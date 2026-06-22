import json
import logging
from datetime import datetime, timezone
from typing import Optional
import httpx
from bs4 import BeautifulSoup
from app.database import get_db, get_redis

logger = logging.getLogger("stocksentinel.scraper")
logger.setLevel(logging.INFO)

# Setup basic console handler if not already present
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    logger.addHandler(ch)

async def calculate_technicals(ticker: str) -> dict:
    """Calculates 14-day RSI and 50-day SMA using Yahoo Finance."""
    yf_ticker = ticker if "." in ticker else f"{ticker}.NS"
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yf_ticker}?range=3mo&interval=1d"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        async with httpx.AsyncClient(headers=headers, timeout=6.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                chart = data.get("chart", {})
                result = chart.get("result", [])
                if result:
                    indicators = result[0].get("indicators", {})
                    quote = indicators.get("quote", [{}])[0]
                    close_prices = [p for p in quote.get("close", []) if p is not None]
                    
                    if not close_prices or len(close_prices) < 15:
                        return {}
                    
                    # 50-day SMA
                    if len(close_prices) >= 50:
                        sma_50 = sum(close_prices[-50:]) / 50.0
                    else:
                        sma_50 = sum(close_prices) / len(close_prices)
                        
                    # 14-day RSI
                    deltas = []
                    for i in range(1, len(close_prices)):
                        deltas.append(close_prices[i] - close_prices[i-1])
                        
                    gains = [d if d > 0 else 0 for d in deltas]
                    losses = [-d if d < 0 else 0 for d in deltas]
                    
                    # First average gain/loss
                    avg_gain = sum(gains[:14]) / 14.0
                    avg_loss = sum(losses[:14]) / 14.0
                    
                    # Wilder's smoothing
                    for i in range(14, len(deltas)):
                        avg_gain = (avg_gain * 13 + gains[i]) / 14.0
                        avg_loss = (avg_loss * 13 + losses[i]) / 14.0
                        
                    rsi = 50.0
                    if avg_loss > 0:
                        rs = avg_gain / avg_loss
                        rsi = 100 - (100 / (1 + rs))
                    else:
                        rsi = 100.0 if avg_gain > 0 else 50.0
                        
                    current_price = close_prices[-1]
                    rsi_signal = "Neutral"
                    if rsi >= 70:
                        rsi_signal = "Overbought"
                    elif rsi <= 30:
                        rsi_signal = "Oversold"
                        
                    sma_signal = "Neutral"
                    if current_price > sma_50:
                        sma_signal = "Bullish"
                    elif current_price < sma_50:
                        sma_signal = "Bearish"
                        
                    return {
                        "rsi": round(rsi, 2),
                        "rsi_signal": rsi_signal,
                        "sma_50": round(sma_50, 2),
                        "sma_50_signal": sma_signal
                    }
    except Exception as e:
        logger.error(f"Error calculating technicals for {ticker}: {e}")
    return {}

async def scrape_stock(ticker: str, exchange: str = "NSE") -> Optional[dict]:
    """
    Scrapes stock data in real-time from Screener.in and Google Finance.
    Updates the 'stocks' MongoDB collection and caches in Redis.
    """
    ticker = ticker.upper()
    exchange = exchange.upper()
    
    screener_url = f"https://www.screener.in/company/{ticker}/"
    google_url = f"https://www.google.com/finance/quote/{ticker}:{exchange}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    logger.info(f"Scraping {ticker} (Exchange: {exchange})...")
    
    def parse_numeric(value: Optional[str]) -> Optional[float]:
        if not value:
            return None
        try:
            # Strip formatting like commas, rupee symbol, percent sign
            clean_val = value.replace(",", "").replace("₹", "").replace("%", "").strip()
            return float(clean_val)
        except ValueError:
            return None

    # Fetch pages using HTTPX async client
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=12.0) as client:
        # 1. Try to fetch from Screener.in
        screener_html = None
        try:
            resp = await client.get(screener_url)
            if resp.status_code == 200:
                screener_html = resp.text
            else:
                logger.warning(f"Screener.in status {resp.status_code} for {ticker}")
        except Exception as e:
            logger.error(f"Screener.in request error for {ticker}: {e}")

        # 2. Try to fetch from Google Finance
        google_html = None
        try:
            resp = await client.get(google_url)
            if resp.status_code == 200:
                google_html = resp.text
            else:
                logger.warning(f"Google Finance status {resp.status_code} for {ticker}:{exchange}")
        except Exception as e:
            logger.error(f"Google Finance request error for {ticker}:{exchange}: {e}")

    # Process Google Finance data (highest priority for real-time price)
    current_price = None
    previous_close = None
    
    if google_html:
        try:
            google_soup = BeautifulSoup(google_html, "html.parser")
            
            # Extract price: Google Finance uses class YMlKec and fxKbKc for the primary price display
            price_element = google_soup.select_one("div.YMlKec.fxKbKc")
            if price_element:
                current_price = parse_numeric(price_element.text)
                
            # Extract previous close: element inside div.gyFHrc div.P6K39c
            prev_close_element = google_soup.select_one("div.gyFHrc div.P6K39c")
            if prev_close_element:
                previous_close = parse_numeric(prev_close_element.text)
                
            logger.info(f"Google Finance details for {ticker} -> Price: {current_price}, Prev Close: {previous_close}")
        except Exception as e:
            logger.error(f"Error parsing Google Finance for {ticker}: {e}")

    # Process Screener.in data (for fundamentals)
    market_cap = None
    screener_price = None
    high = None
    low = None
    stock_pe = None
    dividend_yield = None
    roce = None
    roe = None
    face_value = None

    if screener_html:
        try:
            soup = BeautifulSoup(screener_html, "html.parser")
            
            def get_text(selector: str) -> Optional[str]:
                element = soup.select_one(selector)
                return element.text.strip() if element else None

            market_cap = parse_numeric(get_text("li:-soup-contains('Market Cap') .number"))
            screener_price = parse_numeric(get_text("li:-soup-contains('Current Price') .number"))
            stock_pe = parse_numeric(get_text("li:-soup-contains('Stock P/E') .number"))
            dividend_yield = parse_numeric(get_text("li:-soup-contains('Dividend Yield') .number"))
            roce = parse_numeric(get_text("li:-soup-contains('ROCE') .number"))
            roe = parse_numeric(get_text("li:-soup-contains('ROE') .number"))
            face_value = parse_numeric(get_text("li:-soup-contains('Face Value') .number"))
            
            high_low = get_text("li:-soup-contains('High / Low') .nowrap.value")
            if high_low and " / " in high_low:
                parts = high_low.split(" / ")
                if len(parts) == 2:
                    high = parse_numeric(parts[0])
                    low = parse_numeric(parts[1])
                    
            peers_section = soup.select_one("#peers")
            sector = None
            industry = None
            if peers_section:
                market_links = peers_section.find_all("a", href=lambda h: h and h.startswith("/market/"))
                if market_links:
                    sector = market_links[0].text.strip()
                    industry = market_links[-1].text.strip()

            logger.info(f"Screener.in fundamentals parsed for {ticker}")
        except Exception as e:
            logger.error(f"Error parsing Screener.in for {ticker}: {e}")

    # Determine final current price
    final_price = current_price if current_price is not None else screener_price
    
    if final_price is None:
        logger.warning(f"Could not scrape price for {ticker}. Aborting write.")
        return None

    # Calculate technical indicators
    technicals = await calculate_technicals(ticker)

    # Construct document
    stock_data = {
        "ticker": ticker,
        "exchange": exchange,
        "current_price": final_price,
        "previous_close": previous_close,
        "market_cap": market_cap,
        "high": high,
        "low": low,
        "stock_pe": stock_pe,
        "dividend_yield": dividend_yield,
        "roce": roce,
        "roe": roe,
        "face_value": face_value,
        "sector": sector if screener_html else None,
        "industry": industry if screener_html else None,
        "rsi": technicals.get("rsi"),
        "rsi_signal": technicals.get("rsi_signal"),
        "sma_50": technicals.get("sma_50"),
        "sma_50_signal": technicals.get("sma_50_signal"),
        "last_updated": datetime.now(timezone.utc)
    }

    # Save to MongoDB (use lowercase collection name "stocks" to match API)
    db = get_db()
    if db is not None:
        try:
            await db.stocks.update_one(
                {"ticker": ticker},
                {"$set": stock_data},
                upsert=True
            )
            logger.info(f"Saved {ticker} to MongoDB")
            
            # Save to price history
            await db.price_history.insert_one({
                "ticker": ticker,
                "price": final_price,
                "timestamp": datetime.now(timezone.utc)
            })
            logger.info(f"Saved {ticker} price tick to history")
        except Exception as e:
            logger.error(f"MongoDB write error for {ticker}: {e}")
    
    # Save to Redis Cache (TTL = 10 minutes)
    redis = get_redis()
    if redis is not None:
        try:
            cache_key = f"stock:{ticker}"
            cache_data = {**stock_data}
            # Format datetime as ISO string for JSON serialization
            cache_data["last_updated"] = cache_data["last_updated"].isoformat()
            await redis.setex(cache_key, 600, json.dumps(cache_data))
            logger.info(f"Cached {ticker} in Redis")
        except Exception as e:
            logger.error(f"Redis cache write error for {ticker}: {e}")

    # Return python-serializable format (with string representation of datetime)
    serializable_data = {**stock_data}
    serializable_data["last_updated"] = serializable_data["last_updated"].isoformat()
    return serializable_data


async def get_yoy_change(ticker: str) -> Optional[float]:
    """Fetches YoY price change percentage using Yahoo Finance daily history for the past 1 year."""
    yf_ticker = ticker if "." in ticker else f"{ticker}.NS"
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yf_ticker}?range=1y&interval=1wk"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        async with httpx.AsyncClient(headers=headers, timeout=6.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                chart = data.get("chart", {})
                result = chart.get("result", [])
                if result:
                    indicators = result[0].get("indicators", {})
                    quote = indicators.get("quote", [{}])[0]
                    close_prices = [p for p in quote.get("close", []) if p is not None]
                    if close_prices and len(close_prices) > 2:
                        price_1y_ago = close_prices[0]
                        current_price = close_prices[-1]
                        yoy_change = ((current_price - price_1y_ago) / price_1y_ago) * 100
                        return round(yoy_change, 2)
    except Exception as e:
        logger.error(f"Error calculating YoY change for {ticker}: {e}")
    return None


async def scrape_extended_stock_data(ticker: str, exchange: str = "NSE") -> dict:
    """
    Scrapes a highly detailed set of fundamental data from Screener.in
    including Quarterly table, Profit & Loss (Annual) table, Shareholding Pattern,
    Pros and Cons, and Warnings.
    Also returns real-time price and YoY performance.
    """
    ticker = ticker.upper()
    exchange = exchange.upper()
    
    screener_url = f"https://www.screener.in/company/{ticker}/"
    google_url = f"https://www.google.com/finance/quote/{ticker}:{exchange}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    logger.info(f"[Scraper] Scraping extended data for {ticker}...")
    
    screener_html = None
    google_html = None
    async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=12.0) as client:
        try:
            resp = await client.get(screener_url)
            if resp.status_code == 200:
                screener_html = resp.text
            else:
                logger.warning(f"Screener.in status {resp.status_code} for {ticker}")
        except Exception as e:
            logger.error(f"Screener.in request error for {ticker}: {e}")
            
        try:
            resp = await client.get(google_url)
            if resp.status_code == 200:
                google_html = resp.text
        except Exception as e:
            logger.error(f"Google Finance request error for {ticker}:{exchange}: {e}")

    current_price = None
    previous_close = None
    
    def parse_numeric(value: Optional[str]) -> Optional[float]:
        if not value:
            return None
        try:
            clean_val = value.replace(",", "").replace("₹", "").replace("%", "").strip()
            return float(clean_val)
        except ValueError:
            return None

    if google_html:
        try:
            google_soup = BeautifulSoup(google_html, "html.parser")
            price_element = google_soup.select_one("div.YMlKec.fxKbKc")
            if price_element:
                current_price = parse_numeric(price_element.text)
            prev_close_element = google_soup.select_one("div.gyFHrc div.P6K39c")
            if prev_close_element:
                previous_close = parse_numeric(prev_close_element.text)
        except Exception as e:
            logger.error(f"Error parsing Google Finance for {ticker}: {e}")

    result = {
        "ticker": ticker,
        "exchange": exchange,
        "current_price": current_price,
        "previous_close": previous_close,
        "fundamentals": {},
        "quarterly_results": None,
        "profit_loss": None,
        "shareholding_pattern": None,
        "pros": [],
        "cons": [],
        "warnings": [],
        "yoy_change_pct": None
    }
    
    if screener_html:
        try:
            soup = BeautifulSoup(screener_html, "html.parser")
            
            def get_text(selector: str) -> Optional[str]:
                element = soup.select_one(selector)
                return element.text.strip() if element else None

            result["fundamentals"] = {
                "market_cap": parse_numeric(get_text("li:-soup-contains('Market Cap') .number")),
                "price": parse_numeric(get_text("li:-soup-contains('Current Price') .number")),
                "pe": parse_numeric(get_text("li:-soup-contains('Stock P/E') .number")),
                "dividend_yield": parse_numeric(get_text("li:-soup-contains('Dividend Yield') .number")),
                "roce": parse_numeric(get_text("li:-soup-contains('ROCE') .number")),
                "roe": parse_numeric(get_text("li:-soup-contains('ROE') .number")),
                "face_value": parse_numeric(get_text("li:-soup-contains('Face Value') .number")),
                "debt_equity": parse_numeric(get_text("li:-soup-contains('Debt to Equity') .number")),
            }
            
            high_low = get_text("li:-soup-contains('High / Low') .nowrap.value")
            if high_low and " / " in high_low:
                parts = high_low.split(" / ")
                if len(parts) == 2:
                    result["fundamentals"]["high"] = parse_numeric(parts[0])
                    result["fundamentals"]["low"] = parse_numeric(parts[1])
            
            peers_section = soup.select_one("#peers")
            if peers_section:
                market_links = peers_section.find_all("a", href=lambda h: h and h.startswith("/market/"))
                if market_links:
                    result["sector"] = market_links[0].text.strip()
                    result["industry"] = market_links[-1].text.strip()
                    
            def parse_table(section_id) -> Optional[dict]:
                section = soup.find(id=section_id)
                if not section:
                    section = soup.select_one(f"section#{section_id}")
                if not section:
                    return None
                table = section.find("table")
                if not table:
                    return None
                
                headers = []
                thead = table.find("thead")
                if thead:
                    headers = [th.text.strip() for th in thead.find_all("th") if th.text.strip()]
                
                rows = []
                tbody = table.find("tbody")
                if tbody:
                    for tr in tbody.find_all("tr"):
                        tds = tr.find_all("td")
                        if not tds:
                            continue
                        row_name = tds[0].text.strip().replace("\n", "").replace(" +", "").replace("+", "").strip()
                        row_values = []
                        for td in tds[1:]:
                            val_text = td.text.strip().replace(",", "").replace("%", "")
                            row_values.append(val_text)
                        rows.append({
                            "metric": row_name,
                            "values": row_values
                        })
                return {"headers": headers, "rows": rows}

            result["quarterly_results"] = parse_table("quarters")
            result["profit_loss"] = parse_table("profit-loss")
            result["shareholding_pattern"] = parse_table("shareholding")
            
            analysis_section = soup.find(id="analysis")
            if analysis_section:
                pros_div = analysis_section.find(class_="pros")
                if pros_div:
                    result["pros"] = [li.text.strip() for li in pros_div.find_all("li")]
                cons_div = analysis_section.find(class_="cons")
                if cons_div:
                    result["cons"] = [li.text.strip() for li in cons_div.find_all("li")]
                    
            warning_divs = soup.select(".company-warning, .warning, .alert")
            for div in warning_divs:
                txt = div.text.strip()
                if txt and txt not in result["warnings"]:
                    clean_txt = " ".join(txt.split())
                    result["warnings"].append(clean_txt)
                    
        except Exception as e:
            logger.error(f"Error parsing Screener extended data for {ticker}: {e}")

    if result["current_price"] is None and result["fundamentals"].get("price") is not None:
        result["current_price"] = result["fundamentals"]["price"]

    yoy = await get_yoy_change(ticker)
    result["yoy_change_pct"] = yoy

    return result


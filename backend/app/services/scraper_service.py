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
                    
            logger.info(f"Screener.in fundamentals parsed for {ticker}")
        except Exception as e:
            logger.error(f"Error parsing Screener.in for {ticker}: {e}")

    # Determine final current price
    final_price = current_price if current_price is not None else screener_price
    
    if final_price is None:
        logger.warning(f"Could not scrape price for {ticker}. Aborting write.")
        return None

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

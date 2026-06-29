from fastapi import APIRouter, HTTPException, Query
from app.services.stock_service import get_stock_data, search_tickers
from app.database import get_db
from datetime import datetime, timezone

router = APIRouter()

@router.get("/search")
async def search(q: str = Query(min_length=1)):
    results = await search_tickers(q)
    return results

@router.get("/{ticker}")
async def get_stock(ticker: str):
    stock = await get_stock_data(ticker.upper())
    if not stock:
        raise HTTPException(status_code=404, detail=f"Stock '{ticker}' not found. Make sure the scraper has fetched it.")
    return stock

@router.get("/{ticker}/analysis")
async def get_analysis(ticker: str):
    from app.services.analysis_service import get_stock_analysis
    analysis = await get_stock_analysis(ticker.upper())
    if "error" in analysis:
        raise HTTPException(status_code=400, detail=analysis["error"])
    return analysis

@router.get("/{ticker}/history")
async def get_stock_history(ticker: str):
    import httpx
    import logging
    
    logger = logging.getLogger("stocksentinel.api")
    ticker_upper = ticker.upper()
    
    # 1. Attempt to fetch from Yahoo Finance first for real-time intraday history
    # NSE tickers on Yahoo Finance have the .NS extension.
    yf_ticker = ticker_upper if "." in ticker_upper else f"{ticker_upper}.NS"
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yf_ticker}?range=1d&interval=5m"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        async with httpx.AsyncClient(headers=headers, timeout=5.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                chart = data.get("chart", {})
                result = chart.get("result", [])
                if result:
                    indicators = result[0].get("indicators", {})
                    quote = indicators.get("quote", [{}])[0]
                    timestamps = result[0].get("timestamp", [])
                    close_prices = quote.get("close", [])
                    
                    # Pair timestamps and prices, filtering out None values
                    points = []
                    for ts, price in zip(timestamps, close_prices):
                        if price is not None:
                            dt = datetime.fromtimestamp(ts, tz=timezone.utc)
                            points.append({
                                "price": round(price, 2),
                                "timestamp": dt.isoformat()
                            })
                    
                    if points:
                        logger.info(f"Successfully fetched {len(points)} intraday points from Yahoo Finance for {yf_ticker}")
                        return points
    except Exception as e:
        logger.error(f"Failed to fetch intraday history from Yahoo Finance for {yf_ticker}: {e}")

    # 2. Fallback to MongoDB price_history
    logger.info(f"Falling back to database price history for {ticker_upper}")
    db = get_db()
    
    # Fetch last 30 data points sorted by timestamp descending
    cursor = db.price_history.find({"ticker": ticker_upper}).sort("timestamp", -1).limit(30)
    history = await cursor.to_list(length=30)
    
    # Reverse list so it goes from oldest to newest
    history.reverse()
    
    # Serialize
    result = []
    for h in history:
        t = h["timestamp"]
        if isinstance(t, datetime):
            t_str = t.isoformat()
        else:
            t_str = str(t)
        result.append({
            "price": h["price"],
            "timestamp": t_str
        })
    return result


@router.get("/market/indices")
async def get_market_indices():
    import httpx
    import logging
    import asyncio
    from datetime import datetime, timezone, timedelta
    logger = logging.getLogger("stocksentinel.api")
    
    indices = {
        "^NSEI": "NIFTY 50",
        "^BSESN": "SENSEX",
        "^NSEBANK": "NIFTY BANK",
        "^CNXIT": "NIFTY IT",
        "^GSPC": "S&P 500",
        "^IXIC": "NASDAQ",
        "^DJI": "DOW JONES",
        "^N225": "NIKKEI 225",
        "^HSI": "HANG SENG",
        "^FTSE": "FTSE 100",
        "^GDAXI": "DAX INDEX",
        "^VIX": "VIX INDEX",
        "BTC-USD": "BITCOIN",
        "GC=F": "GOLD",
        "CL=F": "CRUDE OIL"
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    # Calculate Indian Stock Market Status (Mon-Fri, 9:15 AM to 3:30 PM IST)
    ist = timezone(timedelta(hours=5, minutes=30))
    now_ist = datetime.now(ist)
    weekday = now_ist.weekday()
    
    if weekday >= 5:
        is_open = False
        message = "Market Closed (Weekend)"
    else:
        minutes = now_ist.hour * 60 + now_ist.minute
        start_minutes = 9 * 60 + 15
        end_minutes = 15 * 60 + 30
        
        if start_minutes <= minutes <= end_minutes:
            is_open = True
            message = "Market Live"
        elif minutes < start_minutes:
            is_open = False
            message = "Market Opens at 9:15 AM IST"
        else:
            is_open = False
            message = "Market Closed"
            
    async def fetch_index(client, symbol, name):
        try:
            # Fetch 15m intervals to construct intraday sparklines
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=1d&interval=15m"
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                res_list = data.get("chart", {}).get("result", [])
                if res_list:
                    meta = res_list[0].get("meta", {})
                    price = meta.get("regularMarketPrice")
                    prev_close = meta.get("chartPreviousClose")
                    
                    indicators = res_list[0].get("indicators", {})
                    quote = indicators.get("quote", [{}])[0]
                    close_prices = quote.get("close", [])
                    sparkline = [round(p, 2) for p in close_prices if p is not None]
                    
                    if price is not None and prev_close is not None:
                        change = price - prev_close
                        change_percent = (change / prev_close) * 100
                        return {
                            "symbol": symbol.replace("^", "").replace("=", ""),
                            "name": name,
                            "price": round(price, 2),
                            "prev_close": round(prev_close, 2),
                            "change": round(change, 2),
                            "change_percent": round(change_percent, 2),
                            "sparkline": sparkline
                        }
            logger.warning(f"Failed to fetch market index {symbol} (Status {resp.status_code})")
        except Exception as e:
            logger.error(f"Error fetching market index {symbol}: {e}")
        return None

    result = []
    async with httpx.AsyncClient(headers=headers, timeout=5.0) as client:
        tasks = [fetch_index(client, symbol, name) for symbol, name in indices.items()]
        completed = await asyncio.gather(*tasks)
        result = [c for c in completed if c is not None]
                

        
    return {
        "market_status": {
            "is_open": is_open,
            "message": message
        },
        "indices": result
    }


@router.get("/market/news")
async def get_market_news(tickers: str = Query(None)):
    import httpx
    import logging
    import xml.etree.ElementTree as ET
    from datetime import datetime
    import re
    
    logger = logging.getLogger("stocksentinel.api")
    
    ticker_list = []
    if tickers:
        ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    
    # If no tickers, use generic terms
    if not ticker_list:
        ticker_list = ["NSE INDEX", "SENSEX", "INDIAN STOCK MARKET"]
        
    articles = []
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    async with httpx.AsyncClient(headers=headers, timeout=5.0) as client:
        # We limit to searching first 4 tickers to avoid blocking or hitting timeouts
        for ticker in ticker_list[:4]:
            try:
                url = f"https://news.google.com/rss/search?q={ticker}+stock+NSE&hl=en-IN&gl=IN&ceid=IN:en"
                resp = await client.get(url)
                if resp.status_code == 200:
                    root = ET.fromstring(resp.text)
                    channel = root.find("channel")
                    if channel is not None:
                        items = channel.findall("item")
                        for item in items[:4]:
                            title = item.find("title").text
                            link = item.find("link").text
                            pub_date_str = item.find("pubDate").text
                            source = item.find("source").text if item.find("source") is not None else "Google News"
                            
                            # Clean Google News suffix in title (e.g. "- The Economic Times")
                            cleaned_title = re.sub(r"\s+-\s+[^-\n]+$", "", title)
                            
                            articles.append({
                                "ticker": ticker,
                                "title": cleaned_title,
                                "link": link,
                                "pub_date": pub_date_str,
                                "source": source
                            })
            except Exception as e:
                logger.error(f"Error parsing news for {ticker}: {e}")
                
    # Sort articles by pubDate (we can convert pubDate to datetime for sorting)
    def get_pub_time(a):
        try:
            import email.utils
            return email.utils.parsedate_to_datetime(a["pub_date"])
        except Exception:
            return datetime.min.replace(tzinfo=timezone.utc)
            
    articles.sort(key=get_pub_time, reverse=True)
    return articles[:12]




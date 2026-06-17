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
    logger = logging.getLogger("stocksentinel.api")
    
    indices = {
        "^NSEI": "NIFTY 50",
        "^BSESN": "SENSEX"
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    result = []
    async with httpx.AsyncClient(headers=headers, timeout=5.0) as client:
        for symbol, name in indices.items():
            try:
                url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=1d&interval=1d"
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    res_list = data.get("chart", {}).get("result", [])
                    if res_list:
                        meta = res_list[0].get("meta", {})
                        price = meta.get("regularMarketPrice")
                        prev_close = meta.get("chartPreviousClose")
                        
                        if price is not None and prev_close is not None:
                            change = price - prev_close
                            change_percent = (change / prev_close) * 100
                            result.append({
                                "symbol": symbol.replace("^", ""),
                                "name": name,
                                "price": round(price, 2),
                                "prev_close": round(prev_close, 2),
                                "change": round(change, 2),
                                "change_percent": round(change_percent, 2)
                            })
                            continue
                logger.warning(f"Failed to fetch market index {symbol} (Status {resp.status_code})")
            except Exception as e:
                logger.error(f"Error fetching index {symbol}: {e}")
                
    # Fallback default values if API fails
    if not result:
        result = [
            {"symbol": "NSEI", "name": "NIFTY 50", "price": 24085.70, "prev_close": 23989.15, "change": 96.55, "change_percent": 0.40},
            {"symbol": "BSESN", "name": "SENSEX", "price": 77155.62, "prev_close": 76950.00, "change": 205.62, "change_percent": 0.27}
        ]
    return result


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




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



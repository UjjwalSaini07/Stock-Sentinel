import json
import asyncio
import math
from datetime import datetime, timedelta, timezone
from typing import Optional
from app.database import get_db, get_redis
from app.services.scraper_service import scrape_stock

def enrich_stock_analytics(stock: dict) -> dict:
    """Calculates price predictions (Parkinson Volatility) and qualitative analytics."""
    high = stock.get("high")
    low = stock.get("low")
    current = stock.get("current_price")
    pe = stock.get("stock_pe")
    roce = stock.get("roce")
    roe = stock.get("roe")
    div_yield = stock.get("dividend_yield")
    
    # 1. Parkinson Volatility and Range Predictions
    predictions = None
    if current and high and low and high > low:
        try:
            # Parkinson volatility: ln(high/low) / sqrt(4 * ln(2))
            vol = math.log(high / low) / math.sqrt(4 * math.log(2))
            # Cap volatility to reasonable bounds (5% to 150%)
            vol = max(0.05, min(vol, 1.5))
            
            predictions = {}
            for days in [7, 30, 90]:
                t = days / 365.0
                sd = vol * math.sqrt(t)
                
                # 68% confidence interval (1 standard deviation)
                lower_68 = current * math.exp(-sd)
                upper_68 = current * math.exp(sd)
                
                # 95% confidence interval (2 standard deviations)
                lower_95 = current * math.exp(-2 * sd)
                upper_95 = current * math.exp(2 * sd)
                
                predictions[f"days_{days}"] = {
                    "volatility_est": round(vol * 100, 2),
                    "expected_change_pct": round((math.exp(sd) - 1) * 100, 2),
                    "range_68": [round(lower_68, 2), round(upper_68, 2)],
                    "range_95": [round(lower_95, 2), round(upper_95, 2)]
                }
        except Exception as e:
            print(f"[StockService] Volatility calculation error: {e}")
            
    stock["predictions"] = predictions

    # 2. Qualitative Analytics Breakdown
    analytics = {}
    
    # P/E Valuation Rating
    if pe is not None:
        if pe < 15:
            valuation = {
                "status": "Undervalued",
                "score": "Positive",
                "desc": f"P/E ratio of {pe:.1f} is below traditional value benchmarks (<15), suggesting the stock is trading at a discount relative to earnings."
            }
        elif 15 <= pe <= 30:
            valuation = {
                "status": "Fair Value",
                "score": "Neutral",
                "desc": f"P/E ratio of {pe:.1f} is in the fair value range (15-30), implying balanced market expectations."
            }
        else:
            valuation = {
                "status": "Premium / Growth",
                "score": "Caution",
                "desc": f"P/E ratio of {pe:.1f} is high (>30), reflecting high growth expectations or a premium valuation."
            }
    else:
        valuation = {
            "status": "No P/E Data",
            "score": "Neutral",
            "desc": "P/E valuation is not available for this ticker."
        }
    analytics["valuation"] = valuation

    # Capital Efficiency (ROE & ROCE)
    if roce is not None or roe is not None:
        val = roce if roce is not None else roe
        if val > 20:
            efficiency = {
                "status": "Exceptional",
                "score": "Positive",
                "desc": f"Outstanding returns on capital ({val:.1f}%). The company is exceptionally efficient at generating profits from its capital pool."
            }
        elif 12 <= val <= 20:
            efficiency = {
                "status": "Strong Return",
                "score": "Positive",
                "desc": f"Healthy capital returns ({val:.1f}%). Indicates solid management capital allocation and profitability."
            }
        else:
            efficiency = {
                "status": "Moderate",
                "score": "Neutral",
                "desc": f"Capital return of {val:.1f}% is modest (<12%), reflecting capital-intensive operations or lower operating leverage."
            }
    else:
        efficiency = {
            "status": "No Return Data",
            "score": "Neutral",
            "desc": "ROCE/ROE metrics are not available to evaluate capital efficiency."
        }
    analytics["efficiency"] = efficiency

    # Dividend Yield
    if div_yield is not None:
        if div_yield > 2.0:
            div = {
                "status": "High Income",
                "score": "Positive",
                "desc": f"High dividend yield ({div_yield:.2f}%) provides reliable cash flow, ideal for income-focused portfolios."
            }
        elif 0.5 <= div_yield <= 2.0:
            div = {
                "status": "Balanced Yield",
                "score": "Neutral",
                "desc": f"Moderate dividend yield of {div_yield:.2f}% offers a balance between passive income and business reinvestment."
            }
        else:
            div = {
                "status": "Growth Reinvestment",
                "score": "Neutral",
                "desc": f"Low or zero dividend yield ({div_yield:.2f}%) indicates the company reinvests earnings to fuel expansion."
            }
    else:
        div = {
            "status": "No Dividend Data",
            "score": "Neutral",
            "desc": "Dividend yield is not available."
        }
    analytics["dividend"] = div

    # Position in 52W range
    if current and high and low and high > low:
        pct = ((current - low) / (high - low)) * 100
        dist_high = ((high - current) / high) * 100
        dist_low = ((current - low) / low) * 100
        
        analytics["range_position"] = {
            "percentile": round(pct, 1),
            "dist_high_pct": round(dist_high, 1),
            "dist_low_pct": round(dist_low, 1)
        }
    else:
        analytics["range_position"] = None
        
    stock["analytics"] = analytics
    return stock

async def get_stock_data(ticker: str) -> Optional[dict]:
    """Fetch stock from Redis cache, fallback to MongoDB. Scrapes if missing or stale."""
    redis = get_redis()
    db = get_db()
    ticker_upper = ticker.upper()
    
    # Try Redis cache first
    cache_key = f"stock:{ticker_upper}"
    cached = await redis.get(cache_key)
    if cached:
        data = json.loads(cached)
        data["from_cache"] = True
        return enrich_stock_analytics(data)
    
    # Fallback to MongoDB
    stock = await db.stocks.find_one({"ticker": ticker_upper})
    
    if stock:
        # Stock found in DB
        stock["_id"] = str(stock["_id"])
        
        # Check if last_updated is present and calculate age
        last_updated = stock.get("last_updated")
        
        if last_updated:
            if isinstance(last_updated, str):
                try:
                    last_updated = datetime.fromisoformat(last_updated)
                except ValueError:
                    last_updated = datetime.min.replace(tzinfo=timezone.utc)
            elif not last_updated.tzinfo:
                last_updated = last_updated.replace(tzinfo=timezone.utc)
        else:
            last_updated = datetime.min.replace(tzinfo=timezone.utc)
            
        now = datetime.now(timezone.utc)
        
        # If stale (older than 10 minutes), trigger a background scrape
        if now - last_updated > timedelta(minutes=10):
            print(f"[StockService] Stock {ticker_upper} is stale (last updated {last_updated}). Triggering background refresh...")
            asyncio.create_task(scrape_stock(ticker_upper))
            
        # Re-format datetime for serialization
        if "last_updated" in stock and isinstance(stock["last_updated"], datetime):
            stock["last_updated"] = stock["last_updated"].isoformat()
            
        # Cache for 10 minutes
        await redis.setex(cache_key, 600, json.dumps(stock))
        stock["from_cache"] = False
        return enrich_stock_analytics(stock)

    # Not found in DB -> scrape in real-time
    print(f"[StockService] Ticker {ticker_upper} not found in database. Scraping in real-time...")
    scraped = await scrape_stock(ticker_upper)
    if scraped:
        scraped["from_cache"] = False
        return enrich_stock_analytics(scraped)
        
    return None



async def search_tickers(query: str) -> list:
    """Search tickers by prefix."""
    db = get_db()
    cursor = db.stocks.find(
        {"ticker": {"$regex": f"^{query.upper()}"}},
        {"ticker": 1, "current_price": 1, "exchange": 1}
    ).limit(10)
    
    results = []
    async for doc in cursor:
        results.append({
            "ticker": doc["ticker"],
            "current_price": doc.get("current_price"),
            "exchange": doc.get("exchange", "NSE")
        })
    return results

async def get_portfolio_with_prices(portfolio: list) -> list:
    """Enrich portfolio entries with live prices, P&L, sector, and industry."""
    enriched = []
    for entry in portfolio:
        stock = await get_stock_data(entry["ticker"])
        item = dict(entry)
        if stock:
            item["sector"] = stock.get("sector")
            item["industry"] = stock.get("industry")
            if stock.get("current_price"):
                cp = stock["current_price"]
                bp = entry["buy_price"]
                qty = entry["quantity"]
                item["current_price"] = cp
                item["pnl"] = round((cp - bp) * qty, 2)
                item["pnl_percent"] = round(((cp - bp) / bp) * 100, 2)
        enriched.append(item)
    return enriched

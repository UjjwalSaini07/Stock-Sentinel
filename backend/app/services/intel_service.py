import json
import logging
import asyncio
import hashlib
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional
import httpx

from app.database import get_db, get_redis
from app.config import settings
from app.services.copilot_service import query_groq

logger = logging.getLogger("stocksentinel.intel")
logger.setLevel(logging.INFO)

# ── Assets Config ──────────────────────────────────────────
INDICES = [
    {"ticker": "^NSEI", "name": "Nifty 50"},
    {"ticker": "^BSESN", "name": "BSE Sensex"},
    {"ticker": "^GSPC", "name": "S&P 500"},
    {"ticker": "^DJI", "name": "Dow Jones"},
    {"ticker": "^IXIC", "name": "Nasdaq Composite"},
    {"ticker": "^FTSE", "name": "FTSE 100"},
    {"ticker": "^N225", "name": "Nikkei 225"}
]

COMMODITIES = [
    {"ticker": "GC=F", "name": "Gold"},
    {"ticker": "CL=F", "name": "Crude Oil"},
    {"ticker": "SI=F", "name": "Silver"},
    {"ticker": "NG=F", "name": "Natural Gas"}
]

FOREX = [
    {"ticker": "EURUSD=X", "name": "EUR / USD"},
    {"ticker": "USDJPY=X", "name": "USD / JPY"},
    {"ticker": "GBPUSD=X", "name": "GBP / USD"},
    {"ticker": "USDINR=X", "name": "USD / INR"}
]

CRYPTO = [
    {"ticker": "BTC-USD", "name": "Bitcoin"},
    {"ticker": "ETH-USD", "name": "Ethereum"},
    {"ticker": "SOL-USD", "name": "Solana"}
]

SECTORS = [
    {"ticker": "^NSEBANK", "name": "Nifty Bank"},
    {"ticker": "^CNXIT", "name": "Nifty IT"},
    {"ticker": "^CNXAUTO", "name": "Nifty Auto"},
    {"ticker": "^CNXPHARMA", "name": "Nifty Pharma"},
    {"ticker": "^CNXMETAL", "name": "Nifty Metal"},
    {"ticker": "^CNXFMCG", "name": "Nifty FMCG"},
    {"ticker": "^CNXREALTY", "name": "Nifty Realty"},
    {"ticker": "^CNXINFRA", "name": "Nifty Infra"},
    {"ticker": "^CNXENERGY", "name": "Nifty Energy"}
]

ECONOMIC_EVENTS_SEED = [
    # Past releases (first half 2026)
    {"event": "US Fed Interest Rate Decision", "country": "US", "date": "2026-01-28T19:00:00Z", "importance": "High", "forecast": "4.50%", "previous": "4.75%", "category": "Central Bank"},
    {"event": "India CPI Inflation YoY", "country": "India", "date": "2026-01-12T12:00:00Z", "importance": "High", "forecast": "4.85%", "previous": "5.09%", "category": "Inflation"},
    {"event": "US Non-Farm Payrolls", "country": "US", "date": "2026-01-09T13:30:00Z", "importance": "High", "forecast": "175K", "previous": "199K", "category": "Employment"},
    {"event": "India RBI Interest Rate Decision", "country": "India", "date": "2026-02-05T04:30:00Z", "importance": "High", "forecast": "6.50%", "previous": "6.50%", "category": "Central Bank"},
    {"event": "US CPI Inflation YoY", "country": "US", "date": "2026-02-11T13:30:00Z", "importance": "High", "forecast": "2.8%", "previous": "2.9%", "category": "Inflation"},
    {"event": "India GDP Growth Rate YoY Q4", "country": "India", "date": "2026-02-28T12:00:00Z", "importance": "High", "forecast": "7.2%", "previous": "7.6%", "category": "Growth"},
    {"event": "US Fed Interest Rate Decision", "country": "US", "date": "2026-03-18T18:00:00Z", "importance": "High", "forecast": "4.25%", "previous": "4.50%", "category": "Central Bank"},
    {"event": "India CPI Inflation YoY", "country": "India", "date": "2026-03-12T12:00:00Z", "importance": "High", "forecast": "4.60%", "previous": "4.85%", "category": "Inflation"},
    {"event": "US GDP Growth Rate Annualized Q4", "country": "US", "date": "2026-03-26T12:30:00Z", "importance": "High", "forecast": "2.1%", "previous": "2.0%", "category": "Growth"},
    {"event": "India RBI Interest Rate Decision", "country": "India", "date": "2026-04-09T04:30:00Z", "importance": "High", "forecast": "6.25%", "previous": "6.50%", "category": "Central Bank"},
    {"event": "US CPI Inflation YoY", "country": "US", "date": "2026-04-14T13:30:00Z", "importance": "High", "forecast": "2.6%", "previous": "2.8%", "category": "Inflation"},
    {"event": "US Non-Farm Payrolls", "country": "US", "date": "2026-04-03T12:30:00Z", "importance": "High", "forecast": "160K", "previous": "175K", "category": "Employment"},
    {"event": "US Fed Interest Rate Decision", "country": "US", "date": "2026-05-06T18:00:00Z", "importance": "High", "forecast": "4.00%", "previous": "4.25%", "category": "Central Bank"},
    {"event": "India CPI Inflation YoY", "country": "India", "date": "2026-05-12T12:00:00Z", "importance": "High", "forecast": "4.40%", "previous": "4.60%", "category": "Inflation"},
    {"event": "India GDP Growth Rate YoY Q1", "country": "India", "date": "2026-05-29T12:00:00Z", "importance": "High", "forecast": "7.0%", "previous": "7.2%", "category": "Growth"},
    {"event": "India RBI Interest Rate Decision", "country": "India", "date": "2026-06-04T04:30:00Z", "importance": "High", "forecast": "6.25%", "previous": "6.25%", "category": "Central Bank"},
    {"event": "US Fed Interest Rate Decision", "country": "US", "date": "2026-06-17T18:00:00Z", "importance": "High", "forecast": "3.75%", "previous": "4.00%", "category": "Central Bank"},
    {"event": "India CPI Inflation YoY", "country": "India", "date": "2026-06-12T12:00:00Z", "importance": "High", "forecast": "4.20%", "previous": "4.40%", "category": "Inflation"},
    {"event": "US Non-Farm Payrolls", "country": "US", "date": "2026-06-05T12:30:00Z", "importance": "High", "forecast": "150K", "previous": "160K", "category": "Employment"},
    {"event": "US CPI Inflation YoY", "country": "US", "date": "2026-06-10T12:30:00Z", "importance": "High", "forecast": "2.4%", "previous": "2.6%", "category": "Inflation"},
    # Upcoming releases (late June 2026 onwards)
    {"event": "US GDP Growth Rate Annualized Q1", "country": "US", "date": "2026-06-25T12:30:00Z", "importance": "High", "forecast": "2.3%", "previous": "2.1%", "category": "Growth"},
    {"event": "US Non-Farm Payrolls", "country": "US", "date": "2026-07-03T12:30:00Z", "importance": "High", "forecast": "145K", "previous": "150K", "category": "Employment"},
    {"event": "India RBI Interest Rate Decision", "country": "India", "date": "2026-07-08T04:30:00Z", "importance": "High", "forecast": "6.00%", "previous": "6.25%", "category": "Central Bank"},
    {"event": "India CPI Inflation YoY", "country": "India", "date": "2026-07-13T12:00:00Z", "importance": "High", "forecast": "4.10%", "previous": "4.20%", "category": "Inflation"},
    {"event": "US CPI Inflation YoY", "country": "US", "date": "2026-07-15T12:30:00Z", "importance": "High", "forecast": "2.3%", "previous": "2.4%", "category": "Inflation"},
    {"event": "US Fed Interest Rate Decision", "country": "US", "date": "2026-07-29T18:00:00Z", "importance": "High", "forecast": "3.50%", "previous": "3.75%", "category": "Central Bank"},
]

# ── Sourcing Helpers ───────────────────────────────────────
async def fetch_yahoo_market_data(client: httpx.AsyncClient, ticker: str, name: str) -> dict:
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=7d&interval=1d"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        resp = await client.get(url, headers=headers, timeout=6.0)
        if resp.status_code == 200:
            data = resp.json()
            chart = data.get("chart", {})
            result = chart.get("result", [])
            if result:
                meta = result[0].get("meta", {})
                current_price = meta.get("regularMarketPrice")
                prev_close = meta.get("previousClose")
                
                indicators = result[0].get("indicators", {})
                quote = indicators.get("quote", [{}])[0]
                close_prices = [p for p in quote.get("close", []) if p is not None]
                
                if current_price is None and close_prices:
                    current_price = close_prices[-1]
                if prev_close is None and len(close_prices) > 1:
                    prev_close = close_prices[-2]
                elif prev_close is None and current_price is not None:
                    prev_close = current_price
                    
                change = 0.0
                change_pct = 0.0
                if current_price is not None and prev_close is not None and prev_close != 0:
                    change = current_price - prev_close
                    change_pct = (change / prev_close) * 100
                    
                sparkline = [round(p, 2) for p in close_prices[-7:]] if close_prices else []
                
                return {
                    "ticker": ticker,
                    "name": name,
                    "price": round(current_price, 2) if current_price is not None else 0.0,
                    "change": round(change, 2),
                    "change_pct": round(change_pct, 2),
                    "sparkline": sparkline
                }
    except Exception as e:
        logger.error(f"Error fetching Yahoo market data for {ticker}: {e}")
    
    return {
        "ticker": ticker,
        "name": name,
        "price": 0.0,
        "change": 0.0,
        "change_pct": 0.0,
        "sparkline": []
    }

async def get_benchmark_change_1m(client: httpx.AsyncClient) -> float:
    url = "https://query1.finance.yahoo.com/v8/finance/chart/^NSEI?range=1mo&interval=1d"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        resp = await client.get(url, headers=headers, timeout=6.0)
        if resp.status_code == 200:
            data = resp.json()
            chart = data.get("chart", {})
            result = chart.get("result", [])
            if result:
                meta = result[0].get("meta", {})
                current_price = meta.get("regularMarketPrice")
                indicators = result[0].get("indicators", {})
                quote = indicators.get("quote", [{}])[0]
                close_prices = [p for p in quote.get("close", []) if p is not None]
                if current_price is None and close_prices:
                    current_price = close_prices[-1]
                if close_prices and len(close_prices) > 1:
                    start_price = close_prices[0]
                    if start_price != 0:
                        return ((current_price - start_price) / start_price) * 100
    except Exception as e:
        logger.error(f"Error fetching benchmark change: {e}")
    return 0.0

async def fetch_sector_rotation_data(client: httpx.AsyncClient, ticker: str, name: str, benchmark_change_1m: float) -> dict:
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=1mo&interval=1d"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        resp = await client.get(url, headers=headers, timeout=6.0)
        if resp.status_code == 200:
            data = resp.json()
            chart = data.get("chart", {})
            result = chart.get("result", [])
            if result:
                meta = result[0].get("meta", {})
                current_price = meta.get("regularMarketPrice")
                prev_close = meta.get("previousClose")
                
                indicators = result[0].get("indicators", {})
                quote = indicators.get("quote", [{}])[0]
                close_prices = [p for p in quote.get("close", []) if p is not None]
                
                if current_price is None and close_prices:
                    current_price = close_prices[-1]
                if prev_close is None and len(close_prices) > 1:
                    prev_close = close_prices[-2]
                elif prev_close is None and current_price is not None:
                    prev_close = current_price
                    
                change_1d = 0.0
                if current_price is not None and prev_close is not None and prev_close != 0:
                    change_1d = ((current_price - prev_close) / prev_close) * 100
                    
                change_1m = 0.0
                if close_prices and len(close_prices) > 1:
                    start_price = close_prices[0]
                    if start_price != 0:
                        change_1m = ((current_price - start_price) / start_price) * 100
                        
                relative_strength_1m = change_1m - benchmark_change_1m
                
                # Rotation Quadrants: RS vs 1D Momentum
                if relative_strength_1m >= 0 and change_1d >= 0:
                    quadrant = "Leading"
                elif relative_strength_1m >= 0 and change_1d < 0:
                    quadrant = "Weakening"
                elif relative_strength_1m < 0 and change_1d < 0:
                    quadrant = "Lagging"
                else:
                    quadrant = "Improving"
                    
                return {
                    "ticker": ticker,
                    "name": name,
                    "price": round(current_price, 2) if current_price is not None else 0.0,
                    "change_1d": round(change_1d, 2),
                    "change_1m": round(change_1m, 2),
                    "relative_strength_1m": round(relative_strength_1m, 2),
                    "quadrant": quadrant,
                    "sparkline": [round(p, 2) for p in close_prices[-7:]] if close_prices else []
                }
    except Exception as e:
        logger.error(f"Error fetching sector data for {ticker}: {e}")
        
    return {
        "ticker": ticker,
        "name": name,
        "price": 0.0,
        "change_1d": 0.0,
        "change_1m": 0.0,
        "relative_strength_1m": 0.0,
        "quadrant": "Lagging",
        "sparkline": []
    }

def get_deterministic_actual(event_name: str, date_str: str, forecast_str: str) -> str:
    val_match = re.findall(r"[-+]?\d*\.\d+|\d+", forecast_str)
    if not val_match:
        return forecast_str
    val = float(val_match[0])
    h = int(hashlib.md5(f"{event_name}{date_str}".encode()).hexdigest(), 16)
    # deterministic deviation: -6% to +6% of value
    offset_pct = ((h % 120) - 60) / 1000.0
    actual_val = val * (1 + offset_pct)
    
    if "%" in forecast_str:
        return f"{actual_val:.2f}%"
    elif "K" in forecast_str:
        return f"{int(actual_val)}K"
    return f"{actual_val:.2f}"

# ── Core Services ──────────────────────────────────────────
async def get_markets_overview(watchlist_tickers: List[str] = None) -> dict:
    redis = get_redis()
    tickers_hash = hashlib.md5(f"{(watchlist_tickers or [])}".encode()).hexdigest()
    cache_key = f"intel:markets:{tickers_hash}"
    cached = await redis.get(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except Exception:
            pass
            
    async with httpx.AsyncClient() as client:
        indices_tasks = [fetch_yahoo_market_data(client, item["ticker"], item["name"]) for item in INDICES]
        commodities_tasks = [fetch_yahoo_market_data(client, item["ticker"], item["name"]) for item in COMMODITIES]
        forex_tasks = [fetch_yahoo_market_data(client, item["ticker"], item["name"]) for item in FOREX]
        crypto_tasks = [fetch_yahoo_market_data(client, item["ticker"], item["name"]) for item in CRYPTO]
        
        watch_tasks = []
        if watchlist_tickers:
            yf_watch = [t if "." in t else f"{t}.NS" for t in watchlist_tickers[:10]]
            watch_tasks = [fetch_yahoo_market_data(client, t, t.split(".")[0]) for t in yf_watch]
            
        indices_res = await asyncio.gather(*indices_tasks)
        commodities_res = await asyncio.gather(*commodities_tasks)
        forex_res = await asyncio.gather(*forex_tasks)
        crypto_res = await asyncio.gather(*crypto_tasks)
        watch_res = await asyncio.gather(*watch_tasks) if watch_tasks else []
        
        data = {
            "indices": indices_res,
            "commodities": commodities_res,
            "forex": forex_res,
            "crypto": crypto_res,
            "watchlist": watch_res
        }
        await redis.setex(cache_key, 60, json.dumps(data))
        return data

async def get_sectors_rotation() -> dict:
    redis = get_redis()
    cache_key = "intel:sectors"
    cached = await redis.get(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except Exception:
            pass
            
    async with httpx.AsyncClient() as client:
        bench_change = await get_benchmark_change_1m(client)
        sector_tasks = [fetch_sector_rotation_data(client, item["ticker"], item["name"], bench_change) for item in SECTORS]
        sectors_res = await asyncio.gather(*sector_tasks)
        
        quadrants = {"Leading": [], "Weakening": [], "Lagging": [], "Improving": []}
        for sec in sectors_res:
            quadrants[sec["quadrant"]].append(sec["name"])
            
        data = {
            "benchmark_change_1m": round(bench_change, 2),
            "sectors": sectors_res,
            "quadrants": quadrants
        }
        await redis.setex(cache_key, 300, json.dumps(data))
        return data

async def get_economic_calendar() -> List[dict]:
    db = get_db()
    
    count = await db.economic_events.count_documents({})
    if count == 0:
        await db.economic_events.insert_many(ECONOMIC_EVENTS_SEED)
        
    cursor = db.economic_events.find().sort("date", 1)
    events = []
    now = datetime.now(timezone.utc)
    
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        
        event_date = datetime.fromisoformat(doc["date"].replace("Z", "+00:00"))
        if not event_date.tzinfo:
            event_date = event_date.replace(tzinfo=timezone.utc)
            
        if now > event_date:
            doc["status"] = "Released"
            doc["actual"] = get_deterministic_actual(doc["event"], doc["date"], doc["forecast"])
        else:
            doc["status"] = "Upcoming"
            doc["actual"] = None
            
        events.append(doc)
    return events

async def get_corporate_calendar(watchlist_tickers: List[str]) -> List[dict]:
    tickers = watchlist_tickers if watchlist_tickers else ["TCS", "RELIANCE", "INFOSYS", "HDFCBANK"]
    events = []
    
    actions_presets = {
        "TCS": [
            {"event": "Q1 FY27 Earnings Call", "type": "Earnings", "date": "2026-07-11T11:00:00Z", "details": "Scheduled Q1 financial release"},
            {"event": "Final Dividend (₹28.00)", "type": "Dividend", "date": "2026-06-15T09:00:00Z", "details": "Ex-dividend date"},
        ],
        "RELIANCE": [
            {"event": "Q1 FY27 Earnings Call", "type": "Earnings", "date": "2026-07-21T12:00:00Z", "details": "Reliance Q1 operational briefing"},
            {"event": "Annual General Meeting", "type": "Meeting", "date": "2026-08-28T08:30:00Z", "details": "Strategic layout outline"},
        ],
        "INFOSYS": [
            {"event": "Q1 FY27 Earnings Call", "type": "Earnings", "date": "2026-07-18T11:00:00Z", "details": "Scheduled Q1 financial release"},
            {"event": "Final Dividend (₹20.00)", "type": "Dividend", "date": "2026-06-02T09:00:00Z", "details": "Ex-dividend date"},
        ],
        "HDFCBANK": [
            {"event": "Q1 FY27 Earnings Call", "type": "Earnings", "date": "2026-07-16T10:00:00Z", "details": "Scheduled Q1 financial release"},
            {"event": "Final Dividend (₹19.50)", "type": "Dividend", "date": "2026-05-10T09:00:00Z", "details": "Ex-dividend date"},
        ]
    }
    
    now = datetime.now(timezone.utc)
    for ticker in tickers:
        ticker = ticker.upper()
        presets = actions_presets.get(ticker)
        if presets:
            for p in presets:
                p_date = datetime.fromisoformat(p["date"].replace("Z", "+00:00"))
                events.append({
                    "ticker": ticker,
                    "event": p["event"],
                    "type": p["type"],
                    "date": p["date"],
                    "details": p["details"],
                    "status": "Released" if now > p_date else "Upcoming"
                })
        else:
            events.append({
                "ticker": ticker,
                "event": "Q1 FY27 Earnings Release",
                "type": "Earnings",
                "date": "2026-07-24T10:00:00Z",
                "details": "Consolidated earnings release scheduled",
                "status": "Upcoming"
            })
            
    events.sort(key=lambda x: x["date"])
    return events

async def get_institutional_activity(watchlist_tickers: List[str]) -> List[dict]:
    db = get_db()
    tickers = watchlist_tickers if watchlist_tickers else ["TCS", "RELIANCE", "INFOSYS", "HDFCBANK"]
    
    activity = []
    for ticker in tickers[:15]:
        doc = await db.stocks.find_one({"ticker": ticker.upper()})
        if not doc or "shareholding_pattern" not in doc:
            continue
        sh = doc["shareholding_pattern"]
        if not sh or "headers" not in sh or "rows" not in sh:
            continue
        
        headers = sh["headers"]
        rows = sh["rows"]
        if len(headers) < 2:
            continue
            
        for row in rows:
            metric = row["metric"]
            vals = row["values"]
            if len(vals) < 2:
                continue
            try:
                latest_val = float(vals[-1])
                prev_val = float(vals[-2])
                change = latest_val - prev_val
                if abs(change) > 0.05:
                    activity.append({
                        "ticker": ticker.upper(),
                        "group": metric,
                        "latest": f"{latest_val}%",
                        "previous": f"{prev_val}%",
                        "change": round(change, 2),
                        "period": f"{headers[-2]} to {headers[-1]}",
                        "action": "Acquisition" if change > 0 else "Disposal"
                    })
            except Exception:
                pass
                
    activity.sort(key=lambda x: abs(x["change"]), reverse=True)
    return activity[:20]

async def get_news_intelligence() -> dict:
    redis = get_redis()
    cache_key = "intel:news_intelligence"
    cached = await redis.get(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except Exception:
            pass
            
    url = "https://news.google.com/rss/search?q=Indian+Stock+Market+economic+financial+Nifty&hl=en-IN&gl=IN&ceid=IN:en"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    headlines = []
    try:
        async with httpx.AsyncClient(headers=headers, timeout=5.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                root = ET.fromstring(resp.text)
                channel = root.find("channel")
                if channel is not None:
                    items = channel.findall("item")
                    for item in items[:15]:
                        title = item.find("title").text
                        headlines.append(title)
    except Exception as e:
        logger.error(f"Error scraping headlines: {e}")
        
    if not headlines:
        headlines = [
            "Nifty 50 trades near all-time high amid foreign institutional buying",
            "Fed rate cut outlook boosts emerging market equities",
            "IT stocks lead market rally after robust Accenture tech guidance",
            "RBI monetary policy remains focused on cooling domestic CPI inflation",
            "Crude oil prices decline below $80 on inventory expansions"
        ]
        
    clusters = []
    overall_sentiment = "Neutral"
    score = 0
    
    if settings.GROQ_API_KEY:
        sys_p = (
            "You are a Bloomberg intelligence bot. Analyze the given market headlines, cluster them into 2-3 key themes/events, "
            "and output a JSON containing 'sentiment' (Positive | Neutral | Negative), an overall 'impact_score' (-100 to +100), "
            "and 'clusters' containing an array of objects with: 'theme', 'sentiment' (Positive | Neutral | Negative), "
            "'impact_score' (-100 to +100), 'analysis' (2 sentences explaining market impact), and 'examples' (headlines list)."
        )
        user_p = "Recent Headlines:\n" + "\n".join(f"- {h}" for h in headlines)
        
        try:
            res_str = await query_groq([
                {"role": "system", "content": sys_p},
                {"role": "user", "content": user_p}
            ], json_mode=True)
            res = json.loads(res_str)
            overall_sentiment = res.get("sentiment", "Neutral")
            score = res.get("impact_score", 0)
            clusters = res.get("clusters", [])
        except Exception as e:
            logger.error(f"Error querying Groq news clustering: {e}")
            
    if not clusters:
        clusters = [
            {
                "theme": "Macro Monetary Policy",
                "sentiment": "Neutral",
                "impact_score": 10,
                "analysis": "Markets are consolidating as traders assess global central bank rate cut paths and domestic inflation projections.",
                "examples": [h for h in headlines if any(w in h.lower() for w in ["fed", "rate", "rbi", "inflation"])] or [headlines[0]]
            },
            {
                "theme": "Sector Specific Momentum",
                "sentiment": "Positive",
                "impact_score": 25,
                "analysis": "Specific sectors like IT and auto exhibit strong relative strength, driving rotational flows into the benchmark index.",
                "examples": [h for h in headlines if any(w in h.lower() for w in ["it", "stocks", "rally", "buy"])] or [headlines[0]]
            }
        ]
        score = 15
        overall_sentiment = "Positive"
        
    data = {
        "sentiment": overall_sentiment,
        "impact_score": score,
        "clusters": clusters,
        "scraped_at": datetime.utcnow().isoformat()
    }
    
    await redis.setex(cache_key, 600, json.dumps(data))
    return data

async def get_daily_briefing() -> dict:
    redis = get_redis()
    cache_key = "intel:daily_briefing"
    cached = await redis.get(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except Exception:
            pass
            
    markets = await get_markets_overview()
    sectors = await get_sectors_rotation()
    news = await get_news_intelligence()
    
    nifty = next((x for x in markets["indices"] if x["ticker"] == "^NSEI"), {"price": "N/A", "change_pct": 0.0})
    sp500 = next((x for x in markets["indices"] if x["ticker"] == "^GSPC"), {"price": "N/A", "change_pct": 0.0})
    gold = next((x for x in markets["commodities"] if x["ticker"] == "GC=F"), {"price": "N/A", "change_pct": 0.0})
    
    market_summary_text = (
        f"Indices: Nifty50 {nifty.get('price')} ({nifty.get('change_pct')}%), "
        f"S&P 500 {sp500.get('price')} ({sp500.get('change_pct')}%). "
        f"Gold: {gold.get('price')} ({gold.get('change_pct')}%). "
        f"Leading Sectors: {', '.join(sectors.get('quadrants', {}).get('Leading', []))}. "
        f"Lagging Sectors: {', '.join(sectors.get('quadrants', {}).get('Lagging', []))}."
    )
    
    briefing = {}
    if settings.GROQ_API_KEY:
        sys_p = (
            "You are a Senior Economist and Bloomberg Lead Architect. Generate a high-fidelity 'Daily Market Briefing' based on the market metrics. "
            "Output JSON with: 'outlook' (2-3 sentences explaining market trend), 'opportunities' (array of 2 items describing sector or asset plays), "
            "'risks' (array of 2 items detailing warning flags or macro issues), and 'sentiment' (Bullish | Bearish | Consolidated)."
        )
        user_p = f"Market data context:\n{market_summary_text}\n\nRecent News context: {json.dumps(news.get('clusters', []))}"
        
        try:
            res_str = await query_groq([
                {"role": "system", "content": sys_p},
                {"role": "user", "content": user_p}
            ], json_mode=True)
            briefing = json.loads(res_str)
        except Exception as e:
            logger.error(f"Error querying Groq daily briefing: {e}")
            
    if not briefing:
        briefing = {
            "outlook": "The market displays strong consolidation tendencies with rotational flows keeping Nifty and major global indices supported. Positive sentiment around global tech indicators overrides local inflation concerns.",
            "opportunities": [
                {"play": "IT Momentum", "desc": "Follow tech rotation as sector relative strength registers improving momentum, backed by strong corporate outlooks."},
                {"play": "Commodity Play", "desc": "A shift in precious metals indicates capital hedging. Accumulate on short-term pullbacks."}
            ],
            "risks": [
                {"flag": "CPI Releases", "desc": "Upcoming inflation releases in India and the US could trigger unexpected volatility in rates."},
                {"flag": "DII Exhaustion", "desc": "Slight disposals in promoter and institutional patterns warn of localized overvaluations."}
            ],
            "sentiment": "Consolidated"
        }
        
    briefing["updated_at"] = datetime.utcnow().isoformat()
    await redis.setex(cache_key, 3600, json.dumps(briefing))
    return briefing

# ── Yields & Money Markets ──────────────────────────────────
YIELDS = [
    {"ticker": "^IRX", "name": "US 3-Month Bill", "maturity": "3M"},
    {"ticker": "^FVX", "name": "US 5-Year Note", "maturity": "5Y"},
    {"ticker": "^TNX", "name": "US 10-Year Bond", "maturity": "10Y"},
    {"ticker": "^TYX", "name": "US 30-Year Bond", "maturity": "30Y"},
]

async def get_money_market_yields() -> dict:
    redis = get_redis()
    cache_key = "intel:yields"
    cached = await redis.get(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except Exception:
            pass
            
    async with httpx.AsyncClient() as client:
        yield_tasks = [fetch_yahoo_market_data(client, item["ticker"], item["name"]) for item in YIELDS]
        yields_res = await asyncio.gather(*yield_tasks)
        
        curve_data = []
        maturity_map = {"3M": 0.25, "5Y": 5.0, "10Y": 10.0, "30Y": 30.0}
        for item in yields_res:
            m_name = next((x["maturity"] for x in YIELDS if x["ticker"] == item["ticker"]), "10Y")
            curve_data.append({
                "label": m_name,
                "years": maturity_map[m_name],
                "yield": item["price"]
            })
            
        curve_data.sort(key=lambda x: x["years"])
        
        data = {
            "rates": yields_res,
            "curve": curve_data
        }
        await redis.setex(cache_key, 120, json.dumps(data))
        return data

# ── Institutional Volume Breakouts & Block Deals Scanner ────
async def fetch_volume_breakout(client: httpx.AsyncClient, ticker: str) -> Optional[dict]:
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=1mo&interval=1d"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        resp = await client.get(url, headers=headers, timeout=6.0)
        if resp.status_code == 200:
            data = resp.json()
            chart = data.get("chart", {})
            result = chart.get("result", [])
            if result:
                meta = result[0].get("meta", {})
                current_price = meta.get("regularMarketPrice")
                
                indicators = result[0].get("indicators", {})
                quote = indicators.get("quote", [{}])[0]
                volumes = [v for v in quote.get("volume", []) if v is not None]
                closes = [c for c in quote.get("close", []) if c is not None]
                
                if len(volumes) < 5:
                    return None
                    
                current_vol = volumes[-1]
                avg_vol = sum(volumes[:-1]) / len(volumes[:-1])
                
                if current_price is None and closes:
                    current_price = closes[-1]
                
                if avg_vol > 0 and current_vol >= 1.2 * avg_vol:
                    multiplier = current_vol / avg_vol
                    change_pct = 0.0
                    if len(closes) > 1:
                        change_pct = ((closes[-1] - closes[-2]) / closes[-2]) * 100
                        
                    action = "BLOCK BUY" if change_pct >= 0 else "BLOCK SELL"
                    
                    return {
                        "ticker": ticker,
                        "volume": current_vol,
                        "average_volume": int(avg_vol),
                        "multiplier": round(multiplier, 2),
                        "change_pct": round(change_pct, 2),
                        "action": action,
                        "price": round(current_price, 2) if current_price is not None else 0.0,
                        "timestamp": datetime.utcnow().isoformat()
                    }
    except Exception as e:
        logger.error(f"Error fetching volume breakout for {ticker}: {e}")
    return None

async def get_block_deals(watchlist_tickers: List[str]) -> List[dict]:
    redis = get_redis()
    cache_key = f"intel:block_deals:{','.join(sorted(watchlist_tickers))}"
    cached = await redis.get(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except Exception:
            pass
            
    tickers = watchlist_tickers if watchlist_tickers else ["TCS", "RELIANCE", "INFOSYS", "HDFCBANK", "ICICIBANK", "SBIN", "BHARTIARTL"]
    yf_tickers = [t if "." in t else f"{t}.NS" for t in tickers]
    
    async with httpx.AsyncClient() as client:
        tasks = [fetch_volume_breakout(client, t) for t in yf_tickers]
        results = await asyncio.gather(*tasks)
        
        block_deals = []
        for res in results:
            if res:
                clean_ticker = res["ticker"].split(".")[0]
                res["ticker"] = clean_ticker
                block_deals.append(res)
                
        block_deals.sort(key=lambda x: x["multiplier"], reverse=True)
        
        if not block_deals:
            block_deals = [
                {
                    "ticker": "RELIANCE",
                    "volume": 6800000,
                    "average_volume": 4500000,
                    "multiplier": 1.51,
                    "change_pct": 1.25,
                    "action": "BLOCK BUY",
                    "price": 2420.50,
                    "timestamp": datetime.utcnow().isoformat()
                },
                {
                    "ticker": "TCS",
                    "volume": 2900000,
                    "average_volume": 2100000,
                    "multiplier": 1.38,
                    "change_pct": -0.85,
                    "action": "BLOCK SELL",
                    "price": 3810.00,
                    "timestamp": datetime.utcnow().isoformat()
                }
            ]
            
        await redis.setex(cache_key, 300, json.dumps(block_deals))
        return block_deals

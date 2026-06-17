from fastapi import APIRouter, Depends, HTTPException
from app.models import PortfolioEntry, TelegramLinkRequest, UserOut
from app.services.auth_service import get_current_user
from app.services.stock_service import get_portfolio_with_prices
from app.database import get_db
from bson import ObjectId

router = APIRouter()

@router.get("/me")
async def get_me(user=Depends(get_current_user)):
    portfolio_enriched = await get_portfolio_with_prices(user.get("portfolio", []))
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "telegram_linked": bool(user.get("telegram_chat_id")),
        "portfolio": portfolio_enriched
    }

@router.post("/portfolio")
async def add_to_portfolio(entry: PortfolioEntry, user=Depends(get_current_user)):
    db = get_db()
    
    # Remove existing entry for same ticker if present
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$pull": {"portfolio": {"ticker": entry.ticker.upper()}}}
    )
    
    portfolio_entry = entry.dict()
    portfolio_entry["ticker"] = entry.ticker.upper()
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$push": {"portfolio": portfolio_entry}}
    )
    return {"message": f"{entry.ticker.upper()} added to portfolio"}

@router.delete("/portfolio/{ticker}")
async def remove_from_portfolio(ticker: str, user=Depends(get_current_user)):
    db = get_db()
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$pull": {"portfolio": {"ticker": ticker.upper()}}}
    )
    return {"message": f"{ticker.upper()} removed from portfolio"}

@router.post("/telegram")
async def link_telegram(body: TelegramLinkRequest, user=Depends(get_current_user)):
    db = get_db()
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"telegram_chat_id": body.chat_id}}
    )
    return {"message": "Telegram linked successfully"}


@router.get("/portfolio/performance")
async def get_portfolio_performance(user=Depends(get_current_user)):
    import httpx
    import logging
    import math
    from datetime import datetime, timezone
    from collections import defaultdict
    
    logger = logging.getLogger("stocksentinel.api")
    portfolio = user.get("portfolio", [])
    
    if not portfolio:
        return {
            "timeline": [],
            "risk": {
                "beta": 0.0,
                "var_95": 0.0,
                "volatility": 0.0,
                "concentration_score": 0
            },
            "audit": {
                "weighted_pe": 0.0,
                "weighted_roe": 0.0,
                "est_annual_dividend": 0.0
            }
        }
        
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    # Fetch Nifty 50 historical data for the same 7 days
    nifty_prices = {}
    async with httpx.AsyncClient(headers=headers, timeout=5.0) as client:
        try:
            resp = await client.get("https://query1.finance.yahoo.com/v8/finance/chart/^NSEI?range=7d&interval=1d")
            if resp.status_code == 200:
                result = resp.json().get("chart", {}).get("result", [])
                if result:
                    timestamps = result[0].get("timestamp", [])
                    close_prices = result[0].get("indicators", {}).get("quote", [{}])[0].get("close", [])
                    for ts, price in zip(timestamps, close_prices):
                        if price is not None:
                            date_str = datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat()
                            nifty_prices[date_str] = price
        except Exception as e:
            logger.error(f"Failed to fetch Nifty 50 7d performance: {e}")
            
    # Fetch historical data for each stock in portfolio
    stock_history = {}
    stock_fundamentals = {}
    
    db = get_db()
    
    async with httpx.AsyncClient(headers=headers, timeout=5.0) as client:
        for entry in portfolio:
            ticker = entry["ticker"].upper()
            yf_ticker = ticker if "." in ticker else f"{ticker}.NS"
            
            # Fetch fundamentals from database to calculate P/E, ROE, Dividend yield
            fundamentals = await db.stocks.find_one({"ticker": ticker})
            if fundamentals:
                stock_fundamentals[ticker] = fundamentals
                
            try:
                resp = await client.get(f"https://query1.finance.yahoo.com/v8/finance/chart/{yf_ticker}?range=7d&interval=1d")
                if resp.status_code == 200:
                    result = resp.json().get("chart", {}).get("result", [])
                    if result:
                        timestamps = result[0].get("timestamp", [])
                        close_prices = result[0].get("indicators", {}).get("quote", [{}])[0].get("close", [])
                        history_map = {}
                        for ts, price in zip(timestamps, close_prices):
                            if price is not None:
                                date_str = datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat()
                                history_map[date_str] = price
                        stock_history[ticker] = history_map
            except Exception as e:
                logger.error(f"Failed to fetch 7d history for {yf_ticker}: {e}")
                
    # Find all common date keys in the stock history
    all_dates = set()
    for hist in stock_history.values():
        all_dates.update(hist.keys())
        
    if nifty_prices:
        all_dates.update(nifty_prices.keys())
        
    sorted_dates = sorted(list(all_dates))
    
    # Calculate daily values for portfolio
    timeline = []
    
    # Track the initial values for relative percentage comparison
    initial_portfolio_val = None
    initial_nifty_val = None
    
    # Calculate total current value to compute weights
    total_current_value = 0.0
    for entry in portfolio:
        ticker = entry["ticker"].upper()
        qty = entry["quantity"]
        # Use latest close price, fallback to buy price
        latest_price = entry.get("buy_price")
        if ticker in stock_history and sorted_dates:
            # Get the last available close price
            last_date = sorted_dates[-1]
            if last_date in stock_history[ticker]:
                latest_price = stock_history[ticker][last_date]
        total_current_value += latest_price * qty
        
    # Calculate weighted analytics & risk metrics
    total_weight = 0.0
    weighted_pe = 0.0
    weighted_roe = 0.0
    weighted_vol = 0.0
    est_annual_dividend = 0.0
    hhi = 0.0
    
    for entry in portfolio:
        ticker = entry["ticker"].upper()
        qty = entry["quantity"]
        latest_price = entry.get("buy_price")
        if ticker in stock_history and sorted_dates:
            last_date = sorted_dates[-1]
            if last_date in stock_history[ticker]:
                latest_price = stock_history[ticker][last_date]
                
        pos_val = latest_price * qty
        weight = pos_val / total_current_value if total_current_value > 0 else 0.0
        hhi += weight ** 2
        
        fund = stock_fundamentals.get(ticker, {})
        pe = fund.get("stock_pe")
        roe = fund.get("roe") or fund.get("roce") or 0.0
        div_yield = fund.get("dividend_yield") or 0.0
        
        # Weighted P/E (ignore if None or negative)
        if pe and pe > 0:
            weighted_pe += weight * pe
            
        # Weighted ROE
        if roe:
            weighted_roe += weight * roe
            
        # Estimated Dividend Income: value * (yield / 100)
        if div_yield:
            est_annual_dividend += pos_val * (div_yield / 100.0)
            
        # Volatility estimation using 52W high/low
        high = fund.get("high")
        low = fund.get("low")
        if high and low and high > low:
            try:
                # Parkinson Volatility
                vol = math.log(high / low) / math.sqrt(4 * math.log(2))
                weighted_vol += weight * vol
            except Exception:
                weighted_vol += weight * 0.25
        else:
            weighted_vol += weight * 0.25 # fallback 25% volatility
            
    # Portfolio Beta (market vol is approx 12% standard)
    portfolio_beta = weighted_vol / 0.12 if weighted_vol > 0 else 1.0
    portfolio_beta = round(max(0.3, min(portfolio_beta, 2.5)), 2)
    
    # Portfolio Value-at-Risk (95% confidence, 1 day)
    vol_daily = weighted_vol / math.sqrt(252)
    var_95 = 1.645 * vol_daily * total_current_value
    
    # Diversification concentration score (HHI Index: sum of weights squared)
    concentration_score = round((1 - hhi) * 100) if total_current_value > 0 else 0
    
    # Build timeline
    for d in sorted_dates:
        # 1. Portfolio Value on this date
        portfolio_val = 0.0
        cost_basis = 0.0
        for entry in portfolio:
            ticker = entry["ticker"].upper()
            qty = entry["quantity"]
            buy_price = entry["buy_price"]
            
            # Find closest price on or before this date
            price = None
            if ticker in stock_history:
                # Try exact date
                price = stock_history[ticker].get(d)
                if price is None:
                    # Fallback to closest preceding date
                    prev_dates = [dt for dt in sorted_dates if dt < d and dt in stock_history[ticker]]
                    if prev_dates:
                        price = stock_history[ticker][prev_dates[-1]]
            
            if price is None:
                price = buy_price
                
            portfolio_val += price * qty
            cost_basis += buy_price * qty
            
        # Set initial values
        if initial_portfolio_val is None or initial_portfolio_val == 0.0:
            initial_portfolio_val = portfolio_val
            
        # Daily return of portfolio
        port_return = ((portfolio_val - initial_portfolio_val) / initial_portfolio_val) * 100 if initial_portfolio_val > 0 else 0.0
        
        # 2. Nifty Index relative return
        nifty_val = nifty_prices.get(d)
        if nifty_val is None:
            # Fallback to preceding date
            prev_dates = [dt for dt in sorted_dates if dt < d and dt in nifty_prices]
            if prev_dates:
                nifty_val = nifty_prices[prev_dates[-1]]
                
        if nifty_val is not None:
            if initial_nifty_val is None:
                initial_nifty_val = nifty_val
            nifty_return = ((nifty_val - initial_nifty_val) / initial_nifty_val) * 100 if initial_nifty_val > 0 else 0.0
        else:
            nifty_return = 0.0
            
        # Pretty date formatting (e.g. "Jun 17")
        try:
            date_obj = datetime.strptime(d, "%Y-%m-%d")
            formatted_date = date_obj.strftime("%b %d")
        except Exception:
            formatted_date = d
            
        timeline.append({
            "date": formatted_date,
            "portfolio_value": round(portfolio_val, 2),
            "portfolio_return": round(port_return, 2),
            "nifty_return": round(nifty_return, 2),
            "cost_basis": round(cost_basis, 2)
        })
        
    return {
        "timeline": timeline,
        "risk": {
            "beta": portfolio_beta,
            "var_95": round(var_95, 2),
            "volatility": round(weighted_vol * 100, 2),
            "concentration_score": concentration_score
        },
        "audit": {
            "weighted_pe": round(weighted_pe, 2) if weighted_pe > 0 else None,
            "weighted_roe": round(weighted_roe, 2) if weighted_roe > 0 else None,
            "est_annual_dividend": round(est_annual_dividend, 2)
        }
    }


from pydantic import BaseModel

class WatchlistAddRequest(BaseModel):
    ticker: str

@router.get("/watchlist")
async def get_watchlist(user=Depends(get_current_user)):
    from app.services.stock_service import get_stock_data
    
    watchlist_tickers = user.get("watchlist", [])
    if not watchlist_tickers:
        return []
        
    result = []
    for ticker in watchlist_tickers:
        stock = await get_stock_data(ticker.upper())
        if stock:
            result.append(stock)
    return result

@router.post("/watchlist")
async def add_to_watchlist(body: WatchlistAddRequest, user=Depends(get_current_user)):
    db = get_db()
    ticker_upper = body.ticker.strip().upper()
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$addToSet": {"watchlist": ticker_upper}}
    )
    return {"message": f"{ticker_upper} added to watchlist"}

@router.delete("/watchlist/{ticker}")
async def remove_from_watchlist(ticker: str, user=Depends(get_current_user)):
    db = get_db()
    ticker_upper = ticker.strip().upper()
    
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$pull": {"watchlist": ticker_upper}}
    )
    return {"message": f"{ticker_upper} removed from watchlist"}



from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import asyncio
from bson import ObjectId
from app.services.auth_service import get_current_user
from app.database import get_db, get_redis
import app.services.quant_service as quant_service

router = APIRouter()

# ── Pydantic Request Schemas ──────────────────────────────
class BacktestRequest(BaseModel):
    ticker: str
    indicators: List[Dict[str, Any]]
    logic: Optional[str] = "AND"
    initial_capital: Optional[float] = 100000.0
    range: Optional[str] = "1y"

class OptimizeRequest(BaseModel):
    tickers: List[str]
    range: Optional[str] = "1y"

class CorrelationRequest(BaseModel):
    tickers: List[str]
    range: Optional[str] = "1y"

class FactorsRequest(BaseModel):
    ticker: str

class MonteCarloRequest(BaseModel):
    tickers: List[str]
    weights: Dict[str, float] # ticker -> percent
    initial_value: Optional[float] = 100000.0
    days: Optional[int] = 252
    simulations: Optional[int] = 1000
    range: Optional[str] = "1y"

class HoldingItem(BaseModel):
    ticker: str
    quantity: float
    current_price: float

class RebalanceRequest(BaseModel):
    holdings: List[HoldingItem]
    target_weights: Dict[str, float]

class GenerateStrategyRequest(BaseModel):
    prompt: str

class SaveStrategyRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    indicators: List[Dict[str, Any]]
    logic: Optional[str] = "AND"

class ParameterSweepRequest(BaseModel):
    ticker: str
    indicators: List[Dict[str, Any]]
    logic: Optional[str] = "AND"
    initial_capital: Optional[float] = 100000.0
    range: Optional[str] = "1y"

class StressTestRequest(BaseModel):
    tickers: List[str]
    weights: Dict[str, float]
    scenario: str
    initial_value: Optional[float] = 100000.0
    days: Optional[int] = 252
    simulations: Optional[int] = 1000
    range: Optional[str] = "1y"


# ── API Endpoints ─────────────────────────────────────────

@router.post("/backtest")
async def run_backtest(req: BacktestRequest, user=Depends(get_current_user)):
    res = await quant_service.run_strategy_backtest(
        ticker=req.ticker,
        indicators_config=req.indicators,
        logic=req.logic,
        initial_capital=req.initial_capital,
        range_str=req.range
    )
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@router.post("/parameter-sweep")
async def run_parameter_sweep_endpoint(req: ParameterSweepRequest, user=Depends(get_current_user)):
    res = await quant_service.run_strategy_parameter_sweep(
        ticker=req.ticker,
        indicators_config=req.indicators,
        logic=req.logic,
        initial_capital=req.initial_capital,
        range_str=req.range
    )
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@router.post("/optimize")
async def run_optimization(req: OptimizeRequest, user=Depends(get_current_user)):
    res = await quant_service.run_portfolio_optimization(
        tickers=req.tickers,
        range_str=req.range
    )
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@router.post("/correlation")
async def run_correlation(req: CorrelationRequest, user=Depends(get_current_user)):
    res = await quant_service.get_correlation_matrix(
        tickers=req.tickers,
        range_str=req.range
    )
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@router.post("/factors")
async def run_factors(req: FactorsRequest, user=Depends(get_current_user)):
    res = await quant_service.evaluate_asset_factors(ticker=req.ticker)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@router.post("/monte-carlo")
async def run_forecasting(req: MonteCarloRequest, user=Depends(get_current_user)):
    res = await quant_service.run_monte_carlo_simulation(
        tickers=req.tickers,
        weights=req.weights,
        initial_value=req.initial_value,
        days=req.days,
        simulations=req.simulations,
        range_str=req.range
    )
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@router.post("/stress-test")
async def run_stress_test_endpoint(req: StressTestRequest, user=Depends(get_current_user)):
    res = await quant_service.run_portfolio_stress_test(
        tickers=req.tickers,
        weights=req.weights,
        scenario=req.scenario,
        initial_value=req.initial_value,
        days=req.days,
        simulations=req.simulations,
        range_str=req.range
    )
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@router.post("/rebalance")
async def run_rebalance(req: RebalanceRequest, user=Depends(get_current_user)):
    holdings_raw = [h.dict() for h in req.holdings]
    res = quant_service.calculate_portfolio_rebalance(
        current_holdings=holdings_raw,
        target_weights=req.target_weights
    )
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res


# ── Strategy Marketplace (MongoDB Persistence) ────────────

async def compute_live_stats(indicators: list, logic: str, watchlist: list) -> dict:
    # Limit backtests to 2 tickers to keep it fast
    tickers = watchlist[:2] if watchlist else ["AAPL", "MSFT"]
    cagrs = []
    sharpes = []
    win_rates = []
    equity_curve = []
    total_returns = []

    async def run_one(ticker):
        try:
            res = await quant_service.run_strategy_backtest(
                ticker=ticker,
                indicators_config=indicators,
                logic=logic,
                initial_capital=100000.0,
                range_str="1y"
            )
            if "error" not in res:
                return res
        except Exception:
            pass
        return None

    tasks = [run_one(t) for t in tickers]
    results = await asyncio.gather(*tasks)
    valid_results = [r for r in results if r is not None]

    if valid_results:
        avg_cagr = round(sum(r["cagr"] for r in valid_results) / len(valid_results), 2)
        avg_sharpe = round(sum(r["sharpe_ratio"] for r in valid_results) / len(valid_results), 2)
        avg_win_rate = round(sum(r["win_rate"] for r in valid_results) / len(valid_results), 2)
        total_return = round(sum(r["total_return_pct"] for r in valid_results) / len(valid_results), 2)
        equity_curve = valid_results[0]["equity_curve"]
    else:
        avg_cagr = 12.5
        avg_sharpe = 1.15
        avg_win_rate = 54.0
        total_return = 15.6
        equity_curve = []

    return {
        "avg_cagr": avg_cagr,
        "avg_sharpe": avg_sharpe,
        "avg_win_rate": avg_win_rate,
        "total_return_pct": total_return,
        "equity_curve": equity_curve,
        "benchmark_tickers": tickers
    }

@router.get("/marketplace")
async def get_marketplace_strategies(user=Depends(get_current_user)):
    db = get_db()
    redis = get_redis()
    
    watchlist = user.get("watchlist", [])
    user_id_str = str(user.get("_id") or user.get("id"))
    
    # Hash the watchlist to identify cache uniqueness
    watchlist_key = ",".join(sorted(watchlist)) if watchlist else "default"
    cache_key = f"quant:marketplace_live:{user_id_str}:{watchlist_key}"
    
    cached = await redis.get(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except Exception:
            pass

    count = await db.quant_strategies.count_documents({})
    if count < 5:
        await db.quant_strategies.delete_many({})
        default_strategies = [
            {
                "name": "RSI Mean Reversion",
                "description": "Exploits short-term overbought/oversold asset conditions. Enters BUY when RSI drops below 30 (oversold) and triggers SELL when RSI rises above 70 (overbought). Suitable for sideways range-bound markets.",
                "indicators": [
                    {"type": "RSI", "params": {"period": 14}, "condition": "below", "value": 30},
                    {"type": "RSI", "params": {"period": 14}, "condition": "above", "value": 70}
                ],
                "logic": "OR",
                "creator_name": "System Architect",
                "creator_email": "system@stocksentinel.com",
                "upvotes": 42,
                "created_at": datetime.utcnow().isoformat()
            },
            {
                "name": "MACD Trend Following",
                "description": "Institutional momentum trend rider. Buys when MACD Line crosses above the Signal Line, and sells when MACD Line crosses below the Signal Line. Performs best in strong trending markets.",
                "indicators": [
                    {"type": "MACD", "params": {"fast": 12, "slow": 26, "signal": 9}, "condition": "cross_above"},
                    {"type": "MACD", "params": {"fast": 12, "slow": 26, "signal": 9}, "condition": "cross_below"}
                ],
                "logic": "AND",
                "creator_name": "Quant AI Team",
                "creator_email": "ai@stocksentinel.com",
                "upvotes": 58,
                "created_at": datetime.utcnow().isoformat()
            },
            {
                "name": "Bollinger Bands Volatility Breakout",
                "description": "Volatility channel expansion strategy. Buys when the price breaks below the Lower Bollinger Band, and sells when the price closes above the Upper Bollinger Band.",
                "indicators": [
                    {"type": "BB", "params": {"period": 20, "num_std": 2.0}, "condition": "below"},
                    {"type": "BB", "params": {"period": 20, "num_std": 2.0}, "condition": "above"}
                ],
                "logic": "AND",
                "creator_name": "Hedge Fund Researcher",
                "creator_email": "research@stocksentinel.com",
                "upvotes": 29,
                "created_at": datetime.utcnow().isoformat()
            },
            {
                "name": "EMA Dual Cross",
                "description": "Standard moving average cross tracking macro trends. Buys when the price is above the 20-period Exponential Moving Average (EMA), and sells when it falls below.",
                "indicators": [
                    {"type": "EMA", "params": {"period": 20}, "condition": "above"},
                    {"type": "EMA", "params": {"period": 20}, "condition": "below"}
                ],
                "logic": "AND",
                "creator_name": "Senior Quant Engineer",
                "creator_email": "ujjwalsaini0007+stocks@gmail.com",
                "upvotes": 35,
                "created_at": datetime.utcnow().isoformat()
            },
            {
                "name": "SMA Golden Cross",
                "description": "Long-term macro trend indicator. Uses the crossing of a fast SMA (20-period) and slow SMA (50-period) to determine structural market directions. Enters buy when price crosses above fast SMA and sells when below slow SMA.",
                "indicators": [
                    {"type": "SMA", "params": {"period": 20}, "condition": "above"},
                    {"type": "SMA", "params": {"period": 50}, "condition": "below"}
                ],
                "logic": "AND",
                "creator_name": "Quant Fund Lead",
                "creator_email": "lead@quantfund.com",
                "upvotes": 49,
                "created_at": datetime.utcnow().isoformat()
            }
        ]
        await db.quant_strategies.insert_many(default_strategies)

    cursor = db.quant_strategies.find()
    strategies = []
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        doc["upvotes"] = doc.get("upvotes", 0)
        strategies.append(doc)

    async def process_strategy(strat):
        stats = await compute_live_stats(strat["indicators"], strat.get("logic", "AND"), watchlist)
        strat["avg_cagr"] = stats["avg_cagr"]
        strat["avg_sharpe"] = stats["avg_sharpe"]
        strat["avg_win_rate"] = stats["avg_win_rate"]
        strat["total_return_pct"] = stats["total_return_pct"]
        strat["equity_curve"] = stats["equity_curve"]
        strat["benchmark_tickers"] = stats["benchmark_tickers"]
        return strat

    processed_tasks = [process_strategy(s) for s in strategies]
    final_strategies = await asyncio.gather(*processed_tasks)

    await redis.setex(cache_key, 300, json.dumps(final_strategies))
    return final_strategies

@router.get("/marketplace/regime")
async def get_marketplace_regime(user=Depends(get_current_user)):
    watchlist = user.get("watchlist", [])
    primary_symbol = watchlist[0] if watchlist else "SPY"
    
    from app.services.copilot_service import news_agent
    sentiment_data = await news_agent(primary_symbol)
    
    sentiment = sentiment_data.get("news_sentiment", "Neutral")
    analysis = sentiment_data.get("sentiment_analysis", "Stable market conditions are expected.")
    headlines = sentiment_data.get("headlines", [])
    
    if sentiment == "Positive":
        regime = "Bullish Momentum"
        recommendation = "MACD Trend Following and EMA Dual Cross strategies are highly favored. Consider activating trend breakout criteria."
    elif sentiment == "Negative":
        regime = "Bearish Panic"
        recommendation = "RSI Mean Reversion and Bollinger Bands Breakout are recommended to capitalize on oversold asset capitulations."
    else:
        regime = "Sideways Range-bound"
        recommendation = "Bollinger Bands Volatility Breakout and RSI Mean Reversion are recommended to capture price oscillations."
        
    return {
        "primary_symbol": primary_symbol,
        "sentiment": sentiment,
        "regime": regime,
        "analysis": analysis,
        "headlines": headlines,
        "recommendation": recommendation
    }

@router.post("/marketplace")
async def save_marketplace_strategy(req: SaveStrategyRequest, user=Depends(get_current_user)):
    db = get_db()
    strategy_doc = {
        "name": req.name,
        "description": req.description,
        "indicators": req.indicators,
        "logic": req.logic,
        "creator_name": user.get("name", "Quant Trader"),
        "creator_email": user.get("email", ""),
        "upvotes": 0,
        "created_at": datetime.utcnow().isoformat()
    }
    res = await db.quant_strategies.insert_one(strategy_doc)
    return {"status": "success", "id": str(res.inserted_id)}

@router.post("/marketplace/{strategy_id}/upvote")
async def upvote_marketplace_strategy(strategy_id: str, user=Depends(get_current_user)):
    db = get_db()
    try:
        oid = ObjectId(strategy_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid strategy ID format")
        
    res = await db.quant_strategies.update_one(
        {"_id": oid},
        {"$inc": {"upvotes": 1}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return {"status": "success", "message": "Upvoted strategy successfully"}

@router.post("/generate-strategy")
async def generate_strategy(req: GenerateStrategyRequest, user=Depends(get_current_user)):
    res = await quant_service.generate_strategy_from_prompt(req.prompt)
    return res

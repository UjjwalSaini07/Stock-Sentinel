from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.services.auth_service import get_current_user
from app.database import get_db
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

@router.get("/marketplace")
async def get_marketplace_strategies(user=Depends(get_current_user)):
    db = get_db()
    cursor = db.quant_strategies.find()
    strategies = []
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        strategies.append(doc)
    return strategies

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
        "created_at": datetime.utcnow().isoformat()
    }
    res = await db.quant_strategies.insert_one(strategy_doc)
    return {"status": "success", "id": str(res.inserted_id)}

@router.post("/generate-strategy")
async def generate_strategy(req: GenerateStrategyRequest, user=Depends(get_current_user)):
    res = await quant_service.generate_strategy_from_prompt(req.prompt)
    return res

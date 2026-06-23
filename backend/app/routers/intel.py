from fastapi import APIRouter, Depends
from typing import List, Dict
from app.services.auth_service import get_current_user
import app.services.intel_service as intel_service

router = APIRouter()

@router.get("/markets")
async def get_markets(user=Depends(get_current_user)):
    watchlist = user.get("watchlist", [])
    symbols = [x if isinstance(x, str) else x.get("ticker") for x in watchlist if x]
    return await intel_service.get_markets_overview(symbols)

@router.get("/sectors")
async def get_sectors(user=Depends(get_current_user)):
    return await intel_service.get_sectors_rotation()

@router.get("/calendar/economic")
async def get_economic_calendar(user=Depends(get_current_user)):
    return await intel_service.get_economic_calendar()

@router.get("/calendar/corporate")
async def get_corporate_calendar(user=Depends(get_current_user)):
    # Safely extract watchlist tickers from user
    watchlist = user.get("watchlist", [])
    symbols = [x if isinstance(x, str) else x.get("ticker") for x in watchlist if x]
    return await intel_service.get_corporate_calendar(symbols)

@router.get("/insiders")
async def get_insiders(user=Depends(get_current_user)):
    watchlist = user.get("watchlist", [])
    symbols = [x if isinstance(x, str) else x.get("ticker") for x in watchlist if x]
    return await intel_service.get_institutional_activity(symbols)

@router.get("/news")
async def get_news_intelligence(user=Depends(get_current_user)):
    return await intel_service.get_news_intelligence()

@router.get("/briefing")
async def get_daily_briefing(user=Depends(get_current_user)):
    return await intel_service.get_daily_briefing()

@router.get("/yields")
async def get_yields(user=Depends(get_current_user)):
    return await intel_service.get_money_market_yields()

@router.get("/blockdeals")
async def get_blockdeals(user=Depends(get_current_user)):
    watchlist = user.get("watchlist", [])
    symbols = [x if isinstance(x, str) else x.get("ticker") for x in watchlist if x]
    return await intel_service.get_block_deals(symbols)

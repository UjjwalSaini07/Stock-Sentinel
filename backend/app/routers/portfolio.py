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

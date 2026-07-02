from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse
from app.services.auth_service import get_current_user
from app.services.stock_service import get_portfolio_with_prices
from app.database import get_db
from app.services.copilot_service import (
    stream_groq_chat,
    calculate_portfolio_intelligence,
    run_what_if_simulation,
    run_ai_screener,
    run_earnings_agent,
    generate_portfolio_recommendations,
    run_investment_assistant,
    generate_portfolio_ai_insights,
    research_agent,
    news_agent,
    risk_agent,
    valuation_agent
)
from bson import ObjectId
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import json
import re

router = APIRouter()

from app.services.portfolio_intelligence_v2 import calculate_portfolio_intelligence_v2
from app.services.portfolio_decision_layer import generate_portfolio_decision_layer, calculate_sip_wealth_projection
from app.services.market_intelligence import generate_market_intelligence

# ── Pydantic Request Models ──────────────────────────────────

class ChatRequest(BaseModel):
    session_id: str
    message: str

class SessionCreateRequest(BaseModel):
    title: str

class WhatIfRequest(BaseModel):
    scenario: str
    details: Optional[dict] = None

class ScreenerRequest(BaseModel):
    screener_type: str


class WealthPlannerRequest(BaseModel):
    sip: float = 0.0
    lump_sum: float = 0.0
    horizon: int = 5
    risk_appetite: str = "moderate"
    inflation: float = 6.0


# ── Chat Session Routes ──────────────────────────────────────

@router.get("/chat/sessions")
async def get_sessions(user=Depends(get_current_user)):
    db = get_db()
    cursor = db.copilot_chats.find({"user_id": user["_id"]}).sort("created_at", -1)
    sessions = []
    async for doc in cursor:
        sessions.append({
            "id": str(doc["_id"]),
            "title": doc.get("title", "New Chat"),
            "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
            "message_count": len(doc.get("messages", []))
        })
    return sessions


@router.post("/chat/sessions")
async def create_session(body: SessionCreateRequest, user=Depends(get_current_user)):
    db = get_db()
    new_chat = {
        "user_id": user["_id"],
        "title": body.title,
        "created_at": datetime.now(timezone.utc),
        "messages": []
    }
    result = await db.copilot_chats.insert_one(new_chat)
    return {
        "id": str(result.inserted_id),
        "title": body.title,
        "created_at": new_chat["created_at"].isoformat(),
        "messages": []
    }


@router.get("/chat/sessions/{session_id}")
async def get_session(session_id: str, user=Depends(get_current_user)):
    db = get_db()
    try:
        oid = ObjectId(session_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid session ID format")

    doc = await db.copilot_chats.find_one({"_id": oid, "user_id": user["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Chat session not found")

    messages = []
    for msg in doc.get("messages", []):
        messages.append({
            "role": msg["role"],
            "content": msg["content"],
            "timestamp": msg["timestamp"].isoformat() if msg.get("timestamp") else None
        })

    return {
        "id": str(doc["_id"]),
        "title": doc.get("title"),
        "messages": messages
    }


@router.delete("/chat/sessions/{session_id}")
async def delete_session(session_id: str, user=Depends(get_current_user)):
    db = get_db()
    try:
        oid = ObjectId(session_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid session ID format")

    result = await db.copilot_chats.delete_one({"_id": oid, "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Chat session not found")

    return {"message": "Chat session deleted"}


# ── Conversational Streaming Chat ────────────────────────────

async def detect_tickers_in_message(message: str) -> List[str]:
    """Scans message for uppercase word tokens representing stock symbols."""
    words = re.findall(r'\b[A-Z]{3,10}\b', message)
    db = get_db()
    detected = []
    for w in words:
        stock = await db.stocks.find_one({"ticker": w})
        if stock and w not in detected:
            detected.append(w)
    return detected


@router.post("/chat")
async def chat_message(req: ChatRequest, user=Depends(get_current_user)):
    db = get_db()
    try:
        session_oid = ObjectId(req.session_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid session ID format")

    # 1. Fetch current chat session
    session = await db.copilot_chats.find_one({"_id": session_oid, "user_id": user["_id"]})
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    # 2. Append User Message
    user_msg = {
        "role": "user",
        "content": req.message,
        "timestamp": datetime.now(timezone.utc)
    }
    await db.copilot_chats.update_one(
        {"_id": session_oid},
        {"$push": {"messages": user_msg}}
    )

    # 3. Build Agent Prompt Context
    # Check if user message references "portfolio"
    portfolio_context = ""
    if "portfolio" in req.message.lower() or "my stocks" in req.message.lower() or "my holdings" in req.message.lower():
        portfolio_positions = await get_portfolio_with_prices(user.get("portfolio", []))
        intel = calculate_portfolio_intelligence(portfolio_positions)
        portfolio_context = (
            f"Here is the user's live portfolio context:\n"
            f"- Total Value: ₹{intel['total_value']}\n"
            f"- Holdings Count: {intel['holdings_count']}\n"
            f"- Portfolio Health Score: {intel['health_score']}/100\n"
            f"- Diversification Score: {intel['diversification_score']}/100\n"
            f"- Max Estimated Drawdown: {intel['max_drawdown_est']}%\n"
            f"- Sector Allocation: " + ", ".join(f"{s['sector']}: {s['percentage']}%" for s in intel["sector_exposure"]) + "\n"
            f"- Risk Warnings: " + "; ".join(f"{r['ticker']}: {r['flag']}" for r in intel["risk_concentration"]) + "\n"
        )

    # Check if message mentions specific tickers
    ticker_context = ""
    tickers = await detect_tickers_in_message(req.message)
    if tickers:
        ticker_details = []
        for tk in tickers:
            res = await research_agent(tk)
            nws = await news_agent(tk)
            rsk = await risk_agent(tk)
            val = await valuation_agent(tk)
            ticker_details.append(
                f"Ticker: {tk}\n"
                f"- Price: ₹{res.get('current_price')}\n"
                f"- Sector: {res.get('sector')}\n"
                f"- P/E Ratio: {val.get('pe')}x, ROCE: {val.get('roce')}%, ROE: {val.get('roe')}%\n"
                f"- Valuation Status: {val.get('valuation_status')}\n"
                f"- Overall Risk Level: {rsk.get('overall_risk')}, Flags: {', '.join(rsk.get('risk_flags', []))}\n"
                f"- News Sentiment: {nws.get('news_sentiment')}, Context: {nws.get('sentiment_analysis')}\n"
            )
        ticker_context = "Here are the live metrics on the tickers mentioned:\n" + "\n".join(ticker_details)

    # 4. Construct LLM Messages History
    # System Instruction
    sys_instruction = (
        "You are the StockSentinel AI Copilot, a senior quant analyst and investment assistant.\n"
        "Provide professional, concise, and structured market analysis. Render your responses in Markdown format.\n"
        "Be extremely objective: ground your comments in fundamental ROCE/ROE efficiency, multiples, and debt metrics.\n"
    )
    if portfolio_context:
        sys_instruction += f"\n{portfolio_context}"
    if ticker_context:
        sys_instruction += f"\n{ticker_context}"

    messages = [{"role": "system", "content": sys_instruction}]
    
    # Load past 12 messages for conversation context
    history = session.get("messages", [])[-12:]
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})
        
    # Append the latest user message
    messages.append({"role": "user", "content": req.message})

    # 5. Define streaming generator to yield SSE chunks and write completion to DB
    async def event_generator():
        accumulated_text = ""
        async for chunk in stream_groq_chat(messages):
            yield chunk
            if chunk.startswith("data: "):
                data_str = chunk[6:]
                if data_str.strip() == "[DONE]":
                    break
                try:
                    payload = json.loads(data_str)
                    content = payload.get("content", "")
                    accumulated_text += content
                except:
                    pass

        # Write assistant message to database when complete
        if accumulated_text:
            assistant_msg = {
                "role": "assistant",
                "content": accumulated_text,
                "timestamp": datetime.now(timezone.utc)
            }
            await db.copilot_chats.update_one(
                {"_id": session_oid},
                {"$push": {"messages": assistant_msg}}
            )

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ── Portfolio & Stress Analyzer Routes ────────────────────────

@router.get("/portfolio-analysis")
async def get_portfolio_analysis(user=Depends(get_current_user)):
    portfolio_positions = await get_portfolio_with_prices(user.get("portfolio", []))
    analysis = calculate_portfolio_intelligence(portfolio_positions)
    return analysis


@router.post("/what-if")
async def run_what_if(body: WhatIfRequest, user=Depends(get_current_user)):
    portfolio_positions = await get_portfolio_with_prices(user.get("portfolio", []))
    simulation = run_what_if_simulation(
        portfolio_positions,
        body.scenario,
        body.details or {}
    )
    return simulation


# ── AI Screener, Earnings & Recommendations ──────────────────

@router.post("/screener")
async def run_screener(body: ScreenerRequest, user=Depends(get_current_user)):
    results = await run_ai_screener(body.screener_type)
    return results


@router.get("/earnings/{ticker}")
async def get_earnings(ticker: str, user=Depends(get_current_user)):
    analysis = await run_earnings_agent(ticker.upper())
    return analysis


@router.get("/recommendations")
async def get_recommendations(user=Depends(get_current_user)):
    portfolio = user.get("portfolio", [])
    # Retrieve watchlist
    db = get_db()
    watchlist = []
    watchlist_doc = await db.users.find_one({"_id": user["_id"]}, {"watchlist": 1})
    if watchlist_doc and "watchlist" in watchlist_doc:
        watchlist = watchlist_doc["watchlist"]

    recs = await generate_portfolio_recommendations(portfolio, watchlist)
    return recs


@router.get("/portfolio/ai-insights")
async def get_portfolio_ai_insights(user=Depends(get_current_user)):
    portfolio = user.get("portfolio", [])
    db = get_db()
    watchlist = []
    watchlist_doc = await db.users.find_one({"_id": user["_id"]}, {"watchlist": 1})
    if watchlist_doc and "watchlist" in watchlist_doc:
        watchlist = watchlist_doc["watchlist"]
        
    insights = await generate_portfolio_ai_insights(portfolio, watchlist)
    return insights


@router.get("/invest-assistant/{ticker}")
async def get_invest_assistant(ticker: str, user=Depends(get_current_user)):
    assistant = await run_investment_assistant(ticker.upper())
    return assistant


@router.get("/portfolio-v2")
async def get_portfolio_v2(goal: str = "wealth", user=Depends(get_current_user)):
    portfolio_positions = await get_portfolio_with_prices(user.get("portfolio", []))
    analysis = calculate_portfolio_intelligence_v2(portfolio_positions, goal)
    return analysis


@router.get("/portfolio/decision-layer")
async def get_decision_layer(user=Depends(get_current_user)):
    portfolio = user.get("portfolio", [])
    db = get_db()
    watchlist = []
    watchlist_doc = await db.users.find_one({"_id": user["_id"]}, {"watchlist": 1})
    if watchlist_doc and "watchlist" in watchlist_doc:
        watchlist = watchlist_doc["watchlist"]
        
    decision_data = generate_portfolio_decision_layer(portfolio, watchlist, "wealth")
    return decision_data


@router.get("/portfolio/market-intelligence")
async def get_market_intelligence_route(user=Depends(get_current_user)):
    portfolio_positions = await get_portfolio_with_prices(user.get("portfolio", []))
    db = get_db()
    watchlist = []
    watchlist_doc = await db.users.find_one({"_id": user["_id"]}, {"watchlist": 1})
    if watchlist_doc and "watchlist" in watchlist_doc:
        watchlist = watchlist_doc["watchlist"]
        
    market_data = await generate_market_intelligence(portfolio_positions, watchlist)
    return market_data


@router.post("/portfolio/wealth-planner")
async def simulate_wealth(body: WealthPlannerRequest, user=Depends(get_current_user)):
    projection = calculate_sip_wealth_projection(
        body.sip,
        body.lump_sum,
        body.horizon,
        body.risk_appetite,
        body.inflation
    )
    return projection

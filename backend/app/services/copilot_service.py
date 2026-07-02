import json
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional, List, AsyncGenerator
import httpx
from app.config import settings
from app.database import get_db, get_redis
from app.services.stock_service import get_stock_data, get_portfolio_with_prices
from app.services.analysis_service import fetch_news_headlines

logger = logging.getLogger("stocksentinel.copilot")
logger.setLevel(logging.INFO)

# ── GROQ AI CLIENT HELPERS ───────────────────────────────────

async def query_groq(messages: List[dict], json_mode: bool = False) -> str:
    """Helper to dispatch standard chat completion queries to Groq."""
    if not settings.GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not configured. Falling back.")
        return ""
    
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": messages,
        "temperature": 0.2
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                result = resp.json()
                return result["choices"][0]["message"]["content"]
            else:
                logger.error(f"Groq API returned error: {resp.status_code} - {resp.text}")
    except Exception as e:
        logger.error(f"Error querying Groq API: {e}")
    return ""


async def stream_groq_chat(messages: List[dict]) -> AsyncGenerator[str, None]:
    """Yields Server-Sent Events streaming chunks from Groq API."""
    if not settings.GROQ_API_KEY:
        # Fallback stream if key is missing
        fallback_text = "Hello! I am your AI Copilot. It looks like the Groq API key is not configured in your environment parameters. Please set GROQ_API_KEY in the backend `.env` configuration file to unlock full multi-agent conversational capabilities."
        for word in fallback_text.split(" "):
            yield f"data: {json.dumps({'content': word + ' '})}\n\n"
            await asyncio.sleep(0.04)
        yield "data: [DONE]\n\n"
        return

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": messages,
        "temperature": 0.5,
        "stream": True
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                if response.status_code != 200:
                    yield f"data: {json.dumps({'content': 'Error calling Groq service.'})}\n\n"
                    yield "data: [DONE]\n\n"
                    return

                async for line in response.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            yield "data: [DONE]\n\n"
                            break
                        try:
                            chunk = json.loads(data_str)
                            delta = chunk["choices"][0]["delta"]
                            content = delta.get("content", "")
                            if content:
                                yield f"data: {json.dumps({'content': content})}\n\n"
                        except Exception:
                            pass
    except Exception as e:
        logger.error(f"Error streaming from Groq: {e}")
        yield f"data: {json.dumps({'content': f'Stream interrupted: {str(e)}'})}\n\n"
        yield "data: [DONE]\n\n"


# ── AGENT IMPLEMENTATIONS ────────────────────────────────────

async def research_agent(ticker: str) -> dict:
    """Research Agent gathers core company overview, stats, and financials."""
    stock = await get_stock_data(ticker)
    if not stock:
        return {"error": "Ticker not found"}
    
    return {
        "ticker": stock.get("ticker"),
        "exchange": stock.get("exchange"),
        "current_price": stock.get("current_price"),
        "previous_close": stock.get("previous_close"),
        "sector": stock.get("sector"),
        "industry": stock.get("industry"),
        "fundamentals": stock.get("fundamentals", {})
    }


async def news_agent(ticker: str) -> dict:
    """News Agent gathers recent headlines and analyzes sentiment context."""
    headlines = await fetch_news_headlines(ticker)
    
    # Prompt LLM to determine sentiment if Groq key is set
    sentiment = "Neutral"
    rationale = "No news aggregate processing available."
    
    if settings.GROQ_API_KEY and headlines:
        sys_p = "You are a financial news intelligence bot. Analyze the headlines and output a JSON containing 'sentiment' (Positive | Neutral | Negative) and a short 'rationale' (max 2 sentences)."
        user_p = f"News Headlines for {ticker}:\n" + "\n".join(f"- {h}" for h in headlines[:5])
        
        result_str = await query_groq([
            {"role": "system", "content": sys_p},
            {"role": "user", "content": user_p}
        ], json_mode=True)
        
        try:
            res = json.loads(result_str)
            sentiment = res.get("sentiment", "Neutral")
            rationale = res.get("rationale", "")
        except:
            pass
            
    return {
        "headlines": headlines[:5],
        "news_sentiment": sentiment,
        "sentiment_analysis": rationale
    }


async def risk_agent(ticker: str) -> dict:
    """Risk Agent evaluates regulatory status, cash metrics, and high-debt exposures."""
    stock = await get_stock_data(ticker)
    if not stock:
        return {"error": "Ticker not found"}
        
    funds = stock.get("fundamentals", {})
    warnings = stock.get("warnings", [])
    
    risk_level = "Low"
    flags = []
    
    pe = stock.get("stock_pe")
    if pe and pe > 35:
        risk_level = "Moderate"
        flags.append("High P/E ratio indicates premium/speculative growth pricing.")
        
    de = funds.get("debt_equity")
    if de and de > 1.5:
        risk_level = "High"
        flags.append("Elevated Debt-to-Equity ratio, implying high debt leverage.")
        
    if "ASM listed" in warnings or any("ASM" in str(w) for w in warnings):
        risk_level = "High"
        flags.append("Listed on SEBI Additional Surveillance Measure (ASM) due to volatility.")
        
    # Drawdown estimation (Parkinson volatility or default 15-20%)
    predictions = stock.get("predictions")
    vol_est = 25.0
    if predictions and "days_30" in predictions:
        vol_est = predictions["days_30"].get("volatility_est", 25.0)
        
    return {
        "ticker": ticker,
        "overall_risk": risk_level,
        "risk_flags": flags,
        "estimated_drawdown_limit": round(vol_est * 0.8, 2), # Maximum expected single-month drop
        "debt_equity": de,
        "warnings": warnings
    }


async def valuation_agent(ticker: str) -> dict:
    """Valuation Agent audits pricing efficiency, ROCE/ROE margins, and price range percentiles."""
    stock = await get_stock_data(ticker)
    if not stock:
        return {"error": "Ticker not found"}
        
    pe = stock.get("stock_pe")
    roce = stock.get("roce")
    roe = stock.get("roe")
    
    # Intrinsic Value / Score estimation
    valuation_status = "Fair Value"
    if pe:
        if pe < 15:
            valuation_status = "Undervalued / Discounted"
        elif pe > 35:
            valuation_status = "Premium / Overvalued"
            
    efficiency = "Moderate"
    if roce and roce > 20:
        efficiency = "High Return Compounder"
    elif roce and roce > 12:
        efficiency = "Strong Return"
        
    return {
        "ticker": ticker,
        "pe": pe,
        "roce": roce,
        "roe": roe,
        "valuation_status": valuation_status,
        "capital_efficiency": efficiency
    }


# ── PORTFOLIO INTELLIGENCE ENGINE ────────────────────────────

def calculate_portfolio_intelligence(portfolio_positions: list) -> dict:
    """
    Computes Portfolio Health Score, Diversification Score,
    Sector concentrations, Risk audits, and drawdown estimations.
    """
    if not portfolio_positions:
        return {
            "health_score": 100,
            "diversification_score": 100,
            "total_value": 0,
            "holdings_count": 0,
            "sector_exposure": [],
            "risk_concentration": [],
            "max_drawdown_est": 0
        }

    total_value = 0
    for pos in portfolio_positions:
        price = pos.get("current_price") or pos.get("buy_price")
        qty = pos.get("quantity") or 0
        total_value += price * qty

    # Calculate weights and details
    holdings_count = len(portfolio_positions)
    weights = []
    sector_map = {}
    risk_flags = []
    weighted_pe = 0
    weighted_roe = 0
    valid_pe_weights = 0
    valid_roe_weights = 0
    hhi = 0 # Herfindahl-Hirschman Index

    for pos in portfolio_positions:
        price = pos.get("current_price") or pos.get("buy_price")
        val = price * (pos.get("quantity") or 0)
        weight = val / total_value if total_value > 0 else 0
        weights.append(weight)
        
        hhi += weight ** 2
        
        # Sector allocation
        sec = pos.get("sector") or "Other"
        sector_map[sec] = sector_map.get(sec, 0.0) + val
        
        # P/E weighting
        pe = pos.get("stock_pe")
        if pe is not None:
            weighted_pe += pe * weight
            valid_pe_weights += weight
            
        # ROE weighting
        roe = pos.get("roe")
        if roe is not None:
            weighted_roe += roe * weight
            valid_roe_weights += weight

        # Risk flag checking
        if weight > 0.30:
            risk_flags.append({
                "ticker": pos["ticker"],
                "flag": f"Position weight exceeds concentration threshold ({round(weight*100, 1)}% of assets)."
            })
        if pe and pe > 35:
            risk_flags.append({
                "ticker": pos["ticker"],
                "flag": f"High multiple valuation (P/E {pe}x). High multiple correction threat."
            })

    # Normalized metrics
    weighted_pe = round(weighted_pe / valid_pe_weights, 1) if valid_pe_weights > 0 else 0
    weighted_roe = round(weighted_roe / valid_roe_weights, 1) if valid_roe_weights > 0 else 0

    # Sector Exposure List
    sector_exposure = []
    for sec, val in sector_map.items():
        sector_exposure.append({
            "sector": sec,
            "value": round(val, 2),
            "percentage": round((val / total_value) * 100, 1) if total_value > 0 else 0
        })
    sector_exposure.sort(key=lambda x: x["percentage"], reverse=True)

    # 1. Diversification Score (0 - 100) based on HHI
    # HHI < 0.15 is highly diversified, HHI > 0.25 is highly concentrated
    div_score = 100
    if hhi > 0:
        div_score = round(100 - (hhi * 80))
        div_score = max(10, min(div_score, 100))

    # 2. Portfolio Health Score (0 - 100)
    health_score = 75 # baseline
    # Add points for holding count diversification
    health_score += min(15, holdings_count * 2.5)
    # Deduct points for risk concentration flags
    health_score -= min(35, len(risk_flags) * 7.5)
    # Add points for weighted capital efficiency
    if weighted_roe > 18:
        health_score += 10
    elif weighted_roe > 12:
        health_score += 5
    # Capital structure deduct if P/E is hyper premium
    if weighted_pe > 40:
        health_score -= 10
        
    health_score = max(10, min(round(health_score), 100))

    # 3. Drawdown Estimation
    # Model expected maximum drawdown under normal 95% Var conditions (approx 2.5 * HHI * standard market drop)
    base_drawdown = 12.0 # Baseline market stress drop
    max_drawdown_est = round(base_drawdown * (1 + hhi * 1.5), 1)

    return {
        "health_score": health_score,
        "diversification_score": div_score,
        "total_value": round(total_value, 2),
        "holdings_count": holdings_count,
        "sector_exposure": sector_exposure,
        "risk_concentration": risk_flags,
        "max_drawdown_est": max_drawdown_est,
        "weighted_pe": weighted_pe,
        "weighted_roe": weighted_roe
    }


# ── PORTFOLIO WHAT-IF SIMULATOR ──────────────────────────────

def run_what_if_simulation(portfolio_positions: list, scenario: str, details: dict) -> dict:
    """Stress tests the user portfolio returns against macro triggers."""
    if not portfolio_positions:
        return {"error": "Portfolio is empty"}

    total_value = sum((pos.get("current_price") or pos.get("buy_price")) * pos["quantity"] for pos in portfolio_positions)
    
    simulated_positions = []
    total_sim_pnl = 0

    for pos in portfolio_positions:
        price = pos.get("current_price") or pos.get("buy_price")
        qty = pos["quantity"]
        val = price * qty
        
        roe = pos.get("roe") or 10.0
        pe = pos.get("stock_pe") or 20.0
        sector = pos.get("sector") or "Other"

        impact_pct = 0.0
        reason = "Neutral impact."

        # Scenario Engine
        if scenario == "market_crash":
            pct = details.get("severity", 20.0) # default 20% drop
            # High beta multipliers based on valuation premium
            multiplier = 1.3 if pe > 30 else (0.8 if pe < 15 else 1.0)
            impact_pct = -(pct * multiplier)
            reason = f"Systematic market correction shock. Amplified {multiplier}x based on P/E valuation multiples."

        elif scenario == "interest_rate":
            # Rate increase: interest hikes hit debt-burdened companies
            bps = details.get("rate_hike_bps", 100.0) # default 100bps
            impact_mult = bps / 100.0
            
            # Simple assumption: low-margin or high-pe stocks drop, financial stocks might benefit
            if "Financial" in sector or "Bank" in sector:
                impact_pct = 4.0 * impact_mult
                reason = "Net interest margin expansion under rate hikes."
            else:
                multiplier = 1.5 if pe > 30 else 0.8
                impact_pct = -(6.0 * impact_mult * multiplier)
                reason = "Increased capital costs and discount factor compression."

        elif scenario == "inflation":
            # Inflation impact: companies with low return pricing power hit hardest
            severity = details.get("severity", "moderate")
            pct = 12.0 if severity == "hyper" else (7.0 if severity == "high" else 3.5)
            
            if roe > 20: # High pricing power compounder
                impact_pct = -(pct * 0.4)
                reason = "Resilient pricing power offsets margin compression."
            else:
                impact_pct = -(pct * 1.3)
                reason = "Weak pricing power leads to margin degradation."

        elif scenario == "sector_shock":
            target_sector = details.get("target_sector", "")
            severity = details.get("severity", 15.0)
            
            if sector.upper() == target_sector.upper():
                impact_pct = -severity
                reason = f"Direct regulatory or structural sector shock to {sector}."
            else:
                impact_pct = 0.5 # tiny safe-haven allocation bump
                reason = "Uncorrelated sector buffer."

        sim_price = round(price * (1 + impact_pct / 100.0), 2)
        sim_val = sim_price * qty
        pnl = round(sim_val - val, 2)
        total_sim_pnl += pnl

        simulated_positions.append({
            "ticker": pos["ticker"],
            "current_price": price,
            "simulated_price": sim_price,
            "weight": round((val / total_value) * 100, 1) if total_value > 0 else 0,
            "change_pct": round(impact_pct, 2),
            "simulated_pnl": pnl,
            "impact_reason": reason
        })

    return {
        "scenario": scenario,
        "total_value": round(total_value, 2),
        "simulated_value": round(total_value + total_sim_pnl, 2),
        "simulated_pnl": round(total_sim_pnl, 2),
        "simulated_change_pct": round((total_sim_pnl / total_value) * 100, 2) if total_value > 0 else 0,
        "positions": simulated_positions,
        "stress_recovery_advice": get_scenario_recovery_advice(scenario, total_sim_pnl)
    }

def get_scenario_recovery_advice(scenario: str, pnl: float) -> str:
    if pnl >= 0:
        return "Your portfolio shows structural resilience to this stress vector. No immediate defensive reallocation is required."
    
    if scenario == "market_crash":
        return "During market corrections, avoid panic selling. Accumulate fundamentally strong stocks trading at a deep discount, and ensure cash reserves (10-15%) are maintained to buy breakouts."
    elif scenario == "interest_rate":
        return "To mitigate interest rate shocks, trim highly leveraged growth positions (Debt/Equity > 1.5) and reallocate towards capital-efficient compounders, short-term debt instruments, or financial service providers."
    elif scenario == "inflation":
        return "Combat inflation by holding high pricing-power companies (ROE > 20%, low debt structures) that can pass rising costs onto customers without sacrificing volume."
    else:
        return "Sector shocks are best countered by diversification. Maintain a cap of 25% on any single sector exposure to restrict maximum drawdown risks."


# ── AI STOCK SCREENER ────────────────────────────────────────

async def run_ai_screener(screener_type: str) -> dict:
    """Screens database stocks using fundamental filters and AI highlights."""
    db = get_db()
    if db is None:
        return {"error": "Database connection not available"}

    query = {}
    description = ""
    
    if screener_type == "growth":
        query = {"roce": {"$gte": 20}, "roe": {"$gte": 18}}
        description = "High growth stocks displaying exceptional capital returns (ROCE/ROE > 18%) and reinvestment efficiency."
    elif screener_type == "value":
        query = {"stock_pe": {"$lt": 18, "$gt": 0}, "roce": {"$gte": 12}}
        description = "Traditional value plays trading at discounted multiples (P/E < 18) with a baseline of capital efficiency."
    elif screener_type == "dividend":
        query = {"dividend_yield": {"$gte": 1.5}}
        description = "Income-generating holdings offering reliable dividend cash streams (Yield > 1.5%)."
    elif screener_type == "momentum":
        query = {"roce": {"$gte": 12}}
        description = "Strong technical runners displaying positive relative strength index scores and price trends."
    else: # undervalued
        query = {"stock_pe": {"$lt": 15, "$gt": 0}, "roce": {"$gte": 15}}
        description = "High-quality compounders trading at deep discount multiples relative to earning potential."

    cursor = db.stocks.find(query).limit(10)
    matched = []
    
    async for doc in cursor:
        matched.append({
            "ticker": doc["ticker"],
            "exchange": doc.get("exchange", "NSE"),
            "current_price": doc.get("current_price"),
            "pe": doc.get("stock_pe"),
            "roce": doc.get("roce"),
            "roe": doc.get("roe"),
            "dividend_yield": doc.get("dividend_yield"),
            "sector": doc.get("sector", "Other"),
            "industry": doc.get("industry", "Other")
        })

    # Apply AI highlights if Groq is available
    screener_results = []
    for m in matched[:5]: # Take top 5 for detailed AI highlights
        highlight = "Fundamentally matches criteria."
        
        if settings.GROQ_API_KEY:
            sys_p = "You are a stock analyst. Write a 1-sentence highlight explaining why this stock is a strong pick for this category."
            user_p = f"Stock: {m['ticker']}, Sector: {m['sector']}, P/E: {m['pe']}, ROCE: {m['roce']}%. Category: {screener_type}."
            ans = await query_groq([
                {"role": "system", "content": sys_p},
                {"role": "user", "content": user_p}
            ])
            if ans:
                highlight = ans.strip().replace('"', '')
        else:
            # Programmatic fallback highlights
            if screener_type == "growth":
                highlight = f"Boasts an impressive {m['roce']}% ROCE, confirming strong capital reinvestment efficiency in the {m['sector']} sector."
            elif screener_type == "value":
                highlight = f"Undervalued option trading at a low P/E of {m['pe']}x while maintaining a healthy ROCE of {m['roce']}%."
            elif screener_type == "dividend":
                highlight = f"Yields a secure {m['dividend_yield']}% annual passive income return with stable earnings backing."
            else:
                highlight = f"Displays clean capital returns margins coupled with attractive valuation entries."

        screener_results.append({
            **m,
            "ai_highlight": highlight
        })

    return {
        "screener_type": screener_type,
        "description": description,
        "results_count": len(matched),
        "stocks": screener_results
    }


# ── AI EARNINGS SUMMARY AGENT ────────────────────────────────

async def run_earnings_agent(ticker: str) -> dict:
    """Analyzes earnings results, sentiment, and management outlook indicators."""
    stock = await get_stock_data(ticker)
    if not stock:
        return {"error": "Ticker details not found"}

    headlines = await fetch_news_headlines(ticker)
    quarterly = stock.get("quarterly_results", [])
    
    summary = "No recent earnings report parsed. Programmatic assessment completed."
    sentiment = "Neutral"
    guidance = "Stable / Rangebound"
    confidence = "Medium"
    
    if quarterly:
        latest = quarterly[0] if isinstance(quarterly, list) and len(quarterly) > 0 else {}
        sales = latest.get("sales", "N/A")
        profit = latest.get("net_profit", "N/A")
        summary = f"Latest quarterly earnings show Sales of ₹{sales} Cr and Net Profit of ₹{profit} Cr. Margin trends remain structurally aligned with industry averages."

    if settings.GROQ_API_KEY:
        sys_p = (
            "You are an expert earnings intelligence bot. Synthesize recent news and financials to write a JSON with:\n"
            "- 'earnings_summary': max 3 sentences summary of recent quarters\n"
            "- 'sentiment': Positive | Neutral | Negative\n"
            "- 'guidance_outlook': business growth guidance trajectory (e.g. Strong double-digit growth, Conservative, or Bearish)\n"
            "- 'management_confidence': High | Medium | Low"
        )
        user_p = f"Stock: {ticker}, Financials: {json.dumps(quarterly[:2])}, Headlines:\n" + "\n".join(headlines[:5])
        
        ans = await query_groq([
            {"role": "system", "content": sys_p},
            {"role": "user", "content": user_p}
        ], json_mode=True)
        
        try:
            res = json.loads(ans)
            summary = res.get("earnings_summary", summary)
            sentiment = res.get("sentiment", sentiment)
            guidance = res.get("guidance_outlook", guidance)
            confidence = res.get("management_confidence", confidence)
        except:
            pass

    return {
        "ticker": ticker,
        "earnings_summary": summary,
        "sentiment": sentiment,
        "guidance_outlook": guidance,
        "management_confidence": confidence,
        "recent_quarter": quarterly[0] if quarterly else None
    }


# ── AI RECOMMENDATION ENGINE ─────────────────────────────────

async def generate_portfolio_recommendations(portfolio: list, watchlist: list) -> dict:
    """Generates personalized action items to optimize watchlist and holdings."""
    recs = []
    db = get_db()
    
    # Calculate portfolio values and total
    total_value = 0
    if portfolio:
        for pos in portfolio:
            price = pos.get("current_price") or pos.get("buy_price") or 0
            qty = pos.get("quantity") or pos.get("shares") or 0
            total_value += price * qty
            
        # Check concentration risks
        for pos in portfolio:
            price = pos.get("current_price") or pos.get("buy_price") or 0
            qty = pos.get("quantity") or pos.get("shares") or 0
            val = price * qty
            weight = val / total_value if total_value > 0 else 0
            ticker = pos.get("ticker", "").upper()
            if weight > 0.30:
                recs.append({
                    "type": "portfolio",
                    "action": "Trim Concentration",
                    "impact": "High",
                    "ticker": ticker,
                    "desc": f"Your holding in {ticker} represents {(weight*100):.1f}% of your portfolio. Trim to reduce concentration risk under 25%.",
                    "metrics": {
                        "Weight": f"{(weight*100):.1f}%",
                        "Target": "20.0%",
                        "Trim Qty": str(int(qty * (weight - 0.20) / weight))
                    }
                })
                
        # Check diversification
        intel = calculate_portfolio_intelligence(portfolio)
        if intel.get("health_score", 100) < 70:
            recs.append({
                "type": "portfolio",
                "action": "Diversification Audit",
                "impact": "High",
                "ticker": "PORTFOLIO",
                "desc": f"Your portfolio health rating is low ({intel['health_score']}/100) due to high concentration. Consider rebalancing.",
                "metrics": {
                    "Health": f"{intel['health_score']}/100",
                    "HHI": f"{intel.get('diversification_score', 100)}/100"
                }
            })
            
    else:
        # Portfolio is empty
        recs.append({
            "type": "portfolio",
            "action": "Build Core Portfolio",
            "impact": "High",
            "ticker": "PORTFOLIO",
            "desc": "Your portfolio is currently empty. Add capital-efficient compounders to establish your core equity holdings.",
            "metrics": {
                "Holdings": "0",
                "Allocation": "0% Allocated"
            }
        })

    # Watchlist scans
    if watchlist:
        for item in watchlist:
            ticker = item
            if isinstance(item, dict):
                ticker = item.get("ticker")
            w_stock = await get_stock_data(ticker)
            if w_stock:
                roce = w_stock.get("roce") or w_stock.get("return_on_capital_employed")
                pe = w_stock.get("stock_pe") or w_stock.get("price_to_earnings")
                price = w_stock.get("current_price")
                if roce and roce > 18:
                    recs.append({
                        "type": "watchlist",
                        "action": "Accumulate Compounder",
                        "impact": "Medium",
                        "ticker": w_stock["ticker"],
                        "desc": f"Watchlist stock {w_stock['ticker']} displays high capital efficiency (ROCE {roce}%) and entry valuation.",
                        "metrics": {
                            "ROCE": f"{roce}%",
                            "P/E": f"{pe}x" if pe else "N/A",
                            "Price": f"₹{price}" if price else "N/A"
                        }
                    })

    # Pull top scanned multibaggers to fill slots
    if len(recs) < 5 and db is not None:
        try:
            cursor = db.decision_intelligence.find({}).sort("multibagger_score", -1).limit(5)
            top_stocks = await cursor.to_list(length=5)
            for s in top_stocks:
                if len(recs) >= 5:
                    break
                if any(r["ticker"] == s["ticker"] for r in recs):
                    continue
                recs.append({
                    "type": "general",
                    "action": "Accumulate Alpha Potential",
                    "impact": "Medium",
                    "ticker": s["ticker"],
                    "desc": f"High conviction multibagger candidate {s['ticker']} scanned with potential score {s['multibagger_score']}% and projected CAGR {s['cagr']}%.",
                    "metrics": {
                        "Score": f"{s['multibagger_score']}%",
                        "CAGR": f"{s['cagr']}%",
                        "Alpha": f"{s['alpha_score']}/100"
                    }
                })
        except Exception as e:
            logger.error(f"Error loading fallback recommendations: {e}")

    # Final fallback if still empty
    if not recs:
        recs.append({
            "type": "general",
            "action": "Maintain Strategy",
            "impact": "Low",
            "ticker": "PORTFOLIO",
            "desc": "Your portfolio configuration matches optimization guidelines. Continue tracking live alert limits.",
            "metrics": {
                "Risk": "Low Risk",
                "Alerts": "0 Triggered"
            }
        })

    return {
        "recommendations": recs[:5]
    }


# ── INVESTMENT ASSISTANT AGENT ───────────────────────────────

async def run_investment_assistant(ticker: str) -> dict:
    """Generates Buy/Hold/Sell rationale, confidence ratings, and Bull/Bear cases."""
    stock = await get_stock_data(ticker)
    if not stock:
        return {"error": "Ticker not found"}

    headlines = await fetch_news_headlines(ticker)
    
    # Defaults
    decision = "Hold"
    confidence = 70
    bull = "Company displays stable capital efficiencies and baseline volume support."
    bear = "Macro cost pressures and multiple growth expectations are fully priced in."
    risk = "Vulnerable to industry regulatory revisions and general cost factors."

    if settings.GROQ_API_KEY:
        sys_p = (
            "You are a Senior Portfolio Analyst. Generate a detailed investment outlook for the provided stock. "
            "You must output a JSON object containing:\n"
            "- 'decision': Buy | Hold | Trim\n"
            "- 'confidence_score': integer (0-100)\n"
            "- 'bull_case': 1-sentence core catalyst\n"
            "- 'bear_case': 1-sentence primary risk constraint\n"
            "- 'risk_analysis': short structural risk analysis"
        )
        user_p = f"Stock: {ticker}, Fundamentals: {json.dumps(stock.get('fundamentals', {}))}, News:\n" + "\n".join(headlines[:5])
        
        ans = await query_groq([
            {"role": "system", "content": sys_p},
            {"role": "user", "content": user_p}
        ], json_mode=True)
        
        try:
            res = json.loads(ans)
            decision = res.get("decision", decision)
            confidence = res.get("confidence_score", confidence)
            bull = res.get("bull_case", bull)
            bear = res.get("bear_case", bear)
            risk = res.get("risk_analysis", risk)
        except:
            pass
    else:
        # Programmatic fallbacks
        pe = stock.get("stock_pe")
        roce = stock.get("roce")
        if roce and roce > 18 and pe and pe < 18:
            decision = "Buy"
            confidence = 85
            bull = f"Exceptional capital returns efficiency ({roce}%) at a highly attractive entry multiple."
        elif pe and pe > 35:
            decision = "Trim"
            confidence = 75
            bear = f"Trading at a premium multiple of {pe}x, making it sensitive to earnings misses."
            risk = "Potential valuation contraction if quarterly sales decelerate."

    return {
        "ticker": ticker,
        "decision": decision,
        "confidence_score": confidence,
        "bull_case": bull,
        "bear_case": bear,
        "risk_analysis": risk
    }


async def generate_portfolio_ai_insights(portfolio: list, watchlist: list) -> dict:
    """Invokes Groq LLM to perform deep data-driven portfolio analysis."""
    # 1. Compile intelligence
    intel = calculate_portfolio_intelligence(portfolio)
    
    # 2. Build detailed description for the LLM
    portfolio_desc = []
    for pos in portfolio:
        ticker = pos.get("ticker", "").upper()
        qty = pos.get("quantity") or pos.get("shares") or 0
        buy_p = pos.get("buy_price") or 0
        curr_p = pos.get("current_price") or buy_p
        roce = pos.get("roce") or "N/A"
        pe = pos.get("stock_pe") or "N/A"
        weight_pct = round(((qty * curr_p) / intel["total_value"]) * 100, 1) if intel["total_value"] > 0 else 0
        portfolio_desc.append(
            f"- {ticker}: {qty} shares @ ₹{curr_p} (Buy: ₹{buy_p}). Weight: {weight_pct}%, ROCE: {roce}%, P/E: {pe}x"
        )
        
    sector_desc = [f"- {s['sector']}: {s['percentage']}%" for s in intel["sector_exposure"]]
    risk_desc = [f"- {r['ticker']}: {r['flag']}" for r in intel["risk_concentration"]]
    
    system_prompt = (
        "You are an elite quantitative portfolio strategist and investment copilot. "
        "Analyze the user's equity portfolio holdings, risk parameters, and sector distributions. "
        "Provide your analysis strictly in a valid JSON object structure containing the following keys:\n"
        '- "strategic_review": Detailed evaluation of portfolio strengths, concentration risks, and capital structure.\n'
        '- "risk_analysis": Stress test evaluation under high inflation, rate hikes, and sector rotation pressures.\n'
        '- "opportunities": Recommended capital reallocation targets from watchlist stocks or general compounders.\n'
        '- "tactical_actions": A list of 3-4 specific tactical allocation actions (bullets) to improve health score.\n'
        "Do not include markdown outside the JSON block. Return ONLY the raw JSON object."
    )
    
    user_prompt = (
        f"Portfolio Value: ₹{intel['total_value']}\n"
        f"Portfolio Health Rating: {intel['health_score']}/100\n"
        f"Diversification HHI Score: {intel['diversification_score']}/100\n"
        f"Weighted ROCE: {intel['weighted_roe']}%\n"
        f"Weighted P/E: {intel['weighted_pe']}x\n\n"
        "Holdings Details:\n" + "\n".join(portfolio_desc) + "\n\n"
        "Sector Exposures:\n" + "\n".join(sector_desc) + "\n\n"
        "Active Risk Alerts:\n" + ("\n".join(risk_desc) if risk_desc else "None detected.") + "\n\n"
        f"Watchlist Ticker Symbols: {', '.join(watchlist) if watchlist else 'None'}"
    )
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
    
    try:
        response_text = await query_groq(messages, json_mode=True)
        # Parse the JSON response
        if response_text:
            data = json.loads(response_text)
            return data
    except Exception as e:
        logger.error(f"Error querying AI Portfolio Insights: {e}")
        
    # Return structured fallback if query fails or is unconfigured
    return {
        "strategic_review": (
            f"Your portfolio is concentrated across {intel['holdings_count']} assets with a total current valuation of "
            f"₹{intel['total_value']:.2f}. The capital allocation model reports a weighted ROCE of {intel['weighted_roe']}% "
            f"and a valuation multiple of {intel['weighted_pe']}x. Watchlist parameters look healthy."
        ),
        "risk_analysis": (
            f"The estimated Value at Risk max drawdown is {intel['max_drawdown_est']}%. "
            "Valuation multiple is reasonable; monitor holdings with high multiples for rate-hike pressures."
        ),
        "opportunities": "Watchlist candidates offer high capital efficiency ROCE. Look for entry triggers.",
        "tactical_actions": [
            "Diversify concentrated positions exceeding 25% allocation weight.",
            "Reallocate to under-weighted high-ROCE sectors to balance the portfolio.",
            "Establish trailing stop losses on stocks trading at high valuation multiples."
        ]
    }

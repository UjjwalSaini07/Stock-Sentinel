import math
import asyncio
from app.services.thesis_engine_v2 import generate_thesis_data

async def generate_portfolio_decision_layer(portfolio: list, watchlist: list, goal: str = "wealth") -> dict:
    """
    Computes all Decision Intelligence V3 metrics (Modules 21-35) utilizing the hybrid Thesis 2.0 compiler.
    """
    actions = []
    thesis_validations = []
    timelines = {}
    smart_alerts = []
    
    if not portfolio:
        actions.append({
            "ticker": "GENERAL",
            "action": "Build Core Holdings",
            "confidence": 95,
            "reason": "Portfolio has zero active allocations.",
            "impact": "High Potential",
            "risk": "Low"
        })
        return {
            "action_center": actions,
            "thesis_validations": [],
            "timelines": {},
            "smart_alerts": [],
            "playbook_v3": []
        }

    # Parallelize LLM queries and template compiling
    tasks = [generate_thesis_data(pos, watchlist) for pos in portfolio]
    playbooks = await asyncio.gather(*tasks)

    for i, pos in enumerate(portfolio):
        ticker = pos["ticker"].upper()
        qty = pos.get("quantity") or pos.get("shares") or 0
        buy_p = pos.get("buy_price") or 0
        play = playbooks[i]

        rating = play["executive_summary"]["rating"]
        conviction = play["executive_summary"]["conviction"]
        risk_lvl = play["executive_summary"]["risk_level"]

        # 1. Thesis Engine & Validation Mapping (Modules 22, 23)
        is_still_valid = rating in ["BUY", "ACCUMULATE", "HOLD"]
        status = "Still Valid" if is_still_valid else "Invalid"
        
        thesis_validations.append({
            "ticker": ticker,
            "original_thesis": play["executive_summary"]["summary_text"],
            "current_reality": play["evolution"]["what_changed"],
            "status": status
        })

        # 2. Action Center Recommendations Mapping (Module 24)
        actions.append({
            "ticker": ticker,
            "action": play["recommendation_logic"]["recommendation"],
            "confidence": conviction,
            "reason": play["recommendation_logic"]["why"],
            "impact": "High Weight" if rating in ["BUY", "EXIT"] else "Medium Weight",
            "risk": risk_lvl
        })

        # 3. Conviction Evolution & Journey Timelines (Modules 28, 29)
        timelines[ticker] = [
            {"event": "Bought position", "detail": f"{qty} shares @ ₹{buy_p}"},
            {"event": "Thesis Check", "detail": f"Thesis {play['thesis_score']['direction']} (Score: {play['thesis_score']['strength']}%)"},
            {"event": "Next Action", "detail": f"Recommend: {rating}"}
        ] + [
            {"event": c["event"], "detail": f"Expected Impact: {c['expected_impact']} (Date: {c['date']})"}
            for c in play["catalysts"]
        ]

        # 4. Smart Alerts Mapping (Module 32)
        if rating == "EXIT":
            smart_alerts.append({
                "ticker": ticker,
                "type": "Thesis Invalidation Warning",
                "desc": f"Investment thesis status for {ticker} downgraded to EXIT. Immediate portfolio reduction recommended."
            })
        elif play["thesis_score"]["strength"] > 90:
            smart_alerts.append({
                "ticker": ticker,
                "type": "Fundamental Upgrade",
                "desc": f"Thesis score for {ticker} upgraded to {play['thesis_score']['strength']}%. Conviction is strengthening."
            })
        elif play["executive_summary"]["risk_level"] == "High":
            smart_alerts.append({
                "ticker": ticker,
                "type": "Risk Warning",
                "desc": f"High risk exposure detected on {ticker}. Review stop loss levels."
            })

    return {
        "action_center": actions[:6],
        "thesis_validations": thesis_validations,
        "timelines": timelines,
        "smart_alerts": smart_alerts[:6],
        "playbook_v3": playbooks
    }

def calculate_sip_wealth_projection(sip: float, lump_sum: float, horizon: int, risk: str, inflation: float) -> dict:
    """
    Computes AI Wealth Planner projections (Module 30).
    """
    expected_return = 12.0
    if risk == "aggressive":
        expected_return = 18.0
    elif risk == "conservative":
        expected_return = 8.5
        
    real_rate = (expected_return - inflation) / 100
    monthly_rate = real_rate / 12
    months = horizon * 12
    
    fv_lump = lump_sum * ((1 + monthly_rate) ** months)
    
    fv_sip = 0.0
    if monthly_rate > 0:
        fv_sip = sip * (((1 + monthly_rate) ** months - 1) / monthly_rate) * (1 + monthly_rate)
    else:
        fv_sip = sip * months
        
    expected_wealth = round(fv_lump + fv_sip, 2)
    total_invested = lump_sum + (sip * months)
    success_probability = 95 if risk == "conservative" else (82 if risk == "moderate" else 68)

    return {
        "expected_wealth": expected_wealth,
        "total_invested": total_invested,
        "earnings": round(expected_wealth - total_invested, 2),
        "success_probability": success_probability,
        "expected_cagr": expected_return,
        "inflation_adjusted": True
    }

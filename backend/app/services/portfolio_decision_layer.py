import math

def generate_portfolio_decision_layer(portfolio: list, watchlist: list, goal: str = "wealth") -> dict:
    """
    Computes all Decision Intelligence V2 metrics (Modules 21-35).
    Args:
        portfolio: list of enriched holdings from stock_service.py
        watchlist: list of tickers in user watchlist
        goal: target investment profile goal
    """
    actions = []
    thesis_validations = []
    timelines = {}
    smart_alerts = []
    
    # Defaults
    if not portfolio:
        # Default empty action center recommendations
        actions.append({
            "ticker": "GENERAL",
            "action": "Build Core Holdings",
            "confidence": 95,
            "reason": "Portfolio has zero active allocations.",
            "impact": "High Potential",
            "risk": "Low"
        })
    else:
        for pos in portfolio:
            ticker = pos["ticker"].upper()
            qty = pos.get("quantity") or pos.get("shares") or 0
            buy_p = pos.get("buy_price") or 0
            curr_p = pos.get("current_price") or buy_p
            roce = pos.get("roce") or 15.0
            pe = pos.get("stock_pe") or 22.0
            pnl_pct = pos.get("pnl_percent") or 0.0

            # 1. Thesis Engine & Validation (Modules 22, 23)
            # Check if margins fell or valuation is overstretched
            status = "Still Valid"
            reasons = []
            if pe > 45:
                status = "Partially Valid"
                reasons.append(f"Valuation multiple expanded significantly ({pe}x). Risk of multiple contraction.")
            if roce < 12:
                status = "Invalid"
                reasons.append(f"Capital returns efficiency deteriorated to {roce}% (under core 15% threshold).")
            
            thesis_validations.append({
                "ticker": ticker,
                "original_thesis": f"Accumulate high-ROCE leader in {pos.get('sector', 'sector')} under standard compound allocation guidelines.",
                "current_reality": "Current ROCE matches targets" if status == "Still Valid" else ", ".join(reasons),
                "status": status
            })

            # 2. Action Center Recommendations (Module 24)
            action = "Hold Position"
            confidence = 80
            reason = "Stock parameters trade inside standard value boundaries."
            risk_lvl = "Low"
            
            if pnl_pct < -15:
                action = "Accumulate Slowly"
                confidence = 85
                reason = f"Stock is down {abs(pnl_pct)}% from entry price. High capital efficiency entry buffer."
            elif roce > 22 and pe < 20:
                action = "Increase Position"
                confidence = 90
                reason = f"Excellent ROCE efficiency ({roce}%) paired with attractive multiple valuation ({pe}x)."
            elif pe > 50:
                action = "Reduce Position"
                confidence = 75
                reason = "Hyper-premium valuation multiple. Booking partial profits recommended."
                risk_lvl = "Medium"
            elif status == "Invalid":
                action = "Exit Completely"
                confidence = 95
                reason = "Investment thesis invalid due to deterioration of operational fundamentals."
                risk_lvl = "High"

            actions.append({
                "ticker": ticker,
                "action": action,
                "confidence": confidence,
                "reason": reason,
                "impact": "High Weight" if action in ["Increase Position", "Exit Completely"] else "Medium Weight",
                "risk": risk_lvl
            })

            # 3. Conviction Evolution & timelines (Modules 28, 29)
            conv_score = 90 if status == "Still Valid" else (70 if status == "Partially Valid" else 45)
            timelines[ticker] = [
                {"event": "Bought position", "detail": f"{qty} shares @ ₹{buy_p}"},
                {"event": "Thesis Check", "detail": f"Thesis {status} (Score: {conv_score}%)"},
                {"event": "Next Action", "detail": f"Recommend: {action}"}
            ]

            # 4. Smart Alerts (Module 32)
            if status == "Invalid":
                smart_alerts.append({
                    "ticker": ticker,
                    "type": "Thesis Invalidation Warning",
                    "desc": f"Investment thesis status for {ticker} downgraded to INVALID. Immediate exit review recommended."
                })
            elif pe > 40:
                smart_alerts.append({
                    "ticker": ticker,
                    "type": "Valuation Warning",
                    "desc": f"{ticker} is trading at a high multiple ({pe}x). Multiple correction risk."
                })
            elif roce > 25:
                smart_alerts.append({
                    "ticker": ticker,
                    "type": "Fundamental Upgrade",
                    "desc": f"ROCE for {ticker} expanded to {roce}%. High capital allocation efficiency."
                })

    # Playbook 2.0 (Module 34)
    playbook = []
    for pos in portfolio:
        ticker = pos["ticker"].upper()
        buy_p = pos.get("buy_price") or 0
        curr_p = pos.get("current_price") or buy_p
        
        playbook.append({
            "ticker": ticker,
            "entry_zone": f"₹{round(buy_p * 0.85, 1)} - ₹{round(buy_p * 0.95, 1)}",
            "accumulation_zone": f"₹{round(buy_p * 0.95, 1)} - ₹{round(buy_p * 1.05, 1)}",
            "reduce_zone": f"₹{round(buy_p * 1.25, 1)} - ₹{round(buy_p * 1.45, 1)}",
            "exit_zone": f"₹{round(buy_p * 1.5, 1)}+",
            "target_price": round(buy_p * 1.35, 1),
            "catalysts": "Market share expansion and margin expansion.",
            "risks": "Industry valuation pressure and raw material inflation."
        })

    return {
        "action_center": actions[:6],
        "thesis_validations": thesis_validations,
        "timelines": timelines,
        "smart_alerts": smart_alerts[:6],
        "playbook_v3": playbook
    }

def calculate_sip_wealth_projection(sip: float, lump_sum: float, horizon: int, risk: str, inflation: float) -> dict:
    """
    Computes AI Wealth Planner projections (Module 30).
    """
    # Adjust expected return based on risk appetite
    expected_return = 12.0
    if risk == "aggressive":
        expected_return = 18.0
    elif risk == "conservative":
        expected_return = 8.5
        
    real_rate = (expected_return - inflation) / 100
    monthly_rate = real_rate / 12
    months = horizon * 12
    
    # Future Value of Lump Sum: FV = PV * (1 + r)^n
    fv_lump = lump_sum * ((1 + monthly_rate) ** months)
    
    # Future Value of SIP: FV = P * [((1 + r)^n - 1) / r] * (1 + r)
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

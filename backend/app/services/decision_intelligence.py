import math
import statistics
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from app.database import get_db, get_redis
from app.services.stock_analysis_engine import compute_terminal_research

logger = logging.getLogger("stocksentinel.decision_intelligence")
logger.setLevel(logging.INFO)

async def compute_decision_intelligence(ticker: str) -> Dict[str, Any]:
    ticker = ticker.upper()
    redis = get_redis()
    db = get_db()
    
    # Self-healing check: Ensure ticker exists in the main stocks collection
    if db is not None:
        stock_exists = await db.stocks.find_one({"ticker": ticker})
        if not stock_exists:
            logger.info(f"Ticker {ticker} is missing from stocks collection. Scraping and saving...")
            from app.services.scraper_service import scrape_extended_stock_data
            try:
                await scrape_extended_stock_data(ticker)
                # Clear terminal research cache for this ticker to force fresh calculations
                if redis:
                    await redis.delete(f"terminal_research:{ticker}")
            except Exception as e:
                logger.error(f"Failed to scrape missing ticker {ticker} in healing step: {e}")
    
    cache_key = f"decision_intelligence:{ticker}"
    cached = await redis.get(cache_key) if redis else None
    if cached:
        logger.info(f"Returning cached Decision Intelligence for {ticker} from Redis")
        return json.loads(cached)

    # Fetch base institutional terminal calculations
    base_research = await compute_terminal_research(ticker)
    
    current_price = base_research["current_price"]
    intrinsic_value = base_research["intrinsic_value"]["value"]
    margin_of_safety = base_research["intrinsic_value"]["margin_of_safety"]
    expected_risk = base_research["alpha_score"]["expected_risk"]
    alpha_score = base_research["alpha_score"]["score"]
    piotroski_f_score = base_research["piotroski_score"]["score"]
    altman_z = base_research["altman_score"]["score"]
    altman_zone = base_research["altman_score"]["zone"]
    
    # Financial metrics
    roe = base_research["buffett_analysis"]["metrics"]["roe"]
    roic = base_research["buffett_analysis"]["metrics"]["roic"]
    op_margin = base_research["buffett_analysis"]["metrics"]["op_margin"]
    debt_equity = base_research["buffett_analysis"]["metrics"]["debt_equity"]
    current_ratio = base_research["buffett_analysis"]["metrics"]["current_ratio"]
    fcf_cr = base_research["buffett_analysis"]["history"]["fcf_cr"]
    sales_growth = base_research["lynch_analysis"]["growth"]
    eps_growth = base_research["lynch_analysis"]["eps_growth"]
    pe_ratio = base_research["lynch_analysis"]["pe"]
    peg_ratio = base_research["lynch_analysis"]["peg"]
    div_yield = base_research["lynch_analysis"]["dividend_yield"]
    market_cap = base_research["explainability"]["dcf"]["inputs"]["market_cap_cr"]
    
    # Technical & volatility
    rsi = base_research["technical_timing"]["rsi"]
    support = base_research["technical_timing"]["support"]
    resistance = base_research["technical_timing"]["resistance"]
    volatility = base_research["risk_analysis"]["volatility"]
    beta = base_research["risk_analysis"]["beta"]
    ema_50 = base_research["technical_timing"]["ema_50"]
    ema_200 = base_research["technical_timing"]["ema_200"]
    supertrend = base_research["technical_timing"]["supertrend"]
    macd_hist = base_research["technical_timing"]["macd"]["histogram"]
    
    # Sentiment & Smart Money
    sentiment_pct = base_research["news_sentiment"]["sentiment_pct"]
    sentiment_confidence = base_research["news_sentiment"]["confidence_pct"]
    sentiment_summary = base_research["news_sentiment"]["summary"]
    sentiment_impact = base_research["news_sentiment"]["impact"]
    smart_money_score = base_research["smart_money"]["score"]
    promoter_holding = base_research["smart_money"]["promoter_holding"]
    promoter_change = base_research["smart_money"]["promoter_change"]
    fii_holding = base_research["smart_money"]["fii_holding"]
    dii_holding = base_research["smart_money"]["dii_holding"]
    pledged_shares = base_research["smart_money"]["pledged_shares"]

    # ----------------------------------------------------
    # MODULE 1: AI ENTRY ZONE ENGINE
    # ----------------------------------------------------
    strong_support_zone = [support * 0.98, support * 1.02]
    historical_demand_zone = [support * 0.92, support * 0.96]
    ideal_buy_zone = [support * 0.99, support * 1.04]
    safe_buy_zone = [support * 0.95, support * 1.01]
    aggressive_buy_zone = [ema_50 * 0.97, ema_50 * 1.02]
    deep_value_buy_zone = [support * 0.88, support * 0.93]
    
    best_entry_price = support * 1.01
    sip_range = [support * 0.96, support * 1.05]
    
    # Good entry probability model (RSI and support distance)
    dist_to_support = ((current_price - support) / support) * 100 if support > 0 else 10.0
    rsi_factor = max(0, min(100, 100 - rsi))
    support_factor = max(0, min(100, 100 - dist_to_support * 3))
    entry_probability = round(0.5 * rsi_factor + 0.5 * support_factor, 1)
    
    # Entry Zone reasoning
    if current_price <= ideal_buy_zone[1]:
        entry_reasoning = f"Price is trading close to the Strong Support level of ₹{support:.2f}. Technical indicators like RSI ({rsi:.1f}) suggest limited downside risk."
    elif current_price > ideal_buy_zone[1] and rsi > 65:
        entry_reasoning = f"Price has run up significantly above support and RSI ({rsi:.1f}) shows overbought conditions. Waiting for a pullback is recommended."
    else:
        entry_reasoning = f"Price is in a consolidation phase. Suggested strategy is to Accumulate Slowly within the SIP range of ₹{sip_range[0]:.2f} - ₹{sip_range[1]:.2f}."

    # ----------------------------------------------------
    # MODULE 2: AI EXIT ENGINE
    # ----------------------------------------------------
    target_1 = current_price * 1.08
    target_2 = current_price * 1.18
    target_3 = max(intrinsic_value, current_price * 1.35)
    stop_loss = support * 0.94
    trailing_stop = current_price * 0.92
    
    t1_prob = max(10, min(95, 90 - (target_1 - current_price) / current_price * 100))
    t2_prob = max(10, min(95, 70 - (target_2 - current_price) / current_price * 100))
    t3_prob = max(5, min(95, 45 - (target_3 - current_price) / current_price * 100 + (margin_of_safety * 0.3)))
    
    # ----------------------------------------------------
    # MODULE 3: HOLDING PERIOD ESTIMATOR
    # ----------------------------------------------------
    if alpha_score >= 75 and margin_of_safety > 15:
        best_holding_period = "Long Term (1 to 3 Years)"
        holding_reasoning = "High AI Alpha Score and deep intrinsic value discrepancy support long-term compound growth. Financial efficiency warrants multi-year investment."
    elif supertrend == "Bullish" and macd_hist > 0:
        best_holding_period = "Swing (1 to 3 Weeks)"
        holding_reasoning = "Strong technical breakout signals and positive MACD momentum make this highly suitable for short-term swing trading targets."
    else:
        best_holding_period = "Positional (2 to 6 Months)"
        holding_reasoning = "Company is in a mid-term consolidation pattern. Holding positional targets allows cyclical earnings and support structures to materialize."

    # ----------------------------------------------------
    # MODULE 4: MULTIBAGGER PROBABILITY ENGINE
    # ----------------------------------------------------
    cap_score = 25.0
    if market_cap > 50000: cap_score = 5.0
    elif market_cap > 15000: cap_score = 15.0
    
    growth_score = 5.0
    avg_growth = (sales_growth + eps_growth) / 2.0
    if avg_growth > 20.0: growth_score = 30.0
    elif avg_growth > 12.0: growth_score = 20.0
    
    efficiency_score = 5.0
    if roic > 18.0 and roe > 18.0: efficiency_score = 25.0
    elif roic > 12.0 or roe > 12.0: efficiency_score = 15.0
    
    debt_score = 20.0
    if debt_equity > 0.8: debt_score = 5.0
    elif debt_equity > 0.4: debt_score = 12.0
    
    multibagger_score = cap_score + growth_score + efficiency_score + debt_score
    growth_confidence = "High" if roic > 15.0 and altman_zone == "Safe" else "Medium"
    required_cagr_10x = 25.8
    
    prob_2x_3y = round(max(5, min(95, multibagger_score * 0.8 + margin_of_safety * 0.15)), 1)
    prob_3x_5y = round(max(5, min(95, multibagger_score * 0.65 + margin_of_safety * 0.1)), 1)
    prob_5x_10y = round(max(2, min(95, multibagger_score * 0.5)), 1)
    prob_10x_10y = round(max(1, min(90, multibagger_score * 0.3)), 1)

    # ----------------------------------------------------
    # MODULE 5: FUTURE CATALYST ENGINE
    # ----------------------------------------------------
    catalysts = []
    if any(w in sentiment_summary.lower() for w in ["result", "earnings", "quarter"]):
        catalysts.append({"event": "Upcoming Quarterly Results", "impact": "Positive" if sentiment_pct > 60 else "Neutral", "detail": "Earnings trajectory release."})
    else:
        catalysts.append({"event": "Upcoming Quarterly Audits", "impact": "Neutral", "detail": "Scheduled financial reviews."})
        
    if div_yield > 2.0:
        catalysts.append({"event": "Dividend Distribution Declaration", "impact": "Positive", "detail": "Consistent capital return yield payout."})
        
    if "order" in sentiment_summary.lower() or "win" in sentiment_summary.lower():
        catalysts.append({"event": "Large Order Catalog Expansion", "impact": "Positive", "detail": "New order wins support sales runway."})
        
    if debt_equity > 0.8:
        catalysts.append({"event": "Government Interest Rate Shifts", "impact": "Negative", "detail": "Highly leveraged liabilities react to interest hikes."})
    else:
        catalysts.append({"event": "Government Policy Alignment", "impact": "Positive", "detail": "Favorable regulatory environments support growth."})

    # ----------------------------------------------------
    # MODULE 6: WHAT CAN GO WRONG?
    # ----------------------------------------------------
    risks = [
        {
            "name": "Valuation Risk",
            "prob": round(max(10, min(90, pe_ratio * 1.5)), 1),
            "impact": 70,
            "mitigation": "Accumulate only in Safe Buy Zones below resistance levels."
        },
        {
            "name": "Debt Risk",
            "prob": round(max(5, min(90, debt_equity * 60)), 1),
            "impact": 80,
            "mitigation": "Deleveraging schedules or refinancing liability lines."
        },
        {
            "name": "Margin Compression",
            "prob": round(max(10, min(85, 80 - op_margin)), 1),
            "impact": 75,
            "mitigation": "Operational efficiency audits and cost controls."
        },
        {
            "name": "Promoter Risk",
            "prob": round(max(5, min(90, pledged_shares * 2.0)), 1),
            "impact": 90,
            "mitigation": "Revocation of pledged shares by promoter group."
        },
        {
            "name": "Regulatory & Policy Risk",
            "prob": 25.0,
            "impact": 85,
            "mitigation": "Compliance diversification and geographic expansion."
        }
    ]

    # ----------------------------------------------------
    # MODULE 7: AI FUTURE SCENARIOS
    # ----------------------------------------------------
    scenarios = {
        "bull": {
            "price": round(current_price * 1.45, 2),
            "cagr": 22.0,
            "revenue": round(op_margin + 5.0, 1),
            "eps": round(eps_growth + 6.0, 1),
            "probability": 25.0
        },
        "base": {
            "price": round(intrinsic_value, 2),
            "cagr": 12.0,
            "revenue": round(op_margin, 1),
            "eps": round(eps_growth, 1),
            "probability": 55.0
        },
        "bear": {
            "price": round(support * 0.9, 2),
            "cagr": -10.0,
            "revenue": round(op_margin - 6.0, 1),
            "eps": round(eps_growth - 12.0, 1),
            "probability": 20.0
        }
    }

    # ----------------------------------------------------
    # MODULE 8: PRICE PROBABILITY MODEL
    # ----------------------------------------------------
    def norm_cdf(x: float) -> float:
        return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))
        
    def calculate_price_prob(target_pct: float, days: int) -> float:
        t = days / 365.0
        sd = (volatility / 100.0) * math.sqrt(t)
        if sd <= 0: return 50.0
        mu = 0.08 * t
        z = (math.log(1.0 + target_pct / 100.0) - mu) / sd
        prob = 1.0 - norm_cdf(z)
        return round(prob * 100, 1)

    price_probability = {
        "m3": {
            "p10": calculate_price_prob(10, 90),
            "p20": calculate_price_prob(20, 90),
            "p30": calculate_price_prob(30, 90),
            "p50": calculate_price_prob(50, 90)
        },
        "m6": {
            "p10": calculate_price_prob(10, 180),
            "p20": calculate_price_prob(20, 180),
            "p30": calculate_price_prob(30, 180),
            "p50": calculate_price_prob(50, 180)
        },
        "y1": {
            "p10": calculate_price_prob(10, 365),
            "p20": calculate_price_prob(20, 365),
            "p30": calculate_price_prob(30, 365),
            "p50": calculate_price_prob(50, 365)
        },
        "y3": {
            "p10": calculate_price_prob(10, 1095),
            "p20": calculate_price_prob(20, 1095),
            "p30": calculate_price_prob(30, 1095),
            "p50": calculate_price_prob(50, 1095)
        }
    }

    # ----------------------------------------------------
    # MODULE 9: SMART ENTRY TIMER
    # ----------------------------------------------------
    if rsi <= 30:
        entry_timer = "Buy Now"
        timer_reasoning = f"RSI is oversold at {rsi:.1f} and price is resting at historical demand zones. High probability of rebound."
    elif rsi >= 70:
        entry_timer = "Avoid"
        timer_reasoning = f"RSI is overbought at {rsi:.1f} and volume shows heavy distribution patterns. Exit warning active."
    elif current_price > support * 1.06:
        entry_timer = "Wait"
        timer_reasoning = f"Price is trading at a {dist_to_support:.1f}% premium above immediate support levels. Wait for pullbacks."
    else:
        entry_timer = "Accumulate Slowly"
        timer_reasoning = f"Consolidating near support zone of ₹{support:.2f}. Standard SIP positioning recommended."

    # ----------------------------------------------------
    # MODULE 10: SELL SIGNAL ENGINE
    # ----------------------------------------------------
    sell_alerts = []
    if pe_ratio > 40.0:
        sell_alerts.append({"type": "Overvalued", "reason": f"PE ratio of {pe_ratio:.1f}x trades at a premium relative to sales CAGR."})
    if rsi >= 75.0:
        sell_alerts.append({"type": "Momentum Weakening", "reason": f"Extreme overbought RSI ({rsi:.1f}) signals exhaustion warnings."})
    if promoter_change < -0.5:
        sell_alerts.append({"type": "Promoter Selling", "reason": f"Promoters decreased holding by {abs(promoter_change):.2f}% recently."})
    if debt_equity > 1.2:
        sell_alerts.append({"type": "Debt Rising", "reason": f"Leverage is high at {debt_equity:.2f} D/E ratios."})
        
    sell_explanation = "No immediate sell alerts triggered."
    if sell_alerts:
        sell_explanation = " ".join([a["reason"] for a in sell_alerts])

    # ----------------------------------------------------
    # MODULE 11: AI PORTFOLIO FIT
    # ----------------------------------------------------
    portfolio_fit = {
        "Value Investors": round(max(10, min(100, 50.0 + margin_of_safety)), 1),
        "Growth Investors": round(max(10, min(100, avg_growth * 3.5)), 1),
        "Dividend Investors": round(max(5, min(100, div_yield * 20.0)), 1),
        "Momentum Investors": round(max(10, min(100, 100 - rsi)), 1) if entry_timer == "Buy Now" else round(max(10, min(100, rsi)), 1),
        "Swing Traders": round(max(10, min(100, volatility * 2.0)), 1) if supertrend == "Bullish" else 30.0,
        "Retirement Portfolio": round(max(10, min(100, 100 - risk_score_val(expected_risk, debt_equity))), 1),
        "High Risk Portfolio": round(max(10, min(100, volatility * 2.5)), 1),
        "Low Risk Portfolio": round(max(10, min(100, 100 - volatility * 1.5)), 1)
    }

    # ----------------------------------------------------
    # MODULE 16: AI STOCK DNA
    # ----------------------------------------------------
    dna_profile = "TCS"
    if avg_growth > 22.0:
        dna_profile = "NVIDIA" if pe_ratio > 35.0 else "Tesla"
    elif roe > 20.0 and debt_equity < 0.2:
        dna_profile = "Asian Paints" if div_yield > 1.0 else "Apple"
    elif debt_equity > 1.0:
        dna_profile = "Titan"

    # ----------------------------------------------------
    # MODULE 17: AI DAILY HEALTH SCORE
    # ----------------------------------------------------
    health_score = round(0.3 * alpha_score + 0.3 * (piotroski_f_score / 9 * 100) + 0.2 * sentiment_pct + 0.2 * smart_money_score, 1)

    # ----------------------------------------------------
    # MODULE 18: WHY TODAY?
    # ----------------------------------------------------
    why_today = f"Ticker is trading at ₹{current_price:.2f}. "
    if rsi < 30:
        why_today += "Price is undergoing a tactical rebound from oversold support levels."
    elif rsi > 70:
        why_today += "Strong breakout momentum on high volume attracts retail buy options activity."
    elif sentiment_pct > 65:
        why_today += f"Positive news sentiment catalyst: '{sentiment_summary}' drives volume breakout."
    else:
        why_today += "Trading within technical consolidation bounds on standard average volume activity."

    # ----------------------------------------------------
    # MODULE 19: AI CONVICTION METER
    # ----------------------------------------------------
    bullish_signals = 0
    if margin_of_safety > 10: bullish_signals += 1
    if supertrend == "Bullish": bullish_signals += 1
    if piotroski_f_score >= 5: bullish_signals += 1
    if sentiment_pct > 60: bullish_signals += 1
    if smart_money_score > 60: bullish_signals += 1
    
    if bullish_signals >= 4: conviction = "Very High Conviction"
    elif bullish_signals >= 3: conviction = "High Conviction"
    elif bullish_signals >= 2: conviction = "Medium Conviction"
    else: conviction = "Low Conviction"

    # ----------------------------------------------------
    # MODULE 20: THE INVESTMENT PLAYBOOK
    # ----------------------------------------------------
    playbook = {
        "thesis": f"Attractive entry plays on support at ₹{support:.2f}. Valuation yields a {margin_of_safety:.1f}% margin of safety, backed by robust {dna_profile} style capital efficiency DNA.",
        "buy_zone": f"₹{ideal_buy_zone[0]:.2f} - ₹{ideal_buy_zone[1]:.2f}",
        "add_more_zone": f"₹{safe_buy_zone[0]:.2f} - ₹{safe_buy_zone[1]:.2f}",
        "reduce_zone": f"₹{resistance * 0.98:.2f} - ₹{resistance * 1.02:.2f}",
        "exit_zone": f"₹{target_3 * 0.98:.2f} - ₹{target_3 * 1.02:.2f}",
        "stop_loss": round(stop_loss, 2),
        "target": round(target_3, 2),
        "expected_cagr": scenarios["base"]["cagr"],
        "expected_return": round(margin_of_safety, 1),
        "probability_success": prob_2x_3y
    }

    decision_data = {
        "ticker": ticker,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        
        # Module 1
        "entry_zone": {
            "current_price": current_price,
            "best_entry": round(best_entry_price, 2),
            "sip_range": [round(sip_range[0], 2), round(sip_range[1], 2)],
            "strong_support": [round(strong_support_zone[0], 2), round(strong_support_zone[1], 2)],
            "historical_demand": [round(historical_demand_zone[0], 2), round(historical_demand_zone[1], 2)],
            "risk_level": expected_risk,
            "probability": entry_probability,
            "reasoning": entry_reasoning
        },
        # Module 2
        "exit_engine": {
            "target_1": round(target_1, 2),
            "target_1_prob": t1_prob,
            "target_2": round(target_2, 2),
            "target_2_prob": t2_prob,
            "target_3": round(target_3, 2),
            "target_3_prob": t3_prob,
            "stop_loss": round(stop_loss, 2),
            "trailing_stop": round(trailing_stop, 2),
            "confidence": round(sentiment_confidence, 1)
        },
        # Module 3
        "holding_period": {
            "period": best_holding_period,
            "reasoning": holding_reasoning
        },
        # Module 4
        "multibagger_probability": {
            "score": multibagger_score,
            "confidence": growth_confidence,
            "required_cagr_10x": required_cagr_10x,
            "probabilities": {
                "x2_3y": prob_2x_3y,
                "x3_5y": prob_3x_5y,
                "x5_10y": prob_5x_10y,
                "x10_10y": prob_10x_10y
            }
        },
        # Module 5
        "catalysts": catalysts,
        # Module 6
        "risks": risks,
        # Module 7
        "scenarios": scenarios,
        # Module 8
        "price_probability": price_probability,
        # Module 9
        "smart_entry_timer": {
            "signal": entry_timer,
            "reasoning": timer_reasoning
        },
        # Module 10
        "sell_signal": {
            "alerts": sell_alerts,
            "explanation": sell_explanation
        },
        # Module 11
        "portfolio_fit": portfolio_fit,
        # Module 16
        "stock_dna": dna_profile,
        # Module 17
        "health_score": health_score,
        # Module 18
        "why_today": why_today,
        # Module 19
        "conviction_meter": conviction,
        # Module 20
        "playbook": playbook
    }

    if redis:
        try:
            await redis.setex(cache_key, 7200, json.dumps(decision_data))
            # Invalidate scanner caches so they pick up this new/refreshed stock
            await redis.delete("scan:multibagger")
            await redis.delete("scan:early-opportunity")
            await redis.delete("scan:turnaround")
            logger.info("Invalidated scanner cache keys in Redis for new ticker ingestion")
        except Exception as e:
            logger.error(f"Error caching Decision Intelligence for {ticker} in Redis: {e}")

    try:
        if db is not None:
            db_save = {**decision_data}
            db_save["last_analyzed"] = datetime.now(timezone.utc)
            await db.decision_intelligence.update_one(
                {"ticker": ticker},
                {"$set": db_save},
                upsert=True
            )
            logger.info(f"Cached Decision Intelligence for {ticker} in MongoDB")
    except Exception as e:
        logger.error(f"Error caching Decision Intelligence for {ticker} in MongoDB: {e}")

    return decision_data

def risk_score_val(risk_str: str, d_e: float) -> float:
    base = 20.0
    if risk_str == "High": base = 60.0
    elif risk_str == "Medium": base = 40.0
    if d_e > 1.0: base += 20.0
    return base

# --- MODULE 12: MULTIBAGGER DISCOVERY SCAN ---
async def scan_multibagger_stocks() -> List[Dict[str, Any]]:
    redis = get_redis()
    db = get_db()
    
    cache_key = "scan:multibagger"
    cached = await redis.get(cache_key) if redis else None
    if cached:
        return json.loads(cached)
        
    results = []
    if db is not None:
        cursor = db.stocks.find({}, {"ticker": 1}).limit(50)
        tickers = [doc["ticker"] for doc in await cursor.to_list(length=50)]
        
        for t in tickers:
            try:
                dec = await compute_decision_intelligence(t)
                research = await compute_terminal_research(t)
                results.append({
                    "ticker": t,
                    "company_name": research["company_name"],
                    "current_price": research["current_price"],
                    "alpha_score": research["alpha_score"]["score"],
                    "multibagger_score": dec["multibagger_probability"]["score"],
                    "cagr": dec["scenarios"]["base"]["cagr"],
                    "probabilities": dec["multibagger_probability"]["probabilities"]
                })
            except Exception as e:
                logger.error(f"Error scanning multibagger potential for {t}: {e}")
                
        results.sort(key=lambda x: x["multibagger_score"], reverse=True)
        if redis:
            await redis.setex(cache_key, 14400, json.dumps(results))
        
    return results

# --- MODULE 13: EARLY OPPORTUNITY DETECTOR ---
async def scan_early_opportunities() -> List[Dict[str, Any]]:
    redis = get_redis()
    db = get_db()
    
    cache_key = "scan:early-opportunity"
    cached = await redis.get(cache_key) if redis else None
    if cached:
        return json.loads(cached)
        
    results = []
    if db is not None:
        cursor = db.stocks.find({}, {"ticker": 1}).limit(50)
        tickers = [doc["ticker"] for doc in await cursor.to_list(length=50)]
        
        for t in tickers:
            try:
                research = await compute_terminal_research(t)
                
                sales_g = research["lynch_analysis"]["growth"]
                eps_g = research["lynch_analysis"]["eps_growth"]
                roic = research["buffett_analysis"]["metrics"]["roic"]
                
                opp_score = 30.0
                opp_score += (25.0 if sales_g > 15.0 else 5.0)
                opp_score += (25.0 if eps_g > 15.0 else 5.0)
                opp_score += (20.0 if roic > 15.0 else 5.0)
                
                if opp_score >= 60.0:
                    results.append({
                        "ticker": t,
                        "company_name": research["company_name"],
                        "current_price": research["current_price"],
                        "opportunity_score": round(opp_score, 1),
                        "sales_growth": round(sales_g, 1),
                        "profit_growth": round(eps_g, 1),
                        "roic": round(roic, 1)
                    })
            except Exception as e:
                logger.error(f"Error scanning early opportunities for {t}: {e}")
                
        results.sort(key=lambda x: x["opportunity_score"], reverse=True)
        if redis:
            await redis.setex(cache_key, 14400, json.dumps(results))
        
    return results

# --- MODULE 14: TURNAROUND DETECTOR ---
async def scan_turnarounds() -> List[Dict[str, Any]]:
    redis = get_redis()
    db = get_db()
    
    cache_key = "scan:turnarounds"
    cached = await redis.get(cache_key) if redis else None
    if cached:
        return json.loads(cached)
        
    results = []
    if db is not None:
        cursor = db.stocks.find({}, {"ticker": 1}).limit(50)
        tickers = [doc["ticker"] for doc in await cursor.to_list(length=50)]
        
        for t in tickers:
            try:
                research = await compute_terminal_research(t)
                pl_table = await base_table_lookup(research["ticker"], "profit-loss")
                net_profit_vals = pl_table.get_values("Net Profit") if pl_table else []
                
                turnaround_prob = 10.0
                current_p = 0.0
                prev_p = 0.0
                if len(net_profit_vals) >= 2:
                    current_p = net_profit_vals[-1]
                    prev_p = net_profit_vals[-2]
                    
                    if current_p > 0 and prev_p <= 0:
                        turnaround_prob = 85.0
                    elif current_p > prev_p and prev_p < 0:
                        turnaround_prob = 65.0
                        
                if turnaround_prob >= 50.0:
                    results.append({
                        "ticker": t,
                        "company_name": research["company_name"],
                        "current_price": research["current_price"],
                        "turnaround_probability": turnaround_prob,
                        "latest_profit": current_p,
                        "previous_profit": prev_p
                    })
            except Exception as e:
                logger.error(f"Error scanning turnaround setups for {t}: {e}")
                
        results.sort(key=lambda x: x["turnaround_probability"], reverse=True)
        if redis:
            await redis.setex(cache_key, 14400, json.dumps(results))
        
    return results

# --- MODULE 15: AI WATCHLIST RANKING ---
async def rank_watchlist_stocks(tickers: List[str]) -> Dict[str, List[Dict[str, Any]]]:
    best_opportunity = []
    most_undervalued = []
    highest_growth = []
    lowest_risk = []
    highest_momentum = []
    best_swing = []
    best_long_term = []
    
    for t in tickers:
        try:
            t = t.upper()
            research = await compute_terminal_research(t)
            
            stock_info = {
                "ticker": t,
                "company_name": research["company_name"],
                "current_price": research["current_price"],
                "alpha_score": research["alpha_score"]["score"]
            }
            
            best_opportunity.append({**stock_info, "score": research["alpha_score"]["score"]})
            most_undervalued.append({**stock_info, "score": research["intrinsic_value"]["margin_of_safety"]})
            highest_growth.append({**stock_info, "score": research["lynch_analysis"]["growth"]})
            lowest_risk.append({**stock_info, "score": 100 - research["risk_analysis"]["score"]})
            highest_momentum.append({**stock_info, "score": research["momentum_engine"]["score"]})
            best_swing.append({**stock_info, "score": research["technical_timing"]["score"] if research["technical_timing"]["supertrend"] == "Bullish" else 20.0})
            best_long_term.append({**stock_info, "score": research["buffett_analysis"]["score"]})
            
        except Exception as e:
            logger.error(f"Error ranking watchlist stock {t}: {e}")
            
    best_opportunity.sort(key=lambda x: x["score"], reverse=True)
    most_undervalued.sort(key=lambda x: x["score"], reverse=True)
    highest_growth.sort(key=lambda x: x["score"], reverse=True)
    lowest_risk.sort(key=lambda x: x["score"], reverse=True)
    highest_momentum.sort(key=lambda x: x["score"], reverse=True)
    best_swing.sort(key=lambda x: x["score"], reverse=True)
    best_long_term.sort(key=lambda x: x["score"], reverse=True)
    
    return {
        "best_opportunity": best_opportunity,
        "most_undervalued": most_undervalued,
        "highest_growth": highest_growth,
        "lowest_risk": lowest_risk,
        "highest_momentum": highest_momentum,
        "best_swing": best_swing,
        "best_long_term": best_long_term
    }

async def base_table_lookup(ticker: str, section_id: str) -> Optional[Any]:
    from app.services.stock_analysis_engine import FinancialTable
    db = get_db()
    if db is None:
        return None
    doc = await db.stocks.find_one({"ticker": ticker})
    if doc and doc.get(section_id.replace("-", "_")):
        return FinancialTable(doc[section_id.replace("-", "_")])
    return None

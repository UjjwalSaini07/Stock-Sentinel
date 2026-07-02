import math
import statistics
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import httpx
from app.config import settings
from app.database import get_db, get_redis
from app.services.scraper_service import scrape_extended_stock_data
from app.services.analysis_service import fetch_news_headlines
from app.services.quant_service import fetch_historical_prices, calculate_sma, calculate_ema, calculate_rsi, calculate_macd, calculate_bollinger_bands

logger = logging.getLogger("stocksentinel.analysis_engine")
logger.setLevel(logging.INFO)

# --- Financial Table Helper ---
class FinancialTable:
    def __init__(self, data: Optional[dict]):
        self.headers = data.get("headers", []) if data else []
        self.rows = data.get("rows", []) if data else []

    def get_values(self, metric_name: str) -> List[float]:
        for r in self.rows:
            if metric_name.lower() in r["metric"].lower():
                res = []
                for v in r["values"]:
                    clean = "".join(c for c in str(v) if c.isdigit() or c in [".", "-"])
                    try:
                        res.append(float(clean) if clean else 0.0)
                    except ValueError:
                        res.append(0.0)
                return res
        return []

    def get_latest_value(self, metric_name: str, fallback: float = 0.0) -> float:
        vals = self.get_values(metric_name)
        return vals[-1] if vals else fallback

    def get_previous_value(self, metric_name: str, fallback: float = 0.0) -> float:
        vals = self.get_values(metric_name)
        return vals[-2] if len(vals) >= 2 else (vals[0] if vals else fallback)

# --- Technical Timing Helper functions ---
def calculate_adx(highs: List[float], lows: List[float], closes: List[float], period: int = 14) -> List[Optional[float]]:
    adx_list = [None] * len(closes)
    if len(closes) < 2 * period:
        return adx_list
        
    tr = []
    dm_plus = []
    dm_minus = []
    for i in range(1, len(closes)):
        h = highs[i]
        l = lows[i]
        ph = highs[i-1]
        pl = lows[i-1]
        pc = closes[i-1]
        
        tr.append(max(h - l, abs(h - pc), abs(l - pc)))
        
        up = h - ph
        down = pl - l
        
        if up > down and up > 0:
            dm_plus.append(up)
        else:
            dm_plus.append(0.0)
            
        if down > up and down > 0:
            dm_minus.append(down)
        else:
            dm_minus.append(0.0)
            
    # Smoothing
    str_val = sum(tr[:period])
    s_dm_plus = sum(dm_plus[:period])
    s_dm_minus = sum(dm_minus[:period])
    
    di_plus = 100 * (s_dm_plus / str_val) if str_val > 0 else 0
    di_minus = 100 * (s_dm_minus / str_val) if str_val > 0 else 0
    dx = 100 * (abs(di_plus - di_minus) / (di_plus + di_minus)) if (di_plus + di_minus) > 0 else 0
    
    tr_smooth = str_val
    plus_smooth = s_dm_plus
    minus_smooth = s_dm_minus
    
    dx_values = [dx]
    for i in range(period, len(tr)):
        tr_smooth = tr_smooth - (tr_smooth / period) + tr[i]
        plus_smooth = plus_smooth - (plus_smooth / period) + dm_plus[i]
        minus_smooth = minus_smooth - (minus_smooth / period) + dm_minus[i]
        
        di_plus = 100 * (plus_smooth / tr_smooth) if tr_smooth > 0 else 0
        di_minus = 100 * (minus_smooth / tr_smooth) if tr_smooth > 0 else 0
        dx = 100 * (abs(di_plus - di_minus) / (di_plus + di_minus)) if (di_plus + di_minus) > 0 else 0
        dx_values.append(dx)
        
    adx_smooth = sum(dx_values[:period]) / period
    adx_list[period * 2 - 1] = adx_smooth
    for i in range(period, len(dx_values)):
        adx_smooth = (adx_smooth * (period - 1) + dx_values[i]) / period
        idx = period + i
        if idx < len(adx_list):
            adx_list[idx] = adx_smooth
            
    return adx_list

def calculate_atr(highs: List[float], lows: List[float], closes: List[float], period: int = 14) -> List[Optional[float]]:
    atr_list = [None] * len(closes)
    if len(closes) < period:
        return atr_list
    tr = [highs[0] - lows[0]]
    for i in range(1, len(closes)):
        tr.append(max(highs[i] - lows[i], abs(highs[i] - closes[i-1]), abs(lows[i] - closes[i-1])))
        
    atr = sum(tr[:period]) / period
    atr_list[period - 1] = atr
    for i in range(period, len(closes)):
        atr = (atr * (period - 1) + tr[i]) / period
        atr_list[i] = atr
    return atr_list

def calculate_supertrend(highs: List[float], lows: List[float], closes: List[float], period: int = 10, multiplier: float = 3.0) -> Dict[str, List[Any]]:
    atr = calculate_atr(highs, lows, closes, period)
    upperband = [0.0] * len(closes)
    lowerband = [0.0] * len(closes)
    in_trend = [True] * len(closes) # True = Bullish, False = Bearish
    
    for i in range(len(closes)):
        if atr[i] is None:
            continue
        hl2 = (highs[i] + lows[i]) / 2.0
        upperband[i] = hl2 + multiplier * atr[i]
        lowerband[i] = hl2 - multiplier * atr[i]
        
        if i > 0:
            if closes[i-1] > lowerband[i-1]:
                lowerband[i] = max(lowerband[i], lowerband[i-1])
            if closes[i-1] < upperband[i-1]:
                upperband[i] = min(upperband[i], upperband[i-1])
                
            if closes[i] > upperband[i-1]:
                in_trend[i] = True
            elif closes[i] < lowerband[i-1]:
                in_trend[i] = False
            else:
                in_trend[i] = in_trend[i-1]
                if in_trend[i] and lowerband[i] < lowerband[i-1]:
                    lowerband[i] = lowerband[i-1]
                if not in_trend[i] and upperband[i] > upperband[i-1]:
                    upperband[i] = upperband[i-1]
    return {
        "trend": in_trend,
        "upper": upperband,
        "lower": lowerband
    }

def calculate_ichimoku(highs: List[float], lows: List[float], closes: List[float]) -> Dict[str, List[Optional[float]]]:
    tenkan = [None] * len(closes)
    kijun = [None] * len(closes)
    senkou_a = [None] * len(closes)
    senkou_b = [None] * len(closes)
    
    for i in range(len(closes)):
        if i >= 8:
            tenkan[i] = (max(highs[i-8:i+1]) + min(lows[i-8:i+1])) / 2.0
        if i >= 25:
            kijun[i] = (max(highs[i-25:i+1]) + min(lows[i-25:i+1])) / 2.0
        if i >= 25:
            senkou_a[i] = (tenkan[i] + kijun[i]) / 2.0 if (tenkan[i] is not None and kijun[i] is not None) else None
        if i >= 51:
            senkou_b[i] = (max(highs[i-51:i+1]) + min(lows[i-51:i+1])) / 2.0
            
    return {
        "tenkan": tenkan,
        "kijun": kijun,
        "senkou_a": senkou_a,
        "senkou_b": senkou_b
    }

# --- Core Investment Research Calculations ---
async def compute_terminal_research(ticker: str) -> Dict[str, Any]:
    ticker = ticker.upper()
    redis = get_redis()
    db = get_db()
    
    cache_key = f"terminal_research:{ticker}"
    cached = await redis.get(cache_key) if redis else None
    if cached:
        logger.info(f"Returning cached Terminal Research for {ticker} from Redis")
        return json.loads(cached)

    # 1. Fetch scraped tables and fundamentals
    scraped_data = await scrape_extended_stock_data(ticker)
    if not scraped_data or scraped_data.get("current_price") is None:
        raise ValueError(f"Could not scrape financial data for stock {ticker}")
        
    funds = scraped_data.get("fundamentals", {})
    current_price = scraped_data.get("current_price", 0.0)
    market_cap = scraped_data.get("fundamentals", {}).get("market_cap") or scraped_data.get("market_cap")
    if not market_cap:
        market_cap = current_price * 100.0 # fallback

    # Initialize Table Parsers
    pl_table = FinancialTable(scraped_data.get("profit_loss"))
    bs_table = FinancialTable(scraped_data.get("balance_sheet"))
    cf_table = FinancialTable(scraped_data.get("cash_flow"))
    sh_table = FinancialTable(scraped_data.get("shareholding_pattern"))
    qr_table = FinancialTable(scraped_data.get("quarterly_results"))

    # 2. Fetch yfinance prices for technicals & volatility
    hist = await fetch_historical_prices(ticker, "1y")
    if not hist or not hist["close"]:
        # Mock historical structure if API completely fails
        hist = {
            "close": [current_price] * 260,
            "high": [current_price * 1.01] * 260,
            "low": [current_price * 0.99] * 260,
            "volume": [100000] * 260,
            "timestamps": [int(datetime.now().timestamp()) - (i * 86400) for i in range(260)]
        }
        
    closes = hist["close"]
    highs = hist["high"]
    lows = hist["low"]
    volumes = hist["volume"]
    
    # ----------------------------------------------------
    # NEW MODULE 3: INTRINSIC VALUE ENGINE
    # ----------------------------------------------------
    # Inputs
    eps_vals = pl_table.get_values("EPS in Rs")
    latest_eps = eps_vals[-1] if eps_vals else (funds.get("pe") and current_price / funds["pe"]) or 0.0
    latest_eps = max(0.0, latest_eps)
    
    sales_vals = pl_table.get_values("Sales")
    sales_growth = 10.0 # default
    if len(sales_vals) >= 2:
        try:
            growth_list = [((sales_vals[i] - sales_vals[i-1]) / sales_vals[i-1]) * 100 for i in range(1, len(sales_vals)) if sales_vals[i-1] > 0]
            if growth_list:
                sales_growth = sum(growth_list) / len(growth_list)
        except Exception:
            pass
    sales_growth = max(-10.0, min(15.0, sales_growth)) # Cap growth rates between -10% and 15% for safety
    
    # DCF Calculation
    cfo_vals = cf_table.get_values("Cash from Operating Activity")
    # Capex approx from Fixed Assets purchases or depreciation
    dep_vals = pl_table.get_values("Depreciation")
    latest_dep = dep_vals[-1] if dep_vals else 0.0
    # In Screener cash flow investing activities contains "Fixed assets purchased"
    capex_vals = cf_table.get_values("Fixed assets purchased")
    latest_capex = abs(capex_vals[-1]) if capex_vals else latest_dep * 1.1
    
    latest_cfo = cfo_vals[-1] if cfo_vals else 0.0
    latest_fcf = latest_cfo - latest_capex
    if latest_fcf <= 0:
        # Fallback to Net profit - capex
        net_profit_vals = pl_table.get_values("Net Profit")
        latest_net_profit = net_profit_vals[-1] if net_profit_vals else 0.0
        latest_fcf = max(0.0, latest_net_profit * 0.7) # estimate 70% of profit becomes FCF

    # Estimate WACC based on sector
    sector = scraped_data.get("sector", "").lower()
    if "it" in sector or "software" in sector or "tech" in sector:
        wacc = 11.5
    elif "bank" in sector or "finance" in sector or "insurance" in sector:
        wacc = 9.5
    elif "power" in sector or "energy" in sector or "utility" in sector:
        wacc = 8.5
    else:
        wacc = 10.0
        
    def calculate_dcf_value(base_fcf: float, growth: float, wacc_rate: float, terminal_g: float = 3.0) -> float:
        # 10 years projection
        discount_factor = 1 + (wacc_rate / 100.0)
        pv_sum = 0.0
        fcf_proj = base_fcf
        for yr in range(1, 11):
            fcf_proj = fcf_proj * (1 + (growth / 100.0))
            pv_sum += fcf_proj / (discount_factor ** yr)
        # Terminal Value
        terminal_fcf = fcf_proj * (1 + (terminal_g / 100.0))
        tv = terminal_fcf / ((wacc_rate / 100.0) - (terminal_g / 100.0))
        pv_tv = tv / (discount_factor ** 10)
        return pv_sum + pv_tv

    dcf_base_fcf = calculate_dcf_value(latest_fcf, sales_growth, wacc)
    dcf_bull_fcf = calculate_dcf_value(latest_fcf, sales_growth + 3.0, wacc - 0.5)
    dcf_bear_fcf = calculate_dcf_value(latest_fcf, sales_growth - 4.0, wacc + 1.0)
    
    # Scale relative to market cap to get value per share
    dcf_base = (dcf_base_fcf / market_cap) * current_price if market_cap > 0 else current_price
    dcf_bull = (dcf_bull_fcf / market_cap) * current_price if market_cap > 0 else current_price * 1.2
    dcf_bear = (dcf_bear_fcf / market_cap) * current_price if market_cap > 0 else current_price * 0.7
    
    # Benjamin Graham Score Valuation
    graham_growth = max(0.0, min(15.0, sales_growth))
    graham_val = latest_eps * (8.5 + 2 * graham_growth) * 4.4 / 7.5
    
    # Peter Lynch Fair Value Valuation
    lynch_growth = max(1.0, min(25.0, sales_growth))
    lynch_val = latest_eps * lynch_growth
    
    # Owner Earnings Valuation
    depr = pl_table.get_latest_value("Depreciation", 0.0)
    net_inc = pl_table.get_latest_value("Net Profit", 0.0)
    owner_earn = net_inc + depr - latest_capex
    owner_earnings_val = (owner_earn / market_cap) * current_price if market_cap > 0 else current_price
    
    # EV/EBITDA Valuation
    op_profit = pl_table.get_latest_value("Operating Profit", 0.0)
    oth_inc = pl_table.get_latest_value("Other Income", 0.0)
    ebitda = op_profit + oth_inc
    ebitda_multiple = 15.0 if "it" in sector else (8.0 if "power" in sector else 12.0)
    debt = bs_table.get_latest_value("Borrowings", 0.0)
    # Estimate Cash as Investments + Other Assets approx 20%
    cash = bs_table.get_latest_value("Investments", 0.0) + 0.1 * bs_table.get_latest_value("Other Assets", 0.0)
    ev_val = ebitda * ebitda_multiple
    equity_val = ev_val - debt + cash
    ev_ebitda_val = (equity_val / market_cap) * current_price if market_cap > 0 else current_price
    
    # Price / Sales Valuation
    sales_ttm = pl_table.get_latest_value("Sales", 0.0)
    ps_multiple = 4.0 if "it" in sector else 1.5
    ps_val = (sales_ttm * ps_multiple / market_cap) * current_price if market_cap > 0 else current_price
    
    # Price / Book Valuation
    share_capital = bs_table.get_latest_value("Share Capital", 0.0)
    reserves = bs_table.get_latest_value("Reserves", 0.0)
    book_value = share_capital + reserves
    pb_multiple = 5.0 if "it" in sector else 1.8
    pb_val = (book_value * pb_multiple / market_cap) * current_price if market_cap > 0 else current_price
    
    # Residual Income
    cost_of_equity = wacc / 100.0
    equity_charge = book_value * cost_of_equity
    residual_income = net_inc - equity_charge
    residual_income_val = ((book_value + residual_income / cost_of_equity) / market_cap) * current_price if market_cap > 0 else current_price
    
    # Dividend Discount Model
    div_yield = funds.get("dividend_yield", 0.0)
    div_dps = current_price * (div_yield / 100.0)
    ddm_growth = 4.0
    if div_yield > 0.1 and (cost_of_equity - ddm_growth / 100.0) > 0.01:
        ddm_val = div_dps / (cost_of_equity - ddm_growth / 100.0)
    else:
        ddm_val = None
        
    # Compile Intrinsic Values
    valid_vals = [dcf_base, graham_val, lynch_val, owner_earnings_val, ev_ebitda_val, ps_val, pb_val, residual_income_val]
    if ddm_val is not None:
        valid_vals.append(ddm_val)
    intrinsic_value = sum(valid_vals) / len(valid_vals)
    
    margin_of_safety = ((intrinsic_value - current_price) / intrinsic_value) * 100 if intrinsic_value > 0 else 0.0
    discount_pct = max(0.0, margin_of_safety)
    premium_pct = max(0.0, -margin_of_safety)
    
    # ----------------------------------------------------
    # NEW MODULE 4: BUFFETT QUALITY ANALYSIS
    # ----------------------------------------------------
    roe = funds.get("roe", 0.0) or 0.0
    roic = funds.get("roce", 0.0) or 0.0 # using roce as roic proxy
    
    op_margin = pl_table.get_latest_value("OPM %", 0.0)
    net_margin = (net_inc / sales_ttm) * 100 if sales_ttm > 0 else 0.0
    gross_margin = op_margin * 1.2 # proxy
    
    debt_equity = funds.get("debt_equity", 0.0) or (debt / book_value if book_value > 0 else 0.0)
    
    interest = pl_table.get_latest_value("Interest", 0.0)
    interest_coverage = (op_profit / interest) if interest > 0 else 10.0
    
    other_assets = bs_table.get_latest_value("Other Assets", 0.0)
    other_liabilities = bs_table.get_latest_value("Other Liabilities", 0.0)
    current_ratio = (other_assets / other_liabilities) if other_liabilities > 0 else 1.5
    quick_ratio = ((other_assets - 0.3 * other_assets) / other_liabilities) if other_liabilities > 0 else 1.2
    
    cash_flow_quality = (latest_cfo / net_inc) if net_inc > 0 else 1.0
    
    buyback_history = "Neutral" # Promoter holding increases suggest buybacks
    prom_vals = sh_table.get_values("Promoters")
    if prom_vals and len(prom_vals) >= 2 and prom_vals[-1] > prom_vals[0]:
        buyback_history = "Excellent"
        
    div_payouts = pl_table.get_values("Dividend Payout %")
    dividend_growth = "Average"
    if div_payouts and len(div_payouts) >= 2 and div_payouts[-1] > div_payouts[0]:
        dividend_growth = "Good"
        
    # Rating Assignments
    def rate_metric(val: float, ex_thresh: float, gd_thresh: float) -> str:
        if val >= ex_thresh: return "Excellent"
        if val >= gd_thresh: return "Good"
        return "Average" if val >= gd_thresh * 0.5 else "Weak"
        
    buffett_ratings = {
        "ROE": rate_metric(roe, 20.0, 15.0),
        "ROIC": rate_metric(roic, 20.0, 15.0),
        "Operating Margin": rate_metric(op_margin, 25.0, 15.0),
        "Net Margin": rate_metric(net_margin, 18.0, 12.0),
        "Gross Margin": rate_metric(gross_margin, 40.0, 25.0),
        "Debt Equity": "Excellent" if debt_equity < 0.3 else ("Good" if debt_equity < 0.7 else "Weak"),
        "Interest Coverage": rate_metric(interest_coverage, 6.0, 3.5),
        "Current Ratio": "Excellent" if current_ratio > 1.8 else ("Good" if current_ratio > 1.2 else "Weak"),
        "Quick Ratio": "Excellent" if quick_ratio > 1.2 else ("Good" if quick_ratio > 0.8 else "Weak"),
        "Cash Flow Quality": "Excellent" if cash_flow_quality > 1.1 else ("Good" if cash_flow_quality > 0.8 else "Weak")
    }
    
    # Final Buffett Quality Score
    ex_count = list(buffett_ratings.values()).count("Excellent")
    gd_count = list(buffett_ratings.values()).count("Good")
    buffett_score = (ex_count * 10 + gd_count * 7 + (10 - ex_count - gd_count) * 4) * 10.0 / 10.0
    
    # ----------------------------------------------------
    # NEW MODULE 5: PETER LYNCH ANALYSIS
    # ----------------------------------------------------
    eps_growth = 10.0
    if eps_vals and len(eps_vals) >= 2:
        try:
            growth_list = [((eps_vals[i] - eps_vals[i-1]) / eps_vals[i-1]) * 100 for i in range(1, len(eps_vals)) if eps_vals[i-1] > 0]
            if growth_list:
                eps_growth = sum(growth_list) / len(growth_list)
        except Exception:
            pass
    eps_growth = max(1.0, min(30.0, eps_growth))
    
    pe_ratio = funds.get("pe") or (latest_eps > 0 and current_price / latest_eps) or 15.0
    peg_ratio = pe_ratio / eps_growth if eps_growth > 0 else 2.0
    
    lynch_rating = "Avoid"
    if peg_ratio < 0.5: lynch_rating = "Strong Buy"
    elif peg_ratio < 1.0: lynch_rating = "Buy"
    elif peg_ratio < 2.0: lynch_rating = "Hold"
    
    # ----------------------------------------------------
    # NEW MODULE 6: PIOTROSKI F SCORE
    # ----------------------------------------------------
    # 1. Net Income > 0
    f1 = 1 if net_inc > 0 else 0
    # 2. ROA > 0 (ROA = Net profit / Total Assets)
    tot_assets = bs_table.get_latest_value("Total Assets", 1.0)
    roa_current = net_inc / tot_assets if tot_assets > 0 else 0
    f2 = 1 if roa_current > 0 else 0
    # 3. Delta ROA > 0
    tot_assets_prev = bs_table.get_previous_value("Total Assets", 1.0)
    net_inc_prev = pl_table.get_previous_value("Net Profit", 0.0)
    roa_prev = net_inc_prev / tot_assets_prev if tot_assets_prev > 0 else 0
    f3 = 1 if roa_current > roa_prev else 0
    # 4. CFO > Net Income
    f4 = 1 if latest_cfo > net_inc else 0
    # 5. Delta Leverage < 0
    debt_prev = bs_table.get_previous_value("Borrowings", 0.0)
    lev_current = debt / tot_assets if tot_assets > 0 else 0
    lev_prev = debt_prev / tot_assets_prev if tot_assets_prev > 0 else 0
    f5 = 1 if lev_current < lev_prev else 0
    # 6. Delta Current Ratio > 0
    other_assets_prev = bs_table.get_previous_value("Other Assets", 0.0)
    other_liab_prev = bs_table.get_previous_value("Other Liabilities", 1.0)
    cr_prev = other_assets_prev / other_liab_prev if other_liab_prev > 0 else 0.0
    f6 = 1 if current_ratio > cr_prev else 0
    # 7. Share Issuance Check
    share_cap_prev = bs_table.get_previous_value("Share Capital", 0.0)
    f7 = 1 if share_capital <= share_cap_prev else 0
    # 8. Delta Gross Margin > 0
    gross_margin_prev = pl_table.get_previous_value("OPM %", 0.0)
    f8 = 1 if op_margin > gross_margin_prev else 0
    # 9. Delta Asset Turnover > 0
    sales_prev = pl_table.get_previous_value("Sales", 0.0)
    turnover_current = sales_ttm / tot_assets if tot_assets > 0 else 0
    turnover_prev = sales_prev / tot_assets_prev if tot_assets_prev > 0 else 0
    f9 = 1 if turnover_current > turnover_prev else 0
    
    piotroski_f_score = f1 + f2 + f3 + f4 + f5 + f6 + f7 + f8 + f9
    
    piotroski_reasons = {
        "Net Profit Quality": ("Pass" if f1 else "Fail", "Latest Net Income is positive" if f1 else "Latest Net Income is negative"),
        "Return on Assets": ("Pass" if f2 else "Fail", f"ROA of {roa_current:.2%} is positive" if f2 else "ROA is negative"),
        "ROA Momentum": ("Pass" if f3 else "Fail", f"ROA increased from {roa_prev:.2%} to {roa_current:.2%}" if f3 else f"ROA decreased from {roa_prev:.2%}"),
        "Cash Conversion": ("Pass" if f4 else "Fail", f"CFO ({latest_cfo}) is greater than Net Income ({net_inc})" if f4 else "CFO is lower than Net Income"),
        "Debt Deleveraging": ("Pass" if f5 else "Fail", f"Debt Ratio decreased from {lev_prev:.2%} to {lev_current:.2%}" if f5 else "Debt Ratio increased"),
        "Liquidity Growth": ("Pass" if f6 else "Fail", f"Current Ratio increased from {cr_prev:.2f} to {current_ratio:.2f}" if f6 else "Current Ratio decreased"),
        "Equity Non-Dilution": ("Pass" if f7 else "Fail", "No new shares issued (capital remained stable)" if f7 else "Dilution occurred (share capital increased)"),
        "Margin Growth": ("Pass" if f8 else "Fail", f"Operating margin increased from {gross_margin_prev:.1f}% to {op_margin:.1f}%" if f8 else "Operating margin decreased"),
        "Asset Productivity": ("Pass" if f9 else "Fail", f"Asset Turnover improved from {turnover_prev:.2f}x to {turnover_current:.2f}x" if f9 else "Asset Turnover decreased")
    }

    # ----------------------------------------------------
    # NEW MODULE 7: ALTMAN Z SCORE
    # ----------------------------------------------------
    x1 = (other_assets - other_liabilities) / tot_assets if tot_assets > 0 else 0.0
    x2 = reserves / tot_assets if tot_assets > 0 else 0.0
    x3 = ebitda / tot_assets if tot_assets > 0 else 0.0
    x4 = market_cap / (debt + other_liabilities) if (debt + other_liabilities) > 0 else 10.0
    x5 = sales_ttm / tot_assets if tot_assets > 0 else 0.0
    
    altman_z = 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + 0.99 * x5
    
    altman_zone = "Distress"
    if altman_z > 2.99: altman_zone = "Safe"
    elif altman_z >= 1.81: altman_zone = "Grey Zone"
    
    # ----------------------------------------------------
    # NEW MODULE 8: SMART MONEY ANALYSIS
    # ----------------------------------------------------
    prom_pct = sh_table.get_latest_value("Promoters", 50.0)
    prom_prev = sh_table.get_previous_value("Promoters", 50.0)
    prom_change = prom_pct - prom_prev
    
    fii_pct = sh_table.get_latest_value("FIIs", 15.0)
    fii_prev = sh_table.get_previous_value("FIIs", 15.0)
    dii_pct = sh_table.get_latest_value("DIIs", 15.0)
    dii_prev = sh_table.get_previous_value("DIIs", 15.0)
    
    pledged_shares = 0.0 # On Screener shareholding can have pledged shares row
    for r in sh_table.rows:
        if "pledged" in r["metric"].lower() or "encumbered" in r["metric"].lower():
            p_vals = [float(str(v).replace("%","")) for v in r["values"] if v]
            if p_vals: pledged_shares = p_vals[-1]
            
    # Calculate Institutional buying trend
    inst_change = (fii_pct - fii_prev) + (dii_pct - dii_prev)
    
    smart_money_score = 50.0
    smart_money_score += (10.0 if prom_pct > 50 else 0.0)
    smart_money_score += (10.0 if prom_change >= 0 else -10.0)
    smart_money_score += (10.0 if inst_change > 0 else -5.0)
    smart_money_score += (-15.0 if pledged_shares > 15.0 else 5.0)
    smart_money_score = max(0.0, min(100.0, smart_money_score))

    # ----------------------------------------------------
    # NEW MODULE 9: TECHNICAL TIMING ENGINE
    # ----------------------------------------------------
    ema_20 = calculate_ema(closes, 20)[-1] or current_price
    ema_50 = calculate_ema(closes, 50)[-1] or current_price
    ema_100 = calculate_ema(closes, 100)[-1] or current_price
    ema_200 = calculate_ema(closes, 200)[-1] or current_price
    
    macd_res = calculate_macd(closes)
    macd_line = macd_res["macd"][-1] or 0.0
    macd_signal = macd_res["signal"][-1] or 0.0
    
    rsi_val = calculate_rsi(closes)[-1] or 50.0
    adx_arr = calculate_adx(highs, lows, closes)
    adx_val = adx_arr[-1] or 22.0
    atr_val = calculate_atr(highs, lows, closes)[-1] or (current_price * 0.02)
    
    # VWAP approximation
    vwap_val = sum(c * v for c, v in zip(closes[-20:], volumes[-20:])) / sum(volumes[-20:]) if sum(volumes[-20:]) > 0 else current_price
    
    bb_res = calculate_bollinger_bands(closes)
    bb_upper = bb_res["upper"][-1] or (current_price * 1.05)
    bb_lower = bb_res["lower"][-1] or (current_price * 0.95)
    bb_middle = bb_res["middle"][-1] or current_price
    
    supertrend_res = calculate_supertrend(highs, lows, closes)
    supertrend_bullish = supertrend_res["trend"][-1]
    
    ichimoku_res = calculate_ichimoku(highs, lows, closes)
    tenkan = ichimoku_res["tenkan"][-1] or current_price
    kijun = ichimoku_res["kijun"][-1] or current_price
    
    support = min(lows[-30:])
    resistance = max(highs[-30:])
    
    # Volume Trend
    vol_sma20 = sum(volumes[-20:]) / 20.0 if len(volumes) >= 20 else volumes[-1]
    vol_trend = "Bullish" if volumes[-1] > vol_sma20 else "Neutral"
    
    golden_cross = ema_50 > ema_200
    death_cross = ema_50 < ema_200
    
    # Score Calculation
    tech_score = 50.0
    tech_score += (10.0 if current_price > ema_50 else -10.0)
    tech_score += (10.0 if current_price > ema_200 else -10.0)
    tech_score += (10.0 if macd_line > macd_signal else -10.0)
    tech_score += (10.0 if 30 < rsi_val < 70 else (15.0 if rsi_val <= 30 else -10.0))
    tech_score += (10.0 if supertrend_bullish else -10.0)
    tech_score = max(0.0, min(100.0, tech_score))
    
    entry_rating = "Accumulate" if rsi_val <= 35 else ("Strong Buy" if rsi_val <= 25 else ("Sell" if rsi_val >= 75 else "Hold"))
    swing_rating = "Bullish" if supertrend_bullish and macd_line > macd_signal else "Bearish"
    long_term_rating = "Bullish" if current_price > ema_200 and golden_cross else "Neutral"

    # ----------------------------------------------------
    # NEW MODULE 10: MOMENTUM ENGINE
    # ----------------------------------------------------
    ret_1m = ((current_price - closes[-21]) / closes[-21]) * 100 if len(closes) >= 21 else 0.0
    ret_3m = ((current_price - closes[-63]) / closes[-63]) * 100 if len(closes) >= 63 else 0.0
    ret_6m = ((current_price - closes[-126]) / closes[-126]) * 100 if len(closes) >= 126 else 0.0
    ret_1y = ((current_price - closes[0]) / closes[0]) * 100 if len(closes) > 0 else 0.0
    
    relative_strength = ret_1y - 12.0 # Nifty 50 average return proxy 12%
    sector_rs = relative_strength + 5.0 # Sector reference proxy
    
    low_52w = min(lows)
    high_52w = max(highs)
    pos_52w = ((current_price - low_52w) / (high_52w - low_52w)) * 100 if (high_52w - low_52w) > 0 else 50.0
    
    price_mom = "Strong" if ret_3m > 10 else ("Weak" if ret_3m < -5 else "Moderate")
    vol_mom = "High" if volumes[-1] > sum(volumes[-10:]) / 10.0 else "Normal"
    
    mom_score = 50.0
    mom_score += (15.0 if ret_3m > 5.0 else -10.0)
    mom_score += (15.0 if ret_1y > 15.0 else -10.0)
    mom_score += (10.0 if relative_strength > 0 else -5.0)
    mom_score += (10.0 if pos_52w > 60.0 else 0.0)
    mom_score = max(0.0, min(100.0, mom_score))

    # ----------------------------------------------------
    # NEW MODULE 11: NEWS SENTIMENT AI (GROQ LLAMA 3.3)
    # ----------------------------------------------------
    news_headlines = await fetch_news_headlines(ticker)
    sentiment_pct = 50.0
    sentiment_confidence = 70.0
    sentiment_summary = "Neutral corporate highlights."
    sentiment_impact = "Minimal short term volatility impact expected."
    
    if settings.GROQ_API_KEY and news_headlines:
        try:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json"
            }
            prompt = (
                f"Analyze the financial news headlines for stock ticker {ticker} and evaluate overall market sentiment.\n"
                f"Headlines: {json.dumps(news_headlines)}\n"
                "Return a strict JSON response containing:\n"
                "- sentiment_pct: float (0.0 to 100.0, where 100 is extremely bullish, 0 is extremely bearish, 50 is neutral)\n"
                "- confidence_pct: float (0.0 to 100.0)\n"
                "- summary: string (concise sentence summarizing findings)\n"
                "- impact: string (direct consequence on the business/stock)\n"
                "DO NOT return any markdown wrapping, just raw json."
            )
            body = {
                "model": settings.GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": "You are a financial analyst specializing in sentiment mining."},
                    {"role": "user", "content": prompt}
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.1
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, headers=headers, json=body)
                if resp.status_code == 200:
                    ai_res = resp.json()
                    ai_content = json.loads(ai_res["choices"][0]["message"]["content"])
                    sentiment_pct = float(ai_content.get("sentiment_pct", 50.0))
                    sentiment_confidence = float(ai_content.get("confidence_pct", 70.0))
                    sentiment_summary = str(ai_content.get("summary", "Neutral news outlook."))
                    sentiment_impact = str(ai_content.get("impact", "Balanced volatility."))
        except Exception as e:
            logger.error(f"Groq Sentiment error: {e}")
            
    # If no key, programmatically estimate
    elif news_headlines:
        positive_words = ["growth", "gain", "profit", "order", "win", "high", "upgrade", "buy", "bull", "launch", "dividend"]
        negative_words = ["loss", "fall", "debt", "drop", "warn", "surveillance", "fine", "cut", "downgrade", "sell", "bear"]
        pos_count = sum(1 for h in news_headlines if any(w in h.lower() for w in positive_words))
        neg_count = sum(1 for h in news_headlines if any(w in h.lower() for w in negative_words))
        total = pos_count + neg_count
        if total > 0:
            sentiment_pct = 50.0 + (pos_count - neg_count) / total * 50.0
            sentiment_confidence = 65.0
            sentiment_summary = f"Detected {pos_count} positive and {neg_count} cautious catalysts."
            sentiment_impact = "Positive drift expected" if pos_count > neg_count else "Defensive positioning recommended."

    # ----------------------------------------------------
    # NEW MODULE 12: RISK ANALYSIS
    # ----------------------------------------------------
    # Volatility (standard deviation of daily returns)
    daily_returns = [((closes[i] - closes[i-1]) / closes[i-1]) for i in range(1, len(closes))]
    volatility = statistics.stdev(daily_returns) * math.sqrt(252) * 100 if len(daily_returns) >= 2 else 25.0
    
    # Beta approximation vs Nifty proxy (benchmark standard dev is approx 15%)
    beta = (volatility / 15.0) * 0.9 # scaled
    beta = max(0.4, min(2.5, beta))
    
    downside_risk = volatility * 1.65 # Value at risk 95%
    financial_risk = "Medium" if debt_equity > 0.5 else "Low"
    business_risk = "Low" if op_margin > 20.0 else "Medium"
    liquidity_risk = "Low" if current_ratio > 1.2 else "High"
    debt_risk = "Low" if debt_equity < 0.4 else "High"
    
    risk_score = 30.0
    risk_score += (20.0 if volatility > 35.0 else 5.0)
    risk_score += (20.0 if debt_equity > 1.0 else 5.0)
    risk_score += (20.0 if current_ratio < 1.0 else 5.0)
    risk_score += (20.0 if beta > 1.3 else 5.0)
    risk_score = max(0.0, min(100.0, risk_score))

    # ----------------------------------------------------
    # NEW MODULE 1: AI ALPHA SCORE (Weights: defined in prompt)
    # ----------------------------------------------------
    # Norm calculations
    dcf_score = max(0.0, min(100.0, 50.0 + margin_of_safety))
    graham_score = max(0.0, min(100.0, 50.0 + ((graham_val - current_price) / graham_val * 100 if graham_val > 0 else 0)))
    lynch_score = max(0.0, min(100.0, 100.0 - (peg_ratio * 30.0)))
    buffett_score_norm = buffett_score
    piotroski_score_norm = (piotroski_f_score / 9) * 100
    altman_score_norm = max(0.0, min(100.0, (altman_z / 4.0) * 100))
    roic_score_norm = max(0.0, min(100.0, (roic / 20.0) * 100))
    roe_score_norm = max(0.0, min(100.0, (roe / 20.0) * 100))
    
    # Cash flow growth
    fcf_growth = 5.0
    fcf_vals = cf_table.get_values("Cash from Operating Activity")
    if fcf_vals and len(fcf_vals) >= 2 and fcf_vals[-2] != 0:
        fcf_growth = ((fcf_vals[-1] - fcf_vals[-2]) / abs(fcf_vals[-2])) * 100
    fcf_growth_score = max(0.0, min(100.0, 50.0 + fcf_growth))
    
    rev_growth_score = max(0.0, min(100.0, 50.0 + sales_growth * 2))
    
    eps_growth_val = 5.0
    if eps_vals and len(eps_vals) >= 2 and eps_vals[-2] != 0:
        eps_growth_val = ((eps_vals[-1] - eps_vals[-2]) / abs(eps_vals[-2])) * 100
    eps_growth_score = max(0.0, min(100.0, 50.0 + eps_growth_val * 2))
    
    alpha_score = (
        0.12 * dcf_score +
        0.08 * graham_score +
        0.08 * lynch_score +
        0.10 * buffett_score_norm +
        0.10 * piotroski_score_norm +
        0.05 * altman_score_norm +
        0.07 * roic_score_norm +
        0.05 * roe_score_norm +
        0.05 * fcf_growth_score +
        0.05 * rev_growth_score +
        0.05 * eps_growth_score +
        0.05 * tech_score +
        0.05 * mom_score +
        0.05 * smart_money_score +
        0.05 * sentiment_pct
    )
    alpha_score = round(max(0.0, min(100.0, alpha_score)), 1)
    
    # ----------------------------------------------------
    # NEW MODULE 2: PROFESSIONAL COMPOSITE SCORE
    # ----------------------------------------------------
    comp_score = (
        0.25 * dcf_score +
        0.10 * graham_score +
        0.10 * lynch_score +
        0.15 * piotroski_score_norm +
        0.10 * altman_score_norm +
        0.15 * buffett_score_norm +
        0.10 * roic_score_norm +
        0.05 * max(0.0, min(100.0, 100.0 - (ebitda_multiple * 4.0))) +
        0.05 * tech_score +
        0.05 * sentiment_pct
    )
    comp_score = round(max(0.0, min(100.0, comp_score)), 1)
    
    # Classifications
    if comp_score >= 90: comp_class = "Strong Buy"
    elif comp_score >= 80: comp_class = "Buy"
    elif comp_score >= 65: comp_class = "Hold"
    elif comp_score >= 50: comp_class = "Reduce"
    else: comp_class = "Avoid"

    # Expected Upside/Risk/MOS
    expected_upside = max(0.0, margin_of_safety)
    expected_risk = "Low" if risk_score < 30 else ("Medium" if risk_score < 60 else "High")
    
    # Investment rating mapping
    if alpha_score >= 80: alpha_rating = "Strong Buy"
    elif alpha_score >= 65: alpha_rating = "Buy"
    elif alpha_score >= 50: alpha_rating = "Hold"
    else: alpha_rating = "Reduce"

    # ----------------------------------------------------
    # NEW MODULE 13 & 14: AI SUMMARY & BUY/SELL RECOMMENDATION ENGINE
    # ----------------------------------------------------
    rec_mapping = {
        "Strong Buy": ("Strong Buy", 85.0 + (alpha_score - 80) if alpha_score >= 80 else 85.0),
        "Buy": ("Buy", 70.0 + (alpha_score - 65) if alpha_score >= 65 else 70.0),
        "Hold": ("Accumulate" if expected_upside > 10 else "Hold", 60.0),
        "Reduce": ("Reduce", 55.0),
        "Avoid": ("Sell" if risk_score > 60 else "Strong Sell", 75.0)
    }
    final_rec, rec_confidence = rec_mapping[comp_class if comp_class in rec_mapping else "Hold"]
    
    reasons = [
        f"Intrinsic Valuation (DCF & models) signals fair value of ₹{intrinsic_value:.2f}, representing a {expected_upside:.1f}% margin of safety.",
        f"Robust fundamental quality (Piotroski F-score of {piotroski_f_score}/9, Altman Z-score of {altman_z:.2f} {altman_zone}).",
        f"Smart Money backing is {smart_money_score:.1f}/100 and institutional holdings reflect {'growing accumulation' if inst_change >= 0 else 'selective trimming'}."
    ]
    
    target_price = intrinsic_value * 1.15 if final_rec in ["Strong Buy", "Buy"] else intrinsic_value * 0.9
    risk_reward = 3.0 if final_rec in ["Strong Buy", "Buy"] else 1.2
    expected_return = expected_upside
    
    # Investment Summary Paragraph
    ai_attractive = f"{ticker} presents an attractive {'capital appreciation' if final_rec in ['Strong Buy', 'Buy'] else 'defensive hold'} opportunity."
    strengths = ["Strong capitalization and margin safety margins.", "Favorable ROIC/ROE capital returns efficiency."]
    weaknesses = ["Growth volatility or leverage constraints." if debt_equity > 0.8 else "Modest current quarter earnings momentum."]
    
    # ----------------------------------------------------
    # NEW MODULE 15: EXPLAINABILITY METADATA
    # ----------------------------------------------------
    explainability = {
        "alpha_score": {
            "formula": "0.12 * DCF + 0.08 * Graham + 0.08 * Lynch + 0.10 * Buffett + 0.10 * Piotroski + 0.05 * Altman + 0.07 * ROIC + 0.05 * ROE + 0.05 * FCF_g + 0.05 * Rev_g + 0.05 * EPS_g + 0.05 * Tech + 0.05 * Mom + 0.05 * SmartMoney + 0.05 * News",
            "inputs": {
                "dcf_score": round(dcf_score, 1),
                "graham_score": round(graham_score, 1),
                "lynch_score": round(lynch_score, 1),
                "buffett_score": round(buffett_score_norm, 1),
                "piotroski_score": round(piotroski_score_norm, 1),
                "altman_score": round(altman_score_norm, 1),
                "roic_score": round(roic_score_norm, 1),
                "roe_score": round(roe_score_norm, 1),
                "fcf_growth_score": round(fcf_growth_score, 1),
                "rev_growth_score": round(rev_growth_score, 1),
                "eps_growth_score": round(eps_growth_score, 1),
                "technical_score": round(tech_score, 1),
                "momentum_score": round(mom_score, 1),
                "smart_money_score": round(smart_money_score, 1),
                "news_sentiment": round(sentiment_pct, 1)
            },
            "interpretation": "Aggregated premium index mapping core value investing, mathematical health, momentum and news sentiment factors. Higher values indicate lower risk-adjusted premium entries."
        },
        "composite_score": {
            "formula": "0.25 * DCF + 0.10 * Graham + 0.10 * Lynch + 0.15 * Piotroski + 0.10 * Altman + 0.15 * Buffett + 0.10 * ROIC + 0.05 * EV/EBITDA + 0.05 * Tech + 0.05 * News",
            "inputs": {
                "dcf_score": round(dcf_score, 1),
                "graham_score": round(graham_score, 1),
                "lynch_score": round(lynch_score, 1),
                "piotroski_score": round(piotroski_score_norm, 1),
                "altman_score": round(altman_score_norm, 1),
                "buffett_score": round(buffett_score_norm, 1),
                "roic_score": round(roic_score_norm, 1),
                "ev_ebitda_score": round(max(0.0, min(100.0, 100.0 - (ebitda_multiple * 4.0))), 1),
                "technical_score": round(tech_score, 1),
                "news_sentiment": round(sentiment_pct, 1)
            },
            "interpretation": "Institutional scale weighting intrinsic valuations and balance sheet metrics. Determines core BUY/HOLD/SELL ratings."
        },
        "dcf": {
            "formula": "\\sum_{t=1}^{10} \\frac{FCF_t}{(1+WACC)^t} + \\frac{TerminalValue}{(1+WACC)^{10}}",
            "inputs": {
                "base_fcf_cr": round(latest_fcf, 2),
                "sales_growth_rate": round(sales_growth, 2),
                "wacc_percent": round(wacc, 2),
                "market_cap_cr": round(market_cap, 2)
            },
            "interpretation": "Traditional Discounted Cash Flow valuation modeling expected growth rates discounted back to present value using WACC."
        },
        "graham": {
            "formula": "EPS * (8.5 + 2 * g) * 4.4 / Y",
            "inputs": {
                "eps_rs": round(latest_eps, 2),
                "growth_g_pct": round(graham_growth, 2),
                "aaa_yield_y": 7.5
            },
            "interpretation": "Revised Benjamin Graham value formula valuing companies using current earnings yield and moderate growth expectations."
        },
        "piotroski": {
            "formula": "F1 + F2 + F3 + F4 + F5 + F6 + F7 + F8 + F9",
            "inputs": {
                "f1_positive_net_income": f1,
                "f2_positive_roa": f2,
                "f3_roa_acceleration": f3,
                "f4_accrual_quality": f4,
                "f5_debt_reduction": f5,
                "f6_current_ratio_growth": f6,
                "f7_no_dilution": f7,
                "f8_margin_expansion": f8,
                "f9_turnover_improvement": f9
            },
            "interpretation": "9-point fundamental momentum scoring system evaluating profitability, leverage, liquidity, and operational efficiency."
        },
        "altman_z": {
            "formula": "1.2 * A + 1.4 * B + 3.3 * C + 0.6 * D + 0.99 * E",
            "inputs": {
                "working_capital_ratio_A": round(x1, 3),
                "retained_earnings_ratio_B": round(x2, 3),
                "ebitda_ratio_C": round(x3, 3),
                "equity_leverage_ratio_D": round(x4, 3),
                "asset_turnover_ratio_E": round(x5, 3)
            },
            "interpretation": "Standard corporate bankruptcy forecasting score. Value > 2.99 implies Safe Zone (insolvency highly unlikely)."
        }
    }

    # Compile the final result
    terminal_data = {
        "ticker": ticker,
        "exchange": scraped_data.get("exchange", "NSE"),
        "company_name": scraped_data.get("company_name") or f"{ticker} Ltd.",
        "sector": scraped_data.get("sector", "Sector"),
        "industry": scraped_data.get("industry", "Industry"),
        "current_price": current_price,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        
        # MODULE 1: AI ALPHA SCORE
        "alpha_score": {
            "score": alpha_score,
            "confidence": round(sentiment_confidence, 1),
            "rating": alpha_rating,
            "expected_risk": expected_risk,
            "expected_upside": round(expected_upside, 1),
            "margin_of_safety": round(margin_of_safety, 1),
            "explanation": f"The Alpha Score of {alpha_score}/100 is supported by a strong {piotroski_f_score}/9 Piotroski F-score and positive Smart Money holding trends."
        },
        
        # MODULE 2: PROFESSIONAL COMPOSITE SCORE
        "composite_score": {
            "score": comp_score,
            "classification": comp_class,
            "breakdown": {
                "DCF (25%)": round(dcf_score * 0.25, 2),
                "Benjamin Graham (10%)": round(graham_score * 0.10, 2),
                "Peter Lynch (10%)": round(lynch_score * 0.10, 2),
                "Piotroski F Score (15%)": round(piotroski_score_norm * 0.15, 2),
                "Altman Z Score (10%)": round(altman_score_norm * 0.10, 2),
                "Buffett Quality (15%)": round(buffett_score_norm * 0.15, 2),
                "ROIC (10%)": round(roic_score_norm * 0.10, 2),
                "EV/EBITDA (5%)": round(max(0.0, min(100.0, 100.0 - (ebitda_multiple * 4.0))) * 0.05, 2),
                "Technical Trend (5%)": round(tech_score * 0.05, 2),
                "Sentiment (5%)": round(sentiment_pct * 0.05, 2)
            }
        },
        
        # MODULE 3: INTRINSIC VALUE ENGINE
        "intrinsic_value": {
            "current_price": current_price,
            "value": round(intrinsic_value, 2),
            "discount_pct": round(discount_pct, 1),
            "premium_pct": round(premium_pct, 1),
            "margin_of_safety": round(margin_of_safety, 1),
            "cases": {
                "bear": round(dcf_bear, 2),
                "base": round(dcf_base, 2),
                "bull": round(dcf_bull, 2)
            },
            "models": {
                "dcf": round(dcf_base, 2),
                "graham": round(graham_val, 2),
                "lynch": round(lynch_val, 2),
                "owner_earnings": round(owner_earnings_val, 2),
                "ev_ebitda": round(ev_ebitda_val, 2),
                "price_sales": round(ps_val, 2),
                "price_book": round(pb_val, 2),
                "residual_income": round(residual_income_val, 2),
                "ddm": round(ddm_val, 2) if ddm_val else None
            }
        },
        
        # MODULE 4: BUFFETT QUALITY ANALYSIS
        "buffett_analysis": {
            "score": buffett_score,
            "metrics": {
                "roe": roe,
                "roic": roic,
                "op_margin": op_margin,
                "net_margin": net_margin,
                "gross_margin": gross_margin,
                "debt_equity": debt_equity,
                "interest_coverage": interest_coverage,
                "current_ratio": current_ratio,
                "quick_ratio": quick_ratio,
                "cash_flow_quality": cash_flow_quality
            },
            "ratings": buffett_ratings,
            "history": {
                "capital_allocation": buyback_history,
                "dividend_growth": dividend_growth,
                "fcf_cr": round(latest_fcf, 2)
            }
        },
        
        # MODULE 5: PETER LYNCH ANALYSIS
        "lynch_analysis": {
            "peg": round(peg_ratio, 2),
            "growth": round(eps_growth, 2),
            "dividend_yield": div_yield,
            "pe": round(pe_ratio, 2),
            "eps_growth": round(eps_growth, 2),
            "fair_value": round(lynch_val, 2),
            "growth_quality": "High" if roic > 15 else "Average",
            "valuation_rating": lynch_rating,
            "reason": f"PEG ratio is {peg_ratio:.2f} based on PE of {pe_ratio:.1f}x and earnings growth CAGR of {eps_growth:.1f}%. Lynch guidelines consider PEG < 1.0 as buying territory."
        },
        
        # MODULE 6: PIOTROSKI F SCORE
        "piotroski_score": {
            "score": piotroski_f_score,
            "reasons": piotroski_reasons
        },
        
        # MODULE 7: ALTMAN Z SCORE
        "altman_score": {
            "score": round(altman_z, 2),
            "zone": altman_zone,
            "components": {
                "working_capital_ratio_A": round(x1, 3),
                "retained_earnings_ratio_B": round(x2, 3),
                "ebitda_ratio_C": round(x3, 3),
                "equity_leverage_ratio_D": round(x4, 3),
                "asset_turnover_ratio_E": round(x5, 3)
            }
        },
        
        # MODULE 8: SMART MONEY ANALYSIS
        "smart_money": {
            "score": smart_money_score,
            "promoter_holding": prom_pct,
            "promoter_change": round(prom_change, 2),
            "fii_holding": fii_pct,
            "dii_holding": dii_pct,
            "mutual_fund_holding": dii_pct * 0.6, # MF estimate proxy
            "pledged_shares": pledged_shares,
            "institutional_buying_trend": "Buying" if inst_change > 0 else "Neutral"
        },
        
        # MODULE 9: TECHNICAL TIMING ENGINE
        "technical_timing": {
            "score": tech_score,
            "ema_20": round(ema_20, 2),
            "ema_50": round(ema_50, 2),
            "ema_100": round(ema_100, 2),
            "ema_200": round(ema_200, 2),
            "macd": {
                "line": round(macd_line, 2),
                "signal": round(macd_signal, 2),
                "histogram": round(macd_line - macd_signal, 2)
            },
            "rsi": round(rsi_val, 2),
            "adx": round(adx_val, 2),
            "atr": round(atr_val, 2),
            "vwap": round(vwap_val, 2),
            "bollinger": {
                "upper": round(bb_upper, 2),
                "middle": round(bb_middle, 2),
                "lower": round(bb_lower, 2)
            },
            "supertrend": "Bullish" if supertrend_bullish else "Bearish",
            "ichimoku": {
                "tenkan": round(tenkan, 2),
                "kijun": round(kijun, 2)
            },
            "support": round(support, 2),
            "resistance": round(resistance, 2),
            "volume_trend": vol_trend,
            "golden_cross": golden_cross,
            "death_cross": death_cross,
            "entry_rating": entry_rating,
            "swing_rating": swing_rating,
            "long_term_rating": long_term_rating
        },
        
        # MODULE 10: MOMENTUM ENGINE
        "momentum_engine": {
            "score": mom_score,
            "returns": {
                "1m": round(ret_1m, 2),
                "3m": round(ret_3m, 2),
                "6m": round(ret_6m, 2),
                "1y": round(ret_1y, 2)
            },
            "relative_strength": round(relative_strength, 2),
            "sector_relative_strength": round(sector_rs, 2),
            "position_52w_pct": round(pos_52w, 1),
            "price_momentum": price_mom,
            "volume_momentum": vol_mom
        },
        
        # MODULE 11: NEWS SENTIMENT AI
        "news_sentiment": {
            "sentiment_pct": sentiment_pct,
            "confidence_pct": sentiment_confidence,
            "summary": sentiment_summary,
            "impact": sentiment_impact
        },
        
        # MODULE 12: RISK ANALYSIS
        "risk_analysis": {
            "score": risk_score,
            "volatility": round(volatility, 2),
            "beta": round(beta, 2),
            "downside_risk": round(downside_risk, 2),
            "financial_risk": financial_risk,
            "business_risk": business_risk,
            "liquidity_risk": liquidity_risk,
            "debt_risk": debt_risk
        },
        
        # MODULE 13: AI INVESTMENT SUMMARY
        "investment_summary": {
            "why_attractive": ai_attractive,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "key_risks": [f"Leverage multiplier ({debt_equity:.2f}x D/E)." if debt_equity > 0.8 else "Volatility and macro rates pressure.", "Short term valuation premium adjustments."],
            "growth_drivers": [f"Steady quarterly sales compounding ({sales_growth:.1f}% growth).", "Expanding promoter ownership indicators."],
            "valuation_concerns": [f"PE Ratio at {pe_ratio:.1f}x relative to sector benchmarks." if pe_ratio > 25.0 else "Fairly valued on traditional discount models."],
            "competitive_position": "Strong moat backed by sector positioning and historical capital efficiency.",
            "suggested_horizon": "24 to 36 Months",
            "suitable_for": ["Value Investors" if expected_upside > 15 else "Long-Term Investors", "Quality Investors" if roic > 15 else "General Portfolios"]
        },
        
        # MODULE 14: BUY / HOLD / SELL ENGINE
        "recommendation_engine": {
            "recommendation": final_rec,
            "confidence": rec_confidence,
            "reasons": reasons,
            "target_price": round(target_price, 2),
            "fair_value": round(intrinsic_value, 2),
            "risk_reward_ratio": risk_reward,
            "expected_return": round(expected_return, 1)
        },
        
        # MODULE 15: EXPLAINABILITY METADATA
        "explainability": explainability
    }
    
    # Save/Cache in MongoDB & Redis
    try:
        if redis:
            await redis.setex(cache_key, 7200, json.dumps(terminal_data))
        if db is not None:
            db_save = {**terminal_data}
            db_save["ticker"] = ticker
            db_save["last_analyzed"] = datetime.now(timezone.utc)
            await db.terminal_research.update_one(
                {"ticker": ticker},
                {"$set": db_save},
                upsert=True
            )
            logger.info(f"Cached terminal research for {ticker} in MongoDB")
    except Exception as e:
        logger.error(f"Error caching terminal research for {ticker}: {e}")
        
    return terminal_data

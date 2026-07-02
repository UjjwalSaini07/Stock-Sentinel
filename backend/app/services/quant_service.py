import math
import random
import json
import asyncio
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
import httpx
from app.database import get_db, get_redis

# Standard NSE universe for benchmark factor scans
BENCHMARK_UNIVERSE = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "LT", "SBIN", "BHARTIARTL", "ITC", "KOTAKBANK"]

# Helper to normalize tickers
def clean_ticker(ticker: str) -> str:
    ticker = ticker.strip().upper()
    if ticker.endswith(".NS") or ticker.endswith(".BO") or "^" in ticker:
        return ticker
    return f"{ticker}.NS"

# Standard normal distribution sampler using Box-Muller transform
def random_normal() -> float:
    u1 = 1.0 - random.random() # avoid 0.0
    u2 = random.random()
    return math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)

# Math utilities for lists
def mean(values: List[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)

def std_dev(values: List[float], mu: float = None) -> float:
    if len(values) < 2:
        return 0.0
    if mu is None:
        mu = mean(values)
    variance = sum((x - mu) ** 2 for x in values) / (len(values) - 1)
    return math.sqrt(variance)

def covariance(x: List[float], y: List[float], mean_x: float = None, mean_y: float = None) -> float:
    n = len(x)
    if n < 2 or n != len(y):
        return 0.0
    if mean_x is None:
        mean_x = mean(x)
    if mean_y is None:
        mean_y = mean(y)
    return sum((x[i] - mean_x) * (y[i] - mean_y) for i in range(n)) / (n - 1)


# ── Technical Indicator Calculations ──────────────────────
def calculate_sma(prices: List[float], period: int) -> List[Optional[float]]:
    sma = []
    for i in range(len(prices)):
        if i < period - 1:
            sma.append(None)
        else:
            sma.append(sum(prices[i - period + 1 : i + 1]) / period)
    return sma

def calculate_ema(prices: List[float], period: int) -> List[Optional[float]]:
    ema = []
    if not prices:
        return ema
    k = 2.0 / (period + 1)
    # Start with SMA as first value
    current_ema = sum(prices[:period]) / period if len(prices) >= period else prices[0]
    
    for i in range(len(prices)):
        if i < period - 1:
            ema.append(None)
        elif i == period - 1:
            ema.append(current_ema)
        else:
            current_ema = prices[i] * k + current_ema * (1.0 - k)
            ema.append(current_ema)
    return ema

def calculate_rsi(prices: List[float], period: int = 14) -> List[Optional[float]]:
    rsi_list = [None] * len(prices)
    if len(prices) <= period:
        return rsi_list
        
    deltas = [prices[i] - prices[i-1] for i in range(1, len(prices))]
    gains = [d if d > 0 else 0.0 for d in deltas]
    losses = [-d if d < 0 else 0.0 for d in deltas]
    
    # First average
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    
    if avg_loss == 0:
        rsi_list[period] = 100.0 if avg_gain > 0 else 50.0
    else:
        rsi_list[period] = 100.0 - (100.0 / (1.0 + (avg_gain / avg_loss)))
        
    for i in range(period + 1, len(prices)):
        idx = i - 1
        avg_gain = (avg_gain * (period - 1) + gains[idx]) / period
        avg_loss = (avg_loss * (period - 1) + losses[idx]) / period
        
        if avg_loss == 0:
            rsi_list[i] = 100.0 if avg_gain > 0 else 50.0
        else:
            rs = avg_gain / avg_loss
            rsi_list[i] = 100.0 - (100.0 / (1.0 + rs))
            
    return rsi_list

def calculate_macd(prices: List[float], fast: int = 12, slow: int = 26, signal: int = 9) -> Dict[str, List[Optional[float]]]:
    # Compute EMAs
    ema_fast = calculate_ema(prices, fast)
    ema_slow = calculate_ema(prices, slow)
    
    macd_line = []
    for i in range(len(prices)):
        f = ema_fast[i]
        s = ema_slow[i]
        if f is not None and s is not None:
            macd_line.append(f - s)
        else:
            macd_line.append(None)
            
    # Filter out initial None values to compute Signal Line
    warmup_index = next((i for i, x in enumerate(macd_line) if x is not None), len(macd_line))
    macd_valid = macd_line[warmup_index:]
    signal_valid = calculate_ema(macd_valid, signal)
    
    signal_line = [None] * warmup_index + signal_valid
    histogram = []
    for i in range(len(prices)):
        m = macd_line[i]
        sig = signal_line[i]
        if m is not None and sig is not None:
            histogram.append(m - sig)
        else:
            histogram.append(None)
            
    return {
        "macd": macd_line,
        "signal": signal_line,
        "histogram": histogram
    }

def calculate_bollinger_bands(prices: List[float], period: int = 20, num_std: float = 2.0) -> Dict[str, List[Optional[float]]]:
    middle = calculate_sma(prices, period)
    upper = []
    lower = []
    
    for i in range(len(prices)):
        m = middle[i]
        if m is None:
            upper.append(None)
            lower.append(None)
        else:
            window = prices[i - period + 1 : i + 1]
            dev = std_dev(window, m)
            upper.append(m + num_std * dev)
            lower.append(m - num_std * dev)
            
    return {
        "middle": middle,
        "upper": upper,
        "lower": lower
    }


# ── Historical Price Ingestion with Redis Cache ───────────
async def fetch_historical_prices(ticker: str, range_str: str = "1y") -> Optional[Dict[str, Any]]:
    redis = get_redis()
    ticker = ticker.strip().upper()
    cache_key = f"quant:hist:{ticker}:{range_str}"
    
    cached = await redis.get(cache_key) if redis else None
    if cached:
        return json.loads(cached)
        
    # We will try suffixes in order to handle US stocks, Indian stocks, indices, and crypto
    candidates = []
    if ticker.endswith(".NS") or ticker.endswith(".BO") or "^" in ticker or "-" in ticker:
        candidates = [ticker]
    else:
        candidates = [f"{ticker}.NS", ticker, f"{ticker}.BO"]
        
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    for symbol in candidates:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range={range_str}&interval=1d"
        try:
            async with httpx.AsyncClient(headers=headers, timeout=10.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    chart = data.get("chart", {})
                    result = chart.get("result", [])
                    if result and result[0].get("timestamp"):
                        timestamps = result[0].get("timestamp", [])
                        indicators = result[0].get("indicators", {})
                        quote = indicators.get("quote", [{}])[0]
                        closes = quote.get("close", [])
                        volumes = quote.get("volume", [])
                        highs = quote.get("high", [])
                        lows = quote.get("low", [])
                        
                        # Clean None values by forward filling
                        last_close = None
                        last_vol = 0
                        last_high = None
                        last_low = None
                        cleaned_closes = []
                        cleaned_volumes = []
                        cleaned_highs = []
                        cleaned_lows = []
                        cleaned_timestamps = []
                        
                        for i in range(len(timestamps)):
                            c = closes[i]
                            v = volumes[i]
                            h = highs[i]
                            l = lows[i]
                            
                            if c is not None:
                                last_close = c
                            if v is not None:
                                last_vol = v
                            if h is not None:
                                last_high = h
                            if l is not None:
                                last_low = l
                                
                            if last_close is not None:
                                cleaned_closes.append(last_close)
                                cleaned_volumes.append(last_vol)
                                cleaned_highs.append(last_high if last_high is not None else last_close)
                                cleaned_lows.append(last_low if last_low is not None else last_close)
                                cleaned_timestamps.append(timestamps[i])
                                
                        if cleaned_closes:
                            res = {
                                "ticker": symbol.split(".")[0],
                                "timestamps": cleaned_timestamps,
                                "close": cleaned_closes,
                                "volume": cleaned_volumes,
                                "high": cleaned_highs,
                                "low": cleaned_lows
                            }
                            # Cache the result under the original searched ticker
                            if redis:
                                await redis.setex(cache_key, 7200, json.dumps(res))
                            return res
        except Exception as e:
            print(f"[QuantService] Historical fetch error for {symbol}: {e}")
            
    return None


# ── Backtesting Engine ────────────────────────────────────
async def run_strategy_backtest(
    ticker: str, 
    indicators_config: List[Dict[str, Any]], 
    logic: str = "AND", 
    initial_capital: float = 100000.0,
    range_str: str = "1y"
) -> Dict[str, Any]:
    
    hist = await fetch_historical_prices(ticker, range_str)
    if not hist or not hist["close"]:
        return {"error": f"Failed to retrieve price history for {ticker}"}
        
    prices = hist["close"]
    volumes = hist["volume"]
    timestamps = hist["timestamps"]
    dates = [datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d") for ts in timestamps]
    n_days = len(prices)
    
    # Calculate indicator arrays
    ind_vals = {}
    warmup = 1
    
    for config in indicators_config:
        ind_type = config.get("type", "").upper()
        params = config.get("params", {})
        
        if ind_type == "RSI":
            period = params.get("period", 14)
            ind_vals["RSI"] = calculate_rsi(prices, period)
            warmup = max(warmup, period + 1)
        elif ind_type == "SMA":
            period = params.get("period", 50)
            ind_vals["SMA"] = calculate_sma(prices, period)
            warmup = max(warmup, period)
        elif ind_type == "EMA":
            period = params.get("period", 20)
            ind_vals["EMA"] = calculate_ema(prices, period)
            warmup = max(warmup, period)
        elif ind_type == "MACD":
            fast = params.get("fast", 12)
            slow = params.get("slow", 26)
            sig = params.get("signal", 9)
            macd_res = calculate_macd(prices, fast, slow, sig)
            ind_vals["MACD"] = macd_res["macd"]
            ind_vals["MACD_SIGNAL"] = macd_res["signal"]
            warmup = max(warmup, slow + sig)
        elif ind_type == "BB":
            period = params.get("period", 20)
            num_std = params.get("num_std", 2.0)
            bb_res = calculate_bollinger_bands(prices, period, num_std)
            ind_vals["BB_UPPER"] = bb_res["upper"]
            ind_vals["BB_LOWER"] = bb_res["lower"]
            warmup = max(warmup, period)
            
    # Trade execution loop
    cash = initial_capital
    shares = 0.0
    equity_curve = []
    trades = []
    last_action = None # 'BUY' or 'SELL'
    
    def evaluate_condition(config: Dict[str, Any], day_idx: int) -> bool:
        ind_type = config.get("type", "").upper()
        cond = config.get("condition", "below") # below, above, cross_above, cross_below
        val_trigger = config.get("value")
        
        # Helper to safely fetch indicator values
        def get_val(name: str, idx: int):
            return ind_vals.get(name, [None]*n_days)[idx]
            
        if ind_type == "RSI":
            curr = get_val("RSI", day_idx)
            prev = get_val("RSI", day_idx - 1)
            target = val_trigger if val_trigger is not None else 30
        elif ind_type == "SMA":
            curr = prices[day_idx]
            prev = prices[day_idx - 1]
            target = get_val("SMA", day_idx)
        elif ind_type == "EMA":
            curr = prices[day_idx]
            prev = prices[day_idx - 1]
            target = get_val("EMA", day_idx)
        elif ind_type == "MACD":
            curr = get_val("MACD", day_idx)
            prev = get_val("MACD", day_idx - 1)
            target = get_val("MACD_SIGNAL", day_idx)
        elif ind_type == "BB":
            curr = prices[day_idx]
            prev = prices[day_idx - 1]
            target = get_val("BB_UPPER", day_idx) if cond in ["above", "cross_above"] else get_val("BB_LOWER", day_idx)
        else:
            return False
            
        if curr is None or target is None:
            return False
            
        if cond == "below":
            return curr < target
        elif cond == "above":
            return curr > target
        elif cond == "cross_above":
            if prev is None or get_val(ind_type, day_idx - 1) is None:
                return False
            prev_target = get_val("SMA", day_idx-1) if ind_type == "SMA" else (get_val("EMA", day_idx-1) if ind_type == "EMA" else (get_val("MACD_SIGNAL", day_idx-1) if ind_type == "MACD" else (get_val("BB_UPPER", day_idx-1) if cond == "cross_above" else get_val("BB_LOWER", day_idx-1))))
            if prev_target is None:
                return False
            return prev <= prev_target and curr > target
        elif cond == "cross_below":
            if prev is None or get_val(ind_type, day_idx - 1) is None:
                return False
            prev_target = get_val("SMA", day_idx-1) if ind_type == "SMA" else (get_val("EMA", day_idx-1) if ind_type == "EMA" else (get_val("MACD_SIGNAL", day_idx-1) if ind_type == "MACD" else (get_val("BB_UPPER", day_idx-1) if cond == "cross_above" else get_val("BB_LOWER", day_idx-1))))
            if prev_target is None:
                return False
            return prev >= prev_target and curr < target
            
        return False

    for i in range(n_days):
        if i < warmup:
            # Populate equity curve with starting cash
            equity_curve.append({
                "date": dates[i],
                "equity": cash,
                "drawdown": 0.0
            })
            continue
            
        # Check logic
        buy_signals = []
        sell_signals = []
        
        for config in indicators_config:
            triggered = evaluate_condition(config, i)
            cond = config.get("condition", "below")
            
            if cond in ["below", "cross_above"]:
                buy_signals.append(triggered)
            else:
                sell_signals.append(triggered)
                
        # Resolve logic boolean
        is_buy = False
        is_sell = False
        
        if buy_signals:
            is_buy = all(buy_signals) if logic == "AND" else any(buy_signals)
        if sell_signals:
            is_sell = all(sell_signals) if logic == "AND" else any(sell_signals)
            
        curr_price = prices[i]
        
        # Execute signals
        if is_buy and last_action != "BUY" and cash > 100.0:
            fee = 20.0
            trade_cash = cash - fee
            shares_bought = trade_cash / curr_price
            shares = shares_bought
            cash = 0.0
            last_action = "BUY"
            trades.append({
                "date": dates[i],
                "type": "BUY",
                "price": curr_price,
                "quantity": round(shares_bought, 2),
                "value": round(trade_cash, 2)
            })
        elif is_sell and last_action == "BUY" and shares > 0.0:
            fee = 20.0
            trade_val = shares * curr_price
            cash = trade_val - fee
            trades.append({
                "date": dates[i],
                "type": "SELL",
                "price": curr_price,
                "quantity": round(shares, 2),
                "value": round(cash, 2),
                "profit": round(trade_val - fee - trades[-1]["value"], 2)
            })
            shares = 0.0
            last_action = "SELL"
            
        total_equity = cash + (shares * curr_price)
        equity_curve.append({
            "date": dates[i],
            "equity": round(total_equity, 2)
        })
        
    peak = 0.0
    max_dd = 0.0
    for eq in equity_curve:
        val = eq["equity"]
        if val > peak:
            peak = val
        dd = ((peak - val) / peak) * 100.0 if peak > 0 else 0.0
        eq["drawdown"] = round(dd, 2)
        if dd > max_dd:
            max_dd = dd
            
    final_equity = equity_curve[-1]["equity"]
    total_return = ((final_equity - initial_capital) / initial_capital) * 100.0
    
    years = (timestamps[-1] - timestamps[0]) / (365.0 * 24 * 3600)
    years = max(0.1, years)
    cagr = ((final_equity / initial_capital) ** (1.0 / years) - 1.0) * 100.0
    
    daily_returns = []
    for i in range(1, len(equity_curve)):
        prev = equity_curve[i-1]["equity"]
        curr = equity_curve[i]["equity"]
        daily_returns.append((curr - prev) / prev if prev > 0 else 0.0)
        
    mean_ret = mean(daily_returns)
    sd_ret = std_dev(daily_returns, mean_ret)
    
    rf_daily = 0.05 / 252.0
    sharpe = 0.0
    if sd_ret > 0:
        sharpe = ((mean_ret - rf_daily) / sd_ret) * math.sqrt(252.0)
        
    downside_returns = [r for r in daily_returns if r < 0.0]
    sortino = 0.0
    if downside_returns:
        sd_down = std_dev(downside_returns, 0.0)
        if sd_down > 0:
            sortino = ((mean_ret - rf_daily) / sd_down) * math.sqrt(252.0)
            
    sell_trades = [t for t in trades if t["type"] == "SELL"]
    profitable = [t for t in sell_trades if t.get("profit", 0) > 0]
    win_rate = (len(profitable) / len(sell_trades) * 100.0) if sell_trades else 0.0
    
    return {
        "ticker": ticker,
        "initial_capital": initial_capital,
        "final_equity": round(final_equity, 2),
        "total_return_pct": round(total_return, 2),
        "cagr": round(cagr, 2),
        "max_drawdown": round(max_dd, 2),
        "sharpe_ratio": round(sharpe, 2),
        "sortino_ratio": round(sortino, 2),
        "win_rate": round(win_rate, 2),
        "total_trades": len(trades),
        "trades": trades,
        "equity_curve": equity_curve
    }


# ── Mean-Variance Optimization (MVO) / Efficient Frontier ─────
async def run_portfolio_optimization(tickers: List[str], range_str: str = "1y") -> Dict[str, Any]:
    if not tickers or len(tickers) < 2:
        return {"error": "At least 2 tickers are required for optimization"}
        
    data_map = {}
    for t in tickers:
        hist = await fetch_historical_prices(t, range_str)
        if hist and hist["close"]:
            data_map[t] = hist
            
    valid_tickers = list(data_map.keys())
    if len(valid_tickers) < 2:
        return {"error": "Insufficient historical data found for tickers"}
        
    date_to_prices = {}
    for ticker in valid_tickers:
        hist = data_map[ticker]
        closes = hist["close"]
        timestamps = hist["timestamps"]
        for idx, ts in enumerate(timestamps):
            dt = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
            if dt not in date_to_prices:
                date_to_prices[dt] = {}
            date_to_prices[dt][ticker] = closes[idx]
            
    sorted_dates = sorted(list(date_to_prices.keys()))
    aligned_dates = []
    aligned_prices = {t: [] for t in valid_tickers}
    
    for dt in sorted_dates:
        rec = date_to_prices[dt]
        if len(rec) == len(valid_tickers):
            aligned_dates.append(dt)
            for t in valid_tickers:
                aligned_prices[t].append(rec[t])
                
    if len(aligned_dates) < 30:
        return {"error": "Insufficient overlapping historical dates found for assets"}
        
    returns = {t: [] for t in valid_tickers}
    for t in valid_tickers:
        p = aligned_prices[t]
        for i in range(1, len(p)):
            returns[t].append((p[i] - p[i-1]) / p[i-1])
            
    expected_returns = {}
    daily_mean_returns = {}
    for t in valid_tickers:
        m = mean(returns[t])
        daily_mean_returns[t] = m
        expected_returns[t] = m * 252.0
        
    cov_matrix = {}
    for t1 in valid_tickers:
        cov_matrix[t1] = {}
        for t2 in valid_tickers:
            cov_matrix[t1][t2] = covariance(returns[t1], returns[t2], daily_mean_returns[t1], daily_mean_returns[t2]) * 252.0
            
    sim_results = []
    n_sims = 2000
    
    max_sharpe_ratio = -999999.0
    max_sharpe_portfolio = {}
    
    min_volatility = 999999.0
    min_vol_portfolio = {}
    
    rf = 0.05
    
    for _ in range(n_sims):
        raw_w = [random.random() for _ in range(len(valid_tickers))]
        sum_w = sum(raw_w)
        w = [rw / sum_w for rw in raw_w]
        
        p_ret = sum(w[i] * expected_returns[valid_tickers[i]] for i in range(len(valid_tickers)))
        
        p_var = 0.0
        for i, t1 in enumerate(valid_tickers):
            for j, t2 in enumerate(valid_tickers):
                p_var += w[i] * w[j] * cov_matrix[t1][t2]
                
        p_vol = math.sqrt(p_var)
        p_sharpe = (p_ret - rf) / p_vol if p_vol > 0 else 0.0
        
        sim_results.append({
            "weights": {valid_tickers[i]: round(w[i] * 100, 2) for i in range(len(valid_tickers))},
            "return": round(p_ret * 100, 2),
            "volatility": round(p_vol * 100, 2),
            "sharpe": round(p_sharpe, 2)
        })
        
        if p_sharpe > max_sharpe_ratio:
            max_sharpe_ratio = p_sharpe
            max_sharpe_portfolio = {
                "weights": {valid_tickers[i]: round(w[i] * 100, 2) for i in range(len(valid_tickers))},
                "return": round(p_ret * 100, 2),
                "volatility": round(p_vol * 100, 2),
                "sharpe": round(p_sharpe, 2)
            }
            
        if p_vol < min_volatility:
            min_volatility = p_vol
            min_vol_portfolio = {
                "weights": {valid_tickers[i]: round(w[i] * 100, 2) for i in range(len(valid_tickers))},
                "return": round(p_ret * 100, 2),
                "volatility": round(p_vol * 100, 2),
                "sharpe": round(p_sharpe, 2)
            }
            
    correlation_matrix = []
    for t1 in valid_tickers:
        row = {"ticker": t1}
        for t2 in valid_tickers:
            cov = cov_matrix[t1][t2]
            sd1 = math.sqrt(cov_matrix[t1][t1])
            sd2 = math.sqrt(cov_matrix[t2][t2])
            corr = cov / (sd1 * sd2) if (sd1 * sd2) > 0 else 0.0
            row[t2] = round(corr, 3)
        correlation_matrix.append(row)
        
    return {
        "tickers": valid_tickers,
        "max_sharpe_portfolio": max_sharpe_portfolio,
        "min_vol_portfolio": min_vol_portfolio,
        "correlation_matrix": correlation_matrix,
        "efficient_frontier": sim_results[::4]
    }


# ── Correlation Heatmap Calculator ────────────────────────
async def get_correlation_matrix(tickers: List[str], range_str: str = "1y") -> Dict[str, Any]:
    res = await run_portfolio_optimization(tickers, range_str)
    if "error" in res:
        return res
    return {
        "tickers": res["tickers"],
        "matrix": res["correlation_matrix"]
    }


# ── Geometric Brownian Motion Monte Carlo Simulator ───────
async def run_monte_carlo_simulation(
    tickers: List[str], 
    weights: Dict[str, float], 
    initial_value: float = 100000.0,
    days: int = 252,
    simulations: int = 1000,
    range_str: str = "1y"
) -> Dict[str, Any]:
    
    if not tickers:
        return {"error": "No tickers provided"}
        
    opt = await run_portfolio_optimization(tickers, range_str)
    if "error" in opt:
        return opt
        
    valid_tickers = opt["tickers"]
    norm_w = []
    for t in valid_tickers:
        norm_w.append(weights.get(t, 100.0 / len(valid_tickers)) / 100.0)
        
    sum_w = sum(norm_w)
    if sum_w > 0:
        norm_w = [nw / sum_w for nw in norm_w]
        
    data_map = {}
    for t in valid_tickers:
        hist = await fetch_historical_prices(t, range_str)
        if hist:
            data_map[t] = hist
            
    date_to_prices = {}
    for ticker in valid_tickers:
        closes = data_map[ticker]["close"]
        ts = data_map[ticker]["timestamps"]
        for idx, t_val in enumerate(ts):
            dt = datetime.fromtimestamp(t_val, tz=timezone.utc).strftime("%Y-%m-%d")
            if dt not in date_to_prices:
                date_to_prices[dt] = {}
            date_to_prices[dt][ticker] = closes[idx]
            
    sorted_dates = sorted(list(date_to_prices.keys()))
    aligned_prices = {t: [] for t in valid_tickers}
    for dt in sorted_dates:
        rec = date_to_prices[dt]
        if len(rec) == len(valid_tickers):
            for t in valid_tickers:
                aligned_prices[t].append(rec[t])
                
    returns = {t: [] for t in valid_tickers}
    for t in valid_tickers:
        p = aligned_prices[t]
        for i in range(1, len(p)):
            returns[t].append((p[i] - p[i-1]) / p[i-1])
            
    p_daily_returns = []
    for idx in range(len(returns[valid_tickers[0]])):
        daily_ret = sum(norm_w[i] * returns[valid_tickers[i]][idx] for i in range(len(valid_tickers)))
        p_daily_returns.append(daily_ret)
        
    mu_daily = mean(p_daily_returns)
    std_daily = std_dev(p_daily_returns, mu_daily)
    
    dt = 1.0
    paths = []
    for _ in range(simulations):
        current_val = initial_value
        path = [current_val]
        for _ in range(days):
            z = random_normal()
            drift = (mu_daily - 0.5 * (std_daily ** 2)) * dt
            shock = std_daily * z * math.sqrt(dt)
            current_val = current_val * math.exp(drift + shock)
            path.append(current_val)
        paths.append(path)
        
    projection = []
    for day in range(days + 1):
        day_vals = sorted([paths[sim][day] for sim in range(simulations)])
        projection.append({
            "day": day,
            "bear": round(day_vals[int(simulations * 0.1)], 2),
            "median": round(day_vals[int(simulations * 0.5)], 2),
            "bull": round(day_vals[int(simulations * 0.9)], 2)
        })
        
    return {
        "tickers": valid_tickers,
        "weights": {valid_tickers[i]: round(norm_w[i] * 100, 2) for i in range(len(valid_tickers))},
        "daily_expected_return": round(mu_daily * 100, 4),
        "daily_volatility": round(std_daily * 100, 4),
        "annualized_expected_return": round(mu_daily * 252 * 100, 2),
        "annualized_volatility": round(std_daily * math.sqrt(252) * 100, 2),
        "projections": projection
    }


# ── Factor Scanner Engine ─────────────────────────────────
async def evaluate_asset_factors(ticker: str) -> Dict[str, Any]:
    db = get_db()
    ticker_upper = ticker.strip().upper()
    
    stock = await db.stocks.find_one({"ticker": ticker_upper})
    if not stock:
        try:
            from app.services.stock_service import get_stock_data
            stock = await get_stock_data(ticker_upper)
        except Exception:
            stock = None
        
    if not stock:
        # Fallback values for global assets, indices, or cryptos that cannot be scraped
        stock = {
            "ticker": ticker_upper,
            "name": ticker_upper,
            "sector": "Global Assets / Dynamic",
            "stock_pe": 20.0,
            "roce": 12.0,
            "roe": 12.0,
            "dividend_yield": 1.0,
            "profit_loss": {}
        }
        
    hist_1y = await fetch_historical_prices(ticker_upper, "1y")
    momentum_val = 0.0
    volatility_val = 0.15
    if hist_1y and len(hist_1y["close"]) > 20:
        c = hist_1y["close"]
        momentum_val = (c[-1] - c[0]) / c[0]
        rets = [(c[i] - c[i-1])/c[i-1] for i in range(1, len(c))]
        volatility_val = std_dev(rets) * math.sqrt(252.0)
        
    roce = stock.get("roce", 10.0)
    roe = stock.get("roe", 10.0)
    quality_score = (roce + roe) / 2.0
    
    pe = stock.get("stock_pe", 25.0)
    div_yield = stock.get("dividend_yield", 0.0)
    
    growth_score = 10.0
    profit_loss = stock.get("profit_loss", {})
    if profit_loss:
        net_profit = profit_loss.get("Net Profit", [])
        if len(net_profit) >= 2:
            try:
                def extract_val(val_str):
                    return float(str(val_str).replace(",", "").strip())
                v1 = extract_val(net_profit[-2])
                v2 = extract_val(net_profit[-1])
                if v1 > 0:
                    growth_score = ((v2 - v1) / v1) * 100.0
            except:
                pass
                
    mom_pct = max(10, min(95, int((momentum_val + 0.2) / 0.8 * 100)))
    val_pct = max(10, min(95, int(100 - (pe / 60.0 * 80))))
    qual_pct = max(10, min(95, int((quality_score / 35.0) * 100)))
    gro_pct = max(10, min(95, int((growth_score / 30.0) * 100)))
    vol_pct = max(10, min(95, int(100 - (volatility_val / 0.6 * 80))))
    
    return {
        "ticker": ticker_upper,
        "name": stock.get("name", ticker_upper),
        "sector": stock.get("sector", "Sector"),
        "pe": pe,
        "roce": roce,
        "roe": roe,
        "dividend_yield": div_yield,
        "annualized_volatility": round(volatility_val * 100, 2),
        "raw_momentum": round(momentum_val * 100, 2),
        "factors": [
          {"factor": "Momentum", "score": mom_pct, "description": "1-Year Price Momentum trend"},
          {"factor": "Value", "score": val_pct, "description": "Valuation discounts relative to earnings"},
          {"factor": "Quality", "score": qual_pct, "description": "Capital efficiency (ROE & ROCE) margins"},
          {"factor": "Growth", "score": gro_pct, "description": "Net income expansion trends"},
          {"factor": "Volatility", "score": vol_pct, "description": "Risk mitigation (lower volatility yields higher score)"}
        ]
    }


# ── Smart Rebalancing Recommender ────────────────────────
def calculate_portfolio_rebalance(
    current_holdings: List[Dict[str, Any]], 
    target_weights: Dict[str, float]
) -> Dict[str, Any]:
    
    total_current_value = sum(h["quantity"] * h["current_price"] for h in current_holdings)
    if total_current_value == 0:
        return {"error": "Portfolio value is zero. Add holdings first"}
        
    holdings_map = {h["ticker"].upper(): h for h in current_holdings}
    all_tickers = set(list(holdings_map.keys()) + list(target_weights.keys()))
    
    rebalance_orders = []
    allocations = []
    
    for ticker in all_tickers:
        target_pct = target_weights.get(ticker, 0.0)
        target_val = total_current_value * (target_pct / 100.0)
        
        current_h = holdings_map.get(ticker)
        current_qty = current_h["quantity"] if current_h else 0.0
        current_price = current_h["current_price"] if current_h else 0.0
        
        if current_price == 0:
            current_price = 100.0
            
        current_val = current_qty * current_price
        diff_val = target_val - current_val
        diff_qty = diff_val / current_price
        
        allocations.append({
            "ticker": ticker,
            "current_value": round(current_val, 2),
            "current_pct": round((current_val / total_current_value) * 100.0, 2),
            "target_value": round(target_val, 2),
            "target_pct": round(target_pct, 2)
        })
        
        if abs(diff_val) > 100.0:
            action = "BUY" if diff_val > 0 else "SELL"
            rebalance_orders.append({
                "ticker": ticker,
                "action": action,
                "current_price": round(current_price, 2),
                "quantity": round(abs(diff_qty), 2),
                "value": round(abs(diff_val), 2)
            })
            
    return {
        "total_value": round(total_current_value, 2),
        "allocations": allocations,
        "orders": rebalance_orders
    }

async def generate_strategy_from_prompt(prompt: str) -> Dict[str, Any]:
    from app.services.copilot_service import query_groq
    
    sys_prompt = (
        "You are an expert quantitative trading engineer. Your task is to translate a user's natural language "
        "trading strategy description into a structured JSON configuration of technical indicators for a backtester.\n"
        "Supported indicators:\n"
        "1. RSI: params={ \"period\": int }, condition=\"below\"|\"above\"|\"cross_above\"|\"cross_below\", value=float (threshold, e.g. 30)\n"
        "2. SMA: params={ \"period\": int }, condition=\"below\"|\"above\"|\"cross_above\"|\"cross_below\"\n"
        "3. EMA: params={ \"period\": int }, condition=\"below\"|\"above\"|\"cross_above\"|\"cross_below\"\n"
        "4. MACD: params={ \"fast\": 12, \"slow\": 26, \"signal\": 9 }, condition=\"below\"|\"above\"|\"cross_above\"|\"cross_below\"\n"
        "5. BB: params={ \"period\": int, \"num_std\": float }, condition=\"below\"|\"above\"|\"cross_above\"|\"cross_below\"\n\n"
        "You must return a JSON object with this exact structure:\n"
        "{\n"
        "  \"logic\": \"AND\" | \"OR\",\n"
        "  \"indicators\": [\n"
        "     {\n"
        "       \"type\": \"RSI\" | \"SMA\" | \"EMA\" | \"MACD\" | \"BB\",\n"
        "       \"params\": { ... },\n"
        "       \"condition\": \"below\" | \"above\" | \"cross_above\" | \"cross_below\",\n"
        "       \"value\": float | null\n"
        "     }\n"
        "  ]\n"
        "}\n\n"
        "Only return the raw JSON. Do not include markdown code block wrappers."
    )
    
    messages = [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": f"Translate this strategy: {prompt}"}
    ]
    
    try:
        raw_res = await query_groq(messages, json_mode=True)
        if raw_res:
            data = json.loads(raw_res)
            if "indicators" in data:
                return data
    except Exception as e:
        print(f"[QuantService] AI strategy generation error: {e}")
        
    # Robust Fallback parser if LLM fails or is not configured
    prompt_lower = prompt.lower()
    fallback_indicators = []
    
    if "rsi" in prompt_lower:
        val = 30
        if "20" in prompt_lower: val = 20
        elif "25" in prompt_lower: val = 25
        cond = "below"
        if "sell" in prompt_lower or "above" in prompt_lower:
            cond = "above"
            val = 70
        fallback_indicators.append({
            "type": "RSI",
            "params": {"period": 14},
            "condition": cond,
            "value": val
        })
        
    if "sma" in prompt_lower or "moving average" in prompt_lower:
        period = 50
        if "200" in prompt_lower: period = 200
        elif "20" in prompt_lower: period = 20
        cond = "cross_above"
        if "below" in prompt_lower or "cross_below" in prompt_lower:
            cond = "cross_below"
        fallback_indicators.append({
            "type": "SMA",
            "params": {"period": period},
            "condition": cond
        })
        
    if "ema" in prompt_lower:
        period = 20
        if "50" in prompt_lower: period = 50
        cond = "cross_above"
        if "below" in prompt_lower:
            cond = "cross_below"
        fallback_indicators.append({
            "type": "EMA",
            "params": {"period": period},
            "condition": cond
        })

    if "macd" in prompt_lower:
        fallback_indicators.append({
            "type": "MACD",
            "params": {"fast": 12, "slow": 26, "signal": 9},
            "condition": "cross_above"
        })

    if "bollinger" in prompt_lower or "bb" in prompt_lower:
        fallback_indicators.append({
            "type": "BB",
            "params": {"period": 20, "num_std": 2.0},
            "condition": "cross_below"
        })
        
    if not fallback_indicators:
        fallback_indicators = [
            {"type": "RSI", "params": {"period": 14}, "condition": "below", "value": 30},
            {"type": "SMA", "params": {"period": 50}, "condition": "cross_above"}
        ]
        
    return {
        "logic": "AND",
        "indicators": fallback_indicators
    }


# ── Parameter Sweep Generator & Executor ──────────────────
def generate_sweep_configurations(indicators_config: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
    if not indicators_config:
        return []
    
    variations = []
    for ind in indicators_config[:2]:
        ind_type = ind.get("type", "").upper()
        cond = ind.get("condition", "below")
        val = ind.get("value")
        params = ind.get("params", {})
        
        ind_vars = []
        if ind_type == "RSI":
            periods = [9, 14, 21]
            values = [20, 25, 30] if cond in ["below", "cross_below"] else [70, 75, 80]
            if val is not None:
                values = [max(10, val - 5), val, min(90, val + 5)]
            for p in periods:
                for v in values:
                    ind_vars.append({
                        "type": "RSI",
                        "params": {"period": p},
                        "condition": cond,
                        "value": v
                    })
        elif ind_type in ["SMA", "EMA"]:
            periods = [10, 20, 50, 100, 200]
            u_p = params.get("period")
            if u_p:
                periods = sorted(list(set([max(5, u_p // 2), u_p, u_p * 2, 50, 200])))
            for p in periods:
                ind_vars.append({
                    "type": ind_type,
                    "params": {"period": p},
                    "condition": cond
                })
        elif ind_type == "BB":
            periods = [10, 20, 30]
            stds = [1.5, 2.0, 2.5]
            for p in periods:
                for s in stds:
                    ind_vars.append({
                        "type": "BB",
                        "params": {"period": p, "num_std": s},
                        "condition": cond
                    })
        elif ind_type == "MACD":
            combos = [
                {"fast": 12, "slow": 26, "signal": 9},
                {"fast": 10, "slow": 20, "signal": 7},
                {"fast": 15, "slow": 30, "signal": 9},
                {"fast": 8, "slow": 17, "signal": 9}
            ]
            for c in combos:
                ind_vars.append({
                    "type": "MACD",
                    "params": c,
                    "condition": cond
                })
        else:
            ind_vars.append(ind)
            
        variations.append(ind_vars)
        
    configs = []
    if len(variations) == 1:
        for v0 in variations[0]:
            configs.append([v0] + indicators_config[1:])
    elif len(variations) >= 2:
        for v0 in variations[0]:
            for v1 in variations[1]:
                configs.append([v0, v1] + indicators_config[2:])
                
    return configs[:20]

def execute_single_backtest(
    prices: List[float],
    volumes: List[float],
    timestamps: List[int],
    dates: List[str],
    indicators_config: List[Dict[str, Any]],
    logic: str = "AND",
    initial_capital: float = 100000.0
) -> Dict[str, Any]:
    n_days = len(prices)
    ind_vals = {}
    warmup = 1
    
    for config in indicators_config:
        ind_type = config.get("type", "").upper()
        params = config.get("params", {})
        
        if ind_type == "RSI":
            period = params.get("period", 14)
            ind_vals["RSI"] = calculate_rsi(prices, period)
            warmup = max(warmup, period + 1)
        elif ind_type == "SMA":
            period = params.get("period", 50)
            ind_vals["SMA"] = calculate_sma(prices, period)
            warmup = max(warmup, period)
        elif ind_type == "EMA":
            period = params.get("period", 20)
            ind_vals["EMA"] = calculate_ema(prices, period)
            warmup = max(warmup, period)
        elif ind_type == "MACD":
            fast = params.get("fast", 12)
            slow = params.get("slow", 26)
            sig = params.get("signal", 9)
            macd_res = calculate_macd(prices, fast, slow, sig)
            ind_vals["MACD"] = macd_res["macd"]
            ind_vals["MACD_SIGNAL"] = macd_res["signal"]
            warmup = max(warmup, slow + sig)
        elif ind_type == "BB":
            period = params.get("period", 20)
            num_std = params.get("num_std", 2.0)
            bb_res = calculate_bollinger_bands(prices, period, num_std)
            ind_vals["BB_UPPER"] = bb_res["upper"]
            ind_vals["BB_LOWER"] = bb_res["lower"]
            warmup = max(warmup, period)
            
    cash = initial_capital
    shares = 0.0
    equity_curve = []
    trades = []
    last_action = None
    
    def evaluate_condition(config: Dict[str, Any], day_idx: int) -> bool:
        ind_type = config.get("type", "").upper()
        cond = config.get("condition", "below")
        val_trigger = config.get("value")
        
        def get_val(name: str, idx: int):
            return ind_vals.get(name, [None]*n_days)[idx]
            
        if ind_type == "RSI":
            curr = get_val("RSI", day_idx)
            prev = get_val("RSI", day_idx - 1)
            target = val_trigger if val_trigger is not None else 30
        elif ind_type == "SMA":
            curr = prices[day_idx]
            prev = prices[day_idx - 1]
            target = get_val("SMA", day_idx)
        elif ind_type == "EMA":
            curr = prices[day_idx]
            prev = prices[day_idx - 1]
            target = get_val("EMA", day_idx)
        elif ind_type == "MACD":
            curr = get_val("MACD", day_idx)
            prev = get_val("MACD", day_idx - 1)
            target = get_val("MACD_SIGNAL", day_idx)
        elif ind_type == "BB":
            curr = prices[day_idx]
            prev = prices[day_idx - 1]
            target = get_val("BB_UPPER", day_idx) if cond in ["above", "cross_above"] else get_val("BB_LOWER", day_idx)
        else:
            return False
            
        if curr is None or target is None:
            return False
            
        if cond == "below":
            return curr < target
        elif cond == "above":
            return curr > target
        elif cond == "cross_above":
            if prev is None or get_val(ind_type, day_idx - 1) is None:
                return False
            prev_target = get_val("SMA", day_idx-1) if ind_type == "SMA" else (get_val("EMA", day_idx-1) if ind_type == "EMA" else (get_val("MACD_SIGNAL", day_idx-1) if ind_type == "MACD" else (get_val("BB_UPPER", day_idx-1) if cond == "cross_above" else get_val("BB_LOWER", day_idx-1))))
            if prev_target is None:
                return False
            return prev <= prev_target and curr > target
        elif cond == "cross_below":
            if prev is None or get_val(ind_type, day_idx - 1) is None:
                return False
            prev_target = get_val("SMA", day_idx-1) if ind_type == "SMA" else (get_val("EMA", day_idx-1) if ind_type == "EMA" else (get_val("MACD_SIGNAL", day_idx-1) if ind_type == "MACD" else (get_val("BB_UPPER", day_idx-1) if cond == "cross_above" else get_val("BB_LOWER", day_idx-1))))
            if prev_target is None:
                return False
            return prev >= prev_target and curr < target
            
        return False

    for i in range(n_days):
        if i < warmup:
            equity_curve.append({"date": dates[i], "equity": cash})
            continue
            
        buy_signals = []
        sell_signals = []
        
        for config in indicators_config:
            triggered = evaluate_condition(config, i)
            cond = config.get("condition", "below")
            if cond in ["below", "cross_above"]:
                buy_signals.append(triggered)
            else:
                sell_signals.append(triggered)
                
        is_buy = False
        is_sell = False
        if buy_signals:
            is_buy = all(buy_signals) if logic == "AND" else any(buy_signals)
        if sell_signals:
            is_sell = all(sell_signals) if logic == "AND" else any(sell_signals)
            
        curr_price = prices[i]
        
        if is_buy and last_action != "BUY" and cash > 100.0:
            fee = 20.0
            trade_cash = cash - fee
            shares = trade_cash / curr_price
            cash = 0.0
            last_action = "BUY"
            trades.append({"type": "BUY", "price": curr_price, "value": trade_cash})
        elif is_sell and last_action == "BUY" and shares > 0.0:
            fee = 20.0
            trade_val = shares * curr_price
            cash = trade_val - fee
            trades.append({"type": "SELL", "price": curr_price, "value": cash, "profit": trade_val - fee - trades[-1]["value"]})
            shares = 0.0
            last_action = "SELL"
            
        equity_curve.append({
            "date": dates[i],
            "equity": round(cash + (shares * curr_price), 2)
        })
        
    peak = 0.0
    max_dd = 0.0
    for eq in equity_curve:
        val = eq["equity"]
        if val > peak:
            peak = val
        dd = ((peak - val) / peak) * 100.0 if peak > 0 else 0.0
        if dd > max_dd:
            max_dd = dd
            
    final_equity = equity_curve[-1]["equity"]
    total_return = ((final_equity - initial_capital) / initial_capital) * 100.0
    
    years = (timestamps[-1] - timestamps[0]) / (365.0 * 24 * 3600)
    years = max(0.1, years)
    cagr = ((final_equity / initial_capital) ** (1.0 / years) - 1.0) * 100.0
    
    daily_returns = []
    for i in range(1, len(equity_curve)):
        prev = equity_curve[i-1]["equity"]
        curr = equity_curve[i]["equity"]
        daily_returns.append((curr - prev) / prev if prev > 0 else 0.0)
        
    mean_ret = mean(daily_returns)
    sd_ret = std_dev(daily_returns, mean_ret)
    
    rf_daily = 0.05 / 252.0
    sharpe = 0.0
    if sd_ret > 0:
        sharpe = ((mean_ret - rf_daily) / sd_ret) * math.sqrt(252.0)
        
    downside_returns = [r for r in daily_returns if r < 0.0]
    sortino = 0.0
    if downside_returns:
        sd_down = std_dev(downside_returns, 0.0)
        if sd_down > 0:
            sortino = ((mean_ret - rf_daily) / sd_down) * math.sqrt(252.0)
            
    sell_trades = [t for t in trades if t["type"] == "SELL"]
    profitable = [t for t in sell_trades if t.get("profit", 0) > 0]
    win_rate = (len(profitable) / len(sell_trades) * 100.0) if sell_trades else 0.0
    
    return {
        "final_equity": round(final_equity, 2),
        "total_return_pct": round(total_return, 2),
        "cagr": round(cagr, 2),
        "max_drawdown": round(max_dd, 2),
        "sharpe_ratio": round(sharpe, 2),
        "sortino_ratio": round(sortino, 2),
        "win_rate": round(win_rate, 2),
        "total_trades": len(trades)
    }

async def run_strategy_parameter_sweep(
    ticker: str,
    indicators_config: List[Dict[str, Any]],
    logic: str = "AND",
    initial_capital: float = 100000.0,
    range_str: str = "1y"
) -> Dict[str, Any]:
    hist = await fetch_historical_prices(ticker, range_str)
    if not hist or not hist["close"]:
        return {"error": f"Failed to retrieve price history for {ticker}"}
        
    prices = hist["close"]
    volumes = hist["volume"]
    timestamps = hist["timestamps"]
    dates = [datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d") for ts in timestamps]
    
    # Run original config
    original_metrics = execute_single_backtest(
        prices, volumes, timestamps, dates, indicators_config, logic, initial_capital
    )
    
    # Generate sweep configurations
    configs = generate_sweep_configurations(indicators_config)
    
    sweeps_results = []
    # Avoid testing the exact same original parameters
    tested_params = []
    
    for cfg in configs:
        # Check uniqueness by serializing the indicators config
        cfg_sig = json.dumps(cfg, sort_keys=True)
        if cfg_sig in tested_params:
            continue
        tested_params.append(cfg_sig)
        
        try:
            res = execute_single_backtest(
                prices, volumes, timestamps, dates, cfg, logic, initial_capital
            )
            sweeps_results.append({
                "indicators": cfg,
                "metrics": res
            })
        except Exception as e:
            print(f"[QuantService] Sweep simulation error: {e}")
            
    # Sort sweeps by Sharpe ratio (descending)
    sweeps_results.sort(key=lambda x: x["metrics"]["sharpe_ratio"], reverse=True)
    
    return {
        "ticker": ticker.strip().upper(),
        "original_metrics": original_metrics,
        "sweeps": sweeps_results[:5]  # Top 5 optimized configs
    }


# ── Macro Crisis Stress Testing Engine ────────────────────
async def run_portfolio_stress_test(
    tickers: List[str],
    weights: Dict[str, float],
    scenario: str,
    initial_value: float = 100000.0,
    days: int = 252,
    simulations: int = 1000,
    range_str: str = "1y"
) -> Dict[str, Any]:
    
    if not tickers:
        return {"error": "No tickers provided"}
        
    opt = await run_portfolio_optimization(tickers, range_str)
    if "error" in opt:
        return opt
        
    valid_tickers = opt["tickers"]
    norm_w = []
    for t in valid_tickers:
        norm_w.append(weights.get(t, 100.0 / len(valid_tickers)) / 100.0)
        
    sum_w = sum(norm_w)
    if sum_w > 0:
        norm_w = [nw / sum_w for nw in norm_w]
        
    data_map = {}
    for t in valid_tickers:
        hist = await fetch_historical_prices(t, range_str)
        if hist:
            data_map[t] = hist
            
    date_to_prices = {}
    for ticker in valid_tickers:
        closes = data_map[ticker]["close"]
        ts = data_map[ticker]["timestamps"]
        for idx, t_val in enumerate(ts):
            dt = datetime.fromtimestamp(t_val, tz=timezone.utc).strftime("%Y-%m-%d")
            if dt not in date_to_prices:
                date_to_prices[dt] = {}
            date_to_prices[dt][ticker] = closes[idx]
            
    sorted_dates = sorted(list(date_to_prices.keys()))
    aligned_prices = {t: [] for t in valid_tickers}
    for dt in sorted_dates:
        rec = date_to_prices[dt]
        if len(rec) == len(valid_tickers):
            for t in valid_tickers:
                aligned_prices[t].append(rec[t])
                
    returns = {t: [] for t in valid_tickers}
    for t in valid_tickers:
        p = aligned_prices[t]
        for i in range(1, len(p)):
            returns[t].append((p[i] - p[i-1]) / p[i-1])
            
    p_daily_returns = []
    for idx in range(len(returns[valid_tickers[0]])):
        daily_ret = sum(norm_w[i] * returns[valid_tickers[i]][idx] for i in range(len(valid_tickers)))
        p_daily_returns.append(daily_ret)
        
    mu_daily = mean(p_daily_returns)
    std_daily = std_dev(p_daily_returns, mu_daily)
    
    # Define macro stress factors
    vol_multiplier = 1.0
    daily_shift = 0.0
    scenario_name = "Baseline Scenario"
    
    scen = scenario.lower()
    if "lehman" in scen or "2008" in scen:
        vol_multiplier = 2.2
        daily_shift = -0.35 / 252.0  # -35% annual return shock
        scenario_name = "2008 Lehman Shock"
    elif "covid" in scen or "2020" in scen:
        vol_multiplier = 2.8
        daily_shift = -0.25 / 252.0  # -25% annual return shock
        scenario_name = "2020 Covid Crash"
    elif "rate_hike" in scen or "2022" in scen or "inflation" in scen:
        vol_multiplier = 1.4
        daily_shift = -0.15 / 252.0  # -15% annual return shock
        scenario_name = "250bps Fed Rate Shock"
    elif "stagflation" in scen:
        vol_multiplier = 1.6
        daily_shift = -0.12 / 252.0  # -12% annual return shock
        scenario_name = "1970s Stagflation Scenario"
        
    stressed_mu = mu_daily + daily_shift
    stressed_std = std_daily * vol_multiplier
    
    dt = 1.0
    
    # Run stressed simulations
    stressed_paths = []
    for _ in range(simulations):
        current_val = initial_value
        path = [current_val]
        for _ in range(days):
            z = random_normal()
            drift = (stressed_mu - 0.5 * (stressed_std ** 2)) * dt
            shock = stressed_std * z * math.sqrt(dt)
            current_val = current_val * math.exp(drift + shock)
            path.append(current_val)
        stressed_paths.append(path)
        
    # Run normal baseline simulations
    normal_paths = []
    for _ in range(simulations):
        current_val = initial_value
        path = [current_val]
        for _ in range(days):
            z = random_normal()
            drift = (mu_daily - 0.5 * (std_daily ** 2)) * dt
            shock = std_daily * z * math.sqrt(dt)
            current_val = current_val * math.exp(drift + shock)
            path.append(current_val)
        normal_paths.append(path)
        
    # Collate projections
    stressed_projections = []
    normal_projections = []
    
    for day in range(days + 1):
        s_day_vals = sorted([stressed_paths[sim][day] for sim in range(simulations)])
        n_day_vals = sorted([normal_paths[sim][day] for sim in range(simulations)])
        stressed_projections.append({
            "day": day,
            "bear": round(s_day_vals[int(simulations * 0.1)], 2),
            "median": round(s_day_vals[int(simulations * 0.5)], 2),
            "bull": round(s_day_vals[int(simulations * 0.9)], 2)
        })
        normal_projections.append({
            "day": day,
            "median": round(n_day_vals[int(simulations * 0.5)], 2)
        })
        
    final_stressed_vals = sorted([stressed_paths[sim][-1] for sim in range(simulations)])
    final_normal_vals = sorted([normal_paths[sim][-1] for sim in range(simulations)])
    
    # 95% Value at Risk (VaR)
    stressed_var_95 = max(0.0, initial_value - final_stressed_vals[int(simulations * 0.05)])
    normal_var_95 = max(0.0, initial_value - final_normal_vals[int(simulations * 0.05)])
    
    # 95% Expected Shortfall (ES)
    stressed_es_95 = max(0.0, initial_value - mean(final_stressed_vals[:int(simulations * 0.05)]))
    normal_es_95 = max(0.0, initial_value - mean(final_normal_vals[:int(simulations * 0.05)]))
    
    # Peak-to-trough drawdowns helper
    def get_med_mdd(paths_list):
        mdds = []
        for path in paths_list:
            peak = 0.0
            mdd = 0.0
            for val in path:
                if val > peak:
                    peak = val
                dd = ((peak - val) / peak) * 100.0 if peak > 0 else 0.0
                if dd > mdd:
                    mdd = dd
            mdds.append(mdd)
        mdds.sort()
        return mdds[len(mdds) // 2]
        
    stressed_mdd = get_med_mdd(stressed_paths)
    normal_mdd = get_med_mdd(normal_paths)
    
    rf = 0.05
    stressed_ann_ret = stressed_mu * 252 * 100
    normal_ann_ret = mu_daily * 252 * 100
    stressed_ann_vol = stressed_std * math.sqrt(252) * 100
    normal_ann_vol = std_daily * math.sqrt(252) * 100
    
    stressed_sharpe = (stressed_mu * 252 - rf) / (stressed_std * math.sqrt(252)) if stressed_std > 0 else 0.0
    normal_sharpe = (mu_daily * 252 - rf) / (std_daily * math.sqrt(252)) if std_daily > 0 else 0.0
    
    return {
        "scenario": scenario_name,
        "normal_metrics": {
            "annualized_return": round(normal_ann_ret, 2),
            "annualized_volatility": round(normal_ann_vol, 2),
            "sharpe_ratio": round(normal_sharpe, 2),
            "max_drawdown": round(normal_mdd, 2),
            "var_95_pct": round((normal_var_95 / initial_value) * 100, 2),
            "es_95_pct": round((normal_es_95 / initial_value) * 100, 2)
        },
        "stressed_metrics": {
            "annualized_return": round(stressed_ann_ret, 2),
            "annualized_volatility": round(stressed_ann_vol, 2),
            "sharpe_ratio": round(stressed_sharpe, 2),
            "max_drawdown": round(stressed_mdd, 2),
            "var_95_pct": round((stressed_var_95 / initial_value) * 100, 2),
            "es_95_pct": round((stressed_es_95 / initial_value) * 100, 2)
        },
        "normal_median_path": [round(val, 2) for val in [p["median"] for p in normal_projections]],
        "stressed_median_path": [round(val, 2) for val in [p["median"] for p in stressed_projections]],
        "stressed_bear_path": [round(val, 2) for val in [p["bear"] for p in stressed_projections]],
        "stressed_bull_path": [round(val, 2) for val in [p["bull"] for p in stressed_projections]],
        "days": days
    }



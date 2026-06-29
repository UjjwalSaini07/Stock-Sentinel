'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Wallet, TrendingUp, TrendingDown, BarChart2, RefreshCw, ArrowUpRight, Activity, Info, ShieldAlert, Trash2, Sun, Moon, Bell, Briefcase } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import StatCard from '@/components/ui/StatCard'
import HoldingRow from '@/components/portfolio/HoldingRow'
import AddStockModal from '@/components/portfolio/AddStockModal'
import PortfolioDonut from '@/components/charts/PortfolioDonut'
import { userApi, stockApi, alertApi } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { MarketIndex, NewsArticle, PortfolioPerformance, PortfolioEntry, Alert } from '@/types'

function PortfolioInsights({ portfolio, performance }: { portfolio: any[], performance: PortfolioPerformance | null }) {
  if (portfolio.length === 0 || !performance) return null

  // 1. Concentration risk audit
  const totalVal = portfolio.reduce((s, p) => s + (p.current_price ?? p.buy_price) * p.quantity, 0)
  const concentrationRiskPositions = portfolio.filter(p => {
    const pVal = (p.current_price ?? p.buy_price) * p.quantity
    return (pVal / totalVal) > 0.40
  })

  // 2. Performers audit
  const sortedByPnl = [...portfolio].sort((a, b) => (b.pnl_percent ?? 0) - (a.pnl_percent ?? 0))
  const topPerformer = sortedByPnl[0]
  const worstPerformer = sortedByPnl[sortedByPnl.length - 1]

  const hasGainers = topPerformer && (topPerformer.pnl_percent ?? 0) > 0
  const hasLosers = worstPerformer && (worstPerformer.pnl_percent ?? 0) < 0

  return (
    <div className="card space-y-3.5 border-white/5 bg-white/[0.02] backdrop-blur-md">
      <h3 className="section-title text-brand-400"><Info size={14} /> Portfolio Audit & Insights</h3>
      <div className="space-y-2.5 text-xs text-gray-400">
        {concentrationRiskPositions.length > 0 ? (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5">
            <ShieldAlert size={16} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-red-400">High Concentration Risk</div>
              <p className="text-[11px] leading-normal text-red-300 mt-0.5">
                {concentrationRiskPositions.map(p => `${p.ticker} (${Math.round(((p.current_price ?? p.buy_price) * p.quantity / totalVal) * 100)}%)`).join(', ')} represents a large portion of your assets. Consider diversifying to mitigate unsystematic risk.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl flex items-start gap-2.5">
            <ShieldAlert size={16} className="text-brand-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-brand-400">Healthy Diversification</div>
              <p className="text-[11px] leading-normal text-brand-300 mt-0.5">
                Your portfolio holds no positions exceeding the 40% concentration safety threshold. Nice risk management!
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mt-2">
          {hasGainers && (
            <div className="p-2.5 bg-brand-500/5 border border-brand-500/10 rounded-xl">
              <div className="text-[10px] text-gray-500 uppercase font-semibold">Top Asset</div>
              <div className="font-semibold text-brand-400 mt-0.5 text-[11px]">{topPerformer.ticker}</div>
              <div className="text-[10px] text-gray-500 font-mono">PNL: +{topPerformer.pnl_percent?.toFixed(1)}%</div>
            </div>
          )}
          {hasLosers && (
            <div className="p-2.5 bg-red-500/5 border border-red-500/10 rounded-xl">
              <div className="text-[10px] text-gray-500 uppercase font-semibold">Laggard Asset</div>
              <div className="font-semibold text-red-400 mt-0.5 text-[11px]">{worstPerformer.ticker}</div>
              <div className="text-[10px] text-gray-500 font-mono">PNL: {worstPerformer.pnl_percent?.toFixed(1)}%</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function GoalMilestonePlanner({ totalValue }: { totalValue: number }) {
  const [target, setTarget] = useState<number>(500000)
  const [monthlySip, setMonthlySip] = useState<number>(5000)
  const [cagr, setCagr] = useState<number>(12)

  // Save/Load Target & SIP to/from local storage for personalization
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTarget = localStorage.getItem('portfolio_target')
      const savedSip = localStorage.getItem('portfolio_sip')
      if (savedTarget) setTarget(Number(savedTarget))
      if (savedSip) setMonthlySip(Number(savedSip))
    }
  }, [])

  const handleTargetChange = (val: number) => {
    setTarget(val)
    localStorage.setItem('portfolio_target', String(val))
  }

  const handleSipChange = (val: number) => {
    setMonthlySip(val)
    localStorage.setItem('portfolio_sip', String(val))
  }

  // Monthly projection logic
  let monthsToTarget = 0
  let currentValue = totalValue
  const monthlyRate = cagr / 100 / 12

  if (currentValue >= target) {
    monthsToTarget = 0
  } else {
    if (monthlyRate > 0 || monthlySip > 0) {
      while (currentValue < target && monthsToTarget < 600) { // cap at 50 years
        currentValue = currentValue * (1 + monthlyRate) + monthlySip
        monthsToTarget++
      }
    } else {
      monthsToTarget = 999
    }
  }

  const years = Math.floor(monthsToTarget / 12)
  const remainingMonths = monthsToTarget % 12
  const progressPercent = target > 0 ? (totalValue / target) * 100 : 0

  // Generate 10-year projection data points
  const projectionData = []
  let valWithSip = totalValue
  let valWithoutSip = totalValue
  let totalContributed = totalValue

  for (let y = 1; y <= 10; y++) {
    for (let m = 1; m <= 12; m++) {
      valWithSip = valWithSip * (1 + monthlyRate) + monthlySip
      valWithoutSip = valWithoutSip * (1 + monthlyRate)
      totalContributed += monthlySip
    }
    projectionData.push({
      year: `Yr ${y}`,
      "With SIP": Math.round(valWithSip),
      "Without SIP": Math.round(valWithoutSip),
      "Total Contributed": Math.round(totalContributed)
    })
  }

  return (
    <div className="card space-y-4 border-white/5 bg-white/[0.02] backdrop-blur-md">
      <div>
        <h3 className="section-title text-brand-400"><Activity size={14} /> Financial Goal Milestone Planner</h3>
        <p className="text-xs text-gray-500 mt-0.5">Project and simulate timelines to reach your investment milestone targets.</p>
      </div>

      <div className="space-y-4">
        {/* Target Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-gray-400">Target Goal:</span>
            <span className="text-white font-mono font-bold">₹{target.toLocaleString('en-IN')}</span>
          </div>
          <input 
            type="range" 
            min={50000} 
            max={2000000} 
            step={25000} 
            value={target}
            onChange={(e) => handleTargetChange(Number(e.target.value))}
            className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-brand-500"
          />
        </div>

        {/* SIP Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-gray-400">Monthly Contribution (SIP):</span>
            <span className="text-brand-400 font-mono font-bold">₹{monthlySip.toLocaleString('en-IN')} / mo</span>
          </div>
          <input 
            type="range" 
            min={0} 
            max={50000} 
            step={1000} 
            value={monthlySip}
            onChange={(e) => handleSipChange(Number(e.target.value))}
            className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-brand-500"
          />
        </div>

        {/* Goal Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
            <span>Goal Progress</span>
            <span>{progressPercent.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full relative overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-brand-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </div>
        </div>

        {/* Time Projection Summary */}
        <div className="p-3 bg-brand-500/5 border border-brand-500/10 rounded-xl">
          <div className="text-[10px] text-gray-500 uppercase font-semibold">Estimated Time to Milestone</div>
          {totalValue >= target ? (
            <div className="text-sm font-bold text-brand-400 mt-1">Goal achieved! 🎉</div>
          ) : monthsToTarget >= 600 ? (
            <div className="text-sm font-bold text-red-400 mt-1">Goal unreachable with current contributions.</div>
          ) : (
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold font-mono text-white">
                {years > 0 ? `${years} yr${years !== 1 ? 's' : ''}` : ''}
              </span>
              <span className="text-base font-bold font-mono text-white">
                {remainingMonths > 0 ? ` ${remainingMonths} mo${remainingMonths !== 1 ? 's' : ''}` : ''}
              </span>
              <span className="text-xs text-gray-500 ml-1.5">@ {cagr}% expected growth</span>
            </div>
          )}
        </div>

        {/* 10-Year Wealth Projection Chart */}
        {totalValue > 0 && (
          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="flex justify-between items-center text-[10px] text-gray-500 uppercase font-semibold tracking-wider">
              <span>10-Year Wealth Projection SIP Simulator</span>
              <span className="text-brand-400">Value at Yr 10: ₹{projectionData[9]["With SIP"].toLocaleString('en-IN')}</span>
            </div>
            <div className="h-40 bg-white/[0.01] border border-white/5 rounded-xl p-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sipGoalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#26a366" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#26a366" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#182030" />
                  <XAxis dataKey="year" tick={{ fill: '#4b5563', fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#4b5563', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: '#0e1420', border: '1px solid #182030', borderRadius: 8, fontSize: 10 }}
                    formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, '']}
                    labelStyle={{ color: '#9ca3af' }}
                  />
                  <Area type="monotone" dataKey="With SIP" stroke="#26a366" strokeWidth={1.5} fill="url(#sipGoalGrad)" name="With SIP" />
                  <Area type="monotone" dataKey="Without SIP" stroke="#3b82f6" strokeWidth={1} strokeDasharray="3 3" fill="none" name="Without SIP" />
                  <Area type="monotone" dataKey="Total Contributed" stroke="#4b5563" strokeWidth={1} fill="none" name="Total Contributed" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TaxAuditorCard({ portfolio }: { portfolio: any[] }) {
  if (portfolio.length === 0) return null

  const today = new Date()
  let unrealizedStcgGains = 0
  let unrealizedLtcgGains = 0
  let stcgPositions = 0
  let ltcgPositions = 0

  portfolio.forEach(p => {
    const pVal = (p.current_price ?? p.buy_price) * p.quantity
    const cost = p.buy_price * p.quantity
    const pnl = pVal - cost

    if (p.buy_date) {
      const buyDate = new Date(p.buy_date)
      const diffTime = Math.abs(today.getTime() - buyDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays <= 365) {
        unrealizedStcgGains += Math.max(0, pnl)
        stcgPositions++
      } else {
        unrealizedLtcgGains += Math.max(0, pnl)
        ltcgPositions++
      }
    } else {
      unrealizedStcgGains += Math.max(0, pnl)
      stcgPositions++
    }
  })

  const stcgTax = unrealizedStcgGains * 0.20 // 20% short-term tax rate
  const taxableLtcg = Math.max(0, unrealizedLtcgGains - 125000)
  const ltcgTax = taxableLtcg * 0.125
  const totalTax = stcgTax + ltcgTax

  return (
    <div className="card space-y-4 border-white/5 bg-white/[0.02] backdrop-blur-md">
      <div>
        <h3 className="section-title text-brand-400"><Info size={14} /> Tax Exit Estimator & Ledger</h3>
        <p className="text-xs text-gray-500 mt-0.5">Estimated tax liability if you liquidated your portfolio today (Indian Equity Tax rules).</p>
      </div>

      <div className="space-y-2.5 text-xs">
        <div className="flex justify-between items-center py-1.5 border-b border-white/5">
          <span className="text-gray-400">Short-Term Gains (STCG, &le; 1 yr):</span>
          <span className="font-mono text-white font-semibold">₹{unrealizedStcgGains.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between items-center py-1.5 border-b border-white/5">
          <span className="text-gray-400">STCG Est. Tax (@ 20%):</span>
          <span className="font-mono text-red-400 font-semibold">₹{stcgTax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
        </div>
        
        <div className="flex justify-between items-center py-1.5 border-b border-white/5 mt-1">
          <span className="text-gray-400">Long-Term Gains (LTCG, &gt; 1 yr):</span>
          <span className="font-mono text-white font-semibold">₹{unrealizedLtcgGains.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between items-center py-1.5 border-b border-white/5">
          <span className="text-gray-400">LTCG Est. Tax (@ 12.5%):</span>
          <span className="font-mono text-red-400 font-semibold">₹{ltcgTax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
        </div>

        <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl mt-3 flex justify-between items-center">
          <div>
            <div className="text-[10px] text-gray-500 uppercase font-semibold">Total Estimated Exit Tax</div>
            <div className="text-[9px] text-gray-600 leading-normal mt-0.5">Note: LTCG features a ₹1.25L exemption.</div>
          </div>
          <span className="text-lg font-bold font-mono text-red-400">₹{totalTax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
        </div>
      </div>
    </div>
  )
}

function PortfolioRangePredictor({ totalValue, performance }: { totalValue: number; performance: PortfolioPerformance | null }) {
  if (totalValue === 0 || !performance || !performance.risk.volatility) return null

  const vol = performance.risk.volatility / 100
  const t_30 = 30 / 365
  const sd_30 = vol * Math.sqrt(t_30)

  const lowerRange = totalValue * Math.exp(-sd_30)
  const upperRange = totalValue * Math.exp(sd_30)

  const lowerPct = ((lowerRange - totalValue) / totalValue) * 100
  const upperPct = ((upperRange - totalValue) / totalValue) * 100

  return (
    <div className="card space-y-4 border-white/5 bg-white/[0.02] backdrop-blur-md relative overflow-hidden group">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-brand-500/20 via-brand-500 to-brand-500/20" />
      
      <div className="flex justify-between items-start">
        <div>
          <h3 className="section-title text-brand-400 flex items-center gap-1.5">
            <TrendingUp size={14} /> 30-Day Portfolio Range Predictor
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Statistical forecast of valuation boundaries based on weighted volatility.</p>
        </div>
        <span className="badge-green text-[9px] uppercase tracking-wider">68% Confidence</span>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
            <span className="text-[10px] text-gray-500 uppercase font-semibold">Expected Downside</span>
            <div className="text-sm font-bold font-mono text-red-400 mt-1">
              ₹{Math.round(lowerRange).toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-gray-500 font-mono mt-0.5">
              {lowerPct.toFixed(1)}% shift
            </div>
          </div>

          <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
            <span className="text-[10px] text-gray-500 uppercase font-semibold">Expected Upside</span>
            <div className="text-sm font-bold font-mono text-brand-400 mt-1">
              ₹{Math.round(upperRange).toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-gray-500 font-mono mt-0.5">
              +{upperPct.toFixed(1)}% shift
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="h-2 w-full rounded-full bg-gradient-to-r from-red-500/20 via-brand-500/20 to-brand-500/40 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white ring-4 ring-white/10" />
          </div>
          <div className="flex justify-between text-[9px] text-gray-500 font-mono">
            <span>₹{Math.round(lowerRange).toLocaleString('en-IN')}</span>
            <span>Current: ₹{Math.round(totalValue).toLocaleString('en-IN')}</span>
            <span>₹{Math.round(upperRange).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SharpeOptimizerCard({ 
  portfolio, 
  performance, 
  totalValue 
}: { 
  portfolio: PortfolioEntry[]
  performance: PortfolioPerformance | null
  totalValue: number 
}) {
  const [cagr, setCagr] = useState<number>(12)

  if (portfolio.length === 0) return null

  const expectedReturn = cagr / 100
  const riskFreeRate = 0.05
  const vol = performance?.risk?.volatility ? performance.risk.volatility / 100 : 0.20
  
  // Sharpe Ratio calculation
  const sharpe = vol > 0 ? (expectedReturn - riskFreeRate) / vol : 0

  let rating = 'Sub-optimal'
  let ratingColor = 'text-red-400 bg-red-500/10 border-red-500/15'
  let advice = 'Sub-optimal risk efficiency. Consider trimming high-beta or overvalued assets to lower volatility.'
  
  if (sharpe >= 1.0) {
    rating = 'Excellent'
    ratingColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/15'
    advice = 'Your portfolio is highly optimized for risk-adjusted returns. Maintain configuration.'
  } else if (sharpe >= 0.5) {
    rating = 'Good'
    ratingColor = 'text-brand-400 bg-brand-500/10 border-brand-500/15'
    advice = 'Reasonable risk-efficiency. You could optimize by increasing allocation in low-beta, high-ROE assets.'
  }

  // 1-Year Monte Carlo Projections
  const pessimistic = totalValue * Math.exp((expectedReturn - 0.5 * vol * vol) - 1.28155 * vol)
  const median = totalValue * Math.exp(expectedReturn - 0.5 * vol * vol)
  const optimistic = totalValue * Math.exp((expectedReturn - 0.5 * vol * vol) + 1.28155 * vol)

  const pessimisticChange = ((pessimistic - totalValue) / totalValue) * 100
  const medianChange = ((median - totalValue) / totalValue) * 100
  const optimisticChange = ((optimistic - totalValue) / totalValue) * 100

  // Hold/Buy/Sell Decision Matrix
  const decisions = portfolio.map(entry => {
    const cp = entry.current_price ?? entry.buy_price
    const weight = totalValue > 0 ? ((cp * entry.quantity) / totalValue) * 100 : 0
    const pe = entry.stock_pe ?? null
    const roe = entry.roe ?? null
    const roce = entry.roce ?? null
    const high = entry.high ?? null
    const low = entry.low ?? null

    const pricePct = (high && low && high > low) ? ((cp - low) / (high - low)) * 100 : null

    let recommendation: 'Buy' | 'Hold' | 'Trim' = 'Hold'
    let rationale = ''
    let badgeColor = 'bg-gray-500/10 text-gray-400 border-gray-500/15'

    if (weight > 30) {
      recommendation = 'Trim'
      rationale = `Trim: High concentration risk (${weight.toFixed(1)}%) in portfolio.`
      badgeColor = 'bg-red-500/10 text-red-400 border-red-500/15'
    } else if (pe && pe > 40 && pricePct && pricePct > 95) {
      recommendation = 'Trim'
      rationale = `Trim: Premium valuation (P/E ${pe}) & trading at 52w high (${pricePct.toFixed(0)}%).`
      badgeColor = 'bg-red-500/10 text-red-400 border-red-500/15'
    } else if (pe && pe < 15 && ((roe && roe > 15) || (roce && roce > 15))) {
      recommendation = 'Buy'
      rationale = `Buy: High capital return (ROE ${roe ?? roce}%) & undervalued (P/E ${pe}).`
      badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15'
    } else if (pricePct && pricePct < 10 && ((roe && roe > 12) || (roce && roce > 12))) {
      recommendation = 'Buy'
      rationale = `Buy: Quality company trading near 52w low (${pricePct.toFixed(0)}%).`
      badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15'
    } else {
      recommendation = 'Hold'
      rationale = 'Hold: Fair valuation and optimal position weight.'
      badgeColor = 'bg-gray-500/10 text-gray-400 border-gray-500/15'
    }

    return {
      ticker: entry.ticker,
      weight,
      recommendation,
      rationale,
      badgeColor
    }
  })

  return (
    <div className="card space-y-4 border-white/5 bg-white/[0.02] backdrop-blur-md relative overflow-hidden group">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-brand-500/20 via-brand-500 to-brand-500/20" />
      
      <div className="flex justify-between items-start">
        <div>
          <h3 className="section-title text-brand-400 flex items-center gap-1.5">
            <Activity size={14} /> Sharpe Optimizer & Path Forecaster
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Risk-adjusted returns simulation & holdings allocation matrix.</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* CAGR Slider */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-gray-400 font-medium">Expected CAGR:</span>
            <span className="text-white font-mono font-bold">{cagr}%</span>
          </div>
          <input 
            type="range" 
            min={8} 
            max={25} 
            step={1} 
            value={cagr}
            onChange={(e) => setCagr(Number(e.target.value))}
            className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-brand-500"
          />
        </div>

        {/* Sharpe Efficiency Indicator */}
        <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400">Sharpe Efficiency:</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${ratingColor}`}>
              {rating} ({sharpe.toFixed(2)})
            </span>
          </div>
          <p className="text-[11px] leading-normal text-gray-400">
            {advice}
          </p>
        </div>

        {/* 1-Year Monte Carlo Projections Grid */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider">1-Year Monte Carlo Wealth Forecast</span>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 bg-white/[0.01] border border-white/5 rounded-xl text-center">
              <span className="text-[9px] text-gray-500 font-semibold block uppercase">10th Percentile</span>
              <span className="text-[11px] font-mono font-bold text-red-400 block mt-0.5">
                ₹{Math.round(pessimistic).toLocaleString('en-IN')}
              </span>
              <span className="text-[9px] font-mono text-red-500/70">
                {pessimisticChange >= 0 ? '+' : ''}{pessimisticChange.toFixed(1)}%
              </span>
            </div>

            <div className="p-2 bg-white/[0.01] border border-white/5 rounded-xl text-center">
              <span className="text-[9px] text-gray-500 font-semibold block uppercase">Median (50th)</span>
              <span className="text-[11px] font-mono font-bold text-white block mt-0.5">
                ₹{Math.round(median).toLocaleString('en-IN')}
              </span>
              <span className="text-[9px] font-mono text-gray-400">
                {medianChange >= 0 ? '+' : ''}{medianChange.toFixed(1)}%
              </span>
            </div>

            <div className="p-2 bg-white/[0.01] border border-white/5 rounded-xl text-center">
              <span className="text-[9px] text-gray-500 font-semibold block uppercase">90th Percentile</span>
              <span className="text-[11px] font-mono font-bold text-brand-400 block mt-0.5">
                ₹{Math.round(optimistic).toLocaleString('en-IN')}
              </span>
              <span className="text-[9px] font-mono text-brand-500/70">
                {optimisticChange >= 0 ? '+' : ''}{optimisticChange.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Hold/Buy/Sell Decision Matrix Table */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider">Holding Action Matrix</span>
          <div className="border border-white/5 rounded-xl overflow-hidden bg-white/[0.005]">
            <div className="grid grid-cols-[3fr_2fr_5fr] gap-2 px-3 py-2 bg-white/[0.02] border-b border-white/5 text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
              <span>Ticker / Wt</span>
              <span className="text-center">Action</span>
              <span>Rationale</span>
            </div>
            <div className="divide-y divide-white/5 max-h-[160px] overflow-y-auto no-scrollbar">
              {decisions.map((dec, idx) => (
                <div key={idx} className="grid grid-cols-[3fr_2fr_5fr] gap-2 px-3 py-2 text-xs items-center">
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">{dec.ticker}</div>
                    <div className="text-[9px] text-gray-500 font-mono">{dec.weight.toFixed(1)}% wt</div>
                  </div>
                  <div className="flex justify-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${dec.badgeColor}`}>
                      {dec.recommendation}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 leading-tight">
                    {dec.rationale}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


function SectorRebalancingCard({ portfolio }: { portfolio: PortfolioEntry[] }) {
  if (portfolio.length === 0) return null

  const totalVal = portfolio.reduce((sum, p) => sum + (p.current_price ?? p.buy_price) * p.quantity, 0)
  
  const sectorValuationMap: { [key: string]: number } = {}
  const sectorHoldingsMap: { [key: string]: string[] } = {}
  
  portfolio.forEach(p => {
    const sector = p.sector || 'Other / Cash'
    const val = (p.current_price ?? p.buy_price) * p.quantity
    sectorValuationMap[sector] = (sectorValuationMap[sector] || 0) + val
    
    if (!sectorHoldingsMap[sector]) sectorHoldingsMap[sector] = []
    sectorHoldingsMap[sector].push(p.ticker)
  })

  const sectorAnalysis = Object.entries(sectorValuationMap).map(([sectorName, val]) => {
    const weight = totalVal > 0 ? (val / totalVal) * 100 : 0
    let status: 'Optimal' | 'Overweight' | 'Underweight' = 'Optimal'
    let colorClass = 'text-brand-400 bg-brand-500/10 border-brand-500/15'
    let advice = 'Exposure is balanced.'

    if (weight > 30) {
      status = 'Overweight'
      colorClass = 'text-red-400 bg-red-500/10 border-red-500/15'
      advice = 'Trim exposure to reduce sector risk.'
    } else if (weight < 10 && portfolio.length >= 3) {
      status = 'Underweight'
      colorClass = 'text-amber-400 bg-amber-500/10 border-amber-500/15'
      advice = 'Consider building exposure in this sector.'
    }

    return {
      name: sectorName,
      value: val,
      weight,
      status,
      colorClass,
      advice,
      tickers: sectorHoldingsMap[sectorName]
    }
  }).sort((a, b) => b.weight - a.weight)

  return (
    <div className="card space-y-4 border-white/5 bg-white/[0.02] backdrop-blur-md">
      <div>
        <h3 className="section-title text-brand-400 flex items-center gap-1.5">
          <BarChart2 size={14} /> Sector Drift & Rebalancing
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">Monitor sector concentrations and rebalance to mitigate risk.</p>
      </div>

      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
        {sectorAnalysis.map(sect => (
          <div key={sect.name} className="p-3 bg-white/[0.01] border border-white/5 hover:border-white/10 rounded-xl transition-all space-y-2">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-semibold text-white">{sect.name}</span>
                <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                  ₹{Math.round(sect.value).toLocaleString('en-IN')} • {sect.tickers.join(', ')}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-white font-mono">{sect.weight.toFixed(1)}%</div>
                <span className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded border mt-1 ${sect.colorClass}`}>
                  {sect.status}
                </span>
              </div>
            </div>
            {sect.status !== 'Optimal' && (
              <p className="text-[10px] text-gray-400 leading-normal bg-white/[0.02] p-1.5 rounded-lg border border-white/[0.02]">
                💡 {sect.advice}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function DividendForecasterCard({ performance }: { performance: PortfolioPerformance | null }) {
  if (!performance || !performance.audit.est_annual_dividend) return null

  const annualDiv = performance.audit.est_annual_dividend
  const monthlyAvg = annualDiv / 12

  const months = [
    { name: 'Jan', weight: 0.3 },
    { name: 'Feb', weight: 0.5 },
    { name: 'Mar', weight: 0.8 },
    { name: 'Apr', weight: 0.4 },
    { name: 'May', weight: 0.7 },
    { name: 'Jun', weight: 1.2 },
    { name: 'Jul', weight: 2.2 },
    { name: 'Aug', weight: 2.5 },
    { name: 'Sep', weight: 1.5 },
    { name: 'Oct', weight: 0.6 },
    { name: 'Nov', weight: 0.8 },
    { name: 'Dec', weight: 0.5 }
  ]

  const totalWeight = months.reduce((s, m) => s + m.weight, 0)
  const monthlyData = months.map(m => ({
    name: m.name,
    amount: Math.round((m.weight / totalWeight) * annualDiv)
  }))

  return (
    <div className="card space-y-4 border-white/5 bg-white/[0.02] backdrop-blur-md">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="section-title text-brand-400 flex items-center gap-1.5">
            <Wallet size={14} /> Passive Income Forecast
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Estimated monthly dividend cash flows based on historical seasonality.</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-500 uppercase font-semibold block">Total Annual</span>
          <span className="text-sm font-bold font-mono text-white">₹{Math.round(annualDiv).toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="p-3 bg-brand-500/5 border border-brand-500/10 rounded-xl flex justify-between items-center">
          <div>
            <div className="text-[10px] text-gray-500 uppercase font-semibold">Average Monthly Income</div>
            <p className="text-[10px] text-gray-600 leading-normal mt-0.5">Assumes balanced yearly payouts.</p>
          </div>
          <span className="text-base font-bold font-mono text-brand-400">₹{Math.round(monthlyAvg).toLocaleString('en-IN')}</span>
        </div>

        <div className="space-y-2 pt-1">
          <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Seasonality Forecast</div>
          <div className="flex items-end justify-between h-16 pt-2 px-1 bg-white/[0.01] rounded-xl border border-white/5">
            {monthlyData.map((m, idx) => {
              const maxAmt = Math.max(...monthlyData.map(d => d.amount))
              const heightPct = maxAmt > 0 ? (m.amount / maxAmt) * 100 : 0
              
              return (
                <div key={idx} className="flex flex-col items-center flex-1 group relative">
                  <div className="absolute bottom-full mb-1 hidden group-hover:block z-50 bg-[#0e1420] border border-white/10 rounded-lg p-1.5 text-[9px] font-mono text-white whitespace-nowrap shadow-xl">
                    ₹{m.amount.toLocaleString('en-IN')}
                  </div>
                  <div 
                    className="w-2.5 bg-brand-500/30 group-hover:bg-brand-500 rounded-t transition-all duration-300"
                    style={{ height: `${Math.max(5, heightPct)}%` }}
                  />
                  <span className="text-[8px] text-gray-600 font-semibold mt-1.5">{m.name}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function getHeadlineSentiment(title: string): { label: string; colorClass: string } {
  const t = title.toLowerCase()
  const posWords = ['surge', 'rise', 'growth', 'gain', 'profit', 'up', 'higher', 'positive', 'strong', 'upgrade', 'jump', 'buy', 'win', 'beat', 'exceptional', 'high']
  const negWords = ['drop', 'fall', 'loss', 'down', 'lower', 'negative', 'weak', 'downgrade', 'slump', 'decline', 'sell', 'caution', 'warn', 'debt', 'risk']
  
  let posCount = 0
  let negCount = 0
  
  posWords.forEach(w => { if (t.includes(w)) posCount++ })
  negWords.forEach(w => { if (t.includes(w)) negCount++ })
  
  if (posCount > negCount) {
    return { label: 'Bullish', colorClass: 'bg-brand-500/10 text-brand-400 border-brand-500/15' }
  } else if (negCount > posCount) {
    return { label: 'Bearish', colorClass: 'bg-red-500/10 text-red-400 border-red-500/15' }
  }
  return { label: 'Neutral', colorClass: 'bg-white/5 text-gray-400 border-white/5' }
}

function ActiveAlertsCard({ 
  alerts, 
  loading, 
  onToggle, 
  onDelete 
}: { 
  alerts: Alert[]; 
  loading: boolean; 
  onToggle: (id: string) => void; 
  onDelete: (id: string) => void;
}) {
  return (
    <div className="card h-[460px] flex flex-col border-white/5 bg-white/[0.02] backdrop-blur-md">
      <div className="flex items-center gap-2 mb-4 justify-between">
        <h3 className="section-title text-white flex items-center gap-1.5">
          <Activity size={14} className="text-brand-400" /> Active Price Alerts
        </h3>
        <Link href="/alerts" className="text-[10px] text-brand-400 font-semibold hover:underline">
          Manage Alerts →
        </Link>
      </div>

      {loading ? (
        <div className="flex-1 space-y-2.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton h-14 rounded-xl" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-500">
          <ShieldAlert size={24} className="text-gray-600 mb-2" />
          <p className="text-xs font-semibold text-gray-400">No active alerts</p>
          <p className="text-[10px] text-gray-600 leading-normal mt-0.5">Set up target or stop-loss price thresholds to notify your Telegram channel.</p>
        </div>
      ) : (
        <div className="flex-1 space-y-2.5 overflow-y-auto pr-1 no-scrollbar max-h-[380px]">
          {alerts.map(alert => (
            <div key={alert.id} className="p-3 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 transition-all flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-xs">{alert.ticker}</span>
                  <span className="badge-gray text-[8px] uppercase tracking-wider">{alert.exchange}</span>
                </div>
                <div className="flex gap-2 text-[10px] text-gray-500 font-mono mt-1">
                  {alert.target_price && <span>Target: ₹{alert.target_price}</span>}
                  {alert.stop_loss && <span>SL: ₹{alert.stop_loss}</span>}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => onToggle(alert.id)}
                  className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    alert.is_active ? 'bg-brand-500' : 'bg-white/10'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      alert.is_active ? 'translate-x-3' : 'translate-x-0'
                    }`}
                  />
                </button>

                <button
                  onClick={() => onDelete(alert.id)}
                  className="text-gray-500 hover:text-red-400 p-1 hover:bg-red-500/10 rounded transition-colors"
                  title="Delete Alert"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PortfolioStressTester({ portfolio, totalValue }: { portfolio: PortfolioEntry[]; totalValue: number }) {
  const [selectedScenario, setSelectedScenario] = useState<string>('correction')

  if (portfolio.length === 0) return null

  const scenarios = [
    {
      id: 'correction',
      name: 'Market Crash (-30%)',
      desc: 'Simulates a broad market capitulation (similar to 2008 or March 2020).',
    },
    {
      id: 'inflation',
      name: 'High Inflation Spike',
      desc: 'Simulates high inflation where Commodities rise but Tech and Real Estate slump.',
    },
    {
      id: 'growth',
      name: 'Tech & Growth Boom',
      desc: 'Simulates a high-liquidity tech bull run led by software and automation.',
    },
    {
      id: 'rates',
      name: 'Rising Interest Rates',
      desc: 'Simulates central bank rate hikes favoring banks but hurting tech and real estate.',
    }
  ]

  let simulatedTotal = 0
  
  portfolio.forEach(p => {
    const val = (p.current_price ?? p.buy_price) * p.quantity
    const sector = (p.sector || '').toLowerCase()
    
    let changePct = 0
    if (selectedScenario === 'correction') {
      changePct = -30
    } else if (selectedScenario === 'inflation') {
      if (sector.includes('tech') || sector.includes('it') || sector.includes('information')) {
        changePct = -15
      } else if (sector.includes('realty') || sector.includes('estate') || sector.includes('infra')) {
        changePct = -10
      } else if (sector.includes('bank') || sector.includes('financial') || sector.includes('insurance')) {
        changePct = 10
      } else if (sector.includes('energy') || sector.includes('oil') || sector.includes('commodity') || sector.includes('metal') || sector.includes('steel') || sector.includes('power')) {
        changePct = 20
      } else {
        changePct = -5
      }
    } else if (selectedScenario === 'growth') {
      if (sector.includes('tech') || sector.includes('it') || sector.includes('information')) {
        changePct = 35
      } else if (sector.includes('bank') || sector.includes('financial') || sector.includes('insurance')) {
        changePct = 10
      } else {
        changePct = 5
      }
    } else if (selectedScenario === 'rates') {
      if (sector.includes('tech') || sector.includes('it') || sector.includes('information')) {
        changePct = -12
      } else if (sector.includes('realty') || sector.includes('estate') || sector.includes('infra')) {
        changePct = -18
      } else if (sector.includes('bank') || sector.includes('financial') || sector.includes('insurance')) {
        changePct = 15
      } else {
        changePct = -2
      }
    }
    
    simulatedTotal += val * (1 + changePct / 100)
  })

  const diff = simulatedTotal - totalValue
  const diffPct = totalValue > 0 ? (diff / totalValue) * 100 : 0
  const isPos = diff >= 0

  const techExposure = portfolio.reduce((sum, p) => {
    const sector = (p.sector || '').toLowerCase()
    if (sector.includes('tech') || sector.includes('it') || sector.includes('information')) {
      return sum + (p.current_price ?? p.buy_price) * p.quantity
    }
    return sum
  }, 0)
  const techWeight = totalValue > 0 ? (techExposure / totalValue) * 100 : 0

  let advice = ""
  if (selectedScenario === 'correction') {
    advice = "To buffer against broad market crashes, maintain a cash reserve (10-15%) or allocate to defensive low-beta sectors like Fast-Moving Consumer Goods (FMCG) and Pharmaceuticals."
  } else if (selectedScenario === 'inflation') {
    if (techWeight > 30) {
      advice = `Your high tech exposure (${techWeight.toFixed(0)}%) is vulnerable to inflation spikes. Hedging with commodity-focused positions, commodities, or materials is recommended.`
    } else {
      advice = "Your balanced sector exposure keeps inflation risk low. Adding a slice of commodities or value cyclicals could further boost resilience."
    }
  } else if (selectedScenario === 'growth') {
    advice = "A growth boom favors high-beta tech stocks. Ensure you participate while keeping capital efficiency (high ROE/ROCE) metrics in check to avoid speculative bubbles."
  } else if (selectedScenario === 'rates') {
    if (techWeight > 25) {
      advice = `Rate hikes trigger multiple contraction in growth sectors. Consider rotating some Tech gains (${techWeight.toFixed(0)}% weight) into financials/banks to capture rising net interest margins.`
    } else {
      advice = "Your moderate growth exposure leaves you well positioned. Banks/Financials in your portfolio will benefit from higher credit yields during rate cycles."
    }
  }

  return (
    <div className="card space-y-4 border-white/5 bg-white/[0.02] backdrop-blur-md relative overflow-hidden group">
      <div>
        <h3 className="section-title text-brand-400 flex items-center gap-1.5">
          <ShieldAlert size={14} /> Macro Economic Scenario Stress Simulator
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">Simulate macroeconomic shocks on your live holdings to audit valuation impact.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2 md:border-r md:border-white/5 md:pr-4">
          <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Select Scenario</label>
          <div className="flex flex-col gap-1.5">
            {scenarios.map(sc => (
              <button
                key={sc.id}
                type="button"
                onClick={() => setSelectedScenario(sc.id)}
                className={`text-left text-xs font-semibold px-3 py-2 rounded-lg border transition-all ${
                  selectedScenario === sc.id
                    ? 'bg-brand-500/10 border-brand-500/30 text-brand-400'
                    : 'bg-white/[0.01] border-white/5 hover:border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {sc.name}
              </button>
            ))}
          </div>
        </div>

        <div className="col-span-2 space-y-4">
          <div>
            <p className="text-[10px] text-gray-500 uppercase font-semibold">Scenario Outlook</p>
            <p className="text-xs text-gray-400 leading-normal mt-0.5">
              {scenarios.find(s => s.id === selectedScenario)?.desc}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
              <span className="text-[10px] text-gray-500 uppercase font-semibold">Simulated Value</span>
              <div className="text-sm font-bold font-mono text-white mt-1">
                ₹{Math.round(simulatedTotal).toLocaleString('en-IN')}
              </div>
            </div>

            <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
              <span className="text-[10px] text-gray-500 uppercase font-semibold">Simulated Return</span>
              <div className={`text-sm font-bold font-mono mt-1 ${isPos ? 'text-brand-400' : 'text-red-400'}`}>
                {isPos ? '+' : ''}₹{Math.round(diff).toLocaleString('en-IN')} ({isPos ? '+' : ''}{diffPct.toFixed(1)}%)
              </div>
            </div>
          </div>

          <div className="space-y-1 pt-1">
            <div className="h-2 w-full rounded-full bg-white/5 relative overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  isPos ? 'bg-gradient-to-r from-brand-500 to-emerald-400' : 'bg-gradient-to-r from-red-500 to-rose-400'
                }`}
                style={{ 
                  width: `${Math.min(100, isPos ? 50 + (diffPct * 2) : 50 + (diffPct * 1.5))}%`,
                  marginLeft: `${isPos ? '50%' : `calc(50% + ${diffPct * 1.5}%)`}`
                }}
              />
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/20" />
            </div>
            <div className="flex justify-between text-[8px] text-gray-500 font-mono">
              <span>Severe Loss (-50%)</span>
              <span>Baseline (Current)</span>
              <span>Growth (+50%)</span>
            </div>
          </div>

          <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
            <div className="text-[10px] text-gray-500 uppercase font-semibold">🛡️ Dynamic Hedging Action</div>
            <p className="text-[11px] text-gray-400 leading-normal mt-1">
              {advice}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user, refreshUser } = useAuthStore()
  const [showAddModal, setShowAddModal] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [sortBy, setSortBy] = useState<'value' | 'pnl' | 'ticker'>('value')

  const [indices, setIndices] = useState<MarketIndex[]>([])
  const [marketStatus, setMarketStatus] = useState<{ is_open: boolean; message: string } | null>(null)
  const [news, setNews] = useState<NewsArticle[]>([])
  const [performance, setPerformance] = useState<PortfolioPerformance | null>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(true)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loadingAlerts, setLoadingAlerts] = useState(true)
  const [currentTime, setCurrentTime] = useState<string>('')

  useEffect(() => {
    setCurrentTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const [donutGroup, setDonutGroup] = useState<'ticker' | 'sector'>('ticker')

  const portfolio = user?.portfolio ?? []

  const totalInvested = portfolio.reduce((s, p) => s + p.buy_price * p.quantity, 0)
  const totalCurrent  = portfolio.reduce((s, p) => s + (p.current_price ?? p.buy_price) * p.quantity, 0)
  const totalPnl      = totalCurrent - totalInvested
  const totalPnlPct   = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0
  const positive      = totalPnl >= 0

  const sortedPortfolio = [...portfolio].sort((a, b) => {
    if (sortBy === 'pnl') return (b.pnl ?? 0) - (a.pnl ?? 0)
    if (sortBy === 'ticker') return a.ticker.localeCompare(b.ticker)
    return (b.current_price ?? b.buy_price) * b.quantity - (a.current_price ?? a.buy_price) * a.quantity
  })

  // Format grouped sector data to mimic PortfolioEntry structure for Donut
  const groupedBySector = portfolio.reduce((acc: any, p) => {
    const sName = p.sector || 'Other / Cash'
    const value = (p.current_price ?? p.buy_price) * p.quantity
    acc[sName] = (acc[sName] || 0) + value
    return acc
  }, {})

  const sectorEntries = Object.entries(groupedBySector).map(([name, val]) => ({
    ticker: name,
    exchange: 'NSE',
    buy_price: 1,
    quantity: val as number
  }))

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoadingAnalytics(true)
      setLoadingAlerts(true)
      const tickers = portfolio.map(p => p.ticker).join(',')
      const [indicesRes, performanceRes, newsRes, alertsRes] = await Promise.all([
        stockApi.getIndices(),
        userApi.getPortfolioPerformance(),
        stockApi.getNews(tickers),
        alertApi.list()
      ])
      
      setIndices(indicesRes.data.indices || [])
      setMarketStatus(indicesRes.data.market_status || null)
      setPerformance(performanceRes.data)
      setNews(newsRes.data)
      setAlerts(alertsRes.data)
    } catch (err) {
      console.error("Failed to fetch dashboard analytics:", err)
    } finally {
      setLoadingAnalytics(false)
      setLoadingAlerts(false)
    }
  }, [portfolio.length])

  useEffect(() => {
    if (user) {
      fetchAnalytics()
    }
  }, [user, fetchAnalytics])

  async function handleRemove(ticker: string) {
    try {
      await userApi.removeFromPortfolio(ticker)
      toast.success(`${ticker} removed`)
      refreshUser()
    } catch { toast.error('Failed to remove') }
  }

  async function handleToggleAlert(id: string) {
    try {
      const { data } = await alertApi.toggle(id)
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_active: data.is_active } : a))
      toast.success("Alert status updated")
    } catch {
      toast.error("Failed to toggle alert status")
    }
  }

  async function handleDeleteAlert(id: string) {
    try {
      await alertApi.delete(id)
      setAlerts(prev => prev.filter(a => a.id !== id))
      toast.success("Alert deleted")
    } catch {
      toast.error("Failed to delete alert")
    }
  }

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await Promise.all([refreshUser(), fetchAnalytics()])
    setRefreshing(false)
    toast.success('Portfolio analytics refreshed')
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-white/[0.02] to-transparent p-5 rounded-2xl border border-white/[0.04] backdrop-blur-md shadow-2xl relative overflow-hidden group">
        {/* Ambient Time Glow Backdrop */}
        <div className={`absolute -left-10 -top-10 w-44 h-44 rounded-full blur-[80px] pointer-events-none opacity-45 mix-blend-screen transition-colors duration-1000 ${
          new Date().getHours() < 12 
            ? 'bg-amber-400/20' 
            : new Date().getHours() < 17 
              ? 'bg-orange-400/20' 
              : 'bg-indigo-400/30'
        }`} />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-500/5 to-transparent opacity-50 pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10 flex-wrap md:flex-nowrap">
          {/* Dynamic Greeting Icon Box */}
          <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center shadow-inner relative group-hover:border-white/10 transition-colors duration-300">
            {new Date().getHours() < 12 ? (
              <Sun className="w-5.5 h-5.5 text-amber-400 animate-pulse" />
            ) : new Date().getHours() < 17 ? (
              <Sun className="w-5.5 h-5.5 text-orange-400 animate-pulse" />
            ) : (
              <Moon className="w-5.5 h-5.5 text-indigo-300 animate-pulse" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap text-[10px] text-gray-500 font-mono">
              <span className="text-gray-400 font-semibold">
                {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              {currentTime && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/10" />
                  <span className="text-gray-400 bg-white/[0.02] border border-white/[0.04] px-1.5 py-0.5 rounded-md shadow-inner">{currentTime}</span>
                </>
              )}
              {marketStatus && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/10" />
                  <span className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    marketStatus.is_open 
                      ? 'bg-brand-500/10 text-brand-400 border border-brand-500/15 shadow-[0_0_10px_rgba(38,163,102,0.06)]' 
                      : 'bg-red-500/10 text-red-400 border border-red-500/15'
                  }`}>
                    <span className={marketStatus.is_open ? 'dot-live' : 'dot-live-red'} />
                    {marketStatus.message}
                  </span>
                </>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-1.5 flex items-center gap-2">
              <span className="text-gray-400 font-medium">{greeting()},</span>
              <span className="bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
                {user?.name?.split(' ')[0]}
              </span>
              <span className="inline-block origin-bottom-right animate-wave cursor-default">👋</span>
            </h1>
          </div>

          {/* Quick Stats Panel */}
          <div className="hidden lg:flex items-center gap-3 border-l border-white/[0.06] pl-6 ml-2 select-none">
            {/* Active Alerts Pill */}
            <div 
              onClick={() => scrollToSection('dashboard-alerts')}
              className="flex items-center gap-3.5 px-3 py-1.5 rounded-xl border border-white/[0.03] bg-white/[0.01] hover:bg-amber-500/[0.02] hover:border-amber-500/20 hover:shadow-[0_0_12px_rgba(251,191,36,0.04)] transition-all duration-300 cursor-pointer hover:scale-[1.02] active:scale-[0.98] group/stat"
              title="Click to view active alerts"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/5 flex items-center justify-center text-amber-500 shadow-inner group-hover/stat:bg-amber-500/10 transition-colors duration-300">
                <Bell size={13} className={alerts.filter(a => a.is_active).length > 0 ? 'animate-bounce' : ''} />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-extrabold text-gray-500 tracking-wider leading-none">Active Alerts</span>
                <span className="text-sm font-bold text-white font-mono mt-1.5 leading-none">
                  {alerts.filter(a => a.is_active).length}
                </span>
              </div>
            </div>

            {/* Positions Pill */}
            <div 
              onClick={() => scrollToSection('dashboard-holdings')}
              className="flex items-center gap-3.5 px-3 py-1.5 rounded-xl border border-white/[0.03] bg-white/[0.01] hover:bg-brand-500/[0.02] hover:border-brand-500/20 hover:shadow-[0_0_12px_rgba(38,163,102,0.04)] transition-all duration-300 cursor-pointer hover:scale-[1.02] active:scale-[0.98] group/stat"
              title="Click to view holdings"
            >
              <div className="w-8 h-8 rounded-lg bg-brand-500/5 flex items-center justify-center text-brand-400 shadow-inner group-hover/stat:bg-brand-500/10 transition-colors duration-300">
                <Briefcase size={13} />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-extrabold text-gray-500 tracking-wider leading-none">Positions</span>
                <span className="text-sm font-bold text-white font-mono mt-1.5 leading-none">
                  {portfolio.length}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 relative z-10">
          <button onClick={handleRefresh} disabled={refreshing} className="btn-outline flex items-center gap-2 text-xs bg-white/[0.01] hover:bg-white/[0.04] border-white/5 hover:border-white/10 py-2.5 px-4 transition-all duration-300 rounded-xl group/btn">
            <RefreshCw size={13} className={`${refreshing ? 'animate-spin' : 'group-hover/btn:rotate-180'} text-brand-400 transition-transform duration-500`} />
            Refresh
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 text-xs py-2.5 px-4 rounded-xl shadow-[0_0_20px_rgba(38,163,102,0.12)] hover:shadow-[0_0_25px_rgba(38,163,102,0.22)] transition-all duration-300 border border-brand-400/20 hover:scale-[1.02]">
            <Plus size={14} /> Add Stock
          </button>
        </div>
      </div>

      {/* Indices Ticker (Scrolling Marquee) or Loading/Error State */}
      {loadingAnalytics ? (
        <div className="h-[60px] w-full skeleton animate-pulse rounded-2xl border border-white/[0.04]" />
      ) : indices.length > 0 ? (
        <div className="relative w-full overflow-hidden py-3 border-y border-white/[0.04] bg-gradient-to-r from-white/[0.01] via-transparent to-white/[0.01] backdrop-blur-sm rounded-2xl select-none group/marquee animate-fade-in">
          {/* Gradient Overlays for Fadeout edges */}
          <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-black/90 to-transparent z-20 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-black/90 to-transparent z-20 pointer-events-none" />
          
          <div className="flex whitespace-nowrap animate-marquee group-hover/marquee:[animation-play-state:paused] gap-4">
            {/* First Render */}
            <div className="flex gap-4 shrink-0">
              {indices.map(idx => {
                const isPos = idx.change >= 0
                const isCryptoOrComm = ['BTC-USD', 'GCF', 'CLF'].includes(idx.symbol)
                const prefix = isCryptoOrComm ? '$' : '₹'
                const formatLocale = isCryptoOrComm ? 'en-US' : 'en-IN'
                
                return (
                  <div key={`${idx.symbol}-1`} className={`inline-flex items-center gap-3.5 px-4 py-2 rounded-xl border border-white/[0.04] bg-white/[0.015] backdrop-blur-md shadow-lg shrink-0 transition-all duration-300 ${
                    isPos 
                      ? 'hover:border-brand-500/30 hover:bg-brand-500/[0.02] hover:shadow-[0_0_15px_rgba(38,163,102,0.05)]' 
                      : 'hover:border-red-500/30 hover:bg-red-500/[0.02] hover:shadow-[0_0_15px_rgba(239,68,68,0.05)]'
                  }`}>
                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-gray-500 block leading-none">{idx.name}</span>
                      <span className="text-xs font-extrabold text-white font-mono mt-1.5 block leading-none">
                        {prefix}{idx.price.toLocaleString(formatLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    
                    {idx.sparkline && idx.sparkline.length > 0 && (
                      <div className="h-5 w-12 opacity-70 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={idx.sparkline.map(p => ({ price: p }))} margin={{ top: 1, bottom: 1, left: 1, right: 1 }}>
                            <defs>
                              <filter id={`laser-glow-${idx.symbol}-1`} x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="1" result="blur" />
                                <feMerge>
                                  <feMergeNode in="blur" />
                                  <feMergeNode in="SourceGraphic" />
                                </feMerge>
                              </filter>
                            </defs>
                            <Area
                              type="monotone"
                              dataKey="price"
                              stroke={isPos ? '#26a366' : '#ef4444'}
                              strokeWidth={1.5}
                              fill="none"
                              dot={false}
                              filter={`url(#laser-glow-${idx.symbol}-1)`}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    
                    <div className="text-right flex flex-col items-end shrink-0">
                      <span className={`inline-flex items-center text-[10px] font-mono font-bold leading-none ${isPos ? 'text-brand-400' : 'text-red-400'}`}>
                        {isPos ? '▲' : '▼'} {isPos ? '+' : ''}{idx.change_percent.toFixed(2)}%
                      </span>
                      <span className="text-[9px] text-gray-500 font-mono mt-1 leading-none font-semibold">
                        {prefix}{idx.change > 0 ? '+' : ''}{idx.change.toLocaleString(formatLocale, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            
            {/* Duplicate Render for Seamless Scrolling */}
            <div className="flex gap-4 shrink-0" aria-hidden="true">
              {indices.map(idx => {
                const isPos = idx.change >= 0
                const isCryptoOrComm = ['BTC-USD', 'GCF', 'CLF'].includes(idx.symbol)
                const prefix = isCryptoOrComm ? '$' : '₹'
                const formatLocale = isCryptoOrComm ? 'en-US' : 'en-IN'
                
                return (
                  <div key={`${idx.symbol}-2`} className={`inline-flex items-center gap-3.5 px-4 py-2 rounded-xl border border-white/[0.04] bg-white/[0.015] backdrop-blur-md shadow-lg shrink-0 transition-all duration-300 ${
                    isPos 
                      ? 'hover:border-brand-500/30 hover:bg-brand-500/[0.02] hover:shadow-[0_0_15px_rgba(38,163,102,0.05)]' 
                      : 'hover:border-red-500/30 hover:bg-red-500/[0.02] hover:shadow-[0_0_15px_rgba(239,68,68,0.05)]'
                  }`}>
                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-gray-500 block leading-none">{idx.name}</span>
                      <span className="text-xs font-extrabold text-white font-mono mt-1.5 block leading-none">
                        {prefix}{idx.price.toLocaleString(formatLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    
                    {idx.sparkline && idx.sparkline.length > 0 && (
                      <div className="h-5 w-12 opacity-70 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={idx.sparkline.map(p => ({ price: p }))} margin={{ top: 1, bottom: 1, left: 1, right: 1 }}>
                            <defs>
                              <filter id={`laser-glow-${idx.symbol}-2`} x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="1" result="blur" />
                                <feMerge>
                                  <feMergeNode in="blur" />
                                  <feMergeNode in="SourceGraphic" />
                                </feMerge>
                              </filter>
                            </defs>
                            <Area
                              type="monotone"
                              dataKey="price"
                              stroke={isPos ? '#26a366' : '#ef4444'}
                              strokeWidth={1.5}
                              fill="none"
                              dot={false}
                              filter={`url(#laser-glow-${idx.symbol}-2)`}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    
                    <div className="text-right flex flex-col items-end shrink-0">
                      <span className={`inline-flex items-center text-[10px] font-mono font-bold leading-none ${isPos ? 'text-brand-400' : 'text-red-400'}`}>
                        {isPos ? '▲' : '▼'} {isPos ? '+' : ''}{idx.change_percent.toFixed(2)}%
                      </span>
                      <span className="text-[9px] text-gray-500 font-mono mt-1 leading-none font-semibold">
                        {prefix}{idx.change > 0 ? '+' : ''}{idx.change.toLocaleString(formatLocale, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="card flex items-center justify-between p-4 border-red-500/20 bg-red-500/[0.02] backdrop-blur-md rounded-2xl relative overflow-hidden animate-fade-in">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.1)]">
              <ShieldAlert size={15} />
            </div>
            <div>
              <span className="text-[9px] uppercase font-bold tracking-wider text-red-400 block leading-none">Market Feed Connection Error</span>
              <p className="text-[11px] text-gray-400 mt-1 leading-none font-semibold">Live indices are temporarily unavailable. Please retry the connection.</p>
            </div>
          </div>
          <button onClick={handleRefresh} disabled={refreshing} className="btn-outline flex items-center gap-1.5 text-[9px] uppercase font-bold py-2 px-3 rounded-lg border-red-500/20 hover:border-red-500/40 text-red-400 hover:bg-red-500/10 transition-all duration-300 relative z-10">
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
            Retry Feed
          </button>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Portfolio Value"
          value={`₹${totalCurrent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          subValue={`${portfolio.length} position${portfolio.length !== 1 ? 's' : ''}`}
          icon={<Wallet size={16} />}
          neutral
        />
        <StatCard
          label="Amount Invested"
          value={`₹${totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          subValue="Total cost basis"
          icon={<BarChart2 size={16} />}
          neutral
        />
        <StatCard
          label="Total P&L"
          value={`${positive ? '+' : ''}₹${Math.abs(totalPnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          change={`${positive ? '+' : ''}${totalPnlPct.toFixed(2)}% overall`}
          positive={positive}
          icon={positive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
        />
      </div>

      {/* Portfolio Performance & News / Audits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2/3 area */}
        <div className="lg:col-span-2 space-y-4">
          {/* Timeline Chart */}
          {performance && performance.timeline && performance.timeline.length > 0 && (
            <div className="card space-y-4 border-white/5 bg-white/[0.02] backdrop-blur-md">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="section-title text-brand-400"><TrendingUp size={14} /> Portfolio vs Nifty 50 Index</h3>
                  <p className="text-xs text-gray-500 mt-0.5">7-Day relative percentage returns comparing your holdings with the market index.</p>
                </div>
                <div className="flex gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-brand-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-brand-500" /> Portfolio
                  </span>
                  <span className="flex items-center gap-1.5 text-blue-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Nifty 50
                  </span>
                </div>
              </div>
              
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={performance.timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#26a366" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#26a366" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="niftyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#182030" />
                  <XAxis dataKey="date" tick={{ fill: '#4b5563', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip
                    contentStyle={{ background: '#0e1420', border: '1px solid #182030', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number, name: string) => [
                      `${v > 0 ? '+' : ''}${v.toFixed(2)}%`, 
                      name === 'portfolio_return' ? 'My Portfolio' : 'Nifty 50'
                    ]}
                    labelStyle={{ color: '#9ca3af' }}
                  />
                  <Area type="monotone" dataKey="portfolio_return" stroke="#26a366" strokeWidth={2} fill="url(#portGrad)" name="portfolio_return" />
                  <Area type="monotone" dataKey="nifty_return" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="3 3" fill="url(#niftyGrad)" name="nifty_return" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Holdings grid */}
          <div id="dashboard-holdings" className="card border-white/5 bg-white/[0.02] backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title"><BarChart2 size={14} /> Holdings</h3>
              {portfolio.length > 0 && (
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-gray-500 mr-1">Sort:</span>
                  {(['value', 'pnl', 'ticker'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setSortBy(s)}
                      className={`px-2.5 py-1 rounded-lg capitalize transition-all ${
                        sortBy === s ? 'bg-brand-500/15 text-brand-400 font-semibold' : 'text-gray-500 hover:text-white hover:bg-surface-muted'
                      }`}
                    >
                      {s === 'pnl' ? 'P&L' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {portfolio.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-surface-muted flex items-center justify-center mx-auto mb-4">
                  <BarChart2 size={28} className="text-gray-600" />
                </div>
                <p className="text-gray-400 font-medium mb-1">No stocks yet</p>
                <p className="text-gray-600 text-sm mb-5">Add your first holding to start tracking</p>
                <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 mx-auto">
                  <Plus size={16} /> Add your first stock
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2 text-[10px] font-semibold text-gray-600 uppercase tracking-widest border-b border-surface-border mb-1">
                  <span>Stock</span>
                  <span className="text-right">Value / P&L</span>
                  <span className="w-16" />
                </div>
                <div className="space-y-0.5">
                  {sortedPortfolio.map(entry => (
                    <HoldingRow key={entry.ticker} entry={entry} onRemove={handleRemove} />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Sector Drift & Rebalancing Analyzer */}
          <SectorRebalancingCard portfolio={portfolio} />

          {/* Interactive Milestone Planner */}
          <GoalMilestonePlanner totalValue={totalCurrent} />

          {/* Portfolio Scenario Stress Testing Simulator */}
          <PortfolioStressTester portfolio={portfolio} totalValue={totalCurrent} />

          {/* Bottom Left Grid: News & Alerts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Holdings & Market News with Sentiment Badging */}
            <div className="card h-[460px] flex flex-col border-white/5 bg-white/[0.02] backdrop-blur-md">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="section-title text-white flex-1"><Activity size={14} /> Holdings & Market News</h3>
                <span className="badge-gray text-[9px] uppercase tracking-wider">Live RSS</span>
              </div>
              
              {news.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-center text-gray-500 py-12 text-xs">
                  No recent headlines found.
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto pr-1 max-h-[380px] no-scrollbar">
                  {news.map((item, idx) => {
                    const sentiment = getHeadlineSentiment(item.title)
                    return (
                      <a 
                        key={idx} 
                        href={item.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block p-3 rounded-xl bg-white/[0.01] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 transition-all duration-200 group"
                      >
                        <div className="flex justify-between items-start gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="badge-green text-[9px] font-mono tracking-wider px-1.5 py-0.2 rounded uppercase shrink-0">
                              {item.ticker}
                            </span>
                            <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${sentiment.colorClass}`}>
                              {sentiment.label}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-500 font-mono">
                            {item.source}
                          </span>
                        </div>
                        <h4 className="text-xs font-semibold text-gray-200 group-hover:text-white line-clamp-2 leading-relaxed">
                          {item.title}
                        </h4>
                        <div className="text-[9px] text-gray-600 mt-2 text-right font-mono">
                          {item.pub_date}
                        </div>
                      </a>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Active Alerts Card */}
            <div id="dashboard-alerts" className="w-full">
              <ActiveAlertsCard
                alerts={alerts}
                loading={loadingAlerts}
                onToggle={handleToggleAlert}
                onDelete={handleDeleteAlert}
              />
            </div>
          </div>
        </div>

        {/* Right 1/3 sidebar area */}
        <div className="space-y-4">
          {/* Health Insights */}
          <PortfolioInsights portfolio={portfolio} performance={performance} />

          {/* Allocation & Audit */}
          {portfolio.length > 0 && (
            <div className="card flex flex-col items-center justify-center border-white/5 bg-white/[0.02] backdrop-blur-md py-4">
              <div className="flex justify-between items-center w-full mb-3">
                <h3 className="section-title"><BarChart2 size={14} /> Allocation</h3>
                {/* Sector Toggle */}
                <div className="flex gap-0.5 p-0.5 bg-white/[0.03] border border-white/5 rounded-lg">
                  <button 
                    onClick={() => setDonutGroup('ticker')}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${donutGroup === 'ticker' ? 'bg-brand-500 text-white font-bold' : 'text-gray-500 hover:text-white'}`}
                  >
                    Ticker
                  </button>
                  <button 
                    onClick={() => setDonutGroup('sector')}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${donutGroup === 'sector' ? 'bg-brand-500 text-white font-bold' : 'text-gray-500 hover:text-white'}`}
                  >
                    Sector
                  </button>
                </div>
              </div>
              <PortfolioDonut portfolio={donutGroup === 'ticker' ? portfolio : sectorEntries} />
            </div>
          )}

          {/* Tax Auditor Card */}
          <TaxAuditorCard portfolio={portfolio} />

          {/* Dividend Forecaster Card */}
          <DividendForecasterCard performance={performance} />

          {/* Portfolio Range Predictor */}
          <PortfolioRangePredictor totalValue={totalCurrent} performance={performance} />

          {/* Portfolio Audit Details */}
          {performance && portfolio.length > 0 && (
            <div className="card space-y-4 border-white/5 bg-white/[0.02] backdrop-blur-md">
              <h3 className="section-title text-brand-400"><Activity size={14} /> Portfolio Audit & Risk Metrics</h3>
              
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                  <div className="text-[10px] text-gray-500 uppercase font-semibold">Weighted P/E</div>
                  <div className="text-lg font-bold font-mono text-white mt-1">
                    {performance.audit.weighted_pe ? `${performance.audit.weighted_pe}` : '—'}
                  </div>
                </div>
                
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                  <div className="text-[10px] text-gray-500 uppercase font-semibold">Weighted ROE</div>
                  <div className="text-lg font-bold font-mono text-brand-400 mt-1">
                    {performance.audit.weighted_roe ? `${performance.audit.weighted_roe}%` : '—'}
                  </div>
                </div>

                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                  <div className="text-[10px] text-gray-500 uppercase font-semibold">Annual Dividends</div>
                  <div className="text-lg font-bold font-mono text-white mt-1">
                    ₹{performance.audit.est_annual_dividend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>

                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                  <div className="text-[10px] text-gray-500 uppercase font-semibold">Portfolio Beta</div>
                  <div className="text-lg font-bold font-mono text-brand-400 mt-1">
                    {performance.risk.beta}
                  </div>
                </div>

                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl col-span-2">
                  <div className="flex justify-between items-center text-[10px] text-gray-500 uppercase font-semibold">
                    <span>Value at Risk (VaR 95%)</span>
                    <span className="text-red-400 font-bold font-mono">₹{performance.risk.var_95.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1.5 leading-normal">
                    There is a 95% statistical confidence that your portfolio value will not drop by more than ₹{performance.risk.var_95.toLocaleString('en-IN', { maximumFractionDigits: 0 })} in a single trading day.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sharpe Optimizer & Path Forecaster */}
          <SharpeOptimizerCard 
            portfolio={portfolio} 
            performance={performance} 
            totalValue={totalCurrent} 
          />


        </div>
      </div>

      {showAddModal && <AddStockModal onClose={() => setShowAddModal(false)} onAdded={refreshUser} />}
    </div>
  )
}

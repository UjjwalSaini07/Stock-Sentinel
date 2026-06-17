'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Wallet, TrendingUp, TrendingDown, BarChart2, RefreshCw, ArrowUpRight, Activity, Info, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import StatCard from '@/components/ui/StatCard'
import HoldingRow from '@/components/portfolio/HoldingRow'
import AddStockModal from '@/components/portfolio/AddStockModal'
import PortfolioDonut from '@/components/charts/PortfolioDonut'
import { userApi, stockApi } from '@/lib/api'
import toast from 'react-hot-toast'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { MarketIndex, NewsArticle, PortfolioPerformance } from '@/types'

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

export default function DashboardPage() {
  const { user, refreshUser } = useAuthStore()
  const [showAddModal, setShowAddModal] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [sortBy, setSortBy] = useState<'value' | 'pnl' | 'ticker'>('value')

  const [indices, setIndices] = useState<MarketIndex[]>([])
  const [news, setNews] = useState<NewsArticle[]>([])
  const [performance, setPerformance] = useState<PortfolioPerformance | null>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(true)

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
      const tickers = portfolio.map(p => p.ticker).join(',')
      const [indicesRes, performanceRes, newsRes] = await Promise.all([
        stockApi.getIndices(),
        userApi.getPortfolioPerformance(),
        stockApi.getNews(tickers)
      ])
      
      setIndices(indicesRes.data)
      setPerformance(performanceRes.data)
      setNews(newsRes.data)
    } catch (err) {
      console.error("Failed to fetch dashboard analytics:", err)
    } finally {
      setLoadingAnalytics(false)
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
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-sm mb-0.5">{greeting()},</p>
          <h1 className="text-2xl font-bold">{user?.name?.split(' ')[0]} 👋</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} disabled={refreshing} className="btn-outline flex items-center gap-2 text-sm bg-white/[0.01]">
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-brand-400' : ''} />
            Refresh
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> Add Stock
          </button>
        </div>
      </div>

      {/* Indices Ticker */}
      {indices.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-slide-up">
          {indices.map(idx => {
            const isPos = idx.change >= 0
            return (
              <div key={idx.symbol} className="card flex items-center justify-between py-3 relative overflow-hidden border-white/5 bg-white/[0.02] backdrop-blur-md hover:border-white/10 transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPos ? 'bg-brand-500/10 text-brand-400' : 'bg-red-500/10 text-red-400'}`}>
                    <Activity size={14} />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">{idx.name}</span>
                    <div className="text-sm font-bold text-white font-mono mt-0.5">₹{idx.price.toLocaleString('en-IN')}</div>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-full ${isPos ? 'bg-brand-500/10 text-brand-400' : 'bg-red-500/10 text-red-400'}`}>
                    {isPos ? '▲' : '▼'} {isPos ? '+' : ''}{idx.change_percent.toFixed(2)}%
                  </span>
                  <div className="text-[10px] text-gray-500 font-mono mt-1">₹{idx.change > 0 ? '+' : ''}{idx.change.toLocaleString('en-IN')}</div>
                </div>
              </div>
            )
          })}
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
          <div className="card border-white/5 bg-white/[0.02] backdrop-blur-md">
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

          {/* Interactive Milestone Planner */}
          <GoalMilestonePlanner totalValue={totalCurrent} />
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

          {/* RSS News column */}
          <div className="card h-fit flex flex-col border-white/5 bg-white/[0.02] backdrop-blur-md">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="section-title text-white flex-1"><Activity size={14} /> Holdings & Market News</h3>
              <span className="badge-gray text-[9px] uppercase tracking-wider">Live RSS</span>
            </div>
            
            {news.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center text-gray-500 py-12 text-xs">
                No recent headlines found.
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto pr-1 max-h-[460px] no-scrollbar">
                {news.map((item, idx) => (
                  <a 
                    key={idx} 
                    href={item.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block p-3 rounded-xl bg-white/[0.01] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 transition-all duration-200 group"
                  >
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <span className="badge-green text-[9px] font-mono tracking-wider px-1.5 py-0.2 rounded uppercase shrink-0">
                        {item.ticker}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {item.source}
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-gray-200 group-hover:text-white line-clamp-2 leading-relaxed">
                      {item.title}
                    </h4>
                    <div className="text-[9px] text-gray-600 mt-2 text-right">
                      {item.pub_date}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddModal && <AddStockModal onClose={() => setShowAddModal(false)} onAdded={refreshUser} />}
    </div>
  )
}

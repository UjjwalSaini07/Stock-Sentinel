'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  TrendingUp, TrendingDown, RefreshCw, ArrowLeft,
  Plus, Bell, Bookmark, Info, Activity, BadgeDollarSign, Target, ShieldAlert, Eye
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { stockApi, userApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { StockData } from '@/types'
import MetricTile from '@/components/stock/MetricTile'
import SetAlertForm from '@/components/alerts/SetAlertForm'
import AddStockModal from '@/components/portfolio/AddStockModal'

// Re-format timestamps or handle real history price bounds
function formatHistoryChart(historyData: any[], data: StockData) {
  if (historyData && historyData.length > 0) {
    return historyData.map((h: any) => {
      const d = new Date(h.timestamp)
      return {
        t: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        price: h.price
      }
    })
  } else if (data.current_price) {
    const prev = data.previous_close || data.current_price * 0.995
    return [
      { t: 'Prev Close', price: prev },
      { t: 'Current', price: data.current_price }
    ]
  }
  return []
}

function PredictiveWidget({ predictions, currentPrice }: { predictions: any; currentPrice: number }) {
  const [daysTab, setDaysTab] = useState<7 | 30 | 90>(30)
  const data = predictions[`days_${daysTab}`]
  
  if (!data) return null;
  
  const [low68, high68] = data.range_68
  const [low95, high95] = data.range_95
  
  // Calculate bar percentages relative to the 95% range bounds
  const span = high95 - low95
  const left68Pct = span > 0 ? ((low68 - low95) / span) * 100 : 0
  const right68Pct = span > 0 ? ((high68 - low95) / span) * 100 : 0
  const currentPct = span > 0 ? ((currentPrice - low95) / span) * 100 : 50
  
  return (
    <div className="card space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="section-title text-brand-400"><Activity size={14} /> Statistical Future Range Forecast</h3>
          <p className="text-xs text-gray-500 mt-0.5">Calculated using Parkinson Range-Based Volatility model on 52W High/Low bounds.</p>
        </div>
        
        {/* Tab buttons */}
        <div className="flex gap-1 p-0.5 bg-white/[0.03] border border-white/5 rounded-lg w-fit shrink-0">
          {([7, 30, 90] as const).map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setDaysTab(d)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                daysTab === d ? 'bg-brand-500 text-white shadow' : 'text-gray-500 hover:text-white'
              }`}
            >
              {d}d Outlook
            </button>
          ))}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        {/* Stat parameters */}
        <div className="space-y-3 md:border-r md:border-white/5 md:pr-4">
          <div>
            <div className="text-[10px] text-gray-500 uppercase font-semibold">Annual Volatility (Est.)</div>
            <div className="text-lg font-bold font-mono text-white">{data.volatility_est}%</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase font-semibold">Expected Standard Move</div>
            <div className="text-lg font-bold font-mono text-brand-400">±{data.expected_change_pct}%</div>
          </div>
        </div>
        
        {/* Visual Gauge and Ranges (takes 3 cols) */}
        <div className="col-span-3 space-y-4">
          {/* Slider visualization */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-gray-500 font-mono">
              <span>95% Low: ₹{low95.toLocaleString('en-IN')}</span>
              <span>95% High: ₹{high95.toLocaleString('en-IN')}</span>
            </div>
            
            {/* Custom Probability Bar */}
            <div className="h-6 bg-white/[0.02] border border-white/5 rounded-lg relative overflow-hidden">
              {/* 95% region (entire bar is 95% region) */}
              <div className="absolute inset-0 bg-accent-blue/5" />
              
              {/* 68% region (inner bar) */}
              <div 
                className="absolute top-0 bottom-0 bg-brand-500/10 border-l border-r border-brand-500/20"
                style={{ left: `${left68Pct}%`, right: `${100 - right68Pct}%` }}
              />
              
              {/* Current Price Marker */}
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] z-10"
                style={{ left: `${currentPct}%` }}
              />
              <div 
                className="absolute -top-1 w-2 h-2 rounded-full bg-white border border-brand-500 z-10"
                style={{ left: `${currentPct}%`, transform: 'translateX(-50%)' }}
              />
            </div>
            
            <div className="flex justify-between text-[10px] text-gray-500 font-mono">
              <span style={{ marginLeft: `${left68Pct}%`, transform: 'translateX(-50%)' }} className="hidden md:inline">
                68% L: ₹{low68.toLocaleString('en-IN')}
              </span>
              <span style={{ marginRight: `${100 - right68Pct}%`, transform: 'translateX(50%)' }} className="hidden md:inline">
                68% H: ₹{high68.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
          
          {/* Text descriptions */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="space-y-0.5">
              <div className="font-semibold text-brand-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                68% Confidence (1 SD)
              </div>
              <p className="text-gray-500 text-[11px] leading-relaxed">
                Expected trading bounds: <strong>₹{low68.toLocaleString('en-IN')} – ₹{high68.toLocaleString('en-IN')}</strong>. High statistical likelihood of remaining within these levels.
              </p>
            </div>
            
            <div className="space-y-0.5">
              <div className="font-semibold text-accent-blue flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
                95% Confidence (2 SD)
              </div>
              <p className="text-gray-500 text-[11px] leading-relaxed">
                Extreme outer boundaries: <strong>₹{low95.toLocaleString('en-IN')} – ₹{high95.toLocaleString('en-IN')}</strong>. Unlikely to exceed these thresholds unless major catalyst events occur.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ForecastTab({
  analysis,
  loading,
  error,
  onRefresh
}: {
  analysis: any
  loading: boolean
  error: string
  onRefresh: () => void
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <RefreshCw className="animate-spin text-brand-400" size={28} />
        <p className="text-gray-500 text-sm">Groq AI is assembling files, financial tables, news catalysts, and formulating predictions...</p>
      </div>
    )
  }

  if (error || !analysis) {
    return (
      <div className="text-center py-10 space-y-4">
        <p className="text-red-400 text-sm">Failed to generate AI analysis: {error || 'No forecast data'}</p>
        <button onClick={onRefresh} className="btn-outline text-xs flex items-center gap-1.5 mx-auto">
          <RefreshCw size={12} /> Retry Analysis
        </button>
      </div>
    )
  }

  const riskBadgeColor = (val: string) => {
    const v = val?.toLowerCase() || '';
    if (['high', 'weak', 'poor', 'low'].some(k => v.includes(k))) {
      if (v.includes('low') && (v.includes('confidence') || v.includes('quality') || v.includes('visibility'))) return 'bg-red-500/10 text-red-400 border border-red-500/20';
      if (v.includes('high') && v.includes('risk')) return 'bg-red-500/10 text-red-400 border border-red-500/20';
      if (v.includes('weak') || v.includes('poor')) return 'bg-red-500/10 text-red-400 border border-red-500/20';
    }
    if (['strong', 'very high', 'good', 'high'].some(k => v.includes(k))) {
      if (v.includes('high') && v.includes('risk')) return 'bg-red-500/10 text-red-400 border border-red-500/20';
      return 'bg-brand-500/10 text-brand-400 border border-brand-500/20';
    }
    return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white/[0.02] border border-white/5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            {analysis.company_name || `${analysis.ticker} Ltd.`}
            {analysis.asm_status && analysis.asm_status !== 'None' && (
              <span className="text-[10px] px-2 py-0.5 font-bold uppercase rounded bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse">
                {analysis.asm_status}
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {analysis.sector} · {analysis.industry} · Forecast as of {new Date(analysis.last_analyzed || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-6 text-right">
          <div>
            <div className="text-[10px] text-gray-500 font-semibold uppercase">Real-Time Price</div>
            <div className="text-2xl font-bold font-mono text-white mt-0.5">₹{analysis.current_price?.toLocaleString('en-IN')}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-semibold uppercase">1Y Return (YoY)</div>
            <div className={`text-lg font-bold font-mono flex items-center gap-1 mt-0.5 ${analysis.yoy_change_pct >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
              {analysis.yoy_change_pct >= 0 ? '+' : ''}{analysis.yoy_change_pct?.toFixed(2)}%
            </div>
          </div>
          <button onClick={onRefresh} className="btn-icon self-center shrink-0" title="Recalculate forecast">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Metric Tiles grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ROCE */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
          <div className="text-xs text-gray-500 font-medium">ROCE (FY26)</div>
          <div className="text-xl font-bold text-white font-mono mt-2">{analysis.roce_current || '—'}</div>
          <div className="text-[10px] text-gray-400 mt-1">vs {analysis.roce_previous || '—'} last year</div>
        </div>
        {/* ROE */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
          <div className="text-xs text-gray-500 font-medium">ROE (FY26)</div>
          <div className="text-xl font-bold text-white font-mono mt-2">{analysis.roe_current || '—'}</div>
          <div className="text-[10px] text-gray-400 mt-1">3Y avg: {analysis.roe_avg_3y || '—'}</div>
        </div>
        {/* Net Profit */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
          <div className="text-xs text-gray-500 font-medium">Net Profit</div>
          <div className="text-xl font-bold text-white font-mono mt-2">{analysis.net_profit_current || '—'}</div>
          <div className="text-[10px] text-gray-400 mt-1">{analysis.net_profit_label || 'vs last year'}: {analysis.net_profit_previous || '—'}</div>
        </div>
        {/* Revenue */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
          <div className="text-xs text-gray-500 font-medium">Revenue</div>
          <div className="text-xl font-bold text-white font-mono mt-2">{analysis.revenue_current || '—'}</div>
          <div className="text-[10px] text-gray-400 mt-1">{analysis.revenue_label || 'vs last year'}: {analysis.revenue_previous || '—'}</div>
        </div>
      </div>

      {/* Chart Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Revenue Trend Chart */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-400 mb-4">Revenue Trend (₹ Cr)</h3>
          {analysis.revenue_trend_chart && analysis.revenue_trend_chart.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={analysis.revenue_trend_chart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#182030" />
                <XAxis dataKey="year" tick={{ fill: '#4b5563', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${v}`} />
                <Tooltip
                  contentStyle={{ background: '#0e1420', border: '1px solid #182030', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`₹${v} Cr`, 'Revenue']}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-600 text-sm">No revenue trend data available</div>
          )}
        </div>

        {/* Quarterly Sales Chart */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-400 mb-4">Quarterly Sales (₹ Cr)</h3>
          {analysis.quarterly_sales_chart && analysis.quarterly_sales_chart.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={analysis.quarterly_sales_chart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#182030" />
                <XAxis dataKey="quarter" tick={{ fill: '#4b5563', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${v}`} />
                <Tooltip
                  contentStyle={{ background: '#0e1420', border: '1px solid #182030', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`₹${v} Cr`, 'Sales']}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Bar dataKey="sales" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-600 text-sm">No quarterly sales data available</div>
          )}
        </div>
      </div>

      {/* Catalyst Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bull Factors */}
        <div className="card space-y-4">
          <h3 className="text-sm font-bold text-brand-400 flex items-center gap-1.5">
            <TrendingUp size={16} /> Bull Factors (Positive Catalyst)
          </h3>
          <div className="space-y-3">
            {analysis.bull_factors && analysis.bull_factors.length > 0 ? (
              analysis.bull_factors.map((bf: any, i: number) => (
                <div key={i} className="flex justify-between items-start gap-4 p-3 rounded-xl bg-brand-500/[0.02] border border-brand-500/5 hover:border-brand-500/10 transition-colors">
                  <p className="text-xs text-gray-300 leading-relaxed">{bf.factor}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase shrink-0 ${
                    bf.badge_type === 'success' ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' :
                    bf.badge_type === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                  }`}>
                    {bf.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-600">No positive factors identified</p>
            )}
          </div>
        </div>

        {/* Bear Factors */}
        <div className="card space-y-4">
          <h3 className="text-sm font-bold text-red-400 flex items-center gap-1.5">
            <TrendingDown size={16} /> Bear / Risk Factors (Caution)
          </h3>
          <div className="space-y-3">
            {analysis.bear_factors && analysis.bear_factors.length > 0 ? (
              analysis.bear_factors.map((bf: any, i: number) => (
                <div key={i} className="flex justify-between items-start gap-4 p-3 rounded-xl bg-red-500/[0.01] border border-red-500/5 hover:border-red-500/10 transition-colors">
                  <p className="text-xs text-gray-300 leading-relaxed">{bf.factor}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase shrink-0 ${
                    bf.badge_type === 'danger' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                    bf.badge_type === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    'bg-slate-500/10 text-gray-300 border border-slate-500/10'
                  }`}>
                    {bf.type}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-600">No risk factors identified</p>
            )}
          </div>
        </div>
      </div>

      {/* Risk Scorecard */}
      <div className="card">
        <h3 className="text-sm font-bold text-white mb-4">AI Risk & Quality Scorecard</h3>
        {analysis.risk_scorecard ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
            {Object.entries(analysis.risk_scorecard).map(([key, val]: any) => (
              <div key={key} className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-xs text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                <span className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded ${riskBadgeColor(val)}`}>
                  {val}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-600">No scorecard available</p>
        )}
      </div>

      {/* 1-Month Price Outlook */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white">1-Month Price Outlook ({new Date(Date.now() + 30 * 24 * 3600 * 1000).toLocaleString('en-IN', { month: 'long', year: 'numeric' })})</h3>
        {analysis.price_outlook ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Bear Case */}
            <div className="p-4 rounded-2xl bg-red-500/[0.02] border border-red-500/5 hover:border-red-500/10 transition-colors space-y-2">
              <div className="text-xs text-red-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <TrendingDown size={14} /> Bear Case
              </div>
              <div className="text-xl font-bold font-mono text-white mt-1">{analysis.price_outlook.bear_case?.range || '—'}</div>
              <p className="text-xs text-gray-400 leading-relaxed mt-1">{analysis.price_outlook.bear_case?.reason || '—'}</p>
            </div>

            {/* Base Case */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors space-y-2">
              <div className="text-xs text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Activity size={14} /> Base Case
              </div>
              <div className="text-xl font-bold font-mono text-white mt-1">{analysis.price_outlook.base_case?.range || '—'}</div>
              <p className="text-xs text-gray-400 leading-relaxed mt-1">{analysis.price_outlook.base_case?.reason || '—'}</p>
            </div>

            {/* Bull Case */}
            <div className="p-4 rounded-2xl bg-brand-500/[0.02] border border-brand-500/5 hover:border-brand-500/10 transition-colors space-y-2">
              <div className="text-xs text-brand-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp size={14} /> Bull Case
              </div>
              <div className="text-xl font-bold font-mono text-white mt-1">{analysis.price_outlook.bull_case?.range || '—'}</div>
              <p className="text-xs text-gray-400 leading-relaxed mt-1">{analysis.price_outlook.bull_case?.reason || '—'}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-600">No outlook targets available</p>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-gray-600 text-center italic mt-4">
        Not financial advice. Based on public data, fundamentals and recent corporate events only.
      </p>
    </div>
  )
}

export default function StockDetailPage() {
  const { ticker } = useParams<{ ticker: string }>()
  const router = useRouter()
  const { user, refreshUser } = useAuthStore()
  const [stock, setStock] = useState<StockData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'fundamentals' | 'forecast' | 'alert'>('fundamentals')
  const [sparkData, setSparkData] = useState<any[]>([])

  const [analysis, setAnalysis] = useState<any | null>(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [analysisError, setAnalysisError] = useState('')

  const fetchAnalysis = useCallback(async () => {
    try {
      setLoadingAnalysis(true)
      setAnalysisError('')
      const res = await stockApi.getAnalysis(ticker)
      setAnalysis(res.data)
    } catch (err: any) {
      setAnalysisError(err?.response?.data?.detail || 'Failed to generate forecast')
    } finally {
      setLoadingAnalysis(false)
    }
  }, [ticker])

  useEffect(() => {
    if (activeTab === 'forecast' && !analysis && !loadingAnalysis) {
      fetchAnalysis()
    }
  }, [activeTab, analysis, loadingAnalysis, fetchAnalysis])

  const holding = user?.portfolio?.find(p => p.ticker === ticker?.toUpperCase())
  const isWatched = user?.watchlist?.includes(ticker?.toUpperCase())
  const [togglingWatch, setTogglingWatch] = useState(false)

  async function handleToggleWatch() {
    try {
      setTogglingWatch(true)
      const t = ticker?.toUpperCase()
      if (isWatched) {
        await userApi.removeFromWatchlist(t)
        toast.success(`${t} removed from watchlist`)
      } else {
        await userApi.addToWatchlist(t)
        toast.success(`${t} added to watchlist`)
      }
      refreshUser()
    } catch {
      toast.error("Failed to update watchlist")
    } finally {
      setTogglingWatch(false)
    }
  }

  const fetchStock = useCallback(async () => {
    try {
      const [stockRes, historyRes] = await Promise.all([
        stockApi.get(ticker),
        stockApi.getHistory(ticker)
      ])
      
      const data = stockRes.data
      const historyData = historyRes.data
      
      setStock(data)
      setError('')
      setSparkData(formatHistoryChart(historyData, data))
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Stock not found')
    } finally {
      setLoading(false)
    }
  }, [ticker])

  useEffect(() => {
    fetchStock()
    const interval = setInterval(fetchStock, 30000)
    return () => clearInterval(interval)
  }, [fetchStock])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchStock()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="skeleton h-8 w-48 rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="skeleton h-32 rounded-2xl" />)}
        </div>
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    )
  }

  if (error || !stock) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
          <Info size={28} className="text-red-400" />
        </div>
        <h2 className="text-lg font-bold mb-1">Stock not found</h2>
        <p className="text-gray-500 text-sm mb-5">{error || `Could not load data for "${ticker}"`}</p>
        <button onClick={() => router.back()} className="btn-outline flex items-center gap-2">
          <ArrowLeft size={16} /> Go back
        </button>
      </div>
    )
  }

  const change    = stock.current_price && stock.previous_close ? stock.current_price - stock.previous_close : null
  const changePct = change && stock.previous_close ? (change / stock.previous_close) * 100 : null
  const positive  = (change ?? 0) >= 0

  const prices = sparkData.map(d => d.price)
  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 0
  const priceRange = maxPrice - minPrice
  const pad = priceRange > 0 ? priceRange * 0.05 : maxPrice * 0.005
  const sparkMin = minPrice - pad
  const sparkMax = maxPrice + pad

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Breadcrumb */}
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-gray-500 hover:text-white transition-colors text-sm">
        <ArrowLeft size={15} /> Back
      </button>

      {/* Hero card */}
      <div className="card relative overflow-hidden">
        {/* Glow */}
        <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] pointer-events-none opacity-20 ${positive ? 'bg-brand-500' : 'bg-red-500'}`} />

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold tracking-tight">{stock.ticker}</h1>
                <span className="badge-gray">{stock.exchange}</span>
                {holding && <span className="badge-blue">In Portfolio</span>}
                {stock.from_cache && <span className="badge-amber flex items-center gap-1"><Activity size={9} /> Cached</span>}
              </div>
              {holding && (
                <p className="text-sm text-gray-400">
                  You hold <strong className="text-white">{holding.quantity} shares</strong> @ ₹{holding.buy_price.toLocaleString('en-IN')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleRefresh} disabled={refreshing} className="btn-icon" title="Refresh">
                <RefreshCw size={15} className={refreshing ? 'animate-spin text-brand-400' : ''} />
              </button>
              <button 
                onClick={handleToggleWatch} 
                disabled={togglingWatch} 
                className={`btn-outline text-sm flex items-center gap-1.5 ${isWatched ? 'border-brand-500/50 text-brand-400 bg-brand-500/5' : 'text-gray-400'}`}
                title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
              >
                <Eye size={14} className={isWatched ? 'text-brand-400' : ''} /> {isWatched ? 'Watching' : 'Watch'}
              </button>
              {!holding && (
                <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm flex items-center gap-1.5">
                  <Plus size={14} /> Invest
                </button>
              )}
            </div>
          </div>

          {/* Price block */}
          <div className="flex items-baseline gap-4">
            <span className="text-4xl font-bold font-mono tracking-tight">
              {stock.current_price ? `₹${stock.current_price.toLocaleString('en-IN')}` : '—'}
            </span>
            {change !== null && (
              <span className={`flex items-center gap-1.5 text-base font-semibold ${positive ? 'text-brand-400' : 'text-red-400'}`}>
                {positive ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                {positive ? '+' : ''}{change.toFixed(2)} ({positive ? '+' : ''}{changePct?.toFixed(2)}%)
              </span>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Prev close: ₹{stock.previous_close?.toLocaleString('en-IN') ?? '—'}
            {stock.last_updated && ` · Updated ${new Date(stock.last_updated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </div>
      </div>

      {/* Intraday chart + holdings detail */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="card md:col-span-2">
          <h3 className="section-title mb-4"><Activity size={14} /> Intraday Movement</h3>
          {sparkData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={sparkData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={positive ? '#26a366' : '#ef4444'} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={positive ? '#26a366' : '#ef4444'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#182030" />
                <XAxis dataKey="t" tick={{ fill: '#4b5563', fontSize: 10 }} tickLine={false} axisLine={false} interval={5} />
                <YAxis domain={[sparkMin, sparkMax]} tick={{ fill: '#4b5563', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${v >= 100 ? v.toFixed(0) : v.toFixed(2)}`} />
                <Tooltip
                  contentStyle={{ background: '#0e1420', border: '1px solid #182030', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Price']}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Area type="monotone" dataKey="price" stroke={positive ? '#26a366' : '#ef4444'} strokeWidth={1.5} fill="url(#priceGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-600 text-sm">No chart data</div>
          )}
        </div>

        {/* holdings detail */}
        <div className="space-y-4">
          {holding ? (
            <div className="card h-full">
              <h3 className="section-title mb-3">Your Holdings</h3>
              <div className={`text-2xl font-bold font-mono mb-1 ${(holding.pnl ?? 0) >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                {(holding.pnl ?? 0) >= 0 ? '+' : ''}₹{Math.abs(holding.pnl ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              <div className={`text-sm font-semibold mb-4 ${(holding.pnl_percent ?? 0) >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                {(holding.pnl_percent ?? 0) >= 0 ? '▲' : '▼'} {Math.abs(holding.pnl_percent ?? 0).toFixed(2)}% return
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Invested</span>
                  <span className="font-mono text-white">₹{(holding.buy_price * holding.quantity).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Current Value</span>
                  <span className="font-mono text-white">₹{((stock.current_price ?? holding.buy_price) * holding.quantity).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Avg Buy Price</span>
                  <span className="font-mono text-white">₹{holding.buy_price.toLocaleString('en-IN')}</span>
                </div>
                {holding.buy_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Acquired</span>
                    <span className="text-gray-300">{new Date(holding.buy_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card h-full flex flex-col items-center justify-center text-center gap-3">
              <Bookmark size={24} className="text-gray-600" />
              <div>
                <p className="text-sm font-medium text-gray-400">Not in portfolio</p>
                <p className="text-xs text-gray-600 mt-0.5">Track your investment returns</p>
              </div>
              <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm flex items-center gap-1.5">
                <Plus size={14} /> Add to Portfolio
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 52-Week Range Bar */}
      {stock.high && stock.low && stock.current_price && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-title"><Bookmark size={14} /> 52-Week Range</h3>
            {stock.analytics?.range_position && (
              <span className="text-xs text-gray-400 font-mono">
                Current is at the <strong className="text-white">{stock.analytics.range_position.percentile}%</strong> percentile
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-red-400 w-24 text-right">52W L: ₹{stock.low.toLocaleString('en-IN')}</span>
            <div className="flex-1 h-2 bg-white/5 rounded-full relative">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500 via-amber-500 to-brand-500 rounded-full"
                style={{ width: `${Math.max(0, Math.min(100, ((stock.current_price - stock.low) / (stock.high - stock.low)) * 100))}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] border-2 border-brand-500"
                style={{ left: `${Math.max(0, Math.min(100, ((stock.current_price - stock.low) / (stock.high - stock.low)) * 100))}%`, transform: 'translate(-50%, -50%)' }}
              />
            </div>
            <span className="text-xs font-mono text-brand-400 w-24">52W H: ₹{stock.high.toLocaleString('en-IN')}</span>
          </div>
          {stock.analytics?.range_position && (
            <div className="flex justify-between mt-2 text-[10px] text-gray-500">
              <span>▲ {stock.analytics.range_position.dist_low_pct}% above low</span>
              <span>▼ {stock.analytics.range_position.dist_high_pct}% below high</span>
            </div>
          )}
        </div>
      )}

      {/* Statistical Price Range Prediction */}
      {stock.predictions && (
        <PredictiveWidget predictions={stock.predictions} currentPrice={stock.current_price ?? 0} />
      )}

      {/* Qualitative Analytics Health Breakdown */}
      {stock.analytics && (
        <div className="card">
          <h3 className="section-title mb-4"><Info size={14} /> Fundamental Breakdown & Health Check</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Valuation Card */}
            {stock.analytics.valuation && (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Valuation</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                    stock.analytics.valuation.score === 'Positive' ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' :
                    stock.analytics.valuation.score === 'Caution' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                    'bg-white/5 text-gray-400 border border-white/10'
                  }`}>{stock.analytics.valuation.status}</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{stock.analytics.valuation.desc}</p>
              </div>
            )}
            
            {/* Efficiency Card */}
            {stock.analytics.efficiency && (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Efficiency</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                    stock.analytics.efficiency.score === 'Positive' ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' :
                    'bg-white/5 text-gray-400 border border-white/10'
                  }`}>{stock.analytics.efficiency.status}</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{stock.analytics.efficiency.desc}</p>
              </div>
            )}
            
            {/* Dividend Card */}
            {stock.analytics.dividend && (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Dividend Focus</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-white/5 text-gray-300 border border-white/10">{stock.analytics.dividend.status}</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{stock.analytics.dividend.desc}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs: Fundamentals / Forecast / Alert */}
      <div className="card">
        <div className="flex gap-1.5 p-1.5 bg-black/60 border border-white/[0.04] rounded-2xl w-fit mb-5 backdrop-blur-md">
          {(['fundamentals', 'forecast', 'alert'] as const).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 border ${
                activeTab === t
                  ? 'bg-brand-500/10 text-brand-400 border-brand-500/25 shadow-[0_0_15px_rgba(38,163,102,0.06)]'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.02] border-transparent'
              }`}
            >
              {t === 'alert' ? '🔔 Set Alert' : t === 'forecast' ? '🔮 AI Forecast' : '📊 Fundamentals'}
            </button>
          ))}
        </div>

        {activeTab === 'fundamentals' ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricTile label="Market Cap" value={stock.market_cap ? `₹${(stock.market_cap / 1000).toFixed(0)}K Cr` : null} />
            <MetricTile label="P/E Ratio" value={stock.stock_pe?.toFixed(1) ?? null} />
            <MetricTile label="Dividend Yield" value={stock.dividend_yield?.toFixed(2) ?? null} suffix="%" />
            <MetricTile label="Face Value" value={stock.face_value ? `₹${stock.face_value}` : null} />
            <MetricTile label="ROCE" value={stock.roce?.toFixed(1) ?? null} suffix="%" positive={stock.roce ? stock.roce > 15 : null} />
            <MetricTile label="ROE" value={stock.roe?.toFixed(1) ?? null} suffix="%" positive={stock.roe ? stock.roe > 15 : null} />
            <MetricTile label="52W High" value={stock.high ? `₹${stock.high.toLocaleString('en-IN')}` : null} />
            <MetricTile label="52W Low" value={stock.low ? `₹${stock.low.toLocaleString('en-IN')}` : null} />
          </div>
        ) : activeTab === 'forecast' ? (
          <ForecastTab
            analysis={analysis}
            loading={loadingAnalysis}
            error={analysisError}
            onRefresh={fetchAnalysis}
          />
        ) : (
          <SetAlertForm ticker={stock.ticker} currentPrice={stock.current_price} onCreated={() => {}} />
        )}
      </div>

      {showAddModal && <AddStockModal onClose={() => setShowAddModal(false)} onAdded={refreshUser} />}
    </div>
  )
}

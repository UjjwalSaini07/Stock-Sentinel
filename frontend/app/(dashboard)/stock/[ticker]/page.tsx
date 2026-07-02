'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  TrendingUp, TrendingDown, RefreshCw, ArrowLeft,
  Plus, Bell, Bookmark, Info, Activity, Target, ShieldAlert, Eye,
  Zap, Coins, HelpCircle, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp, Scale, Sparkles,
  Compass, Award
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
  const [activeTab, setActiveTab] = useState<'fundamentals' | 'forecast' | 'alert' | 'research' | 'playbook'>('fundamentals')
  const [sparkData, setSparkData] = useState<any[]>([])

  const [analysis, setAnalysis] = useState<any | null>(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [analysisError, setAnalysisError] = useState('')

  // Terminal Research states
  const [researchData, setResearchData] = useState<any | null>(null)
  const [loadingResearch, setLoadingResearch] = useState(false)
  const [researchError, setResearchError] = useState('')
  const [expandedAlpha, setExpandedAlpha] = useState(false)
  const [calcInspector, setCalcInspector] = useState<any | null>(null)

  // AI Playbook Decision states
  const [decisionData, setDecisionData] = useState<any | null>(null)
  const [loadingDecision, setLoadingDecision] = useState(false)
  const [decisionError, setDecisionError] = useState('')

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

  const fetchResearch = useCallback(async () => {
    try {
      setLoadingResearch(true)
      setResearchError('')
      setLoadingDecision(true)
      setDecisionError('')
      
      const [resResearch, resDecision] = await Promise.all([
        stockApi.getTerminalResearch(ticker),
        stockApi.getDecisionIntelligence(ticker)
      ])
      
      setResearchData(resResearch.data)
      setDecisionData(resDecision.data)
    } catch (err: any) {
      setResearchError(err?.response?.data?.detail || 'Failed to fetch terminal research')
      setDecisionError(err?.response?.data?.detail || 'Failed to fetch decision intelligence')
    } finally {
      setLoadingResearch(false)
      setLoadingDecision(false)
    }
  }, [ticker])

  useEffect(() => {
    if (activeTab === 'forecast' && !analysis && !loadingAnalysis) {
      fetchAnalysis()
    }
    if ((activeTab === 'research' || activeTab === 'playbook') && !researchData && !loadingResearch) {
      fetchResearch()
    }
  }, [activeTab, analysis, loadingAnalysis, fetchAnalysis, researchData, loadingResearch, fetchResearch])

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
    fetchResearch() // pre-load research calculations on mount
    const interval = setInterval(fetchStock, 30000)
    return () => clearInterval(interval)
  }, [fetchStock, fetchResearch])

  async function handleRefresh() {
    setRefreshing(true)
    await Promise.all([fetchStock(), fetchResearch()])
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
    <div className="space-y-5 animate-fade-in text-gray-200">
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
                <h1 className="text-3xl font-bold tracking-tight text-white">{stock.ticker}</h1>
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
            <span className="text-4xl font-bold font-mono tracking-tight text-white">
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
          <h3 className="section-title mb-4 text-white"><Activity size={14} /> Intraday Movement</h3>
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
              <h3 className="section-title mb-3 text-white">Your Holdings</h3>
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
            <h3 className="section-title text-white"><Bookmark size={14} /> 52-Week Range</h3>
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
          <h3 className="section-title mb-4 text-white"><Info size={14} /> Fundamental Breakdown & Health Check</h3>
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

      {/* NEW MODULE 1 & 2: PREMIUM AI ALPHA SCORE & COMPOSITE BANNER */}
      {researchData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Alpha Score Banner Card */}
          <div className="card flex flex-col justify-between border-brand-500/15 hover:border-brand-500/30 transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-brand-500/10 transition-colors" />
            <div className="flex justify-between items-start gap-4">
              <div>
                <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
                  <Zap size={12} className="text-brand-400 animate-pulse" /> AI Alpha Score (Multi-Factor)
                </div>
                <div className="text-3.5xl font-extrabold font-mono text-white mt-1.5 flex items-baseline">
                  {researchData.alpha_score.score}
                  <span className="text-xs text-gray-500 font-normal ml-1"> / 100</span>
                </div>
                <div className="text-xs text-gray-400 mt-2 leading-relaxed flex items-center gap-2">
                  Rating: <span className="text-brand-400 font-bold">{researchData.alpha_score.rating}</span> · Risk: <span className="text-amber-400 font-semibold">{researchData.alpha_score.expected_risk}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] text-gray-400 uppercase font-semibold">Expected Return</div>
                <div className="text-2xl font-bold font-mono text-brand-400 mt-1">+{researchData.alpha_score.expected_upside}%</div>
                <div className="text-[10px] text-gray-500 mt-0.5">MOS: {researchData.alpha_score.margin_of_safety}%</div>
              </div>
            </div>
            <div className="border-t border-white/5 pt-3 mt-4 flex items-center justify-between text-xs gap-3">
              <span className="text-gray-400 truncate max-w-[70%] italic">"{researchData.alpha_score.explanation}"</span>
              <button 
                onClick={() => setActiveTab('research')} 
                className="text-brand-400 hover:text-white transition-colors font-bold flex items-center gap-1 flex-shrink-0"
              >
                Research Terminal <span className="text-xs">→</span>
              </button>
            </div>
          </div>

          {/* Professional Composite Score Banner Card */}
          <div className="card flex flex-col justify-between border-accent-blue/15 hover:border-accent-blue/30 transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-accent-blue/5 rounded-full blur-2xl pointer-events-none group-hover:bg-accent-blue/10 transition-colors" />
            <div className="flex justify-between items-start gap-4">
              <div>
                <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
                  <Coins size={12} className="text-accent-blue" /> Intrinsic Value Engine
                </div>
                <div className="text-3.5xl font-extrabold font-mono text-white mt-1.5">
                  ₹{researchData.intrinsic_value.value.toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-gray-400 mt-2 leading-relaxed">
                  MOS: <span className="text-brand-400 font-bold">{researchData.intrinsic_value.margin_of_safety}%</span> · Current: ₹{stock.current_price?.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] text-gray-400 uppercase font-semibold">Composite Score</div>
                <div className="text-2xl font-bold font-mono text-white mt-1">{researchData.composite_score.score}</div>
                <div className="text-[10px] uppercase font-extrabold text-accent-blue mt-0.5 tracking-wider">{researchData.composite_score.classification}</div>
              </div>
            </div>
            <div className="border-t border-white/5 pt-3 mt-4 flex items-center justify-between text-xs gap-3">
              <span className="text-gray-400 truncate max-w-[70%]">9-model valuation aggregate including DCF and Graham formulas.</span>
              <button 
                onClick={() => setActiveTab('research')} 
                className="text-brand-400 hover:text-white transition-colors font-bold flex items-center gap-1 flex-shrink-0"
              >
                Inspect Models <span className="text-xs">→</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs: Fundamentals / Forecast / Research Terminal / Alert */}
      <div className="card">
        <div className="flex flex-wrap gap-1.5 p-1.5 bg-black/60 border border-white/[0.04] rounded-2xl w-fit mb-5 backdrop-blur-md">
          {(['fundamentals', 'research', 'playbook', 'forecast', 'alert'] as const).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 border ${
                activeTab === t
                  ? 'bg-brand-500/10 text-brand-400 border-brand-500/25 shadow-[0_0_15px_rgba(38,163,102,0.06)]'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.02] border-transparent'
              }`}
            >
              {t === 'alert' ? '🔔 Set Alert' : t === 'forecast' ? '🔮 AI Forecast' : t === 'playbook' ? '🚀 AI Playbook' : t === 'research' ? '🏛️ Research Terminal' : '📊 Fundamentals'}
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
        ) : activeTab === 'research' ? (
          // INSTITUTIONAL RESEARCH DASHBOARD
          loadingResearch ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <RefreshCw className="animate-spin text-brand-400" size={28} />
              <p className="text-gray-500 text-sm">Evaluating DCF projections, auditing balance sheet ratios, parsing shareholding patterns...</p>
            </div>
          ) : researchError || !researchData ? (
            <div className="text-center py-10 space-y-4">
              <p className="text-red-400 text-sm">{researchError || 'Terminal research data not loaded'}</p>
              <button onClick={fetchResearch} className="btn-outline text-xs flex items-center gap-1.5 mx-auto">
                <RefreshCw size={12} /> Retry Load
              </button>
            </div>
          ) : (
            <div className="space-y-8 animate-fade-in text-gray-200">
              {/* HEADER BANNER */}
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 p-4 rounded-xl bg-white/[0.01] border border-white/5">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {researchData.company_name} Terminal Report
                    <span className="badge-blue text-[10px] font-mono">{researchData.ticker}</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Programmatic analysis calculated on real historical financials and daily ticker tick history.</p>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs text-gray-400">
                  <span>As of: {new Date(researchData.timestamp).toLocaleString('en-IN')}</span>
                  <button onClick={fetchResearch} className="btn-icon" title="Refresh calculations">
                    <RefreshCw size={12} />
                  </button>
                </div>
              </div>

              {/* BUY / SELL ENGINE & INVESTMENT RECOMMENDATION */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="card lg:col-span-2 space-y-4 border-l-4 border-brand-500">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-brand-400 flex items-center gap-2">
                      <Target size={15} /> Buy / Hold / Sell Strategy Decision
                    </h4>
                    <span className="badge-blue text-xs font-mono font-bold">Confidence: {researchData.recommendation_engine.confidence}%</span>
                  </div>
                  
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-extrabold text-white">{researchData.recommendation_engine.recommendation}</span>
                    <span className="text-xs text-gray-400">Expected Return: <strong className="text-brand-400 font-mono">+{researchData.recommendation_engine.expected_return}%</strong></span>
                  </div>

                  <div className="space-y-2 mt-2">
                    {researchData.recommendation_engine.reasons.map((r: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-300 leading-relaxed">
                        <span className="text-brand-400 font-bold shrink-0 mt-0.5">✓</span>
                        <p>{r}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card space-y-3 justify-between flex flex-col">
                  <div>
                    <h4 className="text-xs text-gray-500 uppercase font-bold tracking-wider">Target & Return Ratios</h4>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase font-semibold">Fair Value</div>
                        <div className="text-base font-bold font-mono text-white">₹{researchData.recommendation_engine.fair_value.toLocaleString('en-IN')}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase font-semibold">Target Price</div>
                        <div className="text-base font-bold font-mono text-brand-400">₹{researchData.recommendation_engine.target_price.toLocaleString('en-IN')}</div>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-white/5 pt-3 flex justify-between items-center text-xs">
                    <span className="text-gray-400">Risk-Reward Ratio</span>
                    <span className="font-bold font-mono text-white">{researchData.recommendation_engine.risk_reward_ratio}:1</span>
                  </div>
                </div>
              </div>

              {/* CORE SCORES GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* AI ALPHA SCORE breakdown */}
                <div className="card space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Zap size={14} className="text-brand-400" /> AI Alpha Score Breakdown
                    </h4>
                    <button 
                      onClick={() => setExpandedAlpha(!expandedAlpha)} 
                      className="text-xs text-brand-400 hover:text-white transition-colors flex items-center gap-1"
                    >
                      {expandedAlpha ? 'Collapse' : 'Show weights'} {expandedAlpha ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full border-4 border-brand-500/20 border-t-brand-500 flex items-center justify-center font-mono text-xl font-bold text-white">
                      {researchData.alpha_score.score}
                    </div>
                    <div>
                      <div className="text-xs text-gray-300 font-semibold">{researchData.alpha_score.rating} Rating</div>
                      <p className="text-[11px] text-gray-500 leading-normal mt-0.5">Calculated using a 15-factor valuation, fundamental, technical, and news sentiment formula.</p>
                    </div>
                  </div>

                  {expandedAlpha && (
                    <div className="space-y-1.5 pt-2 border-t border-white/5 text-xs font-mono">
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-gray-400">DCF Score (12%)</span>
                        <span className="text-white">{researchData.composite_score.breakdown["DCF (25%)"] * 2} / 100</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-gray-400">Buffett Quality (10%)</span>
                        <span className="text-white">{researchData.alpha_score.score ? researchData.alpha_score.score : '—'}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-gray-400">Piotroski F-Score (10%)</span>
                        <span className="text-white">{(researchData.piotroski_score.score / 9 * 100).toFixed(0)} / 100</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-brand-400 cursor-pointer flex items-center gap-1" onClick={() => setCalcInspector({
                          title: "AI Alpha Score",
                          formula: researchData.explainability.alpha_score.formula,
                          inputs: researchData.explainability.alpha_score.inputs,
                          interpretation: researchData.explainability.alpha_score.interpretation
                        })}>
                          <HelpCircle size={11} /> View entire weighted formula
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Professional Composite Score Breakdown */}
                <div className="card space-y-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Scale size={14} className="text-accent-blue" /> Professional Composite Score
                  </h4>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full border-4 border-accent-blue/20 border-t-accent-blue flex items-center justify-center font-mono text-xl font-bold text-white">
                      {researchData.composite_score.score}
                    </div>
                    <div>
                      <div className="text-xs text-gray-300 font-semibold">{researchData.composite_score.classification} Rating</div>
                      <p className="text-[11px] text-gray-500 leading-normal mt-0.5">Weighted heavily towards intrinsic DCF calculations, debt profiles, and capital return ratios.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] font-mono border-t border-white/5 pt-3">
                    <div className="flex justify-between py-0.5">
                      <span className="text-gray-500">DCF (25%)</span>
                      <span className="text-white">{researchData.composite_score.breakdown["DCF (25%)"]}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-gray-500">Buffett (15%)</span>
                      <span className="text-white">{researchData.composite_score.breakdown["Buffett Quality (15%)"]}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-gray-500">Piotroski (15%)</span>
                      <span className="text-white">{researchData.composite_score.breakdown["Piotroski F Score (15%)"]}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-gray-500">Altman (10%)</span>
                      <span className="text-white">{researchData.composite_score.breakdown["Altman Z Score (10%)"]}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* INTRINSIC VALUATION ENGINE TABLE */}
              <div className="card space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Coins size={14} className="text-brand-400" /> Intrinsic Valuation Models
                  </h4>
                  <button 
                    onClick={() => setCalcInspector({
                      title: "Discounted Cash Flow Model",
                      formula: researchData.explainability.dcf.formula,
                      inputs: researchData.explainability.dcf.inputs,
                      interpretation: researchData.explainability.dcf.interpretation
                    })}
                    className="text-xs text-gray-400 hover:text-brand-400 transition-colors flex items-center gap-1"
                  >
                    <HelpCircle size={12} /> How is DCF calculated?
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-white/5 pb-4">
                  <div className="p-3 bg-red-500/[0.01] border border-red-500/5 rounded-xl text-center space-y-1">
                    <div className="text-[10px] text-gray-500 uppercase font-semibold">Bear Case (DCF)</div>
                    <div className="text-lg font-bold font-mono text-red-400">₹{researchData.intrinsic_value.cases.bear.toLocaleString('en-IN')}</div>
                  </div>
                  <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl text-center space-y-1">
                    <div className="text-[10px] text-gray-500 uppercase font-semibold">Base Case (DCF)</div>
                    <div className="text-lg font-bold font-mono text-white">₹{researchData.intrinsic_value.cases.base.toLocaleString('en-IN')}</div>
                  </div>
                  <div className="p-3 bg-brand-500/[0.01] border border-brand-500/5 rounded-xl text-center space-y-1">
                    <div className="text-[10px] text-gray-500 uppercase font-semibold">Bull Case (DCF)</div>
                    <div className="text-lg font-bold font-mono text-brand-400">₹{researchData.intrinsic_value.cases.bull.toLocaleString('en-IN')}</div>
                  </div>
                </div>

                {/* Models Comparison Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-white/5 text-gray-500 uppercase font-bold text-[10px] tracking-wider">
                        <th className="py-2.5">Valuation Model</th>
                        <th className="py-2.5">Estimated Price</th>
                        <th className="py-2.5">vs Current Price</th>
                        <th className="py-2.5">Margin of Safety</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      <tr>
                        <td className="py-2.5 text-gray-300 font-sans">Discounted Cash Flow (DCF)</td>
                        <td className="py-2.5 text-white">₹{researchData.intrinsic_value.models.dcf.toLocaleString('en-IN')}</td>
                        <td className={`py-2.5 ${researchData.intrinsic_value.models.dcf > (stock.current_price || 0) ? 'text-brand-400' : 'text-red-400'}`}>
                          {stock.current_price ? (((researchData.intrinsic_value.models.dcf - stock.current_price) / stock.current_price) * 100).toFixed(1) : 0.0}%
                        </td>
                        <td className="py-2.5 text-gray-400">{stock.current_price ? (((researchData.intrinsic_value.models.dcf - stock.current_price) / researchData.intrinsic_value.models.dcf) * 100).toFixed(1) : 0.0}%</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 text-gray-300 font-sans flex items-center gap-1.5">
                          Benjamin Graham Formula
                          <HelpCircle size={12} className="text-gray-600 hover:text-white cursor-pointer" onClick={() => setCalcInspector({
                            title: "Benjamin Graham Value",
                            formula: researchData.explainability.graham.formula,
                            inputs: researchData.explainability.graham.inputs,
                            interpretation: researchData.explainability.graham.interpretation
                          })} />
                        </td>
                        <td className="py-2.5 text-white">₹{researchData.intrinsic_value.models.graham.toLocaleString('en-IN')}</td>
                        <td className={`py-2.5 ${researchData.intrinsic_value.models.graham > (stock.current_price || 0) ? 'text-brand-400' : 'text-red-400'}`}>
                          {stock.current_price ? (((researchData.intrinsic_value.models.graham - stock.current_price) / stock.current_price) * 100).toFixed(1) : 0.0}%
                        </td>
                        <td className="py-2.5 text-gray-400">{stock.current_price ? (((researchData.intrinsic_value.models.graham - stock.current_price) / researchData.intrinsic_value.models.graham) * 100).toFixed(1) : 0.0}%</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 text-gray-300 font-sans">Peter Lynch Fair Value</td>
                        <td className="py-2.5 text-white">₹{researchData.intrinsic_value.models.lynch.toLocaleString('en-IN')}</td>
                        <td className={`py-2.5 ${researchData.intrinsic_value.models.lynch > (stock.current_price || 0) ? 'text-brand-400' : 'text-red-400'}`}>
                          {stock.current_price ? (((researchData.intrinsic_value.models.lynch - stock.current_price) / stock.current_price) * 100).toFixed(1) : 0.0}%
                        </td>
                        <td className="py-2.5 text-gray-400">{stock.current_price ? (((researchData.intrinsic_value.models.lynch - stock.current_price) / researchData.intrinsic_value.models.lynch) * 100).toFixed(1) : 0.0}%</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 text-gray-300 font-sans">Owner Earnings Model</td>
                        <td className="py-2.5 text-white">₹{researchData.intrinsic_value.models.owner_earnings.toLocaleString('en-IN')}</td>
                        <td className={`py-2.5 ${researchData.intrinsic_value.models.owner_earnings > (stock.current_price || 0) ? 'text-brand-400' : 'text-red-400'}`}>
                          {stock.current_price ? (((researchData.intrinsic_value.models.owner_earnings - stock.current_price) / stock.current_price) * 100).toFixed(1) : 0.0}%
                        </td>
                        <td className="py-2.5 text-gray-400">{stock.current_price ? (((researchData.intrinsic_value.models.owner_earnings - stock.current_price) / researchData.intrinsic_value.models.owner_earnings) * 100).toFixed(1) : 0.0}%</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 text-gray-300 font-sans">EV / EBITDA Model</td>
                        <td className="py-2.5 text-white">₹{researchData.intrinsic_value.models.ev_ebitda.toLocaleString('en-IN')}</td>
                        <td className={`py-2.5 ${researchData.intrinsic_value.models.ev_ebitda > (stock.current_price || 0) ? 'text-brand-400' : 'text-red-400'}`}>
                          {stock.current_price ? (((researchData.intrinsic_value.models.ev_ebitda - stock.current_price) / stock.current_price) * 100).toFixed(1) : 0.0}%
                        </td>
                        <td className="py-2.5 text-gray-400">{stock.current_price ? (((researchData.intrinsic_value.models.ev_ebitda - stock.current_price) / researchData.intrinsic_value.models.ev_ebitda) * 100).toFixed(1) : 0.0}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* BUFFETT QUALITY ANALYSIS & PETER LYNCH */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Buffett Quality Analysis */}
                <div className="card space-y-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Sparkles size={14} className="text-brand-400" /> Buffett Moat & Quality Analysis
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-400">ROE (FY26)</span>
                      <span className={`font-mono font-bold ${researchData.buffett_analysis.ratings.ROE === 'Excellent' ? 'text-brand-400' : 'text-gray-300'}`}>
                        {researchData.buffett_analysis.metrics.roe}% ({researchData.buffett_analysis.ratings.ROE})
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-400">ROIC (FY26)</span>
                      <span className={`font-mono font-bold ${researchData.buffett_analysis.ratings.ROIC === 'Excellent' ? 'text-brand-400' : 'text-gray-300'}`}>
                        {researchData.buffett_analysis.metrics.roic}% ({researchData.buffett_analysis.ratings.ROIC})
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-400">Debt to Equity</span>
                      <span className="font-mono font-bold text-white">
                        {researchData.buffett_analysis.metrics.debt_equity.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-white/5">
                      <span className="text-gray-400">Operating Margin</span>
                      <span className="font-mono font-bold text-white">
                        {researchData.buffett_analysis.metrics.op_margin}%
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between text-gray-500 font-semibold">
                      <span>Capital Reinvestment</span>
                      <span>Dividend Growth</span>
                    </div>
                    <div className="flex justify-between text-white font-mono">
                      <span>{researchData.buffett_analysis.history.capital_allocation}</span>
                      <span>{researchData.buffett_analysis.history.dividend_growth}</span>
                    </div>
                  </div>
                </div>

                {/* Peter Lynch growth analysis */}
                <div className="card space-y-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <TrendingUp size={14} className="text-brand-400" /> Peter Lynch Growth Audit
                  </h4>
                  <div className="space-y-3 text-xs leading-normal">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase font-semibold">PEG Ratio</div>
                        <div className="text-lg font-bold font-mono text-white mt-0.5">{researchData.lynch_analysis.peg}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-500 uppercase font-semibold">Lynch Rating</div>
                        <div className="text-lg font-bold font-mono text-brand-400 mt-0.5">{researchData.lynch_analysis.valuation_rating}</div>
                      </div>
                    </div>
                    <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                      <p className="text-gray-300 text-[11px] leading-relaxed italic">"{researchData.lynch_analysis.reason}"</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PIOTROSKI F SCORE & ALTMAN Z SCORE */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Piotroski F-Score */}
                <div className="card space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Activity size={14} className="text-brand-400" /> Piotroski F-Score ({researchData.piotroski_score.score} / 9)
                    </h4>
                    <span 
                      className="text-xs text-brand-400 hover:text-white cursor-pointer"
                      onClick={() => setCalcInspector({
                        title: "Piotroski F-Score",
                        formula: researchData.explainability.piotroski.formula,
                        inputs: researchData.explainability.piotroski.inputs,
                        interpretation: researchData.explainability.piotroski.interpretation
                      })}
                    >
                      Inspect Rules
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-xs">
                    {Object.entries(researchData.piotroski_score.reasons).map(([key, val]: any) => (
                      <div key={key} className="flex items-center justify-between py-1 border-b border-white/5 gap-4">
                        <span className="text-gray-400">{key}</span>
                        <div className="flex items-center gap-1.5 font-semibold">
                          <span className="text-[10px] text-gray-500 font-normal truncate max-w-[150px] md:max-w-xs">{val[1]}</span>
                          {val[0] === 'Pass' ? <CheckCircle2 size={13} className="text-brand-400" /> : <XCircle size={13} className="text-red-400" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Altman Z-Score */}
                <div className="card space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <ShieldAlert size={14} className="text-amber-400" /> Altman Z-Score Insolvency Audit
                    </h4>
                    <span 
                      className="text-xs text-brand-400 hover:text-white cursor-pointer"
                      onClick={() => setCalcInspector({
                        title: "Altman Z-Score",
                        formula: researchData.explainability.altman_z.formula,
                        inputs: researchData.explainability.altman_z.inputs,
                        interpretation: researchData.explainability.altman_z.interpretation
                      })}
                    >
                      Inspect Formula
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase font-semibold">Altman Z-Score</div>
                      <div className="text-2xl font-bold font-mono text-white mt-0.5">{researchData.altman_score.score}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500 uppercase font-semibold">Financial Zone</div>
                      <div className={`text-base font-extrabold mt-0.5 px-3 py-1 rounded ${
                        researchData.altman_score.zone === 'Safe' ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' :
                        researchData.altman_score.zone === 'Grey Zone' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>{researchData.altman_score.zone}</div>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-sans">A: Working Capital / Assets</span>
                      <span className="text-white">{researchData.altman_score.components.working_capital_ratio_A}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-sans">B: Retained Earnings / Assets</span>
                      <span className="text-white">{researchData.altman_score.components.retained_earnings_ratio_B}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-sans">C: EBITDA / Assets</span>
                      <span className="text-white">{researchData.altman_score.components.ebitda_ratio_C}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-sans">D: Equity Value / Liabilities</span>
                      <span className="text-white">{researchData.altman_score.components.equity_leverage_ratio_D}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SMART MONEY & RISK */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Smart Money Analysis */}
                <div className="card space-y-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Coins size={14} className="text-brand-400" /> Smart Money & Ownership Patterns
                  </h4>
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase font-semibold">Smart Money Score</div>
                      <div className="text-xl font-bold font-mono text-white mt-0.5">{researchData.smart_money.score} / 100</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500 uppercase font-semibold">Institutional Trend</div>
                      <div className="text-sm font-bold text-brand-400 mt-0.5">{researchData.smart_money.institutional_buying_trend}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div className="flex justify-between py-0.5">
                      <span className="text-gray-400">Promoter Holding</span>
                      <span className="font-mono text-white">{researchData.smart_money.promoter_holding}%</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-gray-400">FII Holding</span>
                      <span className="font-mono text-white">{researchData.smart_money.fii_holding}%</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-gray-400">DII Holding</span>
                      <span className="font-mono text-white">{researchData.smart_money.dii_holding}%</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-gray-400">Pledged Shares</span>
                      <span className="font-mono text-white">{researchData.smart_money.pledged_shares}%</span>
                    </div>
                  </div>
                </div>

                {/* Risk Analysis */}
                <div className="card space-y-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <ShieldAlert size={14} className="text-red-400" /> Portfolio Risk Metrics
                  </h4>
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase font-semibold">Risk Score</div>
                      <div className="text-xl font-bold font-mono text-red-400 mt-0.5">{researchData.risk_analysis.score} / 100</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500 uppercase font-semibold">Beta vs Benchmark</div>
                      <div className="text-sm font-bold text-white mt-0.5">{researchData.risk_analysis.beta.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div className="flex justify-between py-0.5">
                      <span className="text-gray-400">Annual Volatility</span>
                      <span className="font-mono text-white">{researchData.risk_analysis.volatility.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-gray-400">Downside VaR (95%)</span>
                      <span className="font-mono text-white">{researchData.risk_analysis.downside_risk.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-gray-400">Financial Risk</span>
                      <span className="font-mono text-white">{researchData.risk_analysis.financial_risk}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-gray-400">Liquidity Risk</span>
                      <span className="font-mono text-white">{researchData.risk_analysis.liquidity_risk}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* TECHNICAL TIMING & MOMENTUM */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Technical Timing */}
                <div className="card space-y-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Activity size={14} className="text-brand-400" /> Technical Timing indicators
                  </h4>
                  <div className="grid grid-cols-3 gap-2 border-b border-white/5 pb-3">
                    <div className="text-center">
                      <div className="text-[9px] text-gray-500 uppercase font-semibold">Entry</div>
                      <div className="text-xs font-bold text-white">{researchData.technical_timing.entry_rating}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9px] text-gray-500 uppercase font-semibold">Swing</div>
                      <div className="text-xs font-bold text-brand-400">{researchData.technical_timing.swing_rating}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9px] text-gray-500 uppercase font-semibold">RSI (14)</div>
                      <div className="text-xs font-bold font-mono text-white">{researchData.technical_timing.rsi}</div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-sans">EMA 20 / EMA 50</span>
                      <span className="text-white">₹{researchData.technical_timing.ema_20} / ₹{researchData.technical_timing.ema_50}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-sans">EMA 200 Support</span>
                      <span className="text-white">₹{researchData.technical_timing.ema_200}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-sans">MACD Histogram</span>
                      <span className="text-white">{researchData.technical_timing.macd.histogram}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-sans">SuperTrend Direction</span>
                      <span className="text-white">{researchData.technical_timing.supertrend}</span>
                    </div>
                  </div>
                </div>

                {/* Momentum Engine */}
                <div className="card space-y-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <TrendingUp size={14} className="text-brand-400" /> Momentum Engine Performance
                  </h4>
                  <div className="grid grid-cols-4 gap-1 text-center font-mono border-b border-white/5 pb-3">
                    <div className="p-1 rounded bg-white/[0.01]">
                      <div className="text-[9px] text-gray-500 font-sans">1M</div>
                      <div className={`text-xs font-bold ${researchData.momentum_engine.returns["1m"] >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                        {researchData.momentum_engine.returns["1m"]}%
                      </div>
                    </div>
                    <div className="p-1 rounded bg-white/[0.01]">
                      <div className="text-[9px] text-gray-500 font-sans">3M</div>
                      <div className={`text-xs font-bold ${researchData.momentum_engine.returns["3m"] >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                        {researchData.momentum_engine.returns["3m"]}%
                      </div>
                    </div>
                    <div className="p-1 rounded bg-white/[0.01]">
                      <div className="text-[9px] text-gray-500 font-sans">6M</div>
                      <div className={`text-xs font-bold ${researchData.momentum_engine.returns["6m"] >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                        {researchData.momentum_engine.returns["6m"]}%
                      </div>
                    </div>
                    <div className="p-1 rounded bg-white/[0.01]">
                      <div className="text-[9px] text-gray-500 font-sans">1Y</div>
                      <div className={`text-xs font-bold ${researchData.momentum_engine.returns["1y"] >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                        {researchData.momentum_engine.returns["1y"]}%
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Relative Strength (vs Nifty)</span>
                      <span className="font-mono text-white">{researchData.momentum_engine.relative_strength}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">52W Position Percentile</span>
                      <span className="font-mono text-white">{researchData.momentum_engine.position_52w_pct}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* NEWS SENTIMENT AI */}
              <div className="card space-y-4">
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Sparkles size={14} className="text-brand-400" /> News Sentiment AI Analysis
                </h4>
                <div className="flex flex-col md:flex-row gap-4 items-center border-b border-white/5 pb-3">
                  <div className="w-20 h-20 rounded-full border-4 border-brand-500/20 border-t-brand-500 flex flex-col items-center justify-center font-mono shrink-0">
                    <span className="text-base font-bold text-white">{researchData.news_sentiment.sentiment_pct.toFixed(0)}%</span>
                    <span className="text-[8px] text-gray-500 uppercase">Sentiment</span>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">Sentiment Summary</h5>
                    <p className="text-xs text-gray-400 leading-relaxed mt-1 italic">"{researchData.news_sentiment.summary}"</p>
                  </div>
                </div>
                <div className="text-xs space-y-1.5">
                  <div className="text-gray-500 font-semibold uppercase tracking-wider text-[10px]">Business & Trading Impact</div>
                  <p className="text-gray-300 leading-normal">{researchData.news_sentiment.impact}</p>
                </div>
              </div>

              {/* AI INVESTMENT SUMMARY */}
              <div className="card space-y-4">
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Info size={14} className="text-brand-400" /> AI Executive Research Summary
                </h4>
                <div className="space-y-4 text-xs">
                  <div>
                    <div className="text-gray-500 font-semibold uppercase tracking-wider text-[10px] mb-1">Moat & Market Positioning</div>
                    <p className="text-gray-300 leading-relaxed">{researchData.investment_summary.competitive_position}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-gray-500 font-semibold uppercase tracking-wider text-[10px] mb-1.5">Investment Strengths</div>
                      <div className="space-y-1.5">
                        {researchData.investment_summary.strengths.map((s: string, i: number) => (
                          <div key={i} className="text-brand-400 flex items-center gap-1">
                            <span>▲</span> <span className="text-gray-300">{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-gray-500 font-semibold uppercase tracking-wider text-[10px] mb-1.5">Investment Risks & Concerns</div>
                      <div className="space-y-1.5">
                        {researchData.investment_summary.key_risks.map((r: string, i: number) => (
                          <div key={i} className="text-red-400 flex items-center gap-1">
                            <span>▼</span> <span className="text-gray-300">{r}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-3 grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-gray-500 font-semibold uppercase tracking-wider text-[10px] mb-0.5">Suggested Investment Horizon</div>
                      <p className="text-white font-mono">{researchData.investment_summary.suggested_horizon}</p>
                    </div>
                    <div>
                      <div className="text-gray-500 font-semibold uppercase tracking-wider text-[10px] mb-0.5">Suitable For</div>
                      <p className="text-white truncate">{researchData.investment_summary.suitable_for.join(", ")}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        ) : activeTab === 'playbook' ? (
          loadingDecision || !decisionData ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <RefreshCw className="animate-spin text-brand-400" size={28} />
              <p className="text-gray-500 text-sm">Evaluating decision intelligence layers, running risk simulations, pricing entry zones...</p>
            </div>
          ) : decisionError ? (
            <div className="text-center py-10 space-y-4">
              <p className="text-red-400 text-sm">{decisionError}</p>
              <button onClick={fetchResearch} className="btn-outline text-xs flex items-center gap-1.5 mx-auto">
                <RefreshCw size={12} /> Retry Load
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in text-gray-200">
              {/* Playbook Header Summary Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 rounded-2xl bg-white/[0.01] border border-white/5">
                <div className="p-4 rounded-xl bg-black/40 border border-white/5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-[80px] h-[80px] bg-brand-500/[0.02] blur-xl rounded-full" />
                  <div className="text-[10px] text-gray-500 uppercase font-semibold">AI Conviction Meter</div>
                  <div className="text-xl font-black text-white mt-1.5 flex items-center gap-2">
                    <Sparkles size={16} className="text-brand-400" />
                    {decisionData.conviction_meter}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 leading-normal">Agreement consensus across fundamentals, valuations, and technical timing filters.</p>
                </div>
                
                <div className="p-4 rounded-xl bg-black/40 border border-white/5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-[80px] h-[80px] bg-brand-500/[0.02] blur-xl rounded-full" />
                  <div className="text-[10px] text-gray-500 uppercase font-semibold">AI Daily Health Index</div>
                  <div className="text-xl font-black text-brand-400 font-mono mt-1.5">
                    {decisionData.health_score} / 100
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 leading-normal">Aggregate daily score computed from momentum trend, valuation discount, and FII/DII activities.</p>
                </div>

                <div className="p-4 rounded-xl bg-black/40 border border-white/5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-[80px] h-[80px] bg-brand-500/[0.02] blur-xl rounded-full" />
                  <div className="text-[10px] text-gray-500 uppercase font-semibold">AI Peer DNA Match</div>
                  <div className="text-xl font-black text-white mt-1.5 flex items-center gap-2">
                    <Activity size={16} className="text-brand-400" />
                    {decisionData.stock_dna} Style
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 leading-normal">Matches this stock's margin efficiency, growth runway, and asset ratios to leading market leaders.</p>
                </div>
              </div>

              {/* Core Playbook 3-column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* AI Entry Zone Card */}
                <div className="card space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400 flex items-center gap-1.5">
                    <Target size={14} /> AI Entry Zone Engine
                  </h4>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                      <span className="text-gray-400 text-xs">Current Price</span>
                      <span className="text-base font-bold font-mono text-white">₹{decisionData.entry_zone.current_price?.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                      <span className="text-gray-400 text-xs">Best Entry Target</span>
                      <span className="text-base font-bold font-mono text-brand-400">₹{decisionData.entry_zone.best_entry?.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                      <span className="text-gray-400 text-xs">Suggested SIP Range</span>
                      <span className="text-xs font-bold font-mono text-white">
                        ₹{decisionData.entry_zone.sip_range[0]?.toLocaleString('en-IN')} - ₹{decisionData.entry_zone.sip_range[1]?.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500 font-semibold uppercase">Good Entry Probability</span>
                        <span className="text-brand-400 font-bold font-mono">{decisionData.entry_zone.probability}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-brand-500" 
                          style={{ width: `${decisionData.entry_zone.probability}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-black/40 border border-white/5 rounded-xl space-y-1 text-xs">
                    <div className="text-[10px] text-gray-500 font-bold uppercase">Pricing Zones</div>
                    <div className="grid grid-cols-2 gap-2 font-mono text-[10px] mt-1.5">
                      <div className="p-1.5 bg-white/[0.02] border border-white/5 rounded text-center">
                        <div className="text-gray-500">Safe Buy</div>
                        <div className="text-gray-300 mt-0.5">₹{decisionData.entry_zone.strong_support[0]} - ₹{decisionData.entry_zone.strong_support[1]}</div>
                      </div>
                      <div className="p-1.5 bg-white/[0.02] border border-white/5 rounded text-center">
                        <div className="text-gray-500">Deep Value</div>
                        <div className="text-gray-300 mt-0.5">₹{decisionData.entry_zone.historical_demand[0]} - ₹{decisionData.entry_zone.historical_demand[1]}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Exit Engine Card */}
                <div className="card space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400 flex items-center gap-1.5">
                    <TrendingUp size={14} /> AI Exit & Target Engine
                  </h4>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <div>
                        <div className="text-xs font-bold text-white">Target 1 (Short Term)</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">Probability: {decisionData.exit_engine.target_1_prob}%</div>
                      </div>
                      <span className="text-sm font-bold font-mono text-brand-400">₹{decisionData.exit_engine.target_1?.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <div>
                        <div className="text-xs font-bold text-white">Target 2 (Swing)</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">Probability: {decisionData.exit_engine.target_2_prob}%</div>
                      </div>
                      <span className="text-sm font-bold font-mono text-brand-400">₹{decisionData.exit_engine.target_2?.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="flex justify-between items-center border-b border-white/5 pb-2">
                      <div>
                        <div className="text-xs font-bold text-white">Target 3 (Long Term)</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">Probability: {decisionData.exit_engine.target_3_prob}%</div>
                      </div>
                      <span className="text-sm font-bold font-mono text-brand-400">₹{decisionData.exit_engine.target_3?.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="flex justify-between items-baseline pt-1">
                      <span className="text-gray-400 text-xs">Hard Stop Loss</span>
                      <span className="text-sm font-bold font-mono text-red-400">₹{decisionData.exit_engine.stop_loss?.toLocaleString('en-IN')}</span>
                    </div>
                    
                    <div className="flex justify-between items-baseline">
                      <span className="text-gray-400 text-xs">Trailing Stop Loss</span>
                      <span className="text-xs font-bold font-mono text-gray-300">₹{decisionData.exit_engine.trailing_stop?.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Smart Entry Timer Card */}
                <div className="card space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400 flex items-center gap-1.5">
                    <Activity size={14} /> Smart Timing & Catalysts
                  </h4>

                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-black/40 border border-white/5 text-center space-y-1">
                      <div className="text-[10px] text-gray-500 font-bold uppercase">Timing Signal</div>
                      <div className={`text-xl font-black ${
                        decisionData.smart_entry_timer.signal === 'Buy Now' ? 'text-brand-400' :
                        decisionData.smart_entry_timer.signal === 'Accumulate Slowly' ? 'text-blue-400' : 'text-red-400'
                      }`}>
                        {decisionData.smart_entry_timer.signal}
                      </div>
                      <p className="text-[10px] text-gray-400 leading-normal pt-1.5 text-left border-t border-white/5 mt-1.5">
                        {decisionData.smart_entry_timer.reasoning}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[10px] text-gray-500 font-semibold uppercase">Holding Period Estimator</div>
                      <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-xs space-y-1">
                        <div className="font-bold text-white">{decisionData.holding_period.period}</div>
                        <p className="text-gray-400 leading-relaxed text-[11px]">{decisionData.holding_period.reasoning}</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Multibagger Probability & Scenarios */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Multibagger Probability Engine */}
                <div className="card space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400 flex items-center gap-1.5">
                      <Sparkles size={14} /> Multibagger Probability Engine
                    </h4>
                    <span className="badge-blue text-[10px] font-mono">Confidence: {decisionData.multibagger_probability.confidence}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-b border-white/5 pb-4">
                    <div className="p-3 bg-black/40 border border-white/5 rounded-xl text-center space-y-1">
                      <div className="text-[10px] text-gray-500 uppercase font-semibold">Multibagger Potential Score</div>
                      <div className="text-2xl font-black text-brand-400 font-mono">{decisionData.multibagger_probability.score} %</div>
                    </div>
                    <div className="p-3 bg-black/40 border border-white/5 rounded-xl text-center space-y-1">
                      <div className="text-[10px] text-gray-500 uppercase font-semibold">Growth Required CAGR</div>
                      <div className="text-2xl font-black text-white font-mono">{decisionData.multibagger_probability.required_cagr_10x}%</div>
                    </div>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    <div className="space-y-1">
                      <div className="flex justify-between font-mono text-[10px]">
                        <span className="text-gray-400">2X Return Probability (3 Years)</span>
                        <span className="text-white font-bold">{decisionData.multibagger_probability.probabilities.x2_3y}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500" style={{ width: `${decisionData.multibagger_probability.probabilities.x2_3y}%` }} />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between font-mono text-[10px]">
                        <span className="text-gray-400">3X Return Probability (5 Years)</span>
                        <span className="text-white font-bold">{decisionData.multibagger_probability.probabilities.x3_5y}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500" style={{ width: `${decisionData.multibagger_probability.probabilities.x3_5y}%` }} />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between font-mono text-[10px]">
                        <span className="text-gray-400">5X Return Probability (10 Years)</span>
                        <span className="text-white font-bold">{decisionData.multibagger_probability.probabilities.x5_10y}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500" style={{ width: `${decisionData.multibagger_probability.probabilities.x5_10y}%` }} />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between font-mono text-[10px]">
                        <span className="text-gray-400">10X Return Probability (10 Years)</span>
                        <span className="text-white font-bold">{decisionData.multibagger_probability.probabilities.x10_10y}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500" style={{ width: `${decisionData.multibagger_probability.probabilities.x10_10y}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Future Scenarios */}
                <div className="card space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400 flex items-center gap-1.5">
                    <TrendingUp size={14} /> AI Future Value Projections
                  </h4>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-white/5 text-gray-500 uppercase font-bold text-[10px] tracking-wider">
                          <th className="py-2.5">Scenario</th>
                          <th className="py-2.5">Target Price</th>
                          <th className="py-2.5">Expected CAGR</th>
                          <th className="py-2.5">Probability</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono text-gray-200">
                        <tr>
                          <td className="py-3 text-brand-400 font-sans">Bull Case Scenario</td>
                          <td className="py-3">₹{decisionData.scenarios.bull.price}</td>
                          <td className="py-3">+{decisionData.scenarios.bull.cagr}%</td>
                          <td className="py-3">{decisionData.scenarios.bull.probability}%</td>
                        </tr>
                        <tr>
                          <td className="py-3 text-white font-sans">Base Case Scenario</td>
                          <td className="py-3">₹{decisionData.scenarios.base.price}</td>
                          <td className="py-3">+{decisionData.scenarios.base.cagr}%</td>
                          <td className="py-3">{decisionData.scenarios.base.probability}%</td>
                        </tr>
                        <tr>
                          <td className="py-3 text-red-400 font-sans">Bear Case Scenario</td>
                          <td className="py-3">₹{decisionData.scenarios.bear.price}</td>
                          <td className="py-3">-{Math.abs(decisionData.scenarios.bear.cagr)}%</td>
                          <td className="py-3">{decisionData.scenarios.bear.probability}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Catalysts, Why Today & AI Risks Simulation */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Catalysts & Daily Moves */}
                <div className="card space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400 flex items-center gap-1.5">
                    <Info size={14} /> Future Catalysts & Daily Catalyst
                  </h4>

                  <div className="p-3 bg-brand-500/[0.01] border border-brand-500/5 rounded-xl text-xs space-y-1">
                    <div className="text-[10px] text-brand-400 font-bold uppercase flex items-center gap-1.5">
                      <Zap size={11} /> Today's AI Catalyst Breakdown
                    </div>
                    <p className="text-gray-300 leading-relaxed font-sans mt-1">{decisionData.why_today}</p>
                  </div>

                  <div className="space-y-2.5">
                    <div className="text-[10px] text-gray-500 font-bold uppercase">Expected Future Catalysts</div>
                    {decisionData.catalysts.map((c: any, i: number) => (
                      <div key={i} className="flex justify-between items-start p-2.5 bg-white/[0.02] border border-white/5 rounded-xl text-xs">
                        <div>
                          <div className="font-bold text-white">{c.event}</div>
                          <div className="text-[10px] text-gray-500 mt-0.5">{c.detail}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono ${
                          c.impact === 'Positive' ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' :
                          c.impact === 'Negative' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-white/5 text-gray-400'
                        }`}>
                          {c.impact} Impact
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Risk Simulation */}
                <div className="card space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400 flex items-center gap-1.5">
                    <ShieldAlert size={14} /> AI Risk Simulation Map
                  </h4>

                  <div className="space-y-3">
                    {decisionData.risks.map((r: any) => (
                      <div key={r.name} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-white">{r.name}</span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            Prob: <strong className="text-red-400">{r.prob}%</strong> · Impact: <strong className="text-red-400">{r.impact}/100</strong>
                          </span>
                        </div>
                        <div className="w-full h-1 bg-white/[0.03] rounded-full overflow-hidden">
                          <div className="h-full bg-red-500" style={{ width: `${r.prob}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-400 font-sans leading-normal">
                          <strong className="text-gray-500">Mitigation:</strong> {r.mitigation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Portfolio Fit & Institutional Playbook */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* AI Portfolio Suitability */}
                <div className="card space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400 flex items-center gap-1.5">
                    <Compass size={14} /> AI Portfolio Fit Suitability
                  </h4>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {Object.entries(decisionData.portfolio_fit).map(([persona, fit]: any) => (
                      <div key={persona} className="p-3 bg-black/40 border border-white/5 rounded-xl space-y-2">
                        <div className="flex justify-between items-baseline font-mono text-[10px]">
                          <span className="text-gray-400 font-sans">{persona}</span>
                          <span className={`${fit > 65 ? 'text-brand-400' : 'text-gray-300'} font-bold`}>{fit}%</span>
                        </div>
                        <div className="w-full h-1 bg-white/[0.03] rounded-full overflow-hidden">
                          <div className={`h-full ${fit > 65 ? 'bg-brand-500' : 'bg-gray-500'}`} style={{ width: `${fit}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* The Investment Playbook */}
                <div className="card space-y-4 border-t-4 border-brand-500">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400 flex items-center gap-1.5">
                    <Award size={14} /> The Institutional Investment Playbook
                  </h4>

                  <div className="space-y-3.5 text-xs leading-normal">
                    <div className="p-3 bg-brand-500/[0.01] border border-brand-500/5 rounded-xl">
                      <div className="text-[10px] text-brand-400 font-bold uppercase">Investment Thesis</div>
                      <p className="text-gray-300 leading-relaxed font-sans mt-1">{decisionData.playbook.thesis}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center font-mono text-[10px]">
                      <div className="p-2 bg-white/[0.02] border border-white/5 rounded-xl">
                        <div className="text-gray-500">Ideal Buy Trigger</div>
                        <div className="text-brand-400 font-bold mt-0.5">{decisionData.playbook.buy_zone}</div>
                      </div>
                      <div className="p-2 bg-white/[0.02] border border-white/5 rounded-xl">
                        <div className="text-gray-500">Ideal Exit Trigger</div>
                        <div className="text-brand-400 font-bold mt-0.5">{decisionData.playbook.exit_zone}</div>
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-3.5 grid grid-cols-3 gap-2 text-center text-xs font-mono">
                      <div>
                        <div className="text-[9px] text-gray-500 uppercase font-semibold">Expected CAGR</div>
                        <div className="text-white font-bold mt-0.5">+{decisionData.playbook.expected_cagr}%</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-gray-500 uppercase font-semibold">Expected Upside</div>
                        <div className="text-white font-bold mt-0.5">+{decisionData.playbook.expected_return}%</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-gray-500 uppercase font-semibold">Success Prob</div>
                        <div className="text-brand-400 font-bold mt-0.5">{decisionData.playbook.probability_success}%</div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )
        ) : (
          <SetAlertForm ticker={stock.ticker} currentPrice={stock.current_price} onCreated={() => {}} />
        )}
      </div>

      {/* CALCULATION INSPECTOR MODAL */}
      {calcInspector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Info size={16} className="text-brand-400" /> Calculation Inspector: {calcInspector.title}
              </h3>
              <button 
                onClick={() => setCalcInspector(null)}
                className="text-gray-500 hover:text-white transition-colors font-mono text-base font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs leading-normal">
              <div>
                <span className="text-gray-500 font-bold uppercase tracking-wider text-[9px]">Mathematical Formula</span>
                <div className="bg-white/5 p-3 rounded-lg font-mono text-white mt-1 border border-white/5 overflow-x-auto text-[11px]">
                  {calcInspector.formula}
                </div>
              </div>

              <div>
                <span className="text-gray-500 font-bold uppercase tracking-wider text-[9px]">Actual Inputs Used</span>
                <div className="bg-black/40 border border-white/5 p-3 rounded-lg space-y-2 mt-1 font-mono text-[11px]">
                  {Object.entries(calcInspector.inputs).map(([key, val]: any) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-500 font-sans">{key.replace(/_/g, ' ')}</span>
                      <span className="text-white">{typeof val === 'number' ? val.toLocaleString('en-IN') : JSON.stringify(val)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-gray-500 font-bold uppercase tracking-wider text-[9px]">Financial Meaning</span>
                <p className="text-gray-300 mt-1 leading-relaxed">{calcInspector.interpretation}</p>
              </div>
            </div>

            <div className="border-t border-white/5 pt-3 flex justify-end">
              <button onClick={() => setCalcInspector(null)} className="btn-primary text-xs px-4 py-1.5">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && <AddStockModal onClose={() => setShowAddModal(false)} onAdded={refreshUser} />}
    </div>
  )
}

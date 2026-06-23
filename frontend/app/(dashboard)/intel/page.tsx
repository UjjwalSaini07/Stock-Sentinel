'use client'
import { useState, useEffect } from 'react'
import { 
  Globe, Calendar, Zap, AlertTriangle, Percent, ChevronRight, Info, 
  Sparkles, Plus, Search, Building2, AlertCircle, Filter, Activity, 
  TrendingUp, TrendingDown, Bell, MessageSquare, Briefcase, RefreshCw, Eye
} from 'lucide-react'
import { 
  AreaChart, Area, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, 
  ScatterChart, Scatter, Cell
} from 'recharts'
import { intelApi, alertApi, stockApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import toast from 'react-hot-toast'

interface MarketAsset {
  ticker: string
  name: string
  price: number
  change: number
  change_pct: number
  sparkline: number[]
}

interface SectorData {
  ticker: string
  name: string
  price: number
  change_1d: number
  change_1m: number
  relative_strength_1m: number
  quadrant: 'Leading' | 'Weakening' | 'Lagging' | 'Improving'
  sparkline: number[]
}

function isTickerInr(ticker: string): boolean {
  const upper = ticker.toUpperCase();
  // Known USD/global patterns:
  if (upper.endsWith('-USD') || upper.endsWith('=F') || (upper.includes('=X') && upper !== 'USDINR=X')) {
    return false;
  }
  if (upper.startsWith('^GSPC') || upper.startsWith('^DJI') || upper.startsWith('^IXIC') || upper.startsWith('^FTSE') || upper.startsWith('^N225')) {
    return false;
  }
  // US tech giants / typical US stocks if they search them
  const usTickers = ['AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'TSLA', 'NVDA', 'NFLX'];
  if (usTickers.includes(upper)) {
    return false;
  }
  return true;
}

function getAssetCurrencyInfo(ticker: string, price: number, usdToInr: number) {
  if (!price || isNaN(price)) {
    return {
      inrPrice: 0,
      reference: '',
      isAlreadyInr: true
    }
  }

  // If the asset is already in INR (Indian stocks/indices)
  if (isTickerInr(ticker)) {
    const usdRef = price / usdToInr;
    return {
      inrPrice: price,
      reference: ticker === 'USDINR=X' ? '' : `$${usdRef.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      isAlreadyInr: true
    }
  }

  // If the asset is FTSE (UK index) - price is in GBP
  if (ticker === '^FTSE') {
    return {
      inrPrice: price * 106.0,
      reference: `£${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      isAlreadyInr: false
    }
  }

  // If the asset is Nikkei (Japan index) - price is in JPY
  if (ticker === '^N225') {
    return {
      inrPrice: price * 0.53,
      reference: `¥${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      isAlreadyInr: false
    }
  }

  // If the asset is EUR/USD forex
  if (ticker === 'EURUSD=X') {
    return {
      inrPrice: price * usdToInr,
      reference: `$${price.toFixed(4)}`,
      isAlreadyInr: false
    }
  }

  // If the asset is USD/JPY forex
  if (ticker === 'USDJPY=X') {
    return {
      inrPrice: usdToInr,
      reference: `${price.toFixed(2)} JPY/USD`,
      isAlreadyInr: false
    }
  }

  // If the asset is GBP/USD forex
  if (ticker === 'GBPUSD=X') {
    return {
      inrPrice: price * usdToInr,
      reference: `$${price.toFixed(4)}`,
      isAlreadyInr: false
    }
  }

  // Otherwise, the asset is USD-denominated (US indices, commodities, cryptos, US stocks)
  return {
    inrPrice: price * usdToInr,
    reference: `$${price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    isAlreadyInr: false
  }
}

export default function MarketIntelligencePage() {
  const { user } = useAuthStore()
  
  // ── States ────────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [markets, setMarkets] = useState<{
    indices: MarketAsset[]
    commodities: MarketAsset[]
    forex: MarketAsset[]
    crypto: MarketAsset[]
    watchlist: MarketAsset[]
  } | null>(null)
  
  const [marketTab, setMarketTab] = useState<'indices' | 'commodities' | 'forex' | 'crypto' | 'watchlist'>('indices')
  
  const [sectors, setSectors] = useState<{
    benchmark_change_1m: number
    sectors: SectorData[]
    quadrants: Record<string, string[]>
  } | null>(null)
  
  const [econCalendar, setEconCalendar] = useState<any[]>([])
  const [corpCalendar, setCorpCalendar] = useState<any[]>([])
  const [calendarTab, setCalendarTab] = useState<'economic' | 'corporate'>('economic')
  
  const [insiders, setInsiders] = useState<any[]>([])
  const [newsIntel, setNewsIntel] = useState<{
    sentiment: string
    impact_score: number
    clusters: any[]
  } | null>(null)
  
  const [briefing, setBriefing] = useState<any>(null)
  const [yieldsData, setYieldsData] = useState<{ rates: any[]; curve: any[] } | null>(null)
  const [blockDeals, setBlockDeals] = useState<any[]>([])
  
  // Smart Alerts Modal
  const [showAlertModal, setShowAlertModal] = useState(false)
  const [alertTicker, setAlertTicker] = useState('')
  const [alertType, setAlertType] = useState<'price' | 'volume' | 'news' | 'sentiment'>('price')
  const [alertCondition, setAlertCondition] = useState('above')
  const [alertValue, setAlertValue] = useState('')
  const [alertNote, setAlertNote] = useState('')
  const [creatingAlert, setCreatingAlert] = useState(false)
  
  // ── Initial Fetch ─────────────────────────────────────────
  async function fetchAllData() {
    setLoading(true)
    try {
      const [mkts, secs, econ, corp, ins, nws, brief, ylds, blocks] = await Promise.all([
        intelApi.getMarkets(),
        intelApi.getSectors(),
        intelApi.getEconomicCalendar(),
        intelApi.getCorporateCalendar(),
        intelApi.getInsiders(),
        intelApi.getNews(),
        intelApi.getBriefing(),
        intelApi.getYields(),
        intelApi.getBlockDeals()
      ])
      
      setMarkets(mkts.data)
      setSectors(secs.data)
      setEconCalendar(econ.data)
      setCorpCalendar(corp.data)
      setInsiders(ins.data)
      setNewsIntel(nws.data)
      setBriefing(brief.data)
      setYieldsData(ylds.data)
      setBlockDeals(blocks.data)
    } catch (e) {
      toast.error('Failed to sync Bloomberg Intelligence Feed')
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    fetchAllData()
  }, [])
  
  // ── Handlers ──────────────────────────────────────────────
  async function handleCreateAlert(e: React.FormEvent) {
    e.preventDefault()
    if (!alertTicker.trim()) return toast.error('Enter a ticker symbol')
    if (!alertValue.trim() && alertType !== 'news') return toast.error('Enter a target value')
    
    setCreatingAlert(true)
    try {
      const payload: Record<string, any> = {
        ticker: alertTicker.toUpperCase(),
        alert_type: alertType,
        condition: alertCondition,
        note: alertNote
      }
      
      if (alertType === 'price') {
        const val = parseFloat(alertValue)
        if (alertCondition === 'above') payload.target_price = val
        else payload.stop_loss = val
        payload.value = alertValue
      } else {
        payload.value = alertValue
      }
      
      await alertApi.create(payload)
      toast.success(`Smart alert set for ${alertTicker.toUpperCase()}`)
      setShowAlertModal(false)
      // reset
      setAlertTicker('')
      setAlertValue('')
      setAlertNote('')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to establish smart alert')
    } finally {
      setCreatingAlert(false)
    }
  }
  
  const usdToInrRate = markets?.forex?.find(f => f.ticker === 'USDINR=X')?.price || 83.5
  const currentAssets = markets ? markets[marketTab] : []
  
  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-surface-border/50 pb-4 gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2.5 font-mono">
            <Globe className="text-brand-400 animate-pulse" size={20} />
            MARKET INTELLIGENCE FEED
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">High-density Bloomberg Terminal analytics, sector rotation flows, money rates, and AI-driven alerts.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchAllData} 
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 font-mono text-xs transition-all disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>TERMINAL SYNC</span>
          </button>
          
          <button 
            onClick={() => setShowAlertModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/20 text-brand-300 font-mono font-bold text-xs transition-all"
          >
            <Plus size={13} />
            <span>ESTABLISH ALERT</span>
          </button>
        </div>
      </div>
      
      {loading && !markets ? (
        <div className="h-[70vh] flex flex-col items-center justify-center space-y-4">
          <Activity className="text-brand-400 animate-spin" size={32} />
          <p className="text-xs text-gray-500 font-mono animate-pulse">BOOTING INTELLIGENCE TERMINAL ENGINE...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
          
          {/* COLUMN 1 & 2: GLOBAL MARKETS & SECTORS */}
          <div className="xl:col-span-2 space-y-6">
            
            {/* Global Markets Dashboard */}
            <div className="card bg-[#050507] border border-white/5 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Activity size={14} className="text-gray-400" />
                  Global Markets overview
                </h3>
                
                {/* Tabs */}
                <div className="flex flex-wrap gap-1 p-0.5 bg-black/40 border border-white/5 rounded-lg text-[9px] font-mono">
                  {(['indices', 'commodities', 'forex', 'crypto', 'watchlist'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setMarketTab(tab)}
                      className={`px-2 py-1 rounded-md uppercase font-bold transition-all ${
                        marketTab === tab ? 'bg-brand-500/10 text-brand-400 border border-brand-500/15' : 'text-gray-500 hover:text-white'
                      }`}
                    >
                      {tab === 'watchlist' ? 'Watchlist' : tab}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-2.5">
                {marketTab === 'watchlist' && currentAssets.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-white/5 rounded-xl text-gray-500 font-mono text-[11px] space-y-1">
                    <Eye className="mx-auto text-gray-600 mb-1" size={16} />
                    <div>Your Watchlist is empty.</div>
                    <div className="text-[9px] text-gray-600">Add tickers in the watchlist section to monitor them here.</div>
                  </div>
                ) : (
                  currentAssets.map((asset) => {
                    const isUp = asset.change_pct >= 0
                    return (
                      <div 
                        key={asset.ticker} 
                        className="flex items-center justify-between p-3 bg-black/20 hover:bg-white/[0.01] border border-white/[0.03] hover:border-white/10 rounded-xl transition-all duration-200 group"
                      >
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold font-mono text-gray-500 group-hover:text-gray-400 transition-colors uppercase">
                            {asset.ticker}
                          </span>
                          <div className="text-xs font-extrabold text-white truncate max-w-[140px] font-mono leading-none">
                            {asset.name}
                          </div>
                        </div>
                        
                        {/* Sparkline */}
                        {asset.sparkline && asset.sparkline.length > 0 && (
                          <div className="h-8 w-24 relative hidden sm:block">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={asset.sparkline.map((val, idx) => ({ idx, val }))} margin={{ top: 2, bottom: 2 }}>
                                <defs>
                                  <linearGradient id={`glow-${asset.ticker}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={isUp ? "#10b981" : "#f43f5e"} stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor={isUp ? "#10b981" : "#f43f5e"} stopOpacity={0.0}/>
                                  </linearGradient>
                                </defs>
                                <Area
                                  type="monotone"
                                  dataKey="val"
                                  stroke={isUp ? "#10b981" : "#f43f5e"}
                                  strokeWidth={1.2}
                                  fillOpacity={1}
                                  fill={`url(#glow-${asset.ticker})`}
                                  dot={false}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                        
                        <div className="text-right space-y-0.5">
                          {(() => {
                            const { inrPrice, reference, isAlreadyInr } = getAssetCurrencyInfo(asset.ticker, asset.price, usdToInrRate)
                            return (
                              <>
                                <div className="text-xs font-bold text-white font-mono leading-none">
                                  ₹{inrPrice.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                                </div>
                                {reference && (
                                  <div className="text-[9px] text-gray-500 font-mono">
                                    {reference}
                                  </div>
                                )}
                              </>
                            )
                          })()}
                          <span className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md ${
                            isUp ? 'bg-brand-500/10 text-brand-400 border border-brand-500/10' : 'bg-red-500/10 text-red-400 border border-red-500/10'
                          } border`}>
                            {isUp ? '+' : ''}{asset.change_pct}%
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
            
            {/* Sector Rotation Analytics */}
            {sectors && (
              <div className="card bg-[#050507] border border-white/5 p-5 space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Percent size={14} className="text-gray-400" />
                    Sector Rotation & Quadrant analytics
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-0.5">Money flow allocation mapped by 1-month Relative Strength (vs Nifty 50) and 1D momentum.</p>
                </div>
                
                {/* 2x2 Rotation Quadrant Visualization */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  {/* Leading (Top Right) */}
                  <div className="border border-brand-500/20 bg-brand-950/5 p-3 rounded-xl flex flex-col justify-between min-h-[90px] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-brand-500/5 blur-[8px] opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center justify-between text-brand-400 font-bold uppercase tracking-wider">
                      <span>Leading</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-400 shadow-[0_0_6px_#10b981]" />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2 z-10">
                      {sectors.quadrants["Leading"]?.map(s => (
                        <span key={s} className="px-1.5 py-0.5 rounded bg-brand-500/10 border border-brand-500/20 text-brand-300 text-[8px] font-bold uppercase">
                          {s.replace('Nifty ', '')}
                        </span>
                      )) || <span className="text-gray-600 italic text-[8px]">No Sector</span>}
                    </div>
                  </div>
                  
                  {/* Improving (Top Left) */}
                  <div className="border border-blue-500/20 bg-blue-950/5 p-3 rounded-xl flex flex-col justify-between min-h-[90px] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-blue-500/5 blur-[8px] opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center justify-between text-blue-400 font-bold uppercase tracking-wider">
                      <span>Improving</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_#3b82f6]" />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2 z-10">
                      {sectors.quadrants["Improving"]?.map(s => (
                        <span key={s} className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[8px] font-bold uppercase">
                          {s.replace('Nifty ', '')}
                        </span>
                      )) || <span className="text-gray-600 italic text-[8px]">No Sector</span>}
                    </div>
                  </div>
                  
                  {/* Weakening (Bottom Right) */}
                  <div className="border border-amber-500/20 bg-amber-950/5 p-3 rounded-xl flex flex-col justify-between min-h-[90px] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-amber-500/5 blur-[8px] opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center justify-between text-amber-400 font-bold uppercase tracking-wider">
                      <span>Weakening</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2 z-10">
                      {sectors.quadrants["Weakening"]?.map(s => (
                        <span key={s} className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[8px] font-bold uppercase">
                          {s.replace('Nifty ', '')}
                        </span>
                      )) || <span className="text-gray-600 italic text-[8px]">No Sector</span>}
                    </div>
                  </div>
                  
                  {/* Lagging (Bottom Left) */}
                  <div className="border border-red-500/20 bg-red-950/5 p-3 rounded-xl flex flex-col justify-between min-h-[90px] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-red-500/5 blur-[8px] opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center justify-between text-red-400 font-bold uppercase tracking-wider">
                      <span>Lagging</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400 shadow-[0_0_6px_#ef4444]" />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2 z-10">
                      {sectors.quadrants["Lagging"]?.map(s => (
                        <span key={s} className="px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-300 text-[8px] font-bold uppercase">
                          {s.replace('Nifty ', '')}
                        </span>
                      )) || <span className="text-gray-600 italic text-[8px]">No Sector</span>}
                    </div>
                  </div>
                </div>
                
                {/* Sector lists table */}
                <div className="border-t border-white/[0.04] pt-3.5 space-y-2">
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block">Sector Metrics</span>
                  <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
                    {sectors.sectors.map((sec) => {
                      const quadColor = 
                        sec.quadrant === 'Leading' ? 'text-brand-400' :
                        sec.quadrant === 'Improving' ? 'text-blue-400' :
                        sec.quadrant === 'Weakening' ? 'text-amber-400' : 'text-red-400'
                        
                      return (
                        <div key={sec.ticker} className="flex items-center justify-between text-[11px] font-mono py-1.5 border-b border-white/[0.02]">
                          <span className="text-white font-bold">{sec.name.replace('Nifty ', '')}</span>
                          
                          <div className="flex items-center gap-3">
                            <span className="text-gray-500">1D: <strong className={sec.change_1d >= 0 ? 'text-brand-400' : 'text-red-400'}>{sec.change_1d}%</strong></span>
                            <span className="text-gray-500">RS: <strong className={sec.relative_strength_1m >= 0 ? 'text-brand-400' : 'text-red-400'}>{sec.relative_strength_1m}%</strong></span>
                            <span className={`text-[9px] font-bold px-1 py-0.2 rounded bg-white/5 uppercase ${quadColor}`}>{sec.quadrant}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
            
          </div>
          
          {/* COLUMN 3: BRIEFING, NEWS, YIELDS & BREAKOUTS */}
          <div className="xl:col-span-2 space-y-6">
            
            {/* AI Daily Market Briefing */}
            {briefing && (
              <div className="card bg-gradient-to-r from-brand-950/20 via-black/40 to-surface-card/30 border border-white/5 p-5 space-y-3 relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-32 h-32 bg-brand-500/10 rounded-full blur-[30px] -mr-8 -mt-8 animate-pulse" />
                
                <div className="flex items-center justify-between relative z-10">
                  <h3 className="text-xs font-bold text-brand-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Sparkles size={14} className="text-brand-400" />
                    AI Daily Market Briefing
                  </h3>
                  <span className="text-[8px] font-mono text-gray-500">Updated: {new Date(briefing.updated_at).toLocaleTimeString()}</span>
                </div>
                
                <div className="space-y-3.5 relative z-10">
                  <p className="text-xs text-white leading-relaxed font-mono">
                    {briefing.outlook}
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Opportunities */}
                    <div className="bg-brand-500/[0.02] border border-brand-500/10 p-3 rounded-lg space-y-1.5">
                      <span className="text-[9px] font-mono font-bold text-brand-400 uppercase tracking-wider block">Opportunities Detected</span>
                      <div className="space-y-2">
                        {briefing.opportunities.map((o: any, idx: number) => (
                          <div key={idx} className="text-[10px] font-mono text-gray-300 leading-normal border-l border-brand-500/30 pl-2">
                            <strong className="text-white block">{o.play}</strong>
                            {o.desc}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Risks */}
                    <div className="bg-red-500/[0.02] border border-red-500/10 p-3 rounded-lg space-y-1.5">
                      <span className="text-[9px] font-mono font-bold text-red-400 uppercase tracking-wider block">Risks / Watch Flags</span>
                      <div className="space-y-2">
                        {briefing.risks.map((r: any, idx: number) => (
                          <div key={idx} className="text-[10px] font-mono text-gray-300 leading-normal border-l border-red-500/30 pl-2">
                            <strong className="text-white block">{r.flag}</strong>
                            {r.desc}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* News Intelligence Engine */}
            {newsIntel && (
              <div className="card bg-[#050507] border border-white/5 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <MessageSquare size={14} className="text-gray-400" />
                      Macro news intelligence
                    </h3>
                    <p className="text-[10px] text-gray-500 mt-0.5">Scraped headlines clustered by theme with AI sentiment impact estimation.</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-gray-500 uppercase">Impact Score:</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${
                      newsIntel.impact_score > 30 ? 'bg-brand-500/10 text-brand-400 border border-brand-500/25' :
                      newsIntel.impact_score < -30 ? 'bg-red-500/10 text-red-400 border border-red-500/25' :
                      'bg-white/5 text-gray-400 border border-white/10'
                    } border`}>
                      {newsIntel.impact_score > 0 ? '+' : ''}{newsIntel.impact_score}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                  {newsIntel.clusters.map((cluster, idx) => {
                    const clusterSentimentColor = 
                      cluster.sentiment === 'Positive' ? 'text-brand-400 border-brand-500/25 bg-brand-500/5' :
                      cluster.sentiment === 'Negative' ? 'text-red-400 border-red-500/25 bg-red-500/5' :
                      'text-gray-400 border-white/10 bg-white/5'
                      
                    return (
                      <div key={idx} className="bg-black/40 border border-white/[0.03] p-4 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-white font-mono uppercase tracking-tight">{cluster.theme}</span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded border uppercase font-mono ${clusterSentimentColor}`}>
                            {cluster.sentiment} (Score: {cluster.impact_score})
                          </span>
                        </div>
                        
                        <p className="text-[10px] text-gray-400 font-mono leading-relaxed">
                          {cluster.analysis}
                        </p>
                        
                        <div className="space-y-1 pt-1.5 border-t border-white/[0.03]">
                          <span className="text-[8px] text-gray-500 uppercase tracking-widest font-mono font-bold block">Representative Headlines</span>
                          {cluster.examples.map((ex: string, eIdx: number) => (
                            <div key={eIdx} className="text-[9px] font-mono text-gray-400 border-l-2 border-brand-500/25 pl-1.5 py-0.2 line-clamp-1 hover:text-white transition-colors cursor-default">
                              {ex}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Money Markets & Bond Yield Curve */}
            {yieldsData && (
              <div className="card bg-[#050507] border border-white/5 p-5 space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <TrendingUp size={14} className="text-gray-400" />
                    Yield Curve & Money Markets
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-0.5">Government Treasury yields and Maturity curve projection.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Yield Table */}
                  <div className="space-y-1.5 text-[11px] font-mono">
                    {yieldsData.rates.map((r: any) => (
                      <div key={r.ticker} className="flex justify-between border-b border-white/[0.02] py-1">
                        <span className="text-gray-400">{r.name.replace('US ', '')}</span>
                        <span className="text-white font-bold">{r.price}%</span>
                      </div>
                    ))}
                  </div>

                  {/* Yield Curve Line Chart */}
                  {yieldsData.curve && yieldsData.curve.length > 0 && (
                    <div className="h-28 relative bg-black/20 border border-white/[0.02] rounded-xl p-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={yieldsData.curve} margin={{ top: 5, right: 5, left: -32, bottom: 0 }}>
                          <XAxis dataKey="label" stroke="#4b5563" fontSize={8} tickLine={false} />
                          <YAxis stroke="#4b5563" fontSize={8} tickLine={false} domain={['auto', 'auto']} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#050507', borderColor: '#121214', borderRadius: '8px' }}
                            labelStyle={{ color: '#9ca3af', fontFamily: 'monospace', fontSize: '8px' }}
                            itemStyle={{ color: '#fff', fontFamily: 'monospace', fontSize: '8px' }}
                          />
                          <Area type="monotone" dataKey="yield" name="Yield %" stroke="#8b5cf6" strokeWidth={1.5} fill="rgba(139, 92, 246, 0.05)" dot={{ r: 2 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Institutional Block Trade & Volume Breakout Radar */}
            {blockDeals && blockDeals.length > 0 && (
              <div className="card bg-[#050507] border border-white/5 p-5 space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Activity size={14} className="text-brand-400 animate-pulse" />
                    Institutional Block Trades & Volume Radar
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-0.5">Real-time volume spikes exceeding 1.2x average 30-day baseline (identifying large fund trades).</p>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {blockDeals.map((deal, idx) => {
                    const isBuy = deal.action === 'BLOCK BUY'
                    return (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-black/20 hover:bg-white/[0.01] border border-white/[0.02] rounded-lg text-[10px] font-mono transition-all">
                        <div className="space-y-0.5">
                          <span className="text-white font-extrabold">{deal.ticker}</span>
                          <div className="text-[8px] text-gray-500 uppercase">Price: ₹{deal.price}</div>
                        </div>

                        <div className="text-center">
                          <span className="text-gray-500 text-[8px] block">Vol Multiplier</span>
                          <span className="text-brand-300 font-bold px-1.5 py-0.2 rounded bg-brand-500/10 border border-brand-500/10">{deal.multiplier}x</span>
                        </div>

                        <div className="text-right space-y-0.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                            isBuy ? 'bg-brand-500/10 text-brand-400 border-brand-500/10' : 'bg-red-500/10 text-red-400 border-red-500/10'
                          }`}>
                            {deal.action}
                          </span>
                          <div className={`text-[9px] font-bold ${deal.change_pct >= 0 ? 'text-brand-400' : 'text-red-400'}`}>
                            {deal.change_pct >= 0 ? '+' : ''}{deal.change_pct}%
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            
          </div>
          
        </div>
      )}
      
      {/* DOUBLE CALENDARS & OWNERSHIP */}
      {!loading && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Economic Calendar */}
          <div className="xl:col-span-2 card bg-[#050507] border border-white/5 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCalendarTab('economic')}
                  className={`text-xs font-bold font-mono uppercase tracking-wider pb-1 transition-all border-b-2 ${
                    calendarTab === 'economic' ? 'border-brand-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Global Economic Calendar
                </button>
                <button
                  onClick={() => setCalendarTab('corporate')}
                  className={`text-xs font-bold font-mono uppercase tracking-wider pb-1 transition-all border-b-2 ${
                    calendarTab === 'corporate' ? 'border-brand-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Watchlist Corporate Actions
                </button>
              </div>
              <Calendar size={14} className="text-gray-500" />
            </div>
            
            <div className="max-h-[350px] overflow-y-auto pr-1.5 space-y-2">
              {calendarTab === 'economic' ? (
                econCalendar.map((event) => {
                  const importanceColor = 
                    event.importance === 'High' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                    event.importance === 'Medium' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                    'text-blue-400 bg-blue-500/10 border-blue-500/20'
                    
                  return (
                    <div 
                      key={event.id} 
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-black/25 border border-white/[0.03] rounded-xl text-[11px] font-mono gap-2 hover:bg-white/[0.01] transition-all"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded border uppercase font-mono ${importanceColor}`}>
                            {event.importance}
                          </span>
                          <span className="text-gray-500 font-bold">{event.country}</span>
                        </div>
                        <span className="text-white font-extrabold">{event.event}</span>
                      </div>
                      
                      <div className="flex items-center justify-between sm:justify-end gap-6 text-right">
                        <div>
                          <span className="text-[9px] text-gray-500 block">Forecast</span>
                          <span className="text-gray-300 font-bold">{event.forecast}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-500 block">Previous</span>
                          <span className="text-gray-400">{event.previous}</span>
                        </div>
                        <div className="w-16">
                          <span className="text-[9px] text-gray-500 block">Actual</span>
                          {event.status === 'Released' ? (
                            <span className="text-white font-bold">{event.actual}</span>
                          ) : (
                            <span className="text-gray-600 italic">Pending</span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500 w-24">
                          {new Date(event.date).toLocaleDateString()} {new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                corpCalendar.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 font-mono text-xs">
                    No corporate actions tracked for watchlist assets.
                  </div>
                ) : (
                  corpCalendar.map((corp, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between p-3 bg-black/25 border border-white/[0.03] rounded-xl text-[11px] font-mono hover:bg-white/[0.01] transition-all"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-brand-500/10 border border-brand-500/20 text-brand-400">
                            {corp.ticker}
                          </span>
                          <span className="text-gray-500 text-[9px] uppercase font-bold">{corp.type}</span>
                        </div>
                        <span className="text-white font-extrabold">{corp.event}</span>
                      </div>
                      
                      <div className="text-right space-y-0.5">
                        <span className="text-gray-300 text-[10px]">{corp.details}</span>
                        <div className="text-[9px] text-gray-500">
                          {new Date(corp.date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
          
          {/* Institutional Activity Monitor */}
          <div className="card bg-[#050507] border border-white/5 p-5 space-y-4">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Building2 size={14} className="text-gray-400" />
                Institutional Activity Monitor
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Recent holdings changes extracted from parsed shareholding lists.</p>
            </div>
            
            <div className="max-h-[350px] overflow-y-auto pr-1 space-y-2">
              {insiders.length === 0 ? (
                <div className="text-center py-12 text-gray-500 font-mono text-xs">
                  No institutional adjustments registered in DB.
                </div>
              ) : (
                insiders.map((ins, idx) => {
                  const isBuy = ins.change >= 0
                  return (
                    <div 
                      key={idx} 
                      className="bg-black/20 border border-white/[0.03] p-3 rounded-xl text-[10px] font-mono space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-white">{ins.ticker}</span>
                        <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded border uppercase font-mono ${
                          isBuy ? 'bg-brand-500/10 text-brand-400 border-brand-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {ins.action}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-gray-400 border-t border-white/[0.02] pt-2">
                        <div>
                          <span className="text-[8px] text-gray-500 uppercase block">Shareholder Group</span>
                          <span className="text-white font-bold">{ins.group}</span>
                        </div>
                        <div className="text-center">
                          <span className="text-[8px] text-gray-500 uppercase block">Change</span>
                          <span className={`font-bold ${isBuy ? 'text-brand-400' : 'text-red-400'}`}>
                            {isBuy ? '+' : ''}{ins.change}%
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] text-gray-500 uppercase block">Quarter</span>
                          <span className="text-gray-300">{ins.period.split(' to ')[1] || ins.period}</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
          
        </div>
      )}
      
      {/* Smart Alert modal */}
      {showAlertModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card bg-[#050507] border border-white/10 max-w-sm w-full p-5 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Bell size={14} className="text-brand-400 animate-pulse" />
                Establish Smart Alert Trigger
              </h3>
              <button onClick={() => setShowAlertModal(false)} className="text-gray-500 hover:text-white font-mono">×</button>
            </div>
            
            <form onSubmit={handleCreateAlert} className="space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-gray-500 font-semibold block">Ticker Symbol</label>
                <input 
                  type="text" 
                  value={alertTicker}
                  onChange={e => setAlertTicker(e.target.value)}
                  className="w-full bg-black border border-white/5 rounded-lg p-2 text-white outline-none focus:border-brand-500 uppercase"
                  placeholder="e.g. TCS"
                  required
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-gray-500 font-semibold block">Alert Type</label>
                <select 
                  value={alertType}
                  onChange={e => setAlertType(e.target.value as any)}
                  className="w-full bg-black border border-white/5 rounded-lg p-2 text-white outline-none focus:border-brand-500 cursor-pointer"
                >
                  <option value="price">Price Threshold Alert</option>
                  <option value="volume">Volume Breakout Alert</option>
                  <option value="news">News Keyword Alert</option>
                  <option value="sentiment">Sentiment Shift Alert</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-gray-500 font-semibold block">Condition</label>
                  <select 
                    value={alertCondition}
                    onChange={e => setAlertCondition(e.target.value)}
                    className="w-full bg-black border border-white/5 rounded-lg p-2 text-white outline-none focus:border-brand-500 cursor-pointer"
                  >
                    {alertType === 'price' && (
                      <>
                        <option value="above">Crosses Above</option>
                        <option value="below">Crosses Below</option>
                      </>
                    )}
                    {alertType === 'volume' && (
                      <>
                        <option value="above">Above Multiplier (e.g. 2.0x)</option>
                      </>
                    )}
                    {alertType === 'news' && (
                      <>
                        <option value="contains">Headline Contains</option>
                      </>
                    )}
                    {alertType === 'sentiment' && (
                      <>
                        <option value="equals">Sentiment Becomes</option>
                      </>
                    )}
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-gray-500 font-semibold block">Value / Target</label>
                  <input 
                    type="text" 
                    value={alertValue}
                    onChange={e => setAlertValue(e.target.value)}
                    className="w-full bg-black border border-white/5 rounded-lg p-2 text-white outline-none focus:border-brand-500"
                    placeholder={
                      alertType === 'price' ? 'e.g. 4200.0' :
                      alertType === 'volume' ? 'e.g. 2.5' :
                      alertType === 'news' ? 'e.g. Guidance Cut' :
                      'Positive | Negative'
                    }
                    required={alertType !== 'news'}
                  />
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-gray-500 font-semibold block">Notes / Reason</label>
                <textarea 
                  rows={2}
                  value={alertNote}
                  onChange={e => setAlertNote(e.target.value)}
                  className="w-full bg-black border border-white/5 rounded-lg p-2 text-white outline-none focus:border-brand-500 resize-none"
                  placeholder="Memo to display when this alert fires"
                />
              </div>
              
              <div className="flex gap-2 pt-2 text-xs">
                <button 
                  type="button"
                  onClick={() => setShowAlertModal(false)}
                  className="flex-1 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={creatingAlert}
                  className="flex-1 p-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold transition-all disabled:opacity-50"
                >
                  {creatingAlert ? 'Establishing...' : 'Create Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
    </div>
  )
}

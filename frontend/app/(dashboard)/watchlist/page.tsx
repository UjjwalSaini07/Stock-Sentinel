'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { TrendingUp, TrendingDown, Eye, Plus, Trash2, Wallet, Activity, Search, RefreshCw, Sparkles, List, Grid, Info, X } from 'lucide-react'
import { userApi, stockApi } from '@/lib/api'
import { StockData } from '@/types'
import toast from 'react-hot-toast'
import AddStockModal from '@/components/portfolio/AddStockModal'
import { useAuthStore } from '@/lib/store'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'

function WatchlistSparkline({ ticker, positive }: { ticker: string; positive: boolean }) {
  const [sparkData, setSparkData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const { data } = await stockApi.getHistory(ticker)
        if (data && data.length > 0) {
          setSparkData(data.map((h: any) => ({ price: h.price })))
        }
      } catch (e) {
        console.error("Failed to load sparkline for", ticker, e)
      } finally {
        setLoading(false)
      }
    }
    loadHistory()
  }, [ticker])

  if (loading) {
    return <div className="h-10 bg-white/[0.02] rounded-lg animate-pulse" />
  }

  if (sparkData.length === 0) {
    return <div className="h-10 flex items-center justify-center text-[10px] text-gray-600">No chart data</div>
  }

  const prices = sparkData.map(d => d.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const range = maxPrice - minPrice

  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sparkData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={`sparkGrad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={positive ? '#26a366' : '#ef4444'} stopOpacity={0.15} />
              <stop offset="95%" stopColor={positive ? '#26a366' : '#ef4444'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area 
            type="monotone" 
            dataKey="price" 
            stroke={positive ? '#26a366' : '#ef4444'} 
            strokeWidth={1} 
            fill={`url(#sparkGrad-${ticker})`} 
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function PredictionRangeBar({ current, predictions }: { current: number; predictions: any }) {
  if (!predictions) return <div className="text-xs text-gray-500">No predictions available.</div>
  
  return (
    <div className="space-y-4">
      {['days_7', 'days_30', 'days_90'].map(key => {
        const pred = predictions[key]
        if (!pred) return null
        const name = key === 'days_7' ? '7 Days' : key === 'days_30' ? '30 Days' : '90 Days'
        const range68 = pred.range_68
        const range95 = pred.range_95
        
        const minScale = range95[0] * 0.95
        const maxScale = range95[1] * 1.05
        const span = maxScale - minScale
        
        const pctCurrent = span > 0 ? ((current - minScale) / span) * 100 : 50
        const pct68Min = span > 0 ? ((range68[0] - minScale) / span) * 100 : 30
        const pct68Max = span > 0 ? ((range68[1] - minScale) / span) * 100 : 70
        const pct95Min = span > 0 ? ((range95[0] - minScale) / span) * 100 : 10
        const pct95Max = span > 0 ? ((range95[1] - minScale) / span) * 100 : 90
        
        return (
          <div key={key} className="space-y-1.5 p-3.5 bg-white/[0.01] border border-white/5 rounded-xl animate-slide-up">
            <div className="flex justify-between items-baseline text-xs">
              <span className="font-semibold text-white">{name} Forecast</span>
              <span className="text-[10px] font-mono text-brand-400 font-semibold">±{pred.expected_change_pct}% Expected Move</span>
            </div>
            <div className="relative h-6 flex items-center">
              <div 
                className="absolute h-2 bg-blue-500/10 border border-blue-500/20 rounded-full"
                style={{ left: `${pct95Min}%`, right: `${100 - pct95Max}%` }}
                title="95% Confidence Range"
              />
              <div 
                className="absolute h-3.5 bg-brand-500/15 border border-brand-500/25 rounded-full"
                style={{ left: `${pct68Min}%`, right: `${100 - pct68Max}%` }}
                title="68% Confidence Range"
              />
              <div 
                className="absolute w-2.5 h-4 bg-white rounded shadow-md ring-2 ring-white/10"
                style={{ left: `${pctCurrent}%` }}
                title={`Current Price: ₹${current}`}
              />
            </div>
            <div className="flex justify-between text-[9px] text-gray-500 font-mono">
              <span>95% Downside: ₹{range95[0]}</span>
              <span className="text-white">Current: ₹{current}</span>
              <span>95% Upside: ₹{range95[1]}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StockInsightsModal({ stock, onClose, onInvest }: { stock: StockData; onClose: () => void; onInvest: (ticker: string) => void }) {
  const [activeTab, setActiveTab] = useState<'stats' | 'audit' | 'predictions' | 'news'>('stats')
  const [news, setNews] = useState<any[]>([])
  const [loadingNews, setLoadingNews] = useState(false)

  const ticker = stock.ticker
  const change = stock.current_price && stock.previous_close ? stock.current_price - stock.previous_close : null
  const changePct = change && stock.previous_close ? (change / stock.previous_close) * 100 : null
  const positive = (change ?? 0) >= 0

  useEffect(() => {
    if (activeTab === 'news') {
      const loadNews = async () => {
        try {
          setLoadingNews(true)
          const { data } = await stockApi.getNews(ticker)
          setNews(data)
        } catch (e) {
          console.error("Failed to load news for", ticker, e)
        } finally {
          setLoadingNews(false)
        }
      }
      loadNews()
    }
  }, [activeTab, ticker])

  let pct52 = 0
  if (stock.week_52_high && stock.week_52_low && stock.current_price) {
    const range = stock.week_52_high - stock.week_52_low
    if (range > 0) {
      pct52 = ((stock.current_price - stock.week_52_low) / range) * 100
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#090d16]/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-white">{stock.ticker}</h2>
              <span className="badge-gray text-[9px] uppercase tracking-wider px-1.5 py-0.2">{stock.exchange}</span>
            </div>
            <span className="text-xs text-gray-500 font-medium">{stock.sector || 'Other Sector'} • {stock.industry || 'Other Industry'}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-lg font-bold font-mono text-white">
                {stock.current_price ? `₹${stock.current_price.toLocaleString('en-IN')}` : '—'}
              </div>
              {changePct !== null && (
                <span className={`text-xs font-mono font-bold ${positive ? 'text-brand-400' : 'text-red-400'}`}>
                  {positive ? '▲' : '▼'} {positive ? '+' : ''}{changePct.toFixed(2)}%
                </span>
              )}
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Headers */}
        <div className="flex border-b border-white/5 bg-white/[0.01] px-4">
          {(['stats', 'audit', 'predictions', 'news'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all capitalize ${
                activeTab === tab 
                  ? 'border-brand-500 text-brand-400' 
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab === 'stats' ? 'Key Stats' : tab === 'audit' ? 'Qualitative Audit' : tab === 'predictions' ? 'Expected Range' : 'News'}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 no-scrollbar min-h-[300px]">
          {activeTab === 'stats' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">P/E Ratio</span>
                  <div className="text-base font-bold font-mono text-white mt-1">
                    {stock.stock_pe ? `${stock.stock_pe}` : '—'}
                  </div>
                </div>
                <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">Dividend Yield</span>
                  <div className="text-base font-bold font-mono text-white mt-1">
                    {stock.dividend_yield ? `${stock.dividend_yield}%` : '—'}
                  </div>
                </div>
                <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">ROCE</span>
                  <div className="text-base font-bold font-mono text-brand-400 mt-1">
                    {stock.roce ? `${stock.roce}%` : '—'}
                  </div>
                </div>
                <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">ROE</span>
                  <div className="text-base font-bold font-mono text-brand-400 mt-1">
                    {stock.roe ? `${stock.roe}%` : '—'}
                  </div>
                </div>
                <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">Book Value</span>
                  <div className="text-base font-bold font-mono text-white mt-1">
                    {stock.book_value ? `₹${stock.book_value.toLocaleString('en-IN')}` : '—'}
                  </div>
                </div>
                <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">Face Value</span>
                  <div className="text-base font-bold font-mono text-white mt-1">
                    {stock.face_value ?? '—'}
                  </div>
                </div>
              </div>

              {stock.week_52_high && stock.week_52_low && (
                <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl space-y-3">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold block">52-Week Trading Range</span>
                  <div className="relative pt-2">
                    <div className="h-1.5 w-full bg-white/5 rounded-full relative">
                      <div 
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-brand-500 ring-4 ring-brand-500/20 shadow-md transition-all duration-300"
                        style={{ left: `calc(${pct52}% - 6px)` }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                    <span>Low: ₹{stock.week_52_low.toLocaleString('en-IN')}</span>
                    <span className="text-brand-400">Current: ₹{stock.current_price?.toLocaleString('en-IN')}</span>
                    <span>High: ₹{stock.week_52_high.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-4">
              {stock.analytics ? (
                <>
                  {stock.analytics.valuation && (
                    <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-white">Valuation Rating</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          stock.analytics.valuation.score === 'Positive' 
                            ? 'bg-brand-500/10 text-brand-400' 
                            : stock.analytics.valuation.score === 'Caution' 
                            ? 'bg-red-500/10 text-red-400' 
                            : 'bg-white/5 text-gray-400'
                        }`}>
                          {stock.analytics.valuation.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 leading-normal">{stock.analytics.valuation.desc}</p>
                    </div>
                  )}

                  {stock.analytics.efficiency && (
                    <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-white">Capital Efficiency</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          stock.analytics.efficiency.score === 'Positive' 
                            ? 'bg-brand-500/10 text-brand-400' 
                            : stock.analytics.efficiency.score === 'Caution' 
                            ? 'bg-red-500/10 text-red-400' 
                            : 'bg-white/5 text-gray-400'
                        }`}>
                          {stock.analytics.efficiency.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 leading-normal">{stock.analytics.efficiency.desc}</p>
                    </div>
                  )}

                  {stock.analytics.dividend && (
                    <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-white">Dividend Safety</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          stock.analytics.dividend.score === 'Positive' 
                            ? 'bg-brand-500/10 text-brand-400' 
                            : stock.analytics.dividend.score === 'Caution' 
                            ? 'bg-red-500/10 text-red-400' 
                            : 'bg-white/5 text-gray-400'
                        }`}>
                          {stock.analytics.dividend.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 leading-normal">{stock.analytics.dividend.desc}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-xs text-gray-500 py-12">No qualitative audits available.</div>
              )}
            </div>
          )}

          {activeTab === 'predictions' && (
            <div className="space-y-4">
              {stock.predictions && stock.current_price ? (
                <PredictionRangeBar current={stock.current_price} predictions={stock.predictions} />
              ) : (
                <div className="text-center text-xs text-gray-500 py-12">Range predictions are not available for this ticker.</div>
              )}
            </div>
          )}

          {activeTab === 'news' && (
            <div className="space-y-3">
              {loadingNews ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton h-20 rounded-xl" />
                  ))}
                </div>
              ) : news.length === 0 ? (
                <div className="text-center text-xs text-gray-500 py-12">No recent headlines found.</div>
              ) : (
                news.map((item, idx) => (
                  <a
                    key={idx}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3.5 bg-white/[0.01] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 rounded-xl transition-all group"
                  >
                    <div className="flex justify-between items-start text-[10px] text-gray-500 mb-1">
                      <span>{item.source}</span>
                      <span>{item.pub_date}</span>
                    </div>
                    <h4 className="text-xs font-semibold text-gray-200 group-hover:text-white leading-relaxed line-clamp-2">
                      {item.title}
                    </h4>
                  </a>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-white/[0.01] flex justify-between items-center gap-3">
          <span className="text-[10px] text-gray-600 font-medium">Last updated: {stock.last_updated ? new Date(stock.last_updated).toLocaleString() : '—'}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-outline text-xs px-4 py-2 bg-white/[0.02] border-white/5">
              Close
            </button>
            <button 
              onClick={() => {
                onClose()
                onInvest(stock.ticker)
              }} 
              className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
            >
              <Wallet size={12} /> Invest in Stock
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function WatchedStockCard({ 
  stock, 
  onRemove, 
  onInvest,
  onOpenInsights
}: { 
  stock: StockData; 
  onRemove: (ticker: string) => void;
  onInvest: (ticker: string) => void;
  onOpenInsights: (stock: StockData) => void;
}) {
  const change = stock.current_price && stock.previous_close ? stock.current_price - stock.previous_close : null
  const changePct = change && stock.previous_close ? (change / stock.previous_close) * 100 : null
  const positive = (change ?? 0) >= 0

  let volatilityClass = "Stable"
  if (stock.high && stock.low && stock.high > stock.low) {
    const vol = Math.log(stock.high / stock.low) / Math.sqrt(4 * Math.log(2))
    if (vol > 0.35) volatilityClass = "High Vol"
    else if (vol > 0.15) volatilityClass = "Moderate"
  }

  let valuationClass = "Fair Value"
  let valuationColor = "text-gray-400 bg-white/5 border-white/5"
  if (stock.stock_pe) {
    if (stock.stock_pe < 15) {
      valuationClass = "Undervalued"
      valuationColor = "text-brand-400 bg-brand-500/10 border-brand-500/15"
    } else if (stock.stock_pe > 30) {
      valuationClass = "Premium"
      valuationColor = "text-amber-400 bg-amber-500/10 border-amber-500/15"
    }
  }

  return (
    <div className="card relative overflow-hidden border-white/5 bg-white/[0.02] backdrop-blur-md hover:border-white/10 transition-all duration-300 group">
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${positive ? 'from-brand-500/40 via-brand-500/10 to-brand-500/0' : 'from-red-500/40 via-red-500/10 to-red-500/0'}`} />

      <div className="flex justify-between items-start mb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white">{stock.ticker}</span>
            <span className="badge-gray text-[9px] px-1.5 py-0.2 uppercase shrink-0">{stock.exchange}</span>
          </div>
          <span className="text-[10px] text-gray-500 font-medium">{stock.sector || "Other Sector"}</span>
        </div>

        {changePct !== null && (
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${positive ? 'bg-brand-500/10 text-brand-400' : 'bg-red-500/10 text-red-400'}`}>
            {positive ? '+' : ''}{changePct.toFixed(2)}%
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-between mb-3">
        <span className="text-xl font-bold font-mono text-white">
          {stock.current_price ? `₹${stock.current_price.toLocaleString('en-IN')}` : '—'}
        </span>
        <span className="text-[10px] text-gray-600 font-mono">
          Close: ₹{stock.previous_close?.toLocaleString('en-IN') ?? '—'}
        </span>
      </div>

      <div className="py-2 border-t border-b border-white/5 my-2">
        <WatchlistSparkline ticker={stock.ticker} positive={positive} />
      </div>

      <div className="flex gap-1.5 mb-4">
        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded border ${valuationColor}`}>
          {valuationClass}
        </span>
        <span className="text-[9px] font-semibold px-2 py-0.5 rounded bg-white/5 border border-white/5 text-blue-400">
          {volatilityClass}
        </span>
      </div>

      <div className="flex justify-between items-center gap-2 pt-1">
        <button 
          onClick={() => onRemove(stock.ticker)} 
          className="btn-icon text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg p-2"
          title="Remove from Watchlist"
        >
          <Trash2 size={14} />
        </button>
        <button 
          onClick={() => onOpenInsights(stock)} 
          className="btn-outline text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 bg-white/[0.02]"
          title="View Analytics"
        >
          <Info size={12} /> Insights
        </button>
        <button 
          onClick={() => onInvest(stock.ticker)} 
          className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3 rounded-lg flex-1 justify-center"
        >
          <Wallet size={12} /> Invest
        </button>
      </div>
    </div>
  )
}

export default function WatchlistPage() {
  const { user, refreshUser } = useAuthStore()
  const [watchlist, setWatchlist] = useState<StockData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [adding, setAdding] = useState(false)
  const [investingTicker, setInvestingTicker] = useState<string | null>(null)
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null)

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [sortBy, setSortBy] = useState<'ticker' | 'price' | 'change' | 'pe'>('ticker')
  const [filterSector, setFilterSector] = useState<string>('ALL')
  const [filterValuation, setFilterValuation] = useState<string>('ALL')
  const [filterVolatility, setFilterVolatility] = useState<string>('ALL')

  const suggestionsRef = useRef<HTMLDivElement>(null)

  const fetchWatchlist = useCallback(async () => {
    try {
      setLoading(true)
      const res = await userApi.getWatchlist()
      setWatchlist(res.data)
    } catch {
      toast.error("Failed to load watchlist data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) {
      fetchWatchlist()
    }
  }, [user, fetchWatchlist])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const { data } = await stockApi.search(searchQuery)
        setSuggestions(data)
      } catch (err) {
        console.error("Suggestions fetch error:", err)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  async function handleAddTicker(tickerSymbol: string) {
    try {
      setAdding(true)
      const ticker = tickerSymbol.trim().toUpperCase()
      await userApi.addToWatchlist(ticker)
      toast.success(`${ticker} added to watchlist`)
      setSearchQuery('')
      setShowSuggestions(false)
      refreshUser()
      fetchWatchlist()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to add ticker")
    } finally {
      setAdding(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) return
    handleAddTicker(searchQuery)
  }

  async function handleRemove(ticker: string) {
    try {
      await userApi.removeFromWatchlist(ticker)
      toast.success(`${ticker} removed from watchlist`)
      refreshUser()
      fetchWatchlist()
    } catch {
      toast.error("Failed to remove ticker")
    }
  }

  function handleInvest(ticker: string) {
    setInvestingTicker(ticker)
  }

  function handleOpenInsights(stock: StockData) {
    setSelectedStock(stock)
  }

  const sectorsList = Array.from(new Set(watchlist.map(w => w.sector).filter(Boolean))) as string[]

  const filteredAndSortedWatchlist = watchlist.filter(stock => {
    if (filterSector !== 'ALL' && stock.sector !== filterSector) return false

    let valuationClass = "Fair Value"
    if (stock.stock_pe) {
      if (stock.stock_pe < 15) valuationClass = "Undervalued"
      else if (stock.stock_pe > 30) valuationClass = "Premium"
    }
    if (filterValuation !== 'ALL' && valuationClass !== filterValuation) return false

    let volatilityClass = "Stable"
    if (stock.high && stock.low && stock.high > stock.low) {
      const vol = Math.log(stock.high / stock.low) / Math.sqrt(4 * Math.log(2))
      if (vol > 0.35) volatilityClass = "High Vol"
      else if (vol > 0.15) volatilityClass = "Moderate"
    }
    if (filterVolatility !== 'ALL' && volatilityClass !== filterVolatility) return false

    return true
  }).sort((a, b) => {
    if (sortBy === 'price') {
      return (b.current_price ?? 0) - (a.current_price ?? 0)
    }
    if (sortBy === 'change') {
      const changeA = a.current_price && a.previous_close ? (a.current_price - a.previous_close) / a.previous_close : 0
      const changeB = b.current_price && b.previous_close ? (b.current_price - b.previous_close) / b.previous_close : 0
      return changeB - changeA
    }
    if (sortBy === 'pe') {
      return (a.stock_pe ?? 9999) - (b.stock_pe ?? 9999)
    }
    return a.ticker.localeCompare(b.ticker)
  })

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Eye size={22} className="text-brand-400" /> Watchlist Screener
          </h1>
          <p className="text-gray-500 text-sm">Monitor stocks and evaluate entry points using live qualitative metrics.</p>
        </div>
        <button onClick={fetchWatchlist} className="btn-outline flex items-center gap-2 text-sm bg-white/[0.01] w-full sm:w-auto justify-center">
          <RefreshCw size={14} /> Refresh Screener
        </button>
      </div>

      {/* Add Stock Banner with Autocomplete */}
      <div ref={suggestionsRef} className="relative w-full">
        <form onSubmit={handleAdd} className="card border-white/5 bg-white/[0.02] backdrop-blur-md flex flex-col sm:flex-row gap-3 items-center relative z-20">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input 
              type="text"
              className="input pl-10"
              placeholder="Type NSE ticker symbol to monitor — e.g. TCS, HDFCBANK, INFIBEAM"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setShowSuggestions(true)
              }}
              onFocus={() => setShowSuggestions(true)}
            />
          </div>
          <button 
            type="submit" 
            disabled={adding || !searchQuery.trim()}
            className="btn-primary w-full sm:w-auto px-6 py-2.5 flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Add to Watchlist
          </button>
        </form>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#0a0f1d]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-30 animate-fade-in">
            <div className="max-h-60 overflow-y-auto no-scrollbar">
              {suggestions.map((sug) => (
                <div 
                  key={sug.ticker}
                  onClick={() => handleAddTicker(sug.ticker)}
                  className="flex justify-between items-center px-4 py-3 hover:bg-white/[0.04] cursor-pointer transition-colors border-b border-white/5 last:border-0"
                >
                  <div>
                    <span className="font-bold text-white text-sm">{sug.ticker}</span>
                    <span className="badge-gray text-[9px] px-1.5 py-0.2 uppercase shrink-0 ml-2">{sug.exchange}</span>
                  </div>
                  <div className="text-right">
                    {sug.current_price ? (
                      <span className="text-xs font-mono font-bold text-brand-400">₹{sug.current_price.toLocaleString('en-IN')}</span>
                    ) : (
                      <span className="text-[10px] text-gray-500 font-mono">No pricing</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Advanced Sorting, Filtering and Toggles Toolbar */}
      {watchlist.length > 0 && (
        <div className="card border-white/5 bg-white/[0.02] backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 animate-slide-up">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Sector</span>
              <select
                value={filterSector}
                onChange={(e) => setFilterSector(e.target.value)}
                className="bg-[#0e1420] border border-white/5 hover:border-white/10 rounded-lg text-xs font-semibold text-gray-300 py-1.5 px-3 focus:outline-none transition-colors"
              >
                <option value="ALL">All Sectors</option>
                {sectorsList.map(sect => (
                  <option key={sect} value={sect}>{sect}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Valuation</span>
              <select
                value={filterValuation}
                onChange={(e) => setFilterValuation(e.target.value)}
                className="bg-[#0e1420] border border-white/5 hover:border-white/10 rounded-lg text-xs font-semibold text-gray-300 py-1.5 px-3 focus:outline-none transition-colors"
              >
                <option value="ALL">All Valuations</option>
                <option value="Undervalued">Undervalued</option>
                <option value="Fair Value">Fair Value</option>
                <option value="Premium">Premium</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Volatility</span>
              <select
                value={filterVolatility}
                onChange={(e) => setFilterVolatility(e.target.value)}
                className="bg-[#0e1420] border border-white/5 hover:border-white/10 rounded-lg text-xs font-semibold text-gray-300 py-1.5 px-3 focus:outline-none transition-colors"
              >
                <option value="ALL">All Volatility</option>
                <option value="Stable">Stable</option>
                <option value="Moderate">Moderate</option>
                <option value="High Vol">High Volatility</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Sort By</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-[#0e1420] border border-white/5 hover:border-white/10 rounded-lg text-xs font-semibold text-gray-300 py-1.5 px-3 focus:outline-none transition-colors"
              >
                <option value="ticker">Ticker Name</option>
                <option value="price">Price (High to Low)</option>
                <option value="change">Day Change %</option>
                <option value="pe">P/E Ratio (Low to High)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 text-right">Layout</span>
              <div className="flex bg-white/[0.03] border border-white/5 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded transition-all ${
                    viewMode === 'grid' 
                      ? 'bg-brand-500 text-white' 
                      : 'text-gray-500 hover:text-white'
                  }`}
                  title="Grid Layout"
                >
                  <Grid size={14} />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded transition-all ${
                    viewMode === 'table' 
                      ? 'bg-brand-500 text-white' 
                      : 'text-gray-500 hover:text-white'
                  }`}
                  title="List Table Layout"
                >
                  <List size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Watchlist Grid / Table */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton h-44 rounded-2xl" />
          ))}
        </div>
      ) : watchlist.length === 0 ? (
        <div className="card text-center py-20 border-white/5 bg-white/[0.02] backdrop-blur-md">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.01] border border-white/5 flex items-center justify-center mx-auto mb-4">
            <Sparkles size={26} className="text-gray-600" />
          </div>
          <p className="text-gray-400 font-medium mb-1">Your Watchlist is empty</p>
          <p className="text-gray-600 text-sm mb-5">Type any NSE/BSE ticker above to add it to your tracking radar.</p>
        </div>
      ) : filteredAndSortedWatchlist.length === 0 ? (
        <div className="card text-center py-16 border-white/5 bg-white/[0.02] backdrop-blur-md">
          <p className="text-gray-400 font-medium mb-1">No matching stocks found</p>
          <p className="text-gray-600 text-sm">Clear some filters to see your watched tickers.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-slide-up">
          {filteredAndSortedWatchlist.map(stock => (
            <WatchedStockCard 
              key={stock.ticker} 
              stock={stock} 
              onRemove={handleRemove}
              onInvest={handleInvest}
              onOpenInsights={handleOpenInsights}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto no-scrollbar rounded-2xl border border-white/5 bg-white/[0.01] animate-slide-up">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                <th className="p-4">Ticker</th>
                <th className="p-4">Price</th>
                <th className="p-4">Change</th>
                <th className="p-4">Sector</th>
                <th className="p-4">P/E Ratio</th>
                <th className="p-4">Volatility</th>
                <th className="p-4 w-32">Trend (24h)</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredAndSortedWatchlist.map(stock => {
                const change = stock.current_price && stock.previous_close ? stock.current_price - stock.previous_close : null
                const changePct = change && stock.previous_close ? (change / stock.previous_close) * 100 : null
                const positive = (change ?? 0) >= 0

                let volatilityClass = "Stable"
                if (stock.high && stock.low && stock.high > stock.low) {
                  const vol = Math.log(stock.high / stock.low) / Math.sqrt(4 * Math.log(2))
                  if (vol > 0.35) volatilityClass = "High Vol"
                  else if (vol > 0.15) volatilityClass = "Moderate"
                }

                let valuationClass = "Fair Value"
                let valuationColor = "text-gray-400 bg-white/5 border-white/5"
                if (stock.stock_pe) {
                  if (stock.stock_pe < 15) {
                    valuationClass = "Undervalued"
                    valuationColor = "text-brand-400 bg-brand-500/10 border-brand-500/15"
                  } else if (stock.stock_pe > 30) {
                    valuationClass = "Premium"
                    valuationColor = "text-amber-400 bg-amber-500/10 border-amber-500/15"
                  }
                }

                return (
                  <tr key={stock.ticker} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{stock.ticker}</span>
                        <span className="badge-gray text-[9px] uppercase tracking-wider">{stock.exchange}</span>
                      </div>
                    </td>
                    <td className="p-4 font-mono font-bold text-white">
                      {stock.current_price ? `₹${stock.current_price.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="p-4 font-mono font-bold">
                      {changePct !== null ? (
                        <span className={positive ? 'text-brand-400' : 'text-red-400'}>
                          {positive ? '+' : ''}{changePct.toFixed(2)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-4 text-gray-400 font-medium">
                      {stock.sector || "Other"}
                    </td>
                    <td className="p-4 font-mono">
                      {stock.stock_pe ? (
                        <span className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded border ${valuationColor}`}>
                          {stock.stock_pe}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-4">
                      <span className="text-[10px] font-semibold text-blue-400">
                        {volatilityClass}
                      </span>
                    </td>
                    <td className="p-4">
                      <WatchlistSparkline ticker={stock.ticker} positive={positive} />
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <button 
                          onClick={() => handleOpenInsights(stock)}
                          className="btn-icon text-gray-500 hover:text-white hover:bg-white/5 rounded-lg p-2"
                          title="View Analytics"
                        >
                          <Info size={14} />
                        </button>
                        <button 
                          onClick={() => handleRemove(stock.ticker)} 
                          className="btn-icon text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg p-2"
                          title="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button 
                          onClick={() => handleInvest(stock.ticker)} 
                          className="btn-primary text-[10px] flex items-center gap-1.5 py-1 px-2.5 rounded-lg"
                        >
                          <Wallet size={10} /> Invest
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for adding stock to portfolio */}
      {investingTicker && (
        <AddStockModal 
          onClose={() => setInvestingTicker(null)} 
          onAdded={() => {
            setInvestingTicker(null)
            refreshUser()
          }}
          prefilledTicker={investingTicker}
        />
      )}

      {/* Modal for stock analytics insights */}
      {selectedStock && (
        <StockInsightsModal
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
          onInvest={handleInvest}
        />
      )}
    </div>
  )
}

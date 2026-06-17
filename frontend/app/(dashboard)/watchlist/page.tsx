'use client'
import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, Eye, Plus, Trash2, Wallet, Activity, Search, RefreshCw, Sparkles } from 'lucide-react'
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
    async function loadHistory() {
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
  const pad = range > 0 ? range * 0.05 : maxPrice * 0.005

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

function WatchedStockCard({ 
  stock, 
  onRemove, 
  onInvest 
}: { 
  stock: StockData; 
  onRemove: (ticker: string) => void;
  onInvest: (ticker: string) => void;
}) {
  const change = stock.current_price && stock.previous_close ? stock.current_price - stock.previous_close : null
  const changePct = change && stock.previous_close ? (change / stock.previous_close) * 100 : null
  const positive = (change ?? 0) >= 0

  // Calculate Parkinson Volatility Class
  let volatilityClass = "Stable"
  if (stock.high && stock.low && stock.high > stock.low) {
    const vol = Math.log(stock.high / stock.low) / Math.sqrt(4 * Math.log(2))
    if (vol > 0.35) volatilityClass = "High Vol"
    else if (vol > 0.15) volatilityClass = "Moderate"
  }

  // Valuation rating
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
      {/* Dynamic top line indicator */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${positive ? 'from-brand-500/40 via-brand-500/10 to-brand-500/0' : 'from-red-500/40 via-red-500/10 to-red-500/0'}`} />

      {/* Header Info */}
      <div className="flex justify-between items-start mb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white">{stock.ticker}</span>
            <span className="badge-gray text-[9px] px-1.5 py-0.2 uppercase shrink-0">{stock.exchange}</span>
          </div>
          <span className="text-[10px] text-gray-500 font-medium">{stock.sector || "Other Sector"}</span>
        </div>

        {/* Change Tag */}
        {changePct !== null && (
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${positive ? 'bg-brand-500/10 text-brand-400' : 'bg-red-500/10 text-red-400'}`}>
            {positive ? '+' : ''}{changePct.toFixed(2)}%
          </span>
        )}
      </div>

      {/* Price Block */}
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-xl font-bold font-mono text-white">
          {stock.current_price ? `₹${stock.current_price.toLocaleString('en-IN')}` : '—'}
        </span>
        <span className="text-[10px] text-gray-600 font-mono">
          Close: ₹{stock.previous_close?.toLocaleString('en-IN') ?? '—'}
        </span>
      </div>

      {/* Real-time Sparkline Trend */}
      <div className="py-2 border-t border-b border-white/5 my-2">
        <WatchlistSparkline ticker={stock.ticker} positive={positive} />
      </div>

      {/* Qualitative Analytics Tags */}
      <div className="flex gap-1.5 mb-4">
        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded border ${valuationColor}`}>
          {valuationClass}
        </span>
        <span className="text-[9px] font-semibold px-2 py-0.5 rounded bg-white/5 border border-white/5 text-blue-400">
          {volatilityClass}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center gap-2 pt-1">
        <button 
          onClick={() => onRemove(stock.ticker)} 
          className="btn-icon text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg p-2"
          title="Remove from Watchlist"
        >
          <Trash2 size={14} />
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
  const [newTicker, setNewTicker] = useState('')
  const [adding, setAdding] = useState(false)
  const [investingTicker, setInvestingTicker] = useState<string | null>(null)

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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newTicker.trim()) return
    try {
      setAdding(true)
      const ticker = newTicker.trim().toUpperCase()
      await userApi.addToWatchlist(ticker)
      toast.success(`${ticker} added to watchlist`)
      setNewTicker('')
      refreshUser()
      fetchWatchlist()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to add ticker")
    } finally {
      setAdding(false)
    }
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

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Eye size={22} className="text-brand-400" /> Watchlist Screener
          </h1>
          <p className="text-gray-500 text-sm">Monitor stocks and evaluate entry points using live qualitative metrics.</p>
        </div>
        <button onClick={fetchWatchlist} className="btn-outline flex items-center gap-2 text-sm bg-white/[0.01]">
          <RefreshCw size={14} /> Refresh Screener
        </button>
      </div>

      {/* Add Stock Banner */}
      <form onSubmit={handleAdd} className="card border-white/5 bg-white/[0.02] backdrop-blur-md flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input 
            type="text"
            className="input pl-10"
            placeholder="Type NSE ticker symbol to monitor — e.g. TCS, HDFCBANK, INFIBEAM"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value)}
          />
        </div>
        <button 
          type="submit" 
          disabled={adding || !newTicker.trim()}
          className="btn-primary w-full sm:w-auto px-6 py-2.5 flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Add to Watchlist
        </button>
      </form>

      {/* Watchlist Grid */}
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-slide-up">
          {watchlist.map(stock => (
            <WatchedStockCard 
              key={stock.ticker} 
              stock={stock} 
              onRemove={handleRemove}
              onInvest={handleInvest}
            />
          ))}
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
    </div>
  )
}

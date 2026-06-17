'use client'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import StockSearch from '@/components/stock/StockSearch'
import { TrendingUp, TrendingDown, Eye, ArrowUpRight, Plus } from 'lucide-react'
import { useState } from 'react'
import AddStockModal from '@/components/portfolio/AddStockModal'

export default function WatchlistPage() {
  const { user, refreshUser } = useAuthStore()
  const [showAdd, setShowAdd] = useState(false)
  const portfolio = user?.portfolio ?? []

  const gainers = portfolio.filter(p => (p.pnl_percent ?? 0) > 0)
  const losers  = portfolio.filter(p => (p.pnl_percent ?? 0) < 0)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-0.5">Watchlist</h1>
          <p className="text-gray-500 text-sm">Search any NSE/BSE stock to analyse it</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> Add to Portfolio
        </button>
      </div>

      {/* Search */}
      <div className="card">
        <h3 className="section-title mb-3"><Eye size={14} /> Search Stocks</h3>
        <StockSearch />
      </div>

      {/* Holdings grid */}
      {portfolio.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title"><TrendingUp size={14} /> Your Holdings</h3>
            <div className="flex gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1 text-brand-400"><span className="w-1.5 h-1.5 rounded-full bg-brand-500" />{gainers.length} up</span>
              <span className="flex items-center gap-1 text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{losers.length} down</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {portfolio.map(p => {
              const positive = (p.pnl_percent ?? 0) >= 0
              const value = (p.current_price ?? p.buy_price) * p.quantity
              return (
                <Link
                  key={p.ticker}
                  href={`/stock/${p.ticker}`}
                  className="group relative p-4 bg-surface-muted rounded-xl border border-surface-border hover:border-brand-500/30 hover:bg-surface-hover transition-all duration-200"
                >
                  {/* Subtle line at top */}
                  <div className={`absolute top-0 left-4 right-4 h-px ${positive ? 'bg-brand-500/30' : 'bg-red-500/30'}`} />

                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-bold text-sm">{p.ticker}</div>
                      <div className="text-[10px] text-gray-600 mt-0.5">{p.exchange} · {p.quantity} shares</div>
                    </div>
                    <ArrowUpRight size={14} className="text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
                  </div>

                  <div className="font-mono font-bold text-base">
                    {p.current_price ? `₹${p.current_price.toLocaleString('en-IN')}` : '—'}
                  </div>

                  <div className={`flex items-center justify-between mt-2`}>
                    <span className="text-xs text-gray-500">
                      ₹{value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                    {p.pnl_percent !== undefined && (
                      <span className={`flex items-center gap-0.5 text-xs font-semibold ${positive ? 'text-brand-400' : 'text-red-400'}`}>
                        {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {positive ? '+' : ''}{p.pnl_percent.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {portfolio.length === 0 && (
        <div className="card text-center py-12">
          <div className="w-14 h-14 rounded-2xl bg-surface-muted flex items-center justify-center mx-auto mb-4">
            <Eye size={24} className="text-gray-600" />
          </div>
          <p className="text-gray-400 font-medium mb-1">Nothing tracked yet</p>
          <p className="text-gray-600 text-sm">Search above to look up any stock</p>
        </div>
      )}

      {showAdd && <AddStockModal onClose={() => setShowAdd(false)} onAdded={refreshUser} />}
    </div>
  )
}

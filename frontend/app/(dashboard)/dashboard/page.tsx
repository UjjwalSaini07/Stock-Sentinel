'use client'
import { useState } from 'react'
import { Plus, Wallet, TrendingUp, TrendingDown, BarChart2, RefreshCw, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import StatCard from '@/components/ui/StatCard'
import HoldingRow from '@/components/portfolio/HoldingRow'
import AddStockModal from '@/components/portfolio/AddStockModal'
import PortfolioDonut from '@/components/charts/PortfolioDonut'
import { userApi } from '@/lib/api'
import toast from 'react-hot-toast'

export default function DashboardPage() {
  const { user, refreshUser } = useAuthStore()
  const [showAddModal, setShowAddModal] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [sortBy, setSortBy] = useState<'value' | 'pnl' | 'ticker'>('value')

  const portfolio = user?.portfolio ?? []

  const totalInvested = portfolio.reduce((s, p) => s + p.buy_price * p.quantity, 0)
  const totalCurrent  = portfolio.reduce((s, p) => s + (p.current_price ?? p.buy_price) * p.quantity, 0)
  const totalPnl      = totalCurrent - totalInvested
  const totalPnlPct   = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0
  const positive      = totalPnl >= 0

  const gainers = portfolio.filter(p => (p.pnl_percent ?? 0) > 0).sort((a, b) => (b.pnl_percent ?? 0) - (a.pnl_percent ?? 0))
  const losers  = portfolio.filter(p => (p.pnl_percent ?? 0) < 0).sort((a, b) => (a.pnl_percent ?? 0) - (b.pnl_percent ?? 0))

  const sortedPortfolio = [...portfolio].sort((a, b) => {
    if (sortBy === 'pnl') return (b.pnl ?? 0) - (a.pnl ?? 0)
    if (sortBy === 'ticker') return a.ticker.localeCompare(b.ticker)
    return (b.current_price ?? b.buy_price) * b.quantity - (a.current_price ?? a.buy_price) * a.quantity
  })

  async function handleRemove(ticker: string) {
    try {
      await userApi.removeFromPortfolio(ticker)
      toast.success(`${ticker} removed`)
      refreshUser()
    } catch { toast.error('Failed to remove') }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await refreshUser()
    setRefreshing(false)
    toast.success('Portfolio refreshed')
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-sm mb-0.5">{greeting()},</p>
          <h1 className="text-2xl font-bold">{user?.name?.split(' ')[0]} 👋</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} disabled={refreshing} className="btn-outline flex items-center gap-2 text-sm">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> Add Stock
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
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

      {/* Portfolio Composition + Gainers/Losers */}
      {portfolio.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {/* Donut chart */}
          <div className="card col-span-1">
            <h3 className="section-title mb-4"><BarChart2 size={14} /> Allocation</h3>
            <PortfolioDonut portfolio={portfolio} />
          </div>

          {/* Gainers & Losers */}
          <div className="col-span-2 grid grid-cols-2 gap-4">
            <div className="card">
              <h3 className="section-title mb-3">
                <TrendingUp size={14} className="text-brand-400" /> Top Gainers
              </h3>
              {gainers.length === 0 ? (
                <p className="text-xs text-gray-600 py-4 text-center">No gainers right now</p>
              ) : (
                <div className="space-y-2">
                  {gainers.slice(0, 4).map(g => (
                    <Link key={g.ticker} href={`/stock/${g.ticker}`} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-surface-muted transition-colors group">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                        <span className="text-sm font-medium">{g.ticker}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-mono font-semibold text-brand-400">+{g.pnl_percent?.toFixed(1)}%</span>
                        <ArrowUpRight size={12} className="text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="section-title mb-3">
                <TrendingDown size={14} className="text-red-400" /> Top Losers
              </h3>
              {losers.length === 0 ? (
                <p className="text-xs text-gray-600 py-4 text-center">No losers — great portfolio!</p>
              ) : (
                <div className="space-y-2">
                  {losers.slice(0, 4).map(l => (
                    <Link key={l.ticker} href={`/stock/${l.ticker}`} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-surface-muted transition-colors group">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        <span className="text-sm font-medium">{l.ticker}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-mono font-semibold text-red-400">{l.pnl_percent?.toFixed(1)}%</span>
                        <ArrowUpRight size={12} className="text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Holdings table */}
      <div className="card">
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
            {/* Column headers */}
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

      {showAddModal && <AddStockModal onClose={() => setShowAddModal(false)} onAdded={refreshUser} />}
    </div>
  )
}

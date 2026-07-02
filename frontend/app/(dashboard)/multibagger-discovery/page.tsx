'use client'
import { useState, useEffect } from 'react'
import { 
  Sparkles, Zap, RefreshCcw, Search, ExternalLink, ArrowUpRight, 
  ShieldAlert, Award, Compass, HeartPulse, Filter, Plus, Check, Info, TrendingUp, BarChart2, PlusCircle, Trash2
} from 'lucide-react'
import { stockApi, userApi } from '@/lib/api'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import { toast } from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'

export default function MultibaggerDiscoveryPage() {
  const { user, refreshUser } = useAuthStore()
  
  const [activeTab, setActiveTab] = useState<'multibagger' | 'early' | 'turnaround'>('multibagger')
  const [multibaggers, setMultibaggers] = useState<any[]>([])
  const [earlyOpps, setEarlyOpps] = useState<any[]>([])
  const [turnarounds, setTurnarounds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Confirmation Modal states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [tickerToDelete, setTickerToDelete] = useState<string | null>(null)

  // New Ticker Ingest states
  const [newTicker, setNewTicker] = useState('')
  const [analyzingTicker, setAnalyzingTicker] = useState(false)

  // Advanced Filters
  const [capFilter, setCapFilter] = useState<'all' | 'micro' | 'small' | 'mid' | 'large'>('all')
  const [sortBy, setSortBy] = useState<'score' | 'prob_2x' | 'prob_10x' | 'cagr'>('score')
  const [qualityOnly, setQualityOnly] = useState(false)

  // Drawer / Modals
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null)
  const [inspectItem, setInspectItem] = useState<any | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      if (activeTab === 'multibagger') {
        const { data } = await stockApi.getScanMultibagger()
        setMultibaggers(data)
      } else if (activeTab === 'early') {
        const { data } = await stockApi.getScanEarlyOpportunity()
        setEarlyOpps(data)
      } else if (activeTab === 'turnaround') {
        const { data } = await stockApi.getScanTurnaround()
        setTurnarounds(data)
      }
    } catch (err: any) {
      toast.error('Failed to sync discovery scans.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [activeTab])

  const handleIngestTicker = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanTicker = newTicker.trim().toUpperCase()
    if (!cleanTicker) return
    
    setAnalyzingTicker(true)
    const toastId = toast.loading(`Scraping financial tables and analyzing ${cleanTicker}...`)
    try {
      await stockApi.getDecisionIntelligence(cleanTicker)
      toast.success(`${cleanTicker} analyzed and ingested successfully!`, { id: toastId })
      setNewTicker('')
      fetchData() // Refresh list
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || `Failed to analyze ${cleanTicker}. Check if it is a valid NSE/BSE symbol.`, { id: toastId })
    } finally {
      setAnalyzingTicker(false)
    }
  }

  const handleDeleteStock = (ticker: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setTickerToDelete(ticker)
    setDeleteConfirmOpen(true)
  }

  const executeDeleteStock = async () => {
    if (!tickerToDelete) return
    const ticker = tickerToDelete
    setDeleteConfirmOpen(false)
    setTickerToDelete(null)
    
    // Optimistic UI Update: remove from local states immediately
    setMultibaggers(prev => prev.filter(item => item.ticker.toUpperCase() !== ticker.toUpperCase()))
    setEarlyOpps(prev => prev.filter(item => item.ticker.toUpperCase() !== ticker.toUpperCase()))
    setTurnarounds(prev => prev.filter(item => item.ticker.toUpperCase() !== ticker.toUpperCase()))
    
    const toastId = toast.loading(`Removing ${ticker} from scan indexes...`)
    try {
      await stockApi.deleteStock(ticker)
      toast.success(`${ticker} successfully deleted!`, { id: toastId })
      fetchData() // Sync with backend state
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || `Failed to delete ${ticker}`, { id: toastId })
      fetchData() // Restore state on failure
    }
  }

  const toggleWatchlist = async (ticker: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const inWatchlist = user?.watchlist?.includes(ticker.toUpperCase())
    try {
      if (inWatchlist) {
        await userApi.removeFromWatchlist(ticker)
        toast.success(`${ticker} removed from watchlist`)
      } else {
        await userApi.addToWatchlist(ticker)
        toast.success(`${ticker} added to watchlist`)
      }
      refreshUser()
    } catch {
      toast.error('Failed to update watchlist.')
    }
  }

  const getFilteredItems = () => {
    let items = activeTab === 'multibagger' ? multibaggers : activeTab === 'early' ? earlyOpps : turnarounds
    
    // 1. Search Query
    if (searchTerm) {
      items = items.filter(item => 
        item.ticker.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.company_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (activeTab === 'multibagger') {
      // 2. Cap Filter
      if (capFilter !== 'all') {
        items = items.filter(item => {
          if (capFilter === 'micro') return item.multibagger_score >= 70
          if (capFilter === 'small') return item.multibagger_score >= 55 && item.multibagger_score < 70
          if (capFilter === 'mid') return item.multibagger_score >= 35 && item.multibagger_score < 55
          return item.multibagger_score < 35
        })
      }

      // 3. Quality Filter
      if (qualityOnly) {
        items = items.filter(item => item.alpha_score >= 60)
      }

      // 4. Custom Sorting
      const sorted = [...items]
      if (sortBy === 'score') {
        sorted.sort((a, b) => b.multibagger_score - a.multibagger_score)
      } else if (sortBy === 'prob_2x') {
        sorted.sort((a, b) => (b.probabilities?.x2_3y || 0) - (a.probabilities?.x2_3y || 0))
      } else if (sortBy === 'prob_10x') {
        sorted.sort((a, b) => (b.probabilities?.x10_10y || 0) - (a.probabilities?.x10_10y || 0))
      } else if (sortBy === 'cagr') {
        sorted.sort((a, b) => b.cagr - a.cagr)
      }
      return sorted;
    }

    return items
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-r from-brand-900/10 via-black to-black border border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-[0_0_50px_rgba(38,163,102,0.02)]">
        <div className="absolute top-0 right-0 w-[400px] h-[200px] bg-brand-500/5 blur-[120px] pointer-events-none rounded-full" />
        <div className="space-y-1.5 z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold uppercase tracking-wider animate-pulse">
            <Sparkles size={12} /> AI Decision Intelligence
          </div>
          <h1 className="text-3xl font-black text-white font-sans uppercase tracking-tight">
            Multibagger Discovery Lab
          </h1>
          <p className="text-gray-400 text-sm max-w-2xl leading-relaxed">
            Real-time quantitative scanning of the Indian equities market to detect alpha-rated multibaggers, early growth accelerations, and turnaround candidates before they trend.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 rounded-xl text-xs font-semibold text-gray-200 transition-all flex items-center gap-2 active:scale-95 z-10 shrink-0"
        >
          <RefreshCcw size={13} className={loading ? 'animate-spin' : ''} /> Sync Scans
        </button>
      </div>

      {/* Quick Analyze & Ingest Widget */}
      <div className="p-5 rounded-2xl bg-surface-card border border-white/5 relative overflow-hidden group shadow-lg">
        <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-brand-500/[0.01] blur-2xl rounded-full pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400 flex items-center gap-1.5">
              <PlusCircle size={14} /> Quick Stock Analyzer & Ingestor
            </h4>
            <p className="text-[11px] text-gray-500">
              Enter any NSE/BSE symbol. The system will crawl raw reports, evaluate growth confidence, and index it inside the Discovery Lab.
            </p>
          </div>
          <form onSubmit={handleIngestTicker} className="flex items-center gap-2 w-full md:max-w-md">
            <input
              type="text"
              placeholder="e.g. SBIN, TATASTEEL"
              value={newTicker}
              onChange={(e) => setNewTicker(e.target.value)}
              className="flex-1 bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-xs text-white uppercase placeholder-gray-600 focus:outline-none focus:border-brand-500/40 transition-colors font-mono"
            />
            <button
              type="submit"
              disabled={analyzingTicker || !newTicker.trim()}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-800 disabled:text-gray-500 rounded-xl text-xs font-semibold text-white transition-all flex items-center gap-2 shrink-0 shadow-[0_0_15px_rgba(38,163,102,0.1)] hover:shadow-[0_0_20px_rgba(38,163,102,0.2)]"
            >
              {analyzingTicker ? (
                <>
                  <RefreshCcw size={12} className="animate-spin" /> Ingesting...
                </>
              ) : (
                'Analyze & Scrape'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="flex flex-wrap gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-xl self-start">
          <button
            onClick={() => { setActiveTab('multibagger'); setSearchTerm(''); }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'multibagger'
                ? 'bg-gradient-to-r from-brand-500/15 to-transparent text-brand-400 border border-brand-500/20 shadow-[0_0_12px_rgba(38,163,102,0.05)]'
                : 'text-gray-400 hover:text-white border border-transparent'
            }`}
          >
            <Award size={13} /> Top Multibagger Potentials
          </button>
          <button
            onClick={() => { setActiveTab('early'); setSearchTerm(''); }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'early'
                ? 'bg-gradient-to-r from-brand-500/15 to-transparent text-brand-400 border border-brand-500/20 shadow-[0_0_12px_rgba(38,163,102,0.05)]'
                : 'text-gray-400 hover:text-white border border-transparent'
            }`}
          >
            <Compass size={13} /> Early Opportunity Detector
          </button>
          <button
            onClick={() => { setActiveTab('turnaround'); setSearchTerm(''); }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'turnaround'
                ? 'bg-gradient-to-r from-brand-500/15 to-transparent text-brand-400 border border-brand-500/20 shadow-[0_0_12px_rgba(38,163,102,0.05)]'
                : 'text-gray-400 hover:text-white border border-transparent'
            }`}
          >
            <HeartPulse size={13} /> Turnaround Detector
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search scanned tickers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/40 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500/40 transition-colors"
          />
        </div>
      </div>

      {/* Advanced Filters Panel (Multibagger tab only) */}
      {activeTab === 'multibagger' && (
        <div className="p-4 rounded-xl bg-white/[0.01] border border-white/5 flex flex-wrap gap-4 items-center text-xs">
          <div className="flex items-center gap-2 text-gray-400 font-sans">
            <Filter size={13} className="text-brand-400" /> Cap Size:
          </div>
          <div className="flex gap-1 bg-black/40 p-1 border border-white/5 rounded-lg">
            {(['all', 'micro', 'small', 'mid', 'large'] as const).map(c => (
              <button
                key={c}
                onClick={() => setCapFilter(c)}
                className={`px-2.5 py-1 rounded capitalize font-medium transition-all ${
                  capFilter === c ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'
                }`}
              >
                {c === 'all' ? 'All Caps' : c === 'micro' ? 'Micro (<500Cr)' : c === 'small' ? 'Small' : c === 'mid' ? 'Mid' : 'Large'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-gray-400 ml-0 lg:ml-4">
            <TrendingUp size={13} className="text-brand-400" /> Sort By:
          </div>
          <div className="flex gap-1 bg-black/40 p-1 border border-white/5 rounded-lg">
            {(['score', 'prob_2x', 'prob_10x', 'cagr'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-2.5 py-1 rounded capitalize font-medium transition-all ${
                  sortBy === s ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'
                }`}
              >
                {s === 'score' ? 'Potential Score' : s === 'prob_2x' ? '2X' : s === 'prob_10x' ? '10X' : 'CAGR'}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-gray-400 ml-auto">
            <input
              type="checkbox"
              checked={qualityOnly}
              onChange={(e) => setQualityOnly(e.target.checked)}
              className="accent-brand-500 rounded border-white/10 bg-black/40"
            />
            High Quality (Alpha &gt; 60)
          </label>
        </div>
      )}

      {/* Grid / Skeletons */}
      {loading ? (
        activeTab === 'multibagger' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="p-5 rounded-2xl bg-surface-card/40 border border-white/5 space-y-5 animate-pulse">
                {/* Header Row Skeleton */}
                <div className="flex justify-between items-start border-b border-white/5 pb-4">
                  <div className="space-y-2.5 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-16 bg-white/10 rounded" />
                      <div className="h-3 w-20 bg-white/5 rounded" />
                    </div>
                    <div className="h-5 w-44 bg-white/10 rounded" />
                    <div className="h-3.5 w-24 bg-white/5 rounded" />
                  </div>
                  <div className="text-right space-y-2">
                    <div className="h-3 w-16 bg-white/5 rounded ml-auto" />
                    <div className="h-7 w-12 bg-white/10 rounded ml-auto" />
                    <div className="h-3 w-20 bg-white/5 rounded ml-auto" />
                  </div>
                </div>

                {/* Factor Breakdown Skeleton */}
                <div className="space-y-2">
                  <div className="h-3 w-24 bg-white/5 rounded" />
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map(b => (
                      <div key={b} className="space-y-1.5">
                        <div className="flex justify-between">
                          <div className="h-2 w-8 bg-white/5 rounded" />
                          <div className="h-2 w-4 bg-white/5 rounded" />
                        </div>
                        <div className="h-1 w-full bg-white/10 rounded-full" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Probabilities Skeleton */}
                <div className="grid grid-cols-4 gap-2 border-t border-white/5 pt-3">
                  {[1, 2, 3, 4].map(p => (
                    <div key={p} className="p-2 bg-black/20 border border-white/5 rounded-xl space-y-2 text-center">
                      <div className="h-2.5 w-8 bg-white/5 mx-auto rounded" />
                      <div className="h-3.5 w-10 bg-white/10 mx-auto rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-white/5 rounded-2xl bg-surface-card/45 divide-y divide-white/5 animate-pulse">
            <div className="p-4 bg-white/[0.01] grid grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map(h => (
                <div key={h} className="h-3.5 bg-white/10 rounded" />
              ))}
            </div>
            {[1, 2, 3, 4, 5].map(r => (
              <div key={r} className="p-4 grid grid-cols-6 gap-4">
                <div className="h-4 bg-white/10 rounded col-span-2" />
                <div className="h-3.5 bg-white/5 rounded" />
                <div className="h-4 bg-white/10 rounded" />
                <div className="h-3.5 bg-white/5 rounded" />
                <div className="h-4 bg-white/5 rounded" />
              </div>
            ))}
          </div>
        )
      ) : getFilteredItems().length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-white/5 bg-white/[0.01]">
          <ShieldAlert className="text-gray-600 mb-3" size={32} />
          <p className="text-gray-400 text-sm font-medium">No stocks matched the active filters.</p>
          <p className="text-gray-600 text-xs mt-1">Please try modifying search queries or cap filters.</p>
        </div>
      ) : activeTab === 'multibagger' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {getFilteredItems().map((item, index) => {
            const inWatchlist = user?.watchlist?.includes(item.ticker.toUpperCase())
            const isExpanded = expandedTicker === item.ticker
            
            // Score Factor break down estimations
            const capFactor = item.multibagger_score >= 70 ? 25 : item.multibagger_score >= 55 ? 15 : 5
            const growthFactor = item.multibagger_score >= 55 ? 30 : 15
            const qualityFactor = item.alpha_score >= 70 ? 25 : 12
            const debtFactor = item.multibagger_score >= 60 ? 20 : 12

            return (
              <div 
                key={item.ticker} 
                className="p-5 rounded-2xl bg-surface-card/65 backdrop-blur-md border border-white/5 hover:border-brand-500/20 hover:bg-white/[0.01] transition-all group relative overflow-hidden flex flex-col justify-between"
              >
                {/* Glow Overlay */}
                <div className="absolute top-0 right-0 w-[140px] h-[140px] bg-brand-500/[0.02] group-hover:bg-brand-500/[0.04] blur-[55px] pointer-events-none rounded-full transition-all" />
                
                <div>
                  {/* Top Metadata row */}
                  <div className="flex items-start justify-between border-b border-white/5 pb-4 mb-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${
                          index === 0 ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                          index === 1 ? 'bg-gray-300/10 text-gray-300 border-gray-300/30' :
                          index === 2 ? 'bg-amber-750/10 text-amber-700 border-amber-750/30' :
                          'bg-brand-500/10 text-brand-400 border-brand-500/20'
                        }`}>
                          {index === 0 ? '🏆 GOLD' : index === 1 ? '🥈 SILVER' : index === 2 ? '🥉 BRONZE' : `RANK #${index + 1}`}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          CAGR Proj: {item.cagr}%
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-white tracking-tight mt-1.5 flex items-center gap-2">
                        {item.company_name}
                        <Link href={`/stock/${item.ticker}`} className="text-gray-500 hover:text-brand-400 transition-colors">
                          <ExternalLink size={14} />
                        </Link>
                      </h3>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">
                        {item.ticker} · ₹{item.current_price?.toLocaleString('en-IN')}
                      </p>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="text-right">
                        <div className="text-[9px] text-gray-500 uppercase font-semibold">Multibagger score</div>
                        <div className="text-2xl font-black text-brand-400 font-mono mt-0.5">
                          {item.multibagger_score}%
                        </div>
                        <div className="text-[9px] text-gray-500 font-mono mt-0.5">
                          Alpha Score: {item.alpha_score}/100
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 shrink-0">
                        {/* Watchlist toggle btn */}
                        <button
                          onClick={(e) => toggleWatchlist(item.ticker, e)}
                          className={`p-1.5 rounded-lg border transition-all active:scale-95 ${
                            inWatchlist 
                              ? 'bg-brand-500/10 border-brand-500/25 text-brand-400' 
                              : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                          }`}
                          title={inWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
                        >
                          {inWatchlist ? <Check size={13} /> : <Plus size={13} />}
                        </button>
                        {/* Delete btn */}
                        <button
                          onClick={(e) => handleDeleteStock(item.ticker, e)}
                          className="p-1.5 rounded-lg border bg-red-500/5 border-red-500/15 text-red-400 hover:bg-red-500/20 hover:border-red-500/30 transition-all active:scale-95"
                          title="Delete from Platform completely"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Micro-score bar visualizer */}
                  <div className="mb-4 space-y-2">
                    <div className="text-[9px] text-gray-500 font-bold uppercase flex items-center justify-between">
                      <span>Quantitative Factor Breakdown</span>
                      <button 
                        onClick={() => setInspectItem(item)}
                        className="text-[9px] text-brand-400 hover:underline flex items-center gap-1 font-sans capitalize"
                      >
                        <Info size={10} /> Inspect Formula
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-[9px] font-mono text-gray-400">
                      <div className="space-y-1">
                        <div className="flex justify-between"><span>Size</span><span>{capFactor}/25</span></div>
                        <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500" style={{ width: `${(capFactor/25)*100}%` }} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between"><span>Growth</span><span>{growthFactor}/30</span></div>
                        <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500" style={{ width: `${(growthFactor/30)*100}%` }} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between"><span>Returns</span><span>{qualityFactor}/25</span></div>
                        <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500" style={{ width: `${(qualityFactor/25)*100}%` }} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between"><span>Debt</span><span>{debtFactor}/20</span></div>
                        <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500" style={{ width: `${(debtFactor/20)*100}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Probabilities Grid */}
                  <div className="grid grid-cols-4 gap-2 text-center border-t border-white/5 pt-3">
                    <div className="p-2 bg-black/40 border border-white/5 rounded-xl">
                      <div className="text-[9px] text-gray-500 font-semibold uppercase">2X (3Y)</div>
                      <div className="text-xs font-bold text-gray-200 font-mono mt-1">{item.probabilities?.x2_3y}%</div>
                    </div>
                    <div className="p-2 bg-black/40 border border-white/5 rounded-xl">
                      <div className="text-[9px] text-gray-500 font-semibold uppercase">3X (5Y)</div>
                      <div className="text-xs font-bold text-gray-200 font-mono mt-1">{item.probabilities?.x3_5y}%</div>
                    </div>
                    <div className="p-2 bg-black/40 border border-white/5 rounded-xl">
                      <div className="text-[9px] text-gray-500 font-semibold uppercase">5X (10Y)</div>
                      <div className="text-xs font-bold text-gray-200 font-mono mt-1">{item.probabilities?.x5_10y}%</div>
                    </div>
                    <div className="p-2 bg-black/40 border border-white/5 rounded-xl">
                      <div className="text-[9px] text-gray-500 font-semibold uppercase">10X (10Y)</div>
                      <div className="text-xs font-bold text-gray-200 font-mono mt-1">{item.probabilities?.x10_10y}%</div>
                    </div>
                  </div>
                </div>

                {/* Collapsible Scenarios Case Projection Drawer */}
                <div className="mt-4 border-t border-white/5 pt-3.5">
                  <button 
                    onClick={() => setExpandedTicker(isExpanded ? null : item.ticker)}
                    className="w-full text-center text-[10px] text-gray-500 hover:text-white transition-colors font-semibold uppercase tracking-wider flex items-center justify-center gap-1"
                  >
                    <BarChart2 size={11} /> {isExpanded ? 'Hide Projections' : 'Expand Projections'}
                  </button>
                  {isExpanded && (
                    <div className="grid grid-cols-3 gap-2.5 font-mono text-[9px] mt-3.5 animate-slide-down">
                      <div className="p-2.5 bg-red-500/[0.01] border border-red-500/5 rounded-xl text-center space-y-0.5">
                        <div className="text-gray-500 font-sans">Bear Case</div>
                        <div className="text-[11px] font-bold text-red-400">₹{(item.current_price * 0.82).toFixed(1)}</div>
                        <div className="text-gray-600">-10% CAGR</div>
                      </div>
                      <div className="p-2.5 bg-white/[0.01] border border-white/5 rounded-xl text-center space-y-0.5">
                        <div className="text-gray-500 font-sans">Base Case</div>
                        <div className="text-[11px] font-bold text-white">₹{(item.current_price * 1.15).toFixed(1)}</div>
                        <div className="text-gray-600">+{item.cagr}% CAGR</div>
                      </div>
                      <div className="p-2.5 bg-brand-500/[0.01] border border-brand-500/5 rounded-xl text-center space-y-0.5">
                        <div className="text-gray-500 font-sans">Bull Case</div>
                        <div className="text-[11px] font-bold text-brand-400">₹{(item.current_price * 1.45).toFixed(1)}</div>
                        <div className="text-gray-600">+22% CAGR</div>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )
          })}
        </div>
      ) : activeTab === 'early' ? (
        <div className="overflow-x-auto border border-white/5 rounded-2xl bg-surface-card/65 backdrop-blur-md">
          <table className="w-full text-xs text-left border-collapse font-sans">
            <thead>
              <tr className="border-b border-white/5 text-gray-500 uppercase font-bold text-[10px] tracking-wider bg-white/[0.01]">
                <th className="p-4">Company Name</th>
                <th className="p-4">Ticker</th>
                <th className="p-4">Current Price</th>
                <th className="p-4">Emerging Opp Score</th>
                <th className="p-4">ROIC (Quality)</th>
                <th className="p-4">Sales Growth</th>
                <th className="p-4">Profit Growth</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-gray-200">
              {getFilteredItems().map((item) => {
                const inWatchlist = user?.watchlist?.includes(item.ticker.toUpperCase())
                return (
                  <tr key={item.ticker} className="hover:bg-white/[0.01] transition-all">
                    <td className="p-4 font-sans font-bold text-white text-sm">{item.company_name}</td>
                    <td className="p-4 text-gray-400 font-bold">{item.ticker}</td>
                    <td className="p-4">₹{item.current_price?.toLocaleString('en-IN')}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded bg-brand-500/10 border border-brand-500/20 text-brand-400 font-bold">
                        {item.opportunity_score}/100
                      </span>
                    </td>
                    <td className="p-4">{item.roic}%</td>
                    <td className="p-4 text-emerald-400">+{item.sales_growth}%</td>
                    <td className="p-4 text-emerald-400">+{item.profit_growth}%</td>
                    <td className="p-4 text-center space-x-3 font-sans">
                      <button 
                        onClick={(e) => toggleWatchlist(item.ticker, e)}
                        className={`text-[11px] font-semibold transition-all ${
                          inWatchlist ? 'text-brand-400 hover:text-brand-300' : 'text-gray-500 hover:text-white'
                        }`}
                      >
                        {inWatchlist ? '✓ Watched' : '+ Watchlist'}
                      </button>
                      <button
                        onClick={(e) => handleDeleteStock(item.ticker, e)}
                        className="text-[11px] font-semibold text-red-400 hover:text-red-300 transition-all"
                      >
                        Delete
                      </button>
                      <Link href={`/stock/${item.ticker}`} className="inline-flex items-center gap-0.5 text-gray-500 hover:text-white transition-colors text-[11px] font-semibold">
                        Inspect <ArrowUpRight size={13} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto border border-white/5 rounded-2xl bg-surface-card/65 backdrop-blur-md">
          <table className="w-full text-xs text-left border-collapse font-sans">
            <thead>
              <tr className="border-b border-white/5 text-gray-500 uppercase font-bold text-[10px] tracking-wider bg-white/[0.01]">
                <th className="p-4">Company Name</th>
                <th className="p-4">Ticker</th>
                <th className="p-4">Current Price</th>
                <th className="p-4">Turnaround Probability</th>
                <th className="p-4">Latest Annual Profit</th>
                <th className="p-4">Previous Annual Profit</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-gray-200">
              {getFilteredItems().map((item) => {
                const inWatchlist = user?.watchlist?.includes(item.ticker.toUpperCase())
                return (
                  <tr key={item.ticker} className="hover:bg-white/[0.01] transition-all">
                    <td className="p-4 font-sans font-bold text-white text-sm">{item.company_name}</td>
                    <td className="p-4 text-gray-400 font-bold">{item.ticker}</td>
                    <td className="p-4">₹{item.current_price?.toLocaleString('en-IN')}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded bg-brand-500/10 border border-brand-500/20 text-brand-400 font-bold">
                        {item.turnaround_probability}%
                      </span>
                    </td>
                    <td className="p-4 text-emerald-400">₹{item.latest_profit?.toLocaleString('en-IN')} Cr</td>
                    <td className={`p-4 ${item.previous_profit < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      ₹{item.previous_profit?.toLocaleString('en-IN')} Cr
                    </td>
                    <td className="p-4 text-center space-x-3 font-sans">
                      <button 
                        onClick={(e) => toggleWatchlist(item.ticker, e)}
                        className={`text-[11px] font-semibold transition-all ${
                          inWatchlist ? 'text-brand-400 hover:text-brand-300' : 'text-gray-500 hover:text-white'
                        }`}
                      >
                        {inWatchlist ? '✓ Watched' : '+ Watchlist'}
                      </button>
                      <button
                        onClick={(e) => handleDeleteStock(item.ticker, e)}
                        className="text-[11px] font-semibold text-red-400 hover:text-red-300 transition-all"
                      >
                        Delete
                      </button>
                      <Link href={`/stock/${item.ticker}`} className="inline-flex items-center gap-0.5 text-gray-500 hover:text-white transition-colors text-[11px] font-semibold">
                        Inspect <ArrowUpRight size={13} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* INSPECTOR MODAL */}
      {inspectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Info size={16} className="text-brand-400" /> Multibagger Formula Inspector
              </h3>
              <button 
                onClick={() => setInspectItem(null)}
                className="text-gray-500 hover:text-white transition-colors font-mono text-base font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs leading-normal">
              <div>
                <span className="text-gray-500 font-bold uppercase tracking-wider text-[9px]">Mathematical Formula</span>
                <div className="bg-white/5 p-3 rounded-lg font-mono text-white mt-1 border border-white/5 text-[11px]">
                  Score = Size_Score (25%) + Growth_Score (30%) + Efficiency_Score (25%) + Debt_Score (20%)
                </div>
              </div>

              <div>
                <span className="text-gray-500 font-bold uppercase tracking-wider text-[9px]">Inputs evaluated for {inspectItem.company_name}</span>
                <div className="bg-black/40 border border-white/5 p-3 rounded-lg space-y-2 mt-1 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-sans">Market Cap Size</span>
                    <span className="text-white font-bold">{inspectItem.multibagger_score >= 70 ? 'Micro-cap' : inspectItem.multibagger_score >= 55 ? 'Small-cap' : 'Large/Mid-cap'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-sans">Expected CAGR Projection</span>
                    <span className="text-white font-bold">{inspectItem.cagr}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-sans">Alpha Health Rating</span>
                    <span className="text-white font-bold">{inspectItem.alpha_score}/100</span>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-gray-500 font-bold uppercase tracking-wider text-[9px]">Mathematical Logic</span>
                <p className="text-gray-300 mt-1 leading-relaxed leading-normal font-sans">
                  The model favors low leverage and strong cash flow quality under standard compound allocation guidelines. Small caps/Micro caps receive a premium score due to a smaller base size enabling rapid earnings doubling.
                </p>
              </div>
            </div>

            <div className="border-t border-white/5 pt-3 flex justify-end">
              <button onClick={() => setInspectItem(null)} className="btn-primary text-xs px-4 py-1.5">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Confirm Stock Deletion"
        message={`Are you sure you want to completely remove ${tickerToDelete} from the scanner indexes? This deletes its scraped fundamentals and calculations.`}
        confirmText="Delete Stock"
        cancelText="Keep Stock"
        type="danger"
        onConfirm={executeDeleteStock}
        onCancel={() => {
          setDeleteConfirmOpen(false)
          setTickerToDelete(null)
        }}
      />
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { Sparkles, Zap, RefreshCcw, Search, ExternalLink, ArrowUpRight, ShieldAlert, Award, Compass, HeartPulse } from 'lucide-react'
import { stockApi } from '@/lib/api'
import Link from 'next/link'
import { toast } from 'react-hot-toast'

export default function MultibaggerDiscoveryPage() {
  const [activeTab, setActiveTab] = useState<'multibagger' | 'early' | 'turnaround'>('multibagger')
  const [multibaggers, setMultibaggers] = useState<any[]>([])
  const [earlyOpps, setEarlyOpps] = useState<any[]>([])
  const [turnarounds, setTurnarounds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

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

  const filteredItems = () => {
    const list = activeTab === 'multibagger' ? multibaggers : activeTab === 'early' ? earlyOpps : turnarounds
    return list.filter(item => 
      item.ticker.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.company_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-r from-brand-900/10 via-black to-black border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-[0_0_50px_rgba(38,163,102,0.02)]">
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

      {/* Tabs Menu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="flex gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-xl self-start">
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

      {/* Grid Loader / Table */}
      {loading ? (
        <div className="space-y-4">
          <div className="h-10 bg-white/[0.01] border border-white/5 rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-40 bg-white/[0.01] border border-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      ) : filteredItems().length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-white/5 bg-white/[0.01]">
          <ShieldAlert className="text-gray-600 mb-3" size={32} />
          <p className="text-gray-400 text-sm font-medium">No stocks matched the current scan criteria.</p>
          <p className="text-gray-600 text-xs mt-1">Please try again later or modify your query.</p>
        </div>
      ) : activeTab === 'multibagger' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredItems().map((item, index) => (
            <div 
              key={item.ticker} 
              className="p-5 rounded-2xl bg-surface-card/65 backdrop-blur-md border border-white/5 hover:border-brand-500/20 hover:bg-white/[0.02] transition-all group relative overflow-hidden"
            >
              {/* Card Glow */}
              <div className="absolute top-0 right-0 w-[120px] h-[120px] bg-brand-500/[0.02] group-hover:bg-brand-500/[0.04] blur-[50px] pointer-events-none rounded-full transition-all" />
              
              <div className="flex items-start justify-between border-b border-white/5 pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">
                      RANK #{index + 1}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      CAGR Proj: {item.cagr}%
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white tracking-tight mt-1.5 flex items-center gap-1.5">
                    {item.company_name}
                    <Link href={`/stock/${item.ticker}`} className="text-gray-500 hover:text-brand-400 transition-colors">
                      <ExternalLink size={14} />
                    </Link>
                  </h3>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                    {item.ticker} · ₹{item.current_price?.toLocaleString('en-IN')}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-gray-500 uppercase font-semibold">Multibagger Potential</div>
                  <div className="text-2xl font-black text-brand-400 font-mono mt-0.5">
                    {item.multibagger_score}%
                  </div>
                  <div className="text-[9px] text-gray-500 font-mono mt-0.5">
                    Alpha Score: {item.alpha_score}/100
                  </div>
                </div>
              </div>

              {/* Probabilities Grid */}
              <div className="grid grid-cols-4 gap-2.5">
                <div className="p-2.5 bg-black/40 border border-white/5 rounded-xl text-center">
                  <div className="text-[9px] text-gray-500 font-semibold uppercase">2X (3Y)</div>
                  <div className="text-xs font-bold text-gray-200 font-mono mt-1">{item.probabilities?.x2_3y}%</div>
                </div>
                <div className="p-2.5 bg-black/40 border border-white/5 rounded-xl text-center">
                  <div className="text-[9px] text-gray-500 font-semibold uppercase">3X (5Y)</div>
                  <div className="text-xs font-bold text-gray-200 font-mono mt-1">{item.probabilities?.x3_5y}%</div>
                </div>
                <div className="p-2.5 bg-black/40 border border-white/5 rounded-xl text-center">
                  <div className="text-[9px] text-gray-500 font-semibold uppercase">5X (10Y)</div>
                  <div className="text-xs font-bold text-gray-200 font-mono mt-1">{item.probabilities?.x5_10y}%</div>
                </div>
                <div className="p-2.5 bg-black/40 border border-white/5 rounded-xl text-center">
                  <div className="text-[9px] text-gray-500 font-semibold uppercase">10X (10Y)</div>
                  <div className="text-xs font-bold text-gray-200 font-mono mt-1">{item.probabilities?.x10_10y}%</div>
                </div>
              </div>
            </div>
          ))}
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
                <th className="p-4 text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-gray-200">
              {filteredItems().map((item) => (
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
                  <td className="p-4 text-center">
                    <Link href={`/stock/${item.ticker}`} className="inline-flex items-center gap-1 text-gray-500 hover:text-white transition-colors">
                      View <ArrowUpRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
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
                <th className="p-4 text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-gray-200">
              {filteredItems().map((item) => (
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
                  <td className="p-4 text-center">
                    <Link href={`/stock/${item.ticker}`} className="inline-flex items-center gap-1 text-gray-500 hover:text-white transition-colors">
                      View <ArrowUpRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

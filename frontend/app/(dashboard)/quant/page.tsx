'use client'
import { useState, useEffect } from 'react'
import { 
  TrendingUp, Play, Plus, Trash2, Save, Layers, Workflow, 
  Database, Zap, BarChart3, ChevronRight, CheckCircle, Info, AlertTriangle, BookOpen, Search
} from 'lucide-react'
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, 
  CartesianGrid, AreaChart, Area, ScatterChart, Scatter 
} from 'recharts'
import { useAuthStore } from '@/lib/store'
import { quantApi, stockApi, userApi } from '@/lib/api'
import { toast } from 'react-hot-toast'

interface IndicatorRow {
  type: string
  period: number
  condition: string
  value?: number
}

interface TradeLog {
  date: string
  type: string
  price: number
  quantity: number
  value: number
  profit?: number
}

interface BacktestResult {
  ticker: string
  initial_capital: number
  final_equity: number
  total_return_pct: number
  cagr: number
  max_drawdown: number
  sharpe_ratio: number
  sortino_ratio: number
  win_rate: number
  total_trades: number
  trades: TradeLog[]
  equity_curve: any[]
}

// ── Searchable Autocomplete Multi-Select Ticker Input ──────
function TickerSelect({ 
  selected, 
  onChange, 
  placeholder = "Search and add stocks...",
  watchlist = []
}: { 
  selected: string[]
  onChange: (tickers: string[]) => void
  placeholder?: string
  watchlist?: string[]
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    if (query.length < 1) {
      setResults([])
      return
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const { data } = await stockApi.search(query)
        setResults(data)
      } catch {}
    }, 200)
    return () => clearTimeout(delayDebounce)
  }, [query])

  const addTicker = (ticker: string) => {
    const t = ticker.toUpperCase()
    if (!selected.includes(t)) {
      onChange([...selected, t])
    }
    setQuery('')
    setShowDropdown(false)
  }

  const removeTicker = (ticker: string) => {
    onChange(selected.filter(x => x !== ticker))
  }

  return (
    <div className="space-y-1.5 relative text-xs">
      <div className="flex flex-wrap gap-1.5 p-2 bg-black/40 border border-white/5 rounded-xl min-h-[44px] items-center">
        {selected.map(ticker => (
          <span key={ticker} className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg font-mono font-bold text-gray-200">
            {ticker}
            <button 
              type="button" 
              onClick={() => removeTicker(ticker)} 
              className="text-gray-500 hover:text-red-400 font-bold font-sans text-sm focus:outline-none"
            >
              &times;
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setShowDropdown(true) }}
          onFocus={() => setShowDropdown(true)}
          placeholder={selected.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[100px] bg-transparent outline-none border-none text-[11px] font-mono text-white placeholder-gray-600"
        />
        {watchlist.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const merged = Array.from(new Set([...selected, ...watchlist]))
              onChange(merged)
              toast.success('Watchlist tickers imported')
            }}
            className="text-[9px] font-mono bg-brand-500/10 border border-brand-500/20 text-brand-400 hover:bg-brand-500/20 px-2 py-1 rounded-md ml-auto"
          >
            Import Watchlist
          </button>
        )}
      </div>

      {showDropdown && (query.length > 0 || results.length > 0) && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-[#050507] border border-white/10 rounded-xl shadow-2xl z-50 max-h-[160px] overflow-y-auto divide-y divide-white/[0.03]">
          {results.map(r => (
            <button
              key={r.ticker}
              type="button"
              onClick={() => addTicker(r.ticker)}
              className="w-full text-left p-2.5 hover:bg-white/[0.03] flex items-center justify-between text-[11px]"
            >
              <span className="font-bold text-white font-mono">{r.ticker}</span>
              <span className="text-gray-500 font-mono text-[9px]">{r.exchange}</span>
            </button>
          ))}
          {query.length > 0 && !results.some(r => r.ticker === query.toUpperCase()) && (
            <button
              type="button"
              onClick={() => addTicker(query)}
              className="w-full text-left p-2.5 hover:bg-white/[0.03] text-[10px] text-brand-400 font-mono"
            >
              Add custom: "{query.toUpperCase()}"
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Searchable Autocomplete Single-Select Ticker Input ─────
function SingleTickerSelect({ 
  value, 
  onChange, 
  placeholder = "Search stock symbol..." 
}: { 
  value: string
  onChange: (ticker: string) => void
  placeholder?: string
}) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<any[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    if (query.length < 1) {
      setResults([])
      return
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const { data } = await stockApi.search(query)
        setResults(data)
      } catch {}
    }, 200)
    return () => clearTimeout(delayDebounce)
  }, [query])

  const selectTicker = (ticker: string) => {
    onChange(ticker.toUpperCase())
    setQuery(ticker.toUpperCase())
    setShowDropdown(false)
  }

  return (
    <div className="space-y-1 relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setShowDropdown(true) }}
          onFocus={() => setShowDropdown(true)}
          placeholder={placeholder}
          className="w-full bg-black/40 border border-white/5 rounded-lg p-2 font-mono text-white text-xs outline-none focus:border-brand-500 pr-8"
        />
        <Search size={12} className="absolute right-2.5 top-3 text-gray-600" />
      </div>
      {showDropdown && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-[#050507] border border-white/10 rounded-xl shadow-2xl z-50 max-h-[160px] overflow-y-auto divide-y divide-white/[0.03]">
          {results.map(r => (
            <button
              key={r.ticker}
              type="button"
              onClick={() => selectTicker(r.ticker)}
              className="w-full text-left p-2.5 hover:bg-white/[0.03] flex items-center justify-between text-[11px]"
            >
              <span className="font-bold text-white font-mono">{r.ticker}</span>
              <span className="text-gray-500 font-mono text-[9px]">{r.exchange}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function InfoTooltip({ content }: { content: string }) {
  return (
    <span className="group relative inline-block ml-1.5 align-middle cursor-pointer">
      <Info size={12} className="text-gray-500 hover:text-brand-400 transition-colors inline" />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-[#050507] border border-white/10 p-2.5 text-[10px] font-mono text-gray-300 shadow-2xl opacity-0 transition-opacity group-hover:opacity-100 z-50 leading-normal">
        {content}
      </span>
    </span>
  )
}

export default function QuantLabPage() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<string>('backtest')
  const [loading, setLoading] = useState<boolean>(false)
  const [watchlist, setWatchlist] = useState<string[]>([])

  // ── Tab 1: Strategy Backtester States ─────────────────────
  const [btTicker, setBtTicker] = useState<string>('')
  const [btCapital, setBtCapital] = useState<number>(100000)
  const [btRange, setBtRange] = useState<string>('1y')
  const [btLogic, setBtLogic] = useState<string>('AND')
  const [indicators, setIndicators] = useState<IndicatorRow[]>([
    { type: 'RSI', period: 14, condition: 'below', value: 30 },
    { type: 'SMA', period: 50, condition: 'cross_above' }
  ])
  const [btResult, setBtResult] = useState<BacktestResult | null>(null)
  
  // AI strategy builder
  const [aiPrompt, setAiPrompt] = useState<string>('')
  const [generatingAi, setGeneratingAi] = useState<boolean>(false)

  // Strategy Saving Modal
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false)
  const [saveStrategyName, setSaveStrategyName] = useState<string>('')
  const [saveStrategyDesc, setSaveStrategyDesc] = useState<string>('')

  // Exclusive Parameter Sweep States
  const [sweeping, setSweeping] = useState<boolean>(false)
  const [sweepResult, setSweepResult] = useState<any | null>(null)

  // ── Tab 2: Optimizer States ──────────────────────────────
  const [optTickers, setOptTickers] = useState<string[]>([])
  const [optRange, setOptRange] = useState<string>('1y')
  const [optResult, setOptResult] = useState<any | null>(null)

  // ── Tab 3: Rebalance States ──────────────────────────────
  const [holdings, setHoldings] = useState<any[]>([])
  const [rebalanceTargets, setRebalanceTargets] = useState<Record<string, number>>({})
  const [rebalanceResult, setRebalanceResult] = useState<any | null>(null)

  // ── Tab 4: Correlation States ────────────────────────────
  const [corrTickers, setCorrTickers] = useState<string[]>([])
  const [corrRange, setCorrRange] = useState<string>('1y')
  const [corrResult, setCorrResult] = useState<any | null>(null)

  // ── Tab 5: Factor States ─────────────────────────────────
  const [factorTicker, setFactorTicker] = useState<string>('')
  const [factorResult, setFactorResult] = useState<any | null>(null)

  // ── Tab 6: Monte Carlo States ────────────────────────────
  const [mcTickers, setMcTickers] = useState<string[]>([])
  const [mcWeights, setMcWeights] = useState<Record<string, number>>({})
  const [mcCapital, setMcCapital] = useState<number>(100000)
  const [mcDays, setMcDays] = useState<number>(252)
  const [mcResult, setMcResult] = useState<any | null>(null)

  // Exclusive Crisis Stress Testing States
  const [stressScenario, setStressScenario] = useState<string>('lehman_2008')
  const [stressResult, setStressResult] = useState<any | null>(null)
  const [stressing, setStressing] = useState<boolean>(false)

  // ── Tab 7: Marketplace States ────────────────────────────
  const [marketplace, setMarketplace] = useState<any[]>([])

  // ── Initial Data Loading ─────────────────────────────────
  async function loadWatchlist() {
    try {
      const { data } = await userApi.getWatchlist()
      if (data && Array.isArray(data)) {
        const symbols = data.map((x: any) => typeof x === 'string' ? x : x.ticker)
        setWatchlist(symbols)
        
        // Dynamically initialize tab inputs from the watchlist if they exist
        if (symbols.length > 0) {
          setBtTicker(symbols[0])
          setFactorTicker(symbols[0])
          setOptTickers(symbols.slice(0, 5))
          setCorrTickers(symbols.slice(0, 5))
          
          const defaultMc = symbols.slice(0, 3)
          setMcTickers(defaultMc)
          
          const weights: Record<string, number> = {}
          const evenW = Math.round(100 / (defaultMc.length || 1))
          defaultMc.forEach((s, idx) => {
            weights[s] = idx === defaultMc.length - 1 ? 100 - evenW * (defaultMc.length - 1) : evenW
          })
          setMcWeights(weights)
        }
      }
    } catch {}
  }

  async function loadPortfolio() {
    try {
      const { data } = await userApi.getMe()
      if (data && data.portfolio && data.portfolio.length > 0) {
        const imported = data.portfolio.map((p: any) => ({
          ticker: p.ticker,
          quantity: p.quantity,
          current_price: p.current_price || p.buy_price
        }))
        setHoldings(imported)
        
        const evenWeight = 100 / imported.length
        const targets: Record<string, number> = {}
        imported.forEach((p: any) => { targets[p.ticker] = Math.round(evenWeight) })
        setRebalanceTargets(targets)
      }
    } catch {}
  }

  async function fetchMarketplace() {
    try {
      const { data } = await quantApi.getMarketplace()
      setMarketplace(data)
    } catch (e: any) {
      toast.error('Failed to load marketplace strategies')
    }
  }

  useEffect(() => {
    loadWatchlist()
    loadPortfolio()
    fetchMarketplace()
  }, [])

  // ── Backtester Handlers ──────────────────────────────────
  const addIndicatorRow = () => {
    setIndicators(prev => [...prev, { type: 'SMA', period: 20, condition: 'cross_above' }])
  }

  const removeIndicatorRow = (idx: number) => {
    setIndicators(prev => prev.filter((_, i) => i !== idx))
  }

  const updateIndicatorRow = (idx: number, field: keyof IndicatorRow, val: any) => {
    setIndicators(prev => prev.map((ind, i) => i === idx ? { ...ind, [field]: val } : ind))
  }

  const runBacktest = async () => {
    if (!btTicker) {
      toast.error('Please search and select a stock ticker first')
      return
    }
    setLoading(true)
    try {
      const { data } = await quantApi.backtest({
        ticker: btTicker,
        indicators,
        logic: btLogic,
        initial_capital: btCapital,
        range: btRange
      })
      setBtResult(data)
      toast.success('Backtest execution complete')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Backtest failed')
    } finally {
      setLoading(false)
    }
  }

  const runParameterSweep = async () => {
    if (!btTicker) {
      toast.error('Please search and select a stock ticker first')
      return
    }
    setSweeping(true)
    try {
      const { data } = await quantApi.parameterSweep({
        ticker: btTicker,
        indicators,
        logic: btLogic,
        initial_capital: btCapital,
        range: btRange
      })
      setSweepResult(data)
      toast.success('Parameter sweep complete!')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Parameter sweep failed')
    } finally {
      setSweeping(false)
    }
  }

  const runAiStrategyGen = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter a strategy description')
      return
    }
    setGeneratingAi(true)
    try {
      const { data } = await quantApi.generateStrategy(aiPrompt)
      setIndicators(data.indicators)
      setBtLogic(data.logic || 'AND')
      toast.success('AI Quant strategy generated and loaded!')
      setAiPrompt('')
    } catch (e: any) {
      toast.error('AI strategy compilation failed')
    } finally {
      setGeneratingAi(false)
    }
  }

  const saveStrategy = async () => {
    if (!saveStrategyName.trim()) {
      toast.error('Strategy name is required')
      return
    }
    try {
      await quantApi.saveStrategy({
        name: saveStrategyName,
        description: saveStrategyDesc,
        indicators,
        logic: btLogic
      })
      toast.success('Strategy saved to Marketplace')
      setShowSaveModal(false)
      fetchMarketplace()
    } catch (e: any) {
      toast.error('Failed to save strategy')
    }
  }

  // ── Optimizer Handlers ───────────────────────────────────
  const runOptimization = async () => {
    if (optTickers.length < 2) {
      toast.error('Please select at least 2 tickers')
      return
    }
    setLoading(true)
    try {
      const { data } = await quantApi.optimize(optTickers, optRange)
      setOptResult(data)
      toast.success('Portfolio optimization complete')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Optimization failed')
    } finally {
      setLoading(false)
    }
  }

  const loadHoldingsIntoOptimizer = () => {
    if (user?.portfolio && user.portfolio.length > 0) {
      const tickers = user.portfolio.map(p => p.ticker)
      setOptTickers(tickers)
      toast.success('Holdings imported')
    } else {
      toast.error('No portfolio holdings found')
    }
  }

  const applyWeightsToRebalancer = (weights: Record<string, number>) => {
    const newHoldings = Object.keys(weights).map(ticker => {
      const existing = holdings.find(h => h.ticker.toUpperCase() === ticker.toUpperCase())
      return {
        ticker,
        quantity: existing ? existing.quantity : 10,
        current_price: existing ? existing.current_price : 100
      }
    })
    setHoldings(newHoldings)
    setRebalanceTargets(weights)
    setActiveTab('rebalance')
    toast.success('Target weights transferred to Rebalancer')
  }

  // ── Rebalancer Handlers ──────────────────────────────────
  const updateHoldingRow = (idx: number, field: string, val: any) => {
    setHoldings(prev => prev.map((h, i) => i === idx ? { ...h, [field]: val } : h))
  }

  const addHoldingRow = () => {
    setHoldings(prev => [...prev, { ticker: '', quantity: 10, current_price: 100 }])
  }

  const removeHoldingRow = (idx: number) => {
    setHoldings(prev => prev.filter((_, i) => i !== idx))
  }

  const runRebalancer = async () => {
    setLoading(true)
    try {
      const { data } = await quantApi.rebalance({
        holdings,
        target_weights: rebalanceTargets
      })
      setRebalanceResult(data)
      toast.success('Rebalancing suggestions generated')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Rebalancing failed')
    } finally {
      setLoading(false)
    }
  }

  const importHoldingsIntoRebalancer = () => {
    if (user?.portfolio && user.portfolio.length > 0) {
      const imported = user.portfolio.map(p => ({
        ticker: p.ticker,
        quantity: p.quantity,
        current_price: p.current_price || p.buy_price
      }))
      setHoldings(imported)
      
      const evenWeight = 100 / imported.length
      const targets: Record<string, number> = {}
      imported.forEach(p => { targets[p.ticker] = Math.round(evenWeight) })
      setRebalanceTargets(targets)
      toast.success('Holdings imported')
    } else {
      toast.error('No portfolio holdings found')
    }
  }

  // ── Correlation Handlers ─────────────────────────────────
  const runCorrelation = async () => {
    if (corrTickers.length < 2) {
      toast.error('Please select at least 2 tickers')
      return
    }
    setLoading(true)
    try {
      const { data } = await quantApi.correlation(corrTickers, corrRange)
      setCorrResult(data)
      toast.success('Correlation matrix loaded')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to load correlation')
    } finally {
      setLoading(false)
    }
  }

  const loadHoldingsIntoCorrelation = () => {
    if (user?.portfolio && user.portfolio.length > 0) {
      setCorrTickers(user.portfolio.map(p => p.ticker))
      toast.success('Holdings imported')
    } else {
      toast.error('No portfolio holdings found')
    }
  }

  // ── Factor Handlers ──────────────────────────────────────
  const runFactors = async () => {
    if (!factorTicker) {
      toast.error('Please search and select a stock ticker first')
      return
    }
    setLoading(true)
    try {
      const { data } = await quantApi.factors(factorTicker)
      setFactorResult(data)
      toast.success('Asset factor scores computed')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Factor scan failed')
    } finally {
      setLoading(false)
    }
  }

  // ── Monte Carlo Handlers ─────────────────────────────────
  const runMonteCarlo = async () => {
    if (mcTickers.length < 1) {
      toast.error('Please select at least 1 ticker')
      return
    }

    // Validate weights sum
    const totalWeights = Object.values(mcWeights).reduce((a, b) => a + b, 0)
    if (Math.abs(totalWeights - 100) > 0.1) {
      toast.error(`Weights must sum to 100% (currently ${totalWeights}%)`)
      return
    }

    setLoading(true)
    try {
      const { data } = await quantApi.monteCarlo({
        tickers: mcTickers,
        weights: mcWeights,
        initial_value: mcCapital,
        days: mcDays,
        simulations: 1000,
        range: '1y'
      })
      setMcResult(data)
      toast.success('Monte Carlo simulation paths complete')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Simulation failed')
    } finally {
      setLoading(false)
    }
  }

  const runStressTest = async () => {
    if (mcTickers.length < 1) {
      toast.error('Please select at least 1 ticker')
      return
    }

    const totalWeights = Object.values(mcWeights).reduce((a, b) => a + b, 0)
    if (Math.abs(totalWeights - 100) > 0.1) {
      toast.error(`Weights must sum to 100% (currently ${totalWeights}%)`)
      return
    }

    setStressing(true)
    try {
      const { data } = await quantApi.stressTest({
        tickers: mcTickers,
        weights: mcWeights,
        scenario: stressScenario,
        initial_value: mcCapital,
        days: mcDays,
        simulations: 1000,
        range: '1y'
      })
      setStressResult(data)
      toast.success('Crisis stress test complete!')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Stress testing failed')
    } finally {
      setStressing(false)
    }
  }

  const loadHoldingsIntoMonteCarlo = () => {
    if (user?.portfolio && user.portfolio.length > 0) {
      const tickers = user.portfolio.map(p => p.ticker)
      setMcTickers(tickers)
      
      const evenWeight = 100 / tickers.length
      const w: Record<string, number> = {}
      tickers.forEach(t => { w[t] = Math.round(evenWeight) })
      setMcWeights(w)
      toast.success('Holdings imported')
    } else {
      toast.error('No portfolio holdings found')
    }
  }

  const loadStrategyFromMarketplace = (strategy: any) => {
    setIndicators(strategy.indicators)
    setBtLogic(strategy.logic || 'AND')
    setActiveTab('backtest')
    toast.success(`Loaded strategy: ${strategy.name}`)
  }

  return (
    <div className="space-y-6 pb-12 animate-fade-in text-white">
      {/* Title */}
      <div className="border-b border-surface-border/50 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="text-brand-400" /> Quant Lab & Backtester
          </h1>
          <p className="text-gray-500 text-xs mt-1">Institutional-grade portfolio optimizer, backtesting engine, and risk simulator</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-surface-border/50 pb-px text-xs font-mono font-bold">
        {[
          { id: 'backtest', label: 'Strategy Backtester', icon: Play },
          { id: 'optimize', label: 'Portfolio Optimizer', icon: Workflow },
          { id: 'rebalance', label: 'Smart Rebalancer', icon: Layers },
          { id: 'correlation', label: 'Correlation Heatmap', icon: Database },
          { id: 'factors', label: 'Factor Scanner', icon: Zap },
          { id: 'montecarlo', label: 'Monte Carlo Forecast', icon: BarChart3 },
          { id: 'marketplace', label: 'Marketplace', icon: BookOpen }
        ].map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all ${
                active 
                  ? 'border-brand-500 text-brand-300 bg-brand-500/5' 
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="p-12 text-center bg-black/40 border border-white/5 rounded-2xl animate-pulse text-brand-400 font-mono text-xs">
          <TrendingUp className="mx-auto animate-bounce mb-3 text-brand-500" size={24} />
          EXECUTING QUANT CALCULATION ENGINES...
        </div>
      )}

      {!loading && (
        <div className="space-y-6">

          {/* ── TAB 1: STRATEGY BACKTESTER ───────────────────────── */}
          {activeTab === 'backtest' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Configuration panel */}
              <div className="lg:col-span-4 space-y-4">
                {/* Quant Copilot Prompt Box */}
                <div className="card bg-gradient-to-br from-brand-500/[0.02] to-transparent border-brand-500/10 p-5 space-y-3 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-full blur-2xl pointer-events-none" />
                  <div className="flex items-center gap-2 text-xs font-bold text-brand-300 uppercase tracking-wider">
                    <Zap size={14} className="text-brand-400 animate-pulse" /> Quant Copilot AI Gen
                  </div>
                  <p className="text-[10px] text-gray-500 leading-normal">
                    Describe your strategy in plain English to automatically configure indicators and threshold signals.
                  </p>
                  <textarea
                    rows={2}
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder="e.g., Buy when RSI goes below 25 and price crosses above SMA 50. Sell when RSI is above 75."
                    className="w-full bg-black/40 border border-white/5 rounded-lg p-2 font-mono text-[10px] text-white outline-none focus:border-brand-500 resize-none"
                  />
                  <button
                    onClick={runAiStrategyGen}
                    disabled={generatingAi}
                    className="w-full p-2 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/25 text-brand-300 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    {generatingAi ? 'Compiling rules...' : 'Generate Rules with AI'}
                  </button>
                </div>

                <div className="card bg-white/[0.01] border-white/5 p-5 space-y-4">
                  <div className="border-b border-white/5 pb-2.5">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      Backtest Settings
                      <InfoTooltip content="Backtest your technical strategies against historical daily stock prices. Configure buy/sell rules based on RSI, SMA, EMA, MACD, or Bollinger Bands and analyze CAGR, Sharpe, Sortino, and drawdown profiles." />
                    </h3>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    {watchlist.length === 0 && (
                      <div className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg font-mono leading-normal">
                        Your watchlist is currently empty. You can search and add any dynamic symbol (e.g. AAPL, BTC-USD, or RELIANCE) below, or add stocks to your watchlist to load them here automatically.
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-gray-500 font-semibold">Ticker Symbol</label>
                      <SingleTickerSelect 
                        value={btTicker} 
                        onChange={setBtTicker} 
                        placeholder="Search stock..." 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-gray-500 font-semibold">Initial Capital</label>
                        <input 
                          type="number" 
                          value={btCapital} 
                          onChange={e => setBtCapital(Number(e.target.value))}
                          className="w-full bg-black/40 border border-white/5 rounded-lg p-2 font-mono text-white outline-none focus:border-brand-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-500 font-semibold">Test Range</label>
                        <select 
                          value={btRange} 
                          onChange={e => setBtRange(e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-lg p-2 font-mono text-white outline-none focus:border-brand-500 cursor-pointer"
                        >
                          <option value="3mo">3 Months</option>
                          <option value="6mo">6 Months</option>
                          <option value="1y">1 Year</option>
                          <option value="2y">2 Years</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-gray-500 font-semibold">Logic Gate</label>
                      <select 
                        value={btLogic} 
                        onChange={e => setBtLogic(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-lg p-2 font-mono text-white outline-none focus:border-brand-500 cursor-pointer"
                      >
                        <option value="AND">All Conditions must match (AND)</option>
                        <option value="OR">Any Condition matches (OR)</option>
                      </select>
                    </div>

                    {/* Indicator rows */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-b border-white/5 pb-1">
                        <label className="text-gray-500 font-semibold">Indicators & Rules</label>
                        <button onClick={addIndicatorRow} className="text-[10px] text-brand-400 font-bold hover:underline flex items-center gap-1">
                          <Plus size={10} /> Add Rule
                        </button>
                      </div>

                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {indicators.map((ind, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-black border border-white/5 space-y-2 relative group">
                            <button onClick={() => removeIndicatorRow(idx)} className="absolute top-2 right-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 size={12} />
                            </button>
                            <div className="grid grid-cols-2 gap-2">
                              <select 
                                value={ind.type} 
                                onChange={e => updateIndicatorRow(idx, 'type', e.target.value)}
                                className="bg-white/5 border border-white/5 rounded p-1 text-[10px] outline-none"
                              >
                                <option value="RSI">RSI</option>
                                <option value="SMA">SMA</option>
                                <option value="EMA">EMA</option>
                                <option value="MACD">MACD</option>
                                <option value="BB">Bollinger Bands</option>
                              </select>
                              <input 
                                type="number" 
                                placeholder="Period"
                                value={ind.period} 
                                onChange={e => updateIndicatorRow(idx, 'period', Number(e.target.value))}
                                className="bg-white/5 border border-white/5 rounded p-1 text-[10px] outline-none text-center"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <select 
                                value={ind.condition} 
                                onChange={e => updateIndicatorRow(idx, 'condition', e.target.value)}
                                className="bg-white/5 border border-white/5 rounded p-1 text-[10px] outline-none"
                              >
                                <option value="below">Less Than (&lt;)</option>
                                <option value="above">Greater Than (&gt;)</option>
                                <option value="cross_above">Crosses Above</option>
                                <option value="cross_below">Crosses Below</option>
                              </select>
                              {ind.type === 'RSI' && (
                                <input 
                                  type="number" 
                                  placeholder="Value" 
                                  value={ind.value || ''}
                                  onChange={e => updateIndicatorRow(idx, 'value', Number(e.target.value))}
                                  className="bg-white/5 border border-white/5 rounded p-1 text-[10px] outline-none text-center"
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button 
                        onClick={runBacktest}
                        className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 border border-brand-500/20 font-bold transition-all text-white text-xs"
                      >
                        <Play size={12} fill="white" /> Execute Backtest
                      </button>
                      <button 
                        onClick={runParameterSweep}
                        disabled={sweeping}
                        className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 border border-purple-500/20 font-bold transition-all text-white text-xs disabled:opacity-50"
                      >
                        <Layers size={12} /> {sweeping ? 'Sweeping...' : 'Param Sweep'}
                      </button>
                    </div>

                    {btResult && (
                      <button 
                        onClick={() => setShowSaveModal(true)}
                        className="w-full flex items-center justify-center gap-2 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold transition-all text-xs"
                      >
                        <Save size={12} /> Save Strategy Template
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Outputs panel */}
              <div className="lg:col-span-8 space-y-6">
                {!btResult ? (
                  <div className="card bg-white/[0.01] border-white/5 p-12 text-center space-y-3">
                    <Info className="mx-auto text-gray-500" size={24} />
                    <h3 className="text-sm font-bold text-white font-mono">No Backtest Results Ready</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">Set up your ticker symbol, indicator conditions, or use the AI generator on the side panel to trigger the backtest execution.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Performance metrics grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: 'Ending Equity', value: `Rs. ${btResult.final_equity.toLocaleString()}`, color: 'text-brand-300' },
                        { label: 'Total Return', value: `${btResult.total_return_pct}%`, color: btResult.total_return_pct >= 0 ? 'text-brand-400' : 'text-red-400' },
                        { label: 'CAGR', value: `${btResult.cagr}%`, color: btResult.cagr >= 0 ? 'text-brand-400' : 'text-red-400' },
                        { label: 'Max Drawdown', value: `-${btResult.max_drawdown}%`, color: 'text-red-400' },
                        { label: 'Sharpe Ratio', value: btResult.sharpe_ratio, color: 'text-brand-300' },
                        { label: 'Sortino Ratio', value: btResult.sortino_ratio, color: 'text-brand-300' },
                        { label: 'Win Rate', value: `${btResult.win_rate}%`, color: 'text-brand-300' },
                        { label: 'Total Trades', value: btResult.total_trades, color: 'text-gray-300' }
                      ].map((item, idx) => (
                        <div key={idx} className="p-3 bg-white/[0.01] border border-white/5 rounded-xl space-y-1">
                          <div className="text-[10px] text-gray-500 font-semibold uppercase">{item.label}</div>
                          <div className={`text-base font-bold font-mono ${item.color}`}>{item.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Chart: Equity curve */}
                    <div className="card bg-white/[0.01] border-white/5 p-5 space-y-4">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Equity Curve Performance</h4>
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={btResult.equity_curve}>
                            <defs>
                              <linearGradient id="eqGlow" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#26a366" stopOpacity={0.25}/>
                                <stop offset="95%" stopColor="#26a366" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#121214" vertical={false} />
                            <XAxis dataKey="date" stroke="#4b5563" fontSize={10} tickLine={false} />
                            <YAxis stroke="#4b5563" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
                            <Tooltip contentStyle={{ backgroundColor: '#050507', borderColor: '#121214', borderRadius: '8px' }} labelStyle={{ color: '#9ca3af' }} />
                            <Area type="monotone" dataKey="equity" stroke="#26a366" strokeWidth={2} fillOpacity={1} fill="url(#eqGlow)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Chart: Drawdown Profile */}
                    <div className="card bg-white/[0.01] border-white/5 p-5 space-y-4">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Drawdown Profile %</h4>
                      <div className="h-[140px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={btResult.equity_curve}>
                            <defs>
                              <linearGradient id="ddGlow" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25}/>
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#121214" vertical={false} />
                            <XAxis dataKey="date" stroke="#4b5563" fontSize={8} tickLine={false} />
                            <YAxis stroke="#4b5563" fontSize={10} tickLine={false} domain={[0, 'auto']} reversed />
                            <Tooltip contentStyle={{ backgroundColor: '#050507', borderColor: '#121214', borderRadius: '8px' }} />
                            <Area type="monotone" dataKey="drawdown" stroke="#ef4444" strokeWidth={1.5} fillOpacity={1} fill="url(#ddGlow)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Parameter Sweep suggestions */}
                    {sweepResult && sweepResult.sweeps && sweepResult.sweeps.length > 0 && (
                      <div className="card bg-white/[0.01] border-white/5 p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                            Grid Search Parameter Sweep Suggestions
                          </h4>
                          <span className="text-[10px] text-gray-500 font-mono">Ranked by Sharpe Ratio</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-white/5 text-gray-500 font-mono text-[10px]">
                                <th className="pb-2">Rank</th>
                                <th className="pb-2 text-left">Parameters Configured</th>
                                <th className="pb-2 text-right">CAGR %</th>
                                <th className="pb-2 text-right">Sharpe</th>
                                <th className="pb-2 text-right">Sortino</th>
                                <th className="pb-2 text-right">Max DD %</th>
                                <th className="pb-2 text-right">Win Rate %</th>
                                <th className="pb-2 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.02]">
                              {sweepResult.sweeps.map((sweep: any, idx: number) => {
                                const metrics = sweep.metrics;
                                const desc = sweep.indicators.map((ind: any) => {
                                  const p = ind.params;
                                  if (ind.type === 'RSI') return `RSI(${p.period}) ${ind.condition} ${ind.value || 30}`;
                                  if (ind.type === 'SMA') return `SMA(${p.period})`;
                                  if (ind.type === 'EMA') return `EMA(${p.period})`;
                                  if (ind.type === 'BB') return `BB(${p.period})`;
                                  if (ind.type === 'MACD') return `MACD(${p.fast}, ${p.slow})`;
                                  return ind.type;
                                }).join(' + ');
                                
                                return (
                                  <tr key={idx} className="hover:bg-white/[0.01] transition-all">
                                    <td className="py-2.5 font-bold text-brand-400 font-mono">#{idx + 1}</td>
                                    <td className="py-2.5 font-mono text-[10px] max-w-[220px] truncate" title={desc}>{desc}</td>
                                    <td className="py-2.5 font-mono text-right text-brand-300 font-bold">{metrics.cagr}%</td>
                                    <td className="py-2.5 font-mono text-right text-brand-300 font-bold">{metrics.sharpe_ratio}</td>
                                    <td className="py-2.5 font-mono text-right text-gray-400">{metrics.sortino_ratio}</td>
                                    <td className="py-2.5 font-mono text-right text-red-400">-{metrics.max_drawdown}%</td>
                                    <td className="py-2.5 font-mono text-right text-gray-400">{metrics.win_rate}%</td>
                                    <td className="py-2.5 text-right">
                                      <button
                                        onClick={() => {
                                          setIndicators(sweep.indicators);
                                          toast.success('Optimized parameters loaded into Strategy Builder!');
                                        }}
                                        className="px-2.5 py-1 text-[9px] font-mono bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 rounded-md border border-brand-500/20 font-bold"
                                      >
                                        Apply
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Trades Log */}
                    <div className="card bg-white/[0.01] border-white/5 p-5 space-y-4">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Execution Trade Logs</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-white/5 text-gray-500">
                              <th className="pb-2">Date</th>
                              <th className="pb-2">Action</th>
                              <th className="pb-2">Execution Price</th>
                              <th className="pb-2">Quantity</th>
                              <th className="pb-2 text-right">Value (Rs.)</th>
                              <th className="pb-2 text-right">PnL (Rs.)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {btResult.trades.map((t, i) => (
                              <tr key={i} className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-all">
                                <td className="py-2.5 font-mono">{t.date}</td>
                                <td className="py-2.5">
                                  <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${t.type === 'BUY' ? 'bg-brand-500/10 text-brand-400' : 'bg-red-500/10 text-red-400'}`}>
                                    {t.type}
                                  </span>
                                </td>
                                <td className="py-2.5 font-mono">Rs. {t.price.toLocaleString()}</td>
                                <td className="py-2.5 font-mono">{t.quantity}</td>
                                <td className="py-2.5 text-right font-mono">Rs. {t.value.toLocaleString()}</td>
                                <td className={`py-2.5 text-right font-mono font-bold ${t.profit !== undefined ? (t.profit >= 0 ? 'text-brand-400' : 'text-red-400') : 'text-gray-500'}`}>
                                  {t.profit !== undefined ? `Rs. ${t.profit.toLocaleString()}` : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 2: PORTFOLIO OPTIMIZER ──────────────────────── */}
          {activeTab === 'optimize' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Inputs */}
              <div className="lg:col-span-4 card bg-white/[0.01] border-white/5 p-5 space-y-4">
                <div className="border-b border-white/5 pb-2.5">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Optimizer Engine
                    <InfoTooltip content="Run Markowitz Mean-Variance Portfolio Optimization. Given a universe of tickers, this will simulate 2,000 portfolios to find the Max Sharpe (optimal risk-adjusted return) and Min Volatility (lowest risk) allocation weights." />
                  </h3>
                </div>

                <div className="space-y-4 text-xs">
                  {watchlist.length === 0 && (
                    <div className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg font-mono leading-normal">
                      Your watchlist is currently empty. Add dynamic tickers in the search box below or import your holdings.
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-gray-500 font-semibold">Universe Tickers</label>
                    <TickerSelect 
                      selected={optTickers} 
                      onChange={setOptTickers} 
                      watchlist={watchlist} 
                    />
                    <button 
                      onClick={loadHoldingsIntoOptimizer}
                      className="text-[10px] text-brand-400 font-bold hover:underline block mt-1"
                    >
                      Import portfolio holdings
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-gray-500 font-semibold">Historical Return Window</label>
                    <select 
                      value={optRange} 
                      onChange={e => setOptRange(e.target.value)}
                      className="w-full bg-black/40 border border-white/5 rounded-lg p-2 font-mono text-white outline-none focus:border-brand-500 cursor-pointer"
                    >
                      <option value="6mo">6 Months</option>
                      <option value="1y">1 Year</option>
                      <option value="2y">2 Years</option>
                    </select>
                  </div>

                  <button 
                    onClick={runOptimization}
                    className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 border border-brand-500/20 font-bold transition-all text-white text-xs mt-2"
                  >
                    <Workflow size={12} /> Run Markowitz Optimizer
                  </button>
                </div>
              </div>

              {/* Outputs */}
              <div className="lg:col-span-8 space-y-6">
                {!optResult ? (
                  <div className="card bg-white/[0.01] border-white/5 p-12 text-center space-y-3">
                    <Workflow className="mx-auto text-gray-500" size={24} />
                    <h3 className="text-sm font-bold text-white font-mono">No Allocations Computed</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">Choose a group of assets via search or watchlist import, and compute the Efficient Frontier weights.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Allocation suggestions side by side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Max Sharpe */}
                      <div className="card bg-brand-500/[0.02] border-brand-500/20 p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-brand-500/10 pb-2">
                          <h4 className="text-xs font-bold text-brand-300 uppercase tracking-wider flex items-center gap-2">
                            <Zap size={14} className="text-brand-400 animate-pulse" /> Max Sharpe Portfolio
                          </h4>
                          <span className="text-[10px] bg-brand-500/10 text-brand-400 px-2 py-0.5 rounded font-mono font-bold">
                            SR: {optResult.max_sharpe_portfolio.sharpe}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 flex justify-between font-mono">
                          <span>Return: <strong>{optResult.max_sharpe_portfolio.return}%</strong></span>
                          <span>Vol: <strong>{optResult.max_sharpe_portfolio.volatility}%</strong></span>
                        </div>

                        <div className="space-y-3 text-xs">
                          {Object.entries(optResult.max_sharpe_portfolio.weights).map(([ticker, pct]: any) => (
                            <div key={ticker} className="space-y-1">
                              <div className="flex justify-between font-mono font-semibold">
                                <span>{ticker}</span>
                                <span>{pct}%</span>
                              </div>
                              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-brand-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>

                        <button 
                          onClick={() => applyWeightsToRebalancer(optResult.max_sharpe_portfolio.weights)}
                          className="w-full p-2 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 text-brand-300 rounded-xl text-xs font-bold transition-all mt-4"
                        >
                          Load into Rebalancer
                        </button>
                      </div>

                      {/* Min Volatility */}
                      <div className="card bg-purple-500/[0.02] border-purple-500/20 p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-purple-500/10 pb-2">
                          <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                            <Layers size={14} className="text-purple-400" /> Min Volatility Portfolio
                          </h4>
                          <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded font-mono font-bold">
                            SR: {optResult.min_vol_portfolio.sharpe}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 flex justify-between font-mono">
                          <span>Return: <strong>{optResult.min_vol_portfolio.return}%</strong></span>
                          <span>Vol: <strong>{optResult.min_vol_portfolio.volatility}%</strong></span>
                        </div>

                        <div className="space-y-3 text-xs">
                          {Object.entries(optResult.min_vol_portfolio.weights).map(([ticker, pct]: any) => (
                            <div key={ticker} className="space-y-1">
                              <div className="flex justify-between font-mono font-semibold">
                                <span>{ticker}</span>
                                <span>{pct}%</span>
                              </div>
                              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-purple-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>

                        <button 
                          onClick={() => applyWeightsToRebalancer(optResult.min_vol_portfolio.weights)}
                          className="w-full p-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-xl text-xs font-bold transition-all mt-4"
                        >
                          Load into Rebalancer
                        </button>
                      </div>

                    </div>

                    {/* Chart: Efficient Frontier scatter plot */}
                    <div className="card bg-white/[0.01] border-white/5 p-5 space-y-4">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Efficient Frontier Simulation</h4>
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                            <CartesianGrid stroke="#121214" strokeDasharray="3 3" />
                            <XAxis type="number" dataKey="volatility" name="Volatility" unit="%" stroke="#4b5563" fontSize={10} />
                            <YAxis type="number" dataKey="return" name="Return" unit="%" stroke="#4b5563" fontSize={10} />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#050507', borderColor: '#121214', borderRadius: '8px' }} />
                            <Scatter name="Portfolios" data={optResult.efficient_frontier} fill="#374151" line={false} />
                            <Scatter 
                              name="Max Sharpe" 
                              data={[optResult.max_sharpe_portfolio]} 
                              fill="#26a366" 
                              shape="circle" 
                              style={{ r: 8, stroke: '#fff', strokeWidth: 1.5 }}
                            />
                            <Scatter 
                              name="Min Volatility" 
                              data={[optResult.min_vol_portfolio]} 
                              fill="#8b5cf6" 
                              shape="circle" 
                              style={{ r: 8, stroke: '#fff', strokeWidth: 1.5 }}
                            />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 3: SMART REBALANCER ─────────────────────────── */}
          {activeTab === 'rebalance' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Configuration holdings */}
              <div className="lg:col-span-6 card bg-white/[0.01] border-white/5 p-5 space-y-4">
                <div className="border-b border-white/5 pb-2.5 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Current Position Settings
                    <InfoTooltip content="Calculate portfolio rebalancing adjustments. Input your current holdings and target weights (e.g. from the Max Sharpe optimizer) to compute target values, current deviations, and exact buy/sell trade instructions." />
                  </h3>
                  <button 
                    onClick={importHoldingsIntoRebalancer}
                    className="text-[10px] text-brand-400 font-bold hover:underline"
                  >
                    Import holdings
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="space-y-2">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 text-gray-500 font-mono">
                          <th className="pb-2">Ticker</th>
                          <th className="pb-2">Qty</th>
                          <th className="pb-2">Price (Rs.)</th>
                          <th className="pb-2">Target Weight %</th>
                          <th className="pb-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {holdings.map((h, i) => (
                          <tr key={i} className="border-b border-white/[0.01]">
                            <td className="py-1.5 pr-2">
                              <input 
                                type="text" 
                                value={h.ticker} 
                                onChange={e => updateHoldingRow(i, 'ticker', e.target.value.toUpperCase())}
                                className="w-16 bg-white/5 border border-white/5 rounded p-1 font-mono text-center outline-none"
                              />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input 
                                type="number" 
                                value={h.quantity} 
                                onChange={e => updateHoldingRow(i, 'quantity', Number(e.target.value))}
                                className="w-16 bg-white/5 border border-white/5 rounded p-1 font-mono text-center outline-none"
                              />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input 
                                type="number" 
                                value={h.current_price} 
                                onChange={e => updateHoldingRow(i, 'current_price', Number(e.target.value))}
                                className="w-20 bg-white/5 border border-white/5 rounded p-1 font-mono text-center outline-none"
                              />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input 
                                type="number" 
                                value={rebalanceTargets[h.ticker] || 0} 
                                onChange={e => setRebalanceTargets(prev => ({ ...prev, [h.ticker]: Number(e.target.value) }))}
                                className="w-16 bg-white/5 border border-white/5 rounded p-1 font-mono text-center outline-none text-brand-300 font-bold"
                              />
                            </td>
                            <td className="py-1.5 text-right">
                              <button onClick={() => removeHoldingRow(i)} className="text-gray-600 hover:text-red-400">
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={addHoldingRow}
                      className="flex-1 p-2 border border-dashed border-white/10 hover:border-brand-500/30 text-gray-500 hover:text-brand-300 rounded-xl text-center font-bold font-mono transition-all"
                    >
                      + Add Asset Row
                    </button>
                    <button 
                      onClick={runRebalancer}
                      className="flex-1 p-2 bg-brand-500 hover:bg-brand-600 border border-brand-500/20 text-white rounded-xl text-center font-bold transition-all"
                    >
                      Calculate Rebalance
                    </button>
                  </div>
                </div>
              </div>

              {/* Outputs recommendations */}
              <div className="lg:col-span-6 space-y-6">
                {!rebalanceResult ? (
                  <div className="card bg-white/[0.01] border-white/5 p-12 text-center space-y-3">
                    <Layers className="mx-auto text-gray-500" size={24} />
                    <h3 className="text-sm font-bold text-white font-mono">No Recommendations Generated</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">Set up your current stock positions, specify target weight distribution, and click rebalance.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Orders summary */}
                    <div className="card bg-brand-500/[0.02] border-brand-500/20 p-5 space-y-4">
                      <div className="border-b border-brand-500/10 pb-2">
                        <h4 className="text-xs font-bold text-brand-300 uppercase tracking-wider flex items-center gap-2">
                          <CheckCircle size={14} className="text-brand-400" /> Suggested Rebalancing Trade Orders
                        </h4>
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono">
                        Total Portfolio Value: <strong>Rs. {rebalanceResult.total_value.toLocaleString()}</strong>
                      </div>

                      <div className="space-y-2">
                        {rebalanceResult.orders.length === 0 ? (
                          <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl text-xs text-center text-gray-400">
                            Holdings match target weights! No trades required.
                          </div>
                        ) : (
                          rebalanceResult.orders.map((o: any, i: number) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-black border border-white/5 text-xs">
                              <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${o.action === 'BUY' ? 'bg-brand-500/10 text-brand-400' : 'bg-red-500/10 text-red-400'}`}>
                                {o.action}
                              </span>
                              <div className="flex-1">
                                <div className="font-bold text-[11px]">{o.ticker}</div>
                                <div className="text-[9px] text-gray-500 font-mono">Price: Rs. {o.current_price}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold font-mono">Qty: {o.quantity}</div>
                                <div className="text-[9px] text-gray-500 font-mono">Val: Rs. {o.value.toLocaleString()}</div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Allocation spread table */}
                    <div className="card bg-white/[0.01] border-white/5 p-5 space-y-4">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Allocation Variance Analysis</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse font-mono">
                          <thead>
                            <tr className="border-b border-white/5 text-gray-500">
                              <th className="pb-2">Asset</th>
                              <th className="pb-2 text-right">Current Value</th>
                              <th className="pb-2 text-right">Current %</th>
                              <th className="pb-2 text-right">Target %</th>
                              <th className="pb-2 text-right">Target Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rebalanceResult.allocations.map((a: any, i: number) => (
                              <tr key={i} className="border-b border-white/[0.02]">
                                <td className="py-2 font-bold text-white">{a.ticker}</td>
                                <td className="py-2 text-right">Rs. {a.current_value.toLocaleString()}</td>
                                <td className="py-2 text-right">{a.current_pct}%</td>
                                <td className="py-2 text-right text-brand-300 font-bold">{a.target_pct}%</td>
                                <td className="py-2 text-right">Rs. {a.target_value.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 4: CORRELATION HEATMAP ──────────────────────── */}
          {activeTab === 'correlation' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Inputs */}
              <div className="lg:col-span-4 card bg-white/[0.01] border-white/5 p-5 space-y-4">
                <div className="border-b border-white/5 pb-2.5">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Correlation Heatmap
                    <InfoTooltip content="Evaluate asset relationships using Pearson's Correlation Coefficient. The pairwise matrix values range from -1.0 (perfect opposite movement) to +1.0 (perfect parallel movement) to help you diversify portfolio risk." />
                  </h3>
                </div>

                <div className="space-y-4 text-xs">
                  {watchlist.length === 0 && (
                    <div className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg font-mono leading-normal">
                      Your watchlist is currently empty. Add dynamic tickers below or import your holdings.
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-gray-500 font-semibold">Asset universe to compute</label>
                    <TickerSelect 
                      selected={corrTickers} 
                      onChange={setCorrTickers} 
                      watchlist={watchlist} 
                    />
                    <button 
                      onClick={loadHoldingsIntoCorrelation}
                      className="text-[10px] text-brand-400 font-bold hover:underline block mt-1"
                    >
                      Import portfolio holdings
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-gray-500 font-semibold">Data Period</label>
                    <select 
                      value={corrRange} 
                      onChange={e => setCorrRange(e.target.value)}
                      className="w-full bg-black/40 border border-white/5 rounded-lg p-2 font-mono text-white outline-none focus:border-brand-500 cursor-pointer"
                    >
                      <option value="6mo">6 Months</option>
                      <option value="1y">1 Year</option>
                      <option value="2y">2 Years</option>
                    </select>
                  </div>

                  <button 
                    onClick={runCorrelation}
                    className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 border border-brand-500/20 font-bold transition-all text-white text-xs mt-2"
                  >
                    <Database size={12} /> Compute Correlation Matrix
                  </button>
                </div>
              </div>

              {/* Heatmap renderer */}
              <div className="lg:col-span-8">
                {!corrResult ? (
                  <div className="card bg-white/[0.01] border-white/5 p-12 text-center space-y-3">
                    <Database className="mx-auto text-gray-500" size={24} />
                    <h3 className="text-sm font-bold text-white font-mono">No Correlation Matrix Loaded</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">Choose a group of assets, set historical parameters, and run matrix computations.</p>
                  </div>
                ) : (
                  <div className="card bg-white/[0.01] border-white/5 p-5 space-y-6">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Pairwise Asset Pearson Matrix</h4>
                      <p className="text-[10px] text-gray-500 mt-0.5">Value coefficients range from -1.0 (perfect hedge) to +1.0 (synchronized momentum).</p>
                    </div>

                    <div className="overflow-x-auto">
                      <div className="min-w-[500px]">
                        <table className="w-full text-center border-collapse">
                          <thead>
                            <tr>
                              <th className="p-2 border border-white/5 bg-white/[0.01] font-mono text-xs text-left text-gray-500">Asset</th>
                              {corrResult.tickers.map((t: string) => (
                                <th key={t} className="p-2 border border-white/5 bg-white/[0.01] font-mono text-xs text-gray-500">{t}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {corrResult.matrix.map((row: any) => (
                              <tr key={row.ticker}>
                                <td className="p-2 border border-white/5 bg-white/[0.01] font-mono text-xs text-left font-bold text-white">{row.ticker}</td>
                                {corrResult.tickers.map((col: string) => {
                                  const val = row[col]
                                  
                                  let bgStyle = 'bg-white/[0.01]'
                                  let textStyle = 'text-gray-400'
                                  if (val > 0.6) { bgStyle = 'bg-brand-500/25'; textStyle = 'text-brand-300 font-bold' }
                                  else if (val > 0.3) { bgStyle = 'bg-brand-500/10'; textStyle = 'text-brand-400' }
                                  else if (val < -0.2) { bgStyle = 'bg-red-500/20'; textStyle = 'text-red-300 font-bold' }
                                  else if (val < -0.05) { bgStyle = 'bg-red-500/10'; textStyle = 'text-red-400' }
                                  
                                  return (
                                    <td 
                                      key={col} 
                                      className={`p-3 border border-white/5 font-mono text-xs transition-colors ${bgStyle} ${textStyle}`}
                                    >
                                      {val}
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 5: FACTOR SCANNER ───────────────────────────── */}
          {activeTab === 'factors' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Inputs */}
              <div className="lg:col-span-4 card bg-white/[0.01] border-white/5 p-5 space-y-4">
                <div className="border-b border-white/5 pb-2.5">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Factor Analyzer
                    <InfoTooltip content="Assess stock characteristics across 5 quantitative factors: Momentum (trend strength), Value (valuation multiples), Quality (capital returns ROCE/ROE), Growth (profit expansion), and Volatility (stability)." />
                  </h3>
                </div>

                <div className="space-y-4 text-xs">
                  {watchlist.length === 0 && (
                    <div className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg font-mono leading-normal">
                      Your watchlist is currently empty. Search and select a symbol in the box below to run factor analysis.
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-gray-500 font-semibold">Ticker Symbol</label>
                    <SingleTickerSelect 
                      value={factorTicker} 
                      onChange={setFactorTicker} 
                      placeholder="Search stock..." 
                    />
                  </div>

                  <button 
                    onClick={runFactors}
                    className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 border border-brand-500/20 font-bold transition-all text-white text-xs mt-2"
                  >
                    <Zap size={12} /> Evaluate Factor Strengths
                  </button>
                </div>
              </div>

              {/* Output bars */}
              <div className="lg:col-span-8">
                {!factorResult ? (
                  <div className="card bg-white/[0.01] border-white/5 p-12 text-center space-y-3">
                    <Zap className="mx-auto text-gray-500" size={24} />
                    <h3 className="text-sm font-bold text-white font-mono">No Factor Analysis Run</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">Input any stock ticker (fully dynamic) to evaluate momentum, value, quality, growth, and volatility scores.</p>
                  </div>
                ) : (
                  <div className="card bg-white/[0.01] border-white/5 p-5 space-y-6">
                    <div className="border-b border-white/5 pb-3">
                      <h4 className="text-sm font-bold text-white">{factorResult.name} ({factorResult.ticker}) Factor Score card</h4>
                      <div className="text-[10px] text-gray-500 font-mono mt-1">
                        Sector: <strong>{factorResult.sector}</strong> | Annual Volatility: <strong>{factorResult.annualized_volatility}%</strong> | 1Y Return: <strong>{factorResult.raw_momentum}%</strong>
                      </div>
                    </div>

                    <div className="space-y-5 text-xs">
                      {factorResult.factors.map((f: any) => (
                        <div key={f.factor} className="space-y-2">
                          <div className="flex justify-between items-end font-mono">
                            <div>
                              <span className="font-bold text-white block">{f.factor} Score</span>
                              <span className="text-[9px] text-gray-500">{f.description}</span>
                            </div>
                            <span className={`font-bold text-sm ${
                              f.score >= 75 ? 'text-brand-400' : (f.score >= 45 ? 'text-brand-300' : 'text-amber-400')
                            }`}>{f.score}/100</span>
                          </div>
                          <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                f.score >= 75 ? 'bg-brand-500' : (f.score >= 45 ? 'bg-brand-400' : 'bg-amber-500')
                              }`} 
                              style={{ width: `${f.score}%` }} 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 6: MONTE CARLO FORECAST ─────────────────────── */}
          {activeTab === 'montecarlo' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Inputs */}
              <div className="lg:col-span-4 card bg-white/[0.01] border-white/5 p-5 space-y-4">
                <div className="border-b border-white/5 pb-2.5">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Risk Forecaster
                    <InfoTooltip content="Project future portfolio valuations using Geometric Brownian Motion (GBM). Based on historical volatility and drift, this simulates 1,000 probability paths to chart bear (10th), median (50th), and bull (90th) percentile bands." />
                  </h3>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <label className="text-gray-500 font-semibold">Holdings Tickers</label>
                    <TickerSelect 
                      selected={mcTickers} 
                      onChange={tickers => {
                        setMcTickers(tickers)
                        // Adjust weights map
                        const w: Record<string, number> = {}
                        const even = Math.round(100 / (tickers.length || 1))
                        tickers.forEach(t => { w[t] = mcWeights[t] || even })
                        setMcWeights(w)
                      }} 
                      watchlist={watchlist} 
                    />
                    <button 
                      onClick={loadHoldingsIntoMonteCarlo}
                      className="text-[10px] text-brand-400 font-bold hover:underline block mt-1"
                    >
                      Import portfolio holdings
                    </button>
                  </div>

                  {/* Weights Input Grid */}
                  {mcTickers.length > 0 && (
                    <div className="space-y-2 p-3 bg-black/40 border border-white/5 rounded-xl">
                      <label className="text-gray-500 font-semibold block border-b border-white/5 pb-1">Weights Allocation %</label>
                      <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                        {mcTickers.map(t => (
                          <div key={t} className="flex items-center justify-between gap-3 text-[11px] font-mono">
                            <span>{t}</span>
                            <div className="flex items-center gap-1.5">
                              <input 
                                type="number" 
                                value={mcWeights[t] || 0}
                                onChange={e => setMcWeights(prev => ({ ...prev, [t]: Number(e.target.value) }))}
                                className="w-16 bg-white/5 border border-white/5 rounded p-1 text-center outline-none text-brand-300 font-bold"
                              />
                              <span>%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="text-[10px] text-gray-500 flex justify-between font-mono border-t border-white/5 pt-2">
                        <span>Total Sum:</span>
                        <span className={
                          Math.abs(Object.values(mcWeights).reduce((a,b)=>a+b,0) - 100) < 0.1 ? 'text-brand-400 font-bold' : 'text-red-400 font-bold'
                        }>{Object.values(mcWeights).reduce((a,b)=>a+b,0)}% / 100%</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-gray-500 font-semibold">Sim Capital</label>
                      <input 
                        type="number" 
                        value={mcCapital} 
                        onChange={e => setMcCapital(Number(e.target.value))}
                        className="w-full bg-black/40 border border-white/5 rounded-lg p-2 font-mono text-white outline-none focus:border-brand-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-gray-500 font-semibold">Days to Project</label>
                      <input 
                        type="number" 
                        value={mcDays} 
                        onChange={e => setMcDays(Number(e.target.value))}
                        className="w-full bg-black/40 border border-white/5 rounded-lg p-2 font-mono text-white outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={runMonteCarlo}
                    className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 border border-brand-500/20 font-bold transition-all text-white text-xs mt-2"
                  >
                    <BarChart3 size={12} /> Run GBM Simulation
                  </button>

                  {/* Crisis Stress Testing Panel */}
                  <div className="border-t border-white/5 pt-4 space-y-3">
                    <div className="flex items-center gap-1">
                      <label className="text-gray-400 font-bold uppercase text-[10px] tracking-wider font-mono flex items-center gap-1.5">
                        <AlertTriangle size={12} className="text-amber-400" /> Crisis Stress Tester
                      </label>
                      <InfoTooltip content="Test portfolio returns and tail risk under historic macro shocks. Simulates parallel paths using scaled volatilities and shifted expected returns." />
                    </div>
                    <div className="space-y-2.5 text-xs">
                      <div className="space-y-1">
                        <label className="text-gray-500 font-semibold">Macro Crisis Scenario</label>
                        <select 
                          value={stressScenario} 
                          onChange={e => setStressScenario(e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-lg p-2 font-mono text-white outline-none focus:border-brand-500"
                        >
                          <option value="lehman_2008">2008 Lehman Shock (-35% Return, 2.2x Vol)</option>
                          <option value="covid_2020">2020 Covid Crash (-25% Return, 2.8x Vol)</option>
                          <option value="rate_hike_2022">250bps Fed Rate Shock (-15% Return, 1.4x Vol)</option>
                          <option value="stagflation">1970s Stagflation Shock (-12% Return, 1.6x Vol)</option>
                        </select>
                      </div>
                      <button 
                        onClick={runStressTest}
                        disabled={stressing}
                        className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-amber-600/10 hover:bg-amber-600/20 border border-amber-500/20 font-bold transition-all text-amber-300 text-xs disabled:opacity-50"
                      >
                        <AlertTriangle size={12} className="text-amber-400 animate-pulse" /> {stressing ? 'Simulating Shock...' : 'Run Stress Test'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chart projection */}
              <div className="lg:col-span-8">
                {!mcResult && !stressResult ? (
                  <div className="card bg-white/[0.01] border-white/5 p-12 text-center space-y-3">
                    <BarChart3 className="mx-auto text-gray-500" size={24} />
                    <h3 className="text-sm font-bold text-white font-mono">No Forecast paths Run</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">Define tickers, allocation weights, initial value, and trigger the GBM risk simulation or Crisis Stress Test paths.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Standard Monte Carlo Projections */}
                    {mcResult && (
                      <div className="space-y-6">
                        {/* Summary stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          {[
                            { label: 'Expected Daily Return', value: `${mcResult.daily_expected_return}%` },
                            { label: 'Expected Daily Volatility', value: `${mcResult.daily_volatility}%` },
                            { label: 'Annualized Return Est.', value: `${mcResult.annualized_expected_return}%`, color: 'text-brand-300' },
                            { label: 'Annualized Risk Est.', value: `${mcResult.annualized_volatility}%`, color: 'text-purple-400' }
                          ].map((item, idx) => (
                            <div key={idx} className="p-3 bg-white/[0.01] border border-white/5 rounded-xl space-y-1">
                              <div className="text-[10px] text-gray-500 font-semibold uppercase">{item.label}</div>
                              <div className={`text-sm font-bold font-mono ${item.color || 'text-white'}`}>{item.value}</div>
                            </div>
                          ))}
                        </div>

                        {/* Chart path projection */}
                        <div className="card bg-white/[0.01] border-white/5 p-5 space-y-4">
                          <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Geometric Brownian Motion (GBM) Projections</h4>
                            <p className="text-[10px] text-gray-500 mt-0.5">Shaded region bounds the 10th percentile (bear case) to 90th percentile (bull case) projections.</p>
                          </div>

                          <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={mcResult.projections}>
                                <defs>
                                  <linearGradient id="mcGlow" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15}/>
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#121214" vertical={false} />
                                <XAxis dataKey="day" stroke="#4b5563" fontSize={10} tickLine={false} />
                                <YAxis stroke="#4b5563" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
                                <Tooltip contentStyle={{ backgroundColor: '#050507', borderColor: '#121214', borderRadius: '8px' }} />
                                <Area type="monotone" dataKey="bull" stroke="none" fill="url(#mcGlow)" />
                                <Area type="monotone" dataKey="bear" stroke="none" fill="none" />
                                <Area type="monotone" dataKey="median" stroke="#8b5cf6" strokeWidth={2} dot={false} fill="none" />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Crisis Stress Test Comparative Projections */}
                    {stressResult && (
                      <div className="space-y-6 pt-6 border-t border-white/5">
                        <div>
                          <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                            <AlertTriangle size={13} /> Crisis Stress Scenario: {stressResult.scenario}
                          </h4>
                          <p className="text-[10px] text-gray-500 mt-0.5">Comparative simulation of portfolio metrics under historical crisis shifts.</p>
                        </div>

                        {/* Stressed vs Normal metrics grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          {[
                            { label: 'Stressed Return', value: `${stressResult.stressed_metrics.annualized_return}%`, color: stressResult.stressed_metrics.annualized_return >= 0 ? 'text-brand-400' : 'text-red-400' },
                            { label: 'Stressed Volatility', value: `${stressResult.stressed_metrics.annualized_volatility}%`, color: 'text-purple-400' },
                            { label: 'Stressed Max Drawdown', value: `-${stressResult.stressed_metrics.max_drawdown}%`, color: 'text-red-400' },
                            { label: 'Stressed Sharpe', value: stressResult.stressed_metrics.sharpe_ratio, color: 'text-amber-300' },
                            { label: '95% Value at Risk (VaR)', value: `Rs. ${Math.round(stressResult.stressed_metrics.var_95_pct * mcCapital / 100).toLocaleString()} (${stressResult.stressed_metrics.var_95_pct}%)`, color: 'text-red-400', span: 'col-span-2' },
                            { label: '95% Expected Shortfall (ES)', value: `Rs. ${Math.round(stressResult.stressed_metrics.es_95_pct * mcCapital / 100).toLocaleString()} (${stressResult.stressed_metrics.es_95_pct}%)`, color: 'text-red-400', span: 'col-span-2' }
                          ].map((item, idx) => (
                            <div key={idx} className={`p-3 bg-white/[0.01] border border-white/5 rounded-xl space-y-1 ${item.span || ''}`}>
                              <div className="text-[10px] text-gray-500 font-semibold uppercase">{item.label}</div>
                              <div className={`text-xs sm:text-sm font-bold font-mono ${item.color}`}>{item.value}</div>
                            </div>
                          ))}
                        </div>

                        {/* Comparative chart */}
                        <div className="card bg-white/[0.01] border-white/5 p-5 space-y-4">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Crisis Scenario Comparison Chart</h4>
                          <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={stressResult.stressed_median_path.map((val: number, idx: number) => ({
                                day: idx,
                                normal: stressResult.normal_median_path[idx],
                                stressed: val,
                                bear: stressResult.stressed_bear_path[idx],
                                bull: stressResult.stressed_bull_path[idx]
                              }))}>
                                <defs>
                                  <linearGradient id="stressGlow" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15}/>
                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#121214" vertical={false} />
                                <XAxis dataKey="day" stroke="#4b5563" fontSize={10} tickLine={false} />
                                <YAxis stroke="#4b5563" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
                                <Tooltip contentStyle={{ backgroundColor: '#050507', borderColor: '#121214', borderRadius: '8px' }} />
                                <Area type="monotone" dataKey="bull" stroke="none" fill="url(#stressGlow)" />
                                <Area type="monotone" dataKey="bear" stroke="none" fill="none" />
                                <Area type="monotone" dataKey="normal" name="Normal (Median)" stroke="#8b5cf6" strokeWidth={2} dot={false} fill="none" />
                                <Area type="monotone" dataKey="stressed" name="Stressed (Median)" stroke="#f59e0b" strokeWidth={2} dot={false} fill="none" />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 7: STRATEGY MARKETPLACE ─────────────────────── */}
          {activeTab === 'marketplace' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-surface-border/50 pb-2">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                    Saved Quantitative Strategies
                    <InfoTooltip content="Browse, load, or share strategy configurations with the community database." />
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Explore pre-saved quant trading formulas or run backtests on shared assets.</p>
                </div>
              </div>

              {marketplace.length === 0 ? (
                <div className="card bg-white/[0.01] border-white/5 p-12 text-center space-y-3">
                  <BookOpen className="mx-auto text-gray-500" size={24} />
                  <h3 className="text-sm font-bold text-white font-mono">Marketplace is Empty</h3>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">Create and save strategy configurations in the Strategy Backtester tab to publish them here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {marketplace.map((strat) => (
                    <div key={strat.id} className="card bg-[#050507] border border-white/5 hover:border-brand-500/30 p-5 flex flex-col justify-between space-y-4 group transition-all duration-300">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-white group-hover:text-brand-300 transition-colors">{strat.name}</h4>
                          <span className="text-[9px] font-mono bg-white/5 px-2 py-0.5 rounded text-gray-400 font-bold uppercase">
                            Gate: {strat.logic || 'AND'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 leading-normal min-h-[40px]">
                          {strat.description || 'No description provided.'}
                        </p>
                      </div>

                      <div className="divider" />

                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-1">
                          {strat.indicators.map((ind: any, i: number) => (
                            <span 
                              key={i}
                              className="text-[9px] font-mono font-bold text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full"
                            >
                              {ind.type} (P: {ind.period})
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                          <span>By: <strong>{strat.creator_name}</strong></span>
                          <span>{new Date(strat.created_at).toLocaleDateString()}</span>
                        </div>

                        <button 
                          onClick={() => loadStrategyFromMarketplace(strat)}
                          className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/25 text-brand-300 font-bold text-xs transition-all duration-200"
                        >
                          Load into Strategy Builder <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* Save Strategy Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card bg-[#050507] border border-white/10 max-w-sm w-full p-5 space-y-4 animate-slide-up">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Save Strategy template</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">This strategy will be persisted in MongoDB and listed in the Marketplace.</p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-gray-500 font-semibold">Strategy Name</label>
                <input 
                  type="text" 
                  value={saveStrategyName} 
                  onChange={e => setSaveStrategyName(e.target.value)}
                  className="w-full bg-black border border-white/5 rounded-lg p-2 font-mono text-white outline-none focus:border-brand-500"
                  placeholder="e.g. RSI Mean Reversion"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-500 font-semibold">Description</label>
                <textarea 
                  rows={3}
                  value={saveStrategyDesc} 
                  onChange={e => setSaveStrategyDesc(e.target.value)}
                  className="w-full bg-black border border-white/5 rounded-lg p-2 font-mono text-white outline-none focus:border-brand-500 resize-none"
                  placeholder="Summarize the core logic, assets, and assumptions."
                />
              </div>
            </div>

            <div className="flex gap-2 text-xs">
              <button 
                onClick={() => setShowSaveModal(false)}
                className="flex-1 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={saveStrategy}
                className="flex-1 p-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold transition-all"
              >
                Save Strategy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

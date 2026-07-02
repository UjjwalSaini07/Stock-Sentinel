'use client'
import { useState, useEffect, useRef } from 'react'
import { 
  Bot, Send, Trash2, Plus, RefreshCw, AlertTriangle, 
  TrendingUp, TrendingDown, Search, Sparkles, Activity, 
  Percent, ShieldAlert, DollarSign, Layers, CheckCircle,
  Clock, ArrowRight, Compass, BarChart2, Info, CheckCircle2,
  ChevronRight
} from 'lucide-react'
import { copilotApi } from '@/lib/api'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

interface ChatSession {
  id: string
  title: string
  created_at: string
  message_count: number
}

function parseInlineMarkdown(text: string) {
  const parts = text.split('**')
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return <strong key={i} className="text-white font-bold">{part}</strong>
    }
    return part
  })
}

function formatMarkdown(text: string) {
  if (!text) return null
  const lines = text.split('\n')
  return lines.map((line, i) => {
    if (line.startsWith('### ')) {
      return <h4 key={i} className="text-xs font-bold text-white mt-3 mb-1.5">{line.slice(4)}</h4>
    }
    if (line.startsWith('## ')) {
      return <h3 key={i} className="text-sm font-bold text-white mt-4 mb-2">{line.slice(3)}</h3>
    }
    if (line.startsWith('# ')) {
      return <h2 key={i} className="text-base font-bold text-white mt-5 mb-2.5">{line.slice(2)}</h2>
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <li key={i} className="list-disc list-inside ml-2 text-gray-300 mt-1">
          {parseInlineMarkdown(line.slice(2))}
        </li>
      )
    }
    return <p key={i} className="mt-1.5 min-h-[1.5em]">{parseInlineMarkdown(line)}</p>
  })
}

const EmptyStatePrompt = ({ sectionTitle }: { sectionTitle: string }) => (
  <div className="card bg-black/80 backdrop-blur-2xl border-white/[0.08] p-12 rounded-3xl text-center space-y-6 relative overflow-hidden max-w-lg mx-auto mt-12 animate-slide-up shadow-2xl shadow-brand-500/5">
    {/* Glowing background radial blur */}
    <div className="absolute -top-12 -left-12 w-[150px] h-[150px] bg-brand-500/[0.03] blur-3xl rounded-full pointer-events-none" />
    <div className="absolute -bottom-12 -right-12 w-[150px] h-[150px] bg-blue-500/[0.03] blur-3xl rounded-full pointer-events-none" />

    {/* Pulsing Radar UI Animation */}
    <div className="flex items-center justify-center">
      <div className="relative flex items-center justify-center w-24 h-24">
        <div className="absolute inset-0 rounded-full bg-brand-500/10 animate-ping opacity-60" />
        <div className="absolute w-16 h-16 rounded-full bg-brand-500/15 border border-brand-500/20 animate-pulse" />
        <div className="absolute w-12 h-12 rounded-full bg-gradient-to-br from-brand-500/30 to-blue-500/30 border border-white/10 flex items-center justify-center shadow-lg shadow-brand-500/20">
          <Bot className="text-brand-400 animate-bounce" size={20} />
        </div>
      </div>
    </div>

    {/* Text Insights */}
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-white tracking-tight uppercase">Portfolio Inactive</h3>
      <p className="text-xs text-gray-400 leading-relaxed font-sans max-w-sm mx-auto">
        Please craft your portfolio first to enable institutional-grade <span className="text-brand-400 font-semibold">{sectionTitle}</span>, macro stress testing, and real-time thesis audits.
      </p>
    </div>

    {/* Call to Action Button */}
    <div>
      <Link 
        href="/watchlist" 
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 rounded-xl text-xs font-bold text-white transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg shadow-brand-500/10 uppercase tracking-wider"
      >
        <Plus size={14} /> Add Assets in Watchlist
      </Link>
    </div>
  </div>
)

export default function CopilotPage() {
  const [activeTab, setActiveTab] = useState<'chat' | 'whatif' | 'briefing' | 'portfolio' | 'optimizer' | 'playbook' | 'planner'>('chat')
  
  // Helper to render AI insights safely (preventing React child object errors)
  const renderSafeInsight = (value: any) => {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'object') {
      if (Array.isArray(value)) return value.join(', ')
      return Object.entries(value)
        .map(([key, val]) => `${key.replace(/_/g, ' ').toUpperCase()}: ${typeof val === 'object' ? JSON.stringify(val) : val}`)
        .join(' | ')
    }
    return String(value)
  }
  
  // ── Chat State ─────────────────────────────────────────────
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Confirmation Modal states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [sessionIdToDelete, setSessionIdToDelete] = useState<string | null>(null)

  // ── Portfolio Intelligence State ───────────────────────────
  const [portfolioIntel, setPortfolioIntel] = useState<any>(null)
  const [intelLoading, setIntelLoading] = useState(false)

  // ── What-If Stress Simulator State ─────────────────────────
  const [whatIfScenario, setWhatIfScenario] = useState<'market_crash' | 'interest_rate' | 'inflation' | 'sector_shock'>('market_crash')
  const [whatIfInputs, setWhatIfInputs] = useState<any>({
    severity: 20,
    rate_hike_bps: 100,
    inflation_severity: 'high',
    target_sector: 'IT'
  })
  const [whatIfResults, setWhatIfResults] = useState<any>(null)
  const [whatIfLoading, setWhatIfLoading] = useState(false)

  // ── Screener State ─────────────────────────────────────────
  const [screenerType, setScreenerType] = useState<'growth' | 'value' | 'dividend' | 'momentum' | 'undervalued'>('growth')
  const [screenerData, setScreenerData] = useState<any>(null)
  const [screenerLoading, setScreenerLoading] = useState(false)

  // ── Earnings State ─────────────────────────────────────────
  const [earningsTicker, setEarningsTicker] = useState('')
  const [earningsData, setEarningsData] = useState<any>(null)
  const [earningsLoading, setEarningsLoading] = useState(false)

  // ── Recommendations State ──────────────────────────────────
  const [recsData, setRecsData] = useState<any>(null)
  const [recsLoading, setRecsLoading] = useState(false)
  const [rebalanceWeights, setRebalanceWeights] = useState<{[key: string]: number}>({
    'SBIN': 25,
    'TATASTEEL': 25,
    'KPEL': 30,
    'NBCC': 20
  })

  // ── AI Portfolio Insights State ─────────────────────────────
  const [aiInsights, setAiInsights] = useState<any>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)

  async function generateAiInsights() {
    setInsightsLoading(true)
    try {
      const { data } = await copilotApi.getPortfolioAiInsights()
      setAiInsights(data)
      toast.success('AI Portfolio Insights generated!')
    } catch {
      toast.error('Failed to generate AI insights')
    } finally {
      setInsightsLoading(false)
    }
  }

  // ── AI CIO Workspace States (Modules 1-45) ──────────────────
  const [portfolioV2Data, setPortfolioV2Data] = useState<any>(null)
  const [decisionLayerData, setDecisionLayerData] = useState<any>(null)
  const [marketIntelData, setMarketIntelData] = useState<any>(null)
  const [selectedGoal, setSelectedGoal] = useState<string>('wealth')
  const [cioLoading, setCioLoading] = useState(false)
  
  // Wealth Planner inputs
  const [sipInput, setSipInput] = useState<number>(5000)
  const [lumpSumInput, setLumpSumInput] = useState<number>(50000)
  const [horizonInput, setHorizonInput] = useState<number>(5)
  const [riskInput, setRiskInput] = useState<string>('moderate')
  const [inflationInput, setInflationInput] = useState<number>(6.0)
  const [wealthSimulation, setWealthSimulation] = useState<any>(null)
  const [simulationLoading, setSimulationLoading] = useState(false)

  const isPortfolioEmpty = portfolioIntel !== null && portfolioIntel.holdings_count === 0

  // custom journal timelines
  const [customLogs, setCustomLogs] = useState<Record<string, { event: string; detail: string }[]>>({})
  const [activeNoteText, setActiveNoteText] = useState<Record<string, string>>({})

  const addJournalEntry = (ticker: string) => {
    const note = activeNoteText[ticker]?.trim()
    if (!note) return
    
    setCustomLogs(prev => {
      const existing = prev[ticker] || []
      return {
        ...prev,
        [ticker]: [
          ...existing,
          { event: "Journal Entry", detail: note }
        ]
      }
    })
    
    setActiveNoteText(prev => ({
      ...prev,
      [ticker]: ""
    }))
    toast.success(`Journal entry saved for ${ticker}`)
  }

  async function loadCioWorkspaceData(goal = selectedGoal) {
    setCioLoading(true)
    try {
      const [v2Res, decRes, mktRes] = await Promise.all([
        copilotApi.getPortfolioV2(goal),
        copilotApi.getDecisionLayer(),
        copilotApi.getMarketIntelligence()
      ])
      setPortfolioV2Data(v2Res.data)
      setDecisionLayerData(decRes.data)
      setMarketIntelData(mktRes.data)
    } catch {
      toast.error("Failed to sync AI CIO data streams.")
    } finally {
      setCioLoading(false)
    }
  }

  async function runWealthSimulation() {
    setSimulationLoading(true)
    try {
      const { data } = await copilotApi.simulateWealth({
        sip: sipInput,
        lump_sum: lumpSumInput,
        horizon: horizonInput,
        risk_appetite: riskInput,
        inflation: inflationInput
      })
      setWealthSimulation(data)
      toast.success("Wealth projection model simulated successfully!")
    } catch {
      toast.error("Failed to run wealth simulation model.")
    } finally {
      setSimulationLoading(false)
    }
  }

  // ── Initial Load ───────────────────────────────────────────
  useEffect(() => {
    fetchSessions()
    loadPortfolioIntel()
    loadCioWorkspaceData()
  }, [])

  useEffect(() => {
    if (activeSessionId) {
      loadSessionMessages(activeSessionId)
    } else {
      setMessages([])
    }
  }, [activeSessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Chat Session Methods ───────────────────────────────────
  async function fetchSessions() {
    setSessionsLoading(true)
    try {
      const { data } = await copilotApi.getSessions()
      setSessions(data)
      if (data.length > 0 && !activeSessionId) {
        setActiveSessionId(data[0].id)
      }
    } catch {
      toast.error('Failed to load chat history')
    } finally {
      setSessionsLoading(false)
    }
  }

  async function createSession(title = 'New Assistant Chat') {
    try {
      const { data } = await copilotApi.createSession(title)
      setSessions(prev => [data, ...prev])
      setActiveSessionId(data.id)
      toast.success('New conversation started')
    } catch {
      toast.error('Failed to create session')
    }
  }

  async function loadSessionMessages(id: string) {
    try {
      const { data } = await copilotApi.getSessionMessages(id)
      setMessages(data.messages)
    } catch {
      toast.error('Failed to load messages')
    }
  }

  function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setSessionIdToDelete(id)
    setDeleteConfirmOpen(true)
  }

  async function executeDeleteSession() {
    if (!sessionIdToDelete) return
    const id = sessionIdToDelete
    setDeleteConfirmOpen(false)
    setSessionIdToDelete(null)
    
    const previousSessions = [...sessions]
    
    // Optimistic UI Update
    setSessions(prev => prev.filter(s => s.id !== id))
    if (activeSessionId === id) {
      setActiveSessionId(null)
      setMessages([])
    }
    
    try {
      await copilotApi.deleteSession(id)
      toast.success('Chat deleted')
    } catch {
      // Rollback
      setSessions(previousSessions)
      if (activeSessionId === id) {
        setActiveSessionId(id)
        loadSessionMessages(id)
      }
      toast.error('Failed to delete session')
    }
  }

  // ── Chat Message streaming handler ────────────────────────
  async function handleSendMessage(e?: React.FormEvent, customPrompt?: string) {
    if (e) e.preventDefault()
    const message = customPrompt || inputMessage
    if (!message.trim() || chatLoading) return

    let currentSessionId = activeSessionId
    if (!currentSessionId) {
      // Auto-create session if none active
      try {
        const title = message.length > 25 ? message.slice(0, 25) + '…' : message
        const { data } = await copilotApi.createSession(title)
        setSessions(prev => [data, ...prev])
        currentSessionId = data.id
        setActiveSessionId(data.id)
      } catch {
        toast.error('Failed to initialize session')
        return
      }
    }

    // Clear input message
    setInputMessage('')
    
    // Add user message to UI
    const newUserMsg: Message = { role: 'user', content: message, timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, newUserMsg])
    setChatLoading(true)

    // Add placeholder assistant message for streaming
    const assistantPlaceholderMsg: Message = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, assistantPlaceholderMsg])

    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_URL}/copilot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ session_id: currentSessionId, message })
      })

      if (!response.ok) throw new Error('Response error')
      if (!response.body) throw new Error('No stream response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let done = false
      let fullText = ''

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        const chunk = decoder.decode(value, { stream: !done })
        
        // Parse SSE payload
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim()
            if (dataStr === '[DONE]') {
              done = true
              break
            }
            try {
              const payload = JSON.parse(dataStr)
              const content = payload.content
              if (content) {
                fullText += content
                // Update assistant message with accumulated text
                setMessages(prev => {
                  const updated = [...prev]
                  if (updated.length > 0) {
                    updated[updated.length - 1] = {
                      role: 'assistant',
                      content: fullText
                    }
                  }
                  return updated
                })
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      toast.error('Connection interrupted')
      // Remove placeholder on failure
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setChatLoading(false)
      // Refresh session message count
      fetchSessions()
    }
  }

  // ── Portfolio Intelligence Methods ─────────────────────────
  async function loadPortfolioIntel() {
    setIntelLoading(true)
    try {
      const { data } = await copilotApi.getPortfolioAnalysis()
      setPortfolioIntel(data)
    } catch {
      toast.error('Failed to analyze portfolio health')
    } finally {
      setIntelLoading(false)
    }
  }

  // ── What-If Stress Simulator Methods ───────────────────────
  async function runSimulation() {
    setWhatIfLoading(true)
    try {
      const { data } = await copilotApi.runWhatIf(whatIfScenario, whatIfInputs)
      setWhatIfResults(data)
      toast.success('Simulation computed successfully')
    } catch {
      toast.error('Failed to run what-if simulation')
    } finally {
      setWhatIfLoading(false)
    }
  }

  // ── Screener Methods ───────────────────────────────────────
  async function runScreener(type = screenerType) {
    setScreenerLoading(true)
    try {
      const { data } = await copilotApi.runScreener(type)
      setScreenerData(data)
    } catch {
      toast.error('Screener run failed')
    } finally {
      setScreenerLoading(false)
    }
  }

  // ── Earnings summarizer Methods ────────────────────────────
  async function searchEarnings(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!earningsTicker.trim()) return
    setEarningsLoading(true)
    try {
      const { data } = await copilotApi.getEarnings(earningsTicker)
      setEarningsData(data)
      toast.success('Earnings synthesized')
    } catch {
      toast.error('Earnings lookup failed')
    } finally {
      setEarningsLoading(false)
    }
  }

  // ── Recommendations Methods ────────────────────────────────
  async function loadRecommendations() {
    setRecsLoading(true)
    try {
      const { data } = await copilotApi.getRecommendations()
      setRecsData(data)
      
      // Dynamically load rebalance positions if user has holdings
      if (portfolioIntel?.positions?.length > 0) {
        const initialWeights: {[key: string]: number} = {}
        portfolioIntel.positions.forEach((pos: any) => {
          const price = pos.current_price || pos.buy_price || 0
          const qty = pos.quantity || 0
          const val = price * qty
          const wt = Math.round((val / (portfolioIntel.total_value || 1)) * 100)
          initialWeights[pos.ticker.toUpperCase()] = wt
        })
        setRebalanceWeights(initialWeights)
      }
    } catch {
      toast.error('Recommendations failed to generate')
    } finally {
      setRecsLoading(false)
    }
  }

  return (
    <div className={`space-y-6 animate-fade-in ${activeTab === 'chat' ? 'pb-2' : 'pb-12'}`}>
      {/* Tab Navigation header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-border/50 pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="text-brand-400" /> AI Copilot Workspace
          </h1>
          <p className="text-gray-500 text-xs mt-1">Multi-agent analysis, stress testing, and portfolio recommendations</p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1 bg-white/[0.02] p-1 rounded-xl border border-white/[0.04] backdrop-blur-md">
          {([
            { id: 'chat', label: 'Copilot Chat' },
            { id: 'whatif', label: 'What-If Stress' },
            { id: 'briefing', label: 'AI CIO Briefing' },
            { id: 'portfolio', label: 'Portfolio Intel' },
            { id: 'optimizer', label: 'Action Center' },
            { id: 'playbook', label: 'Thesis Playbook' },
            { id: 'planner', label: 'Wealth Planner' }
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                if (tab.id === 'portfolio') {
                  loadPortfolioIntel()
                  loadCioWorkspaceData()
                }
                if (tab.id === 'briefing' || tab.id === 'optimizer' || tab.id === 'playbook') {
                  loadCioWorkspaceData()
                }
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-brand-500 text-white shadow-[0_0_12px_rgba(38,163,102,0.25)]'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Tab Screen Area */}
      <div className="grid grid-cols-1 gap-6">
        
        {/* ── TAB 1: COPILOT CHAT ──────────────────────────────── */}
        {activeTab === 'chat' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-180px)] min-h-[450px]">
            {/* Sessions Sidebar */}
            <div className="lg:col-span-1 card flex flex-col h-full bg-surface-card border-surface-border min-h-0 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sessions</span>
                <button 
                  onClick={() => createSession()}
                  className="btn-outline p-1 rounded-lg hover:border-brand-500/40 text-gray-400 hover:text-white transition-all"
                  title="New Conversation"
                >
                  <Plus size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 no-scrollbar">
                {sessionsLoading ? (
                  <div className="text-center py-6 text-xs text-gray-500">Loading chat logs…</div>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-500">No past conversations.</div>
                ) : (
                  sessions.map(s => (
                    <div
                      key={s.id}
                      onClick={() => setActiveSessionId(s.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border ${
                        activeSessionId === s.id
                          ? 'bg-brand-500/10 border-brand-500/30 text-brand-400'
                          : 'bg-white/[0.01] border-transparent hover:bg-white/[0.03] text-gray-400'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="text-xs font-semibold truncate text-white">{s.title}</div>
                        <div className="text-[9px] text-gray-500 mt-0.5">{s.message_count} message{s.message_count !== 1 ? 's' : ''}</div>
                      </div>
                      <button 
                        onClick={(e) => deleteSession(s.id, e)}
                        className="text-gray-600 hover:text-red-400 transition-colors p-1 hover:bg-white/5 rounded"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Chat Board */}
            <div className="lg:col-span-3 card flex flex-col h-full bg-surface-card border-surface-border min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto space-y-4 p-2 no-scrollbar border-b border-surface-border/50 pb-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                    <div className="w-12 h-12 bg-brand-500/10 border border-brand-500/20 rounded-full flex items-center justify-center text-brand-400">
                      <Bot size={24} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Ask your AI Copilot anything</h3>
                      <p className="text-xs text-gray-500 mt-1 max-w-xs">Ask about specific tickers (e.g. SIGMAADV) or check portfolio health. Copilot will automatically aggregate news, risks, and pricing metrics.</p>
                    </div>
                    {/* Suggested Prompts */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md w-full pt-4">
                      {[
                        "How diversified is my portfolio?",
                        "What is the analysis on stock SIGMAADV?",
                        "Check the news sentiment on RVNL.",
                        "What is the valuation of SIGMAADV?"
                      ].map((prompt, i) => (
                        <button
                          key={i}
                          onClick={() => handleSendMessage(undefined, prompt)}
                          className="text-left text-[11px] p-2.5 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.04] text-gray-400 hover:text-white transition-all duration-200"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((m, index) => (
                    <div 
                      key={index} 
                      className={`flex gap-3 max-w-3xl ${m.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold border ${
                        m.role === 'user'
                          ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                          : 'bg-brand-500/10 border-brand-500/20 text-brand-400'
                      }`}>
                        {m.role === 'user' ? 'U' : <Bot size={14} />}
                      </div>
                      <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-blue-500/5 border border-blue-500/10 text-white rounded-tr-none'
                          : 'bg-white/[0.02] border border-white/[0.05] text-gray-200 rounded-tl-none markdown-body'
                      }`}>
                        {m.role === 'user' ? (
                          m.content
                        ) : (
                          formatMarkdown(m.content)
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSendMessage} className="flex gap-2 pt-4">
                <input
                  type="text"
                  placeholder="Ask a question or analyze stock..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  disabled={chatLoading}
                  className="input flex-1 bg-white/[0.01]"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !inputMessage.trim()}
                  className="btn-primary flex items-center justify-center p-3 rounded-xl shadow-[0_0_15px_rgba(38,163,102,0.12)] shrink-0"
                >
                  <Send size={15} />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── TAB 2: PORTFOLIO INTELLIGENCE ───────────────────── */}
        {activeTab === 'portfolio' && (
          <div className="space-y-6">
            {intelLoading ? (
              <div className="card text-center py-12 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="animate-spin text-brand-500" size={24} />
                <span className="text-xs text-gray-500">Auditing portfolio parameters…</span>
              </div>
            ) : isPortfolioEmpty ? (
              <EmptyStatePrompt sectionTitle="Portfolio Analytics" />
            ) : portfolioIntel ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up">
                
                {/* General Stats Column */}
                <div className="md:col-span-1 space-y-6">
                  {/* Health Card */}
                  <div className="card bg-gradient-to-br from-white/[0.01] to-transparent border-white/5 space-y-4">
                    <h3 className="section-title text-white"><ShieldAlert size={14} /> Health Overview</h3>
                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Health Score</span>
                        <div className="text-4xl font-extrabold text-white mt-1 font-mono">{portfolioIntel.health_score}%</div>
                      </div>
                      <div className="w-16 h-16 rounded-full border-2 border-brand-500/20 flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-brand-500/5 animate-pulse" />
                        <span className="text-brand-400 font-bold text-sm font-mono">{portfolioIntel.health_score > 80 ? 'Good' : 'Audit'}</span>
                      </div>
                    </div>

                    <div className="divider" />

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[9px] text-gray-500 uppercase font-bold">Total Assets</span>
                        <div className="text-sm font-bold text-white font-mono mt-0.5">₹{portfolioIntel.total_value.toLocaleString('en-IN')}</div>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-500 uppercase font-bold">Diversification</span>
                        <div className="text-sm font-bold text-white font-mono mt-0.5">{portfolioIntel.diversification_score}%</div>
                      </div>
                    </div>

                    {portfolioV2Data && (
                      <div className="pt-3 border-t border-white/5 grid grid-cols-2 gap-4 font-mono text-xs">
                        <div>
                          <span className="text-[9px] text-gray-500 uppercase font-bold block">Sharpe Ratio</span>
                          <span className="text-white font-bold block mt-0.5">{portfolioV2Data.sharpe_ratio}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-500 uppercase font-bold block">Beta Exposure</span>
                          <span className="text-white font-bold block mt-0.5">{portfolioV2Data.portfolio_beta}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-500 uppercase font-bold block">Portfolio Alpha</span>
                          <span className="text-brand-400 font-bold block mt-0.5">+{portfolioV2Data.portfolio_alpha}%</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-500 uppercase font-bold block">Volatility StdDev</span>
                          <span className="text-white font-bold block mt-0.5">{portfolioV2Data.portfolio_volatility}%</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Drawdown Warning Card */}
                  <div className="card bg-white/[0.01] border-white/5 space-y-3.5">
                    <h3 className="section-title text-red-400"><TrendingDown size={14} /> Stress Limitations</h3>
                    <p className="text-xs text-gray-400 leading-relaxed">Estimates the maximum projected asset drop under standard 95% Value-at-Risk market conditions.</p>
                    <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl flex items-center justify-between">
                      <span className="text-xs font-semibold text-red-400">Max Projected Drop</span>
                      <span className="text-sm font-bold text-red-400 font-mono">-{portfolioIntel.max_drawdown_est}%</span>
                    </div>
                    {portfolioV2Data && (
                      <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-xs font-mono text-gray-400">
                        <div className="p-2 bg-white/[0.01] border border-white/5 rounded-lg">
                          <span className="text-[8px] uppercase text-gray-500 block">Value at Risk (VaR)</span>
                          <span className="text-white font-bold block mt-0.5">₹{portfolioV2Data.value_at_risk?.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="p-2 bg-white/[0.01] border border-white/5 rounded-lg">
                          <span className="text-[8px] uppercase text-gray-500 block">Cond VaR (CVaR)</span>
                          <span className="text-white font-bold block mt-0.5">₹{portfolioV2Data.conditional_var?.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Allocation Column */}
                <div className="md:col-span-2 space-y-6">
                  {/* Sector exposure */}
                  <div className="card bg-white/[0.01] border-white/5 space-y-4">
                    <h3 className="section-title text-white"><Layers size={14} /> Sector Exposure breakdown</h3>
                    <div className="space-y-3 pt-2">
                      {portfolioIntel.sector_exposure.length === 0 ? (
                        <p className="text-xs text-gray-500">No sectors found. Add positions to your portfolio.</p>
                      ) : (
                        portfolioIntel.sector_exposure.map((sec: any, i: number) => (
                          <div key={i} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-white">{sec.sector}</span>
                              <span className="text-gray-400 font-mono">{sec.percentage}% (₹{sec.value.toLocaleString('en-IN')})</span>
                            </div>
                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-brand-500 rounded-full" 
                                style={{ width: `${sec.percentage}%` }}
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Concentrated risk warnings */}
                  <div className="card bg-white/[0.01] border-white/5 space-y-4">
                    <h3 className="section-title text-amber-400"><AlertTriangle size={14} /> Risk Concentrations</h3>
                    <div className="space-y-2">
                      {portfolioIntel.risk_concentration.length === 0 ? (
                        <div className="p-3.5 bg-brand-500/5 border border-brand-500/10 rounded-xl flex items-center gap-3 text-xs text-brand-400">
                          <CheckCircle size={16} />
                          <span>No severe risk concentrations detected. Allocation spread is optimal!</span>
                        </div>
                      ) : (
                        portfolioIntel.risk_concentration.map((risk: any, i: number) => (
                          <div key={i} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-start gap-3">
                            <div className="text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded shrink-0">
                              {risk.ticker}
                            </div>
                            <p className="text-xs text-gray-400 leading-normal">{risk.flag}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* 🚀 AI Portfolio Insights Engine */}
                <div className="md:col-span-3 card bg-black/60 border border-white/5 space-y-4 pt-5 mt-2 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-brand-500/[0.02] blur-2xl rounded-full pointer-events-none" />
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase flex items-center gap-1.5">
                        <Sparkles className="text-brand-400 animate-pulse" size={14} /> AI Portfolio Insights Engine
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">Generate deep strategic reviews, tail-risk stress audits, and capital reallocation alerts using Groq Llama 3.</p>
                    </div>
                    <button
                      onClick={generateAiInsights}
                      disabled={insightsLoading}
                      className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-800 disabled:text-gray-500 rounded-xl text-xs font-bold text-white transition-all active:scale-95 flex items-center gap-2 shadow-md shadow-brand-500/10 shrink-0"
                    >
                      {insightsLoading ? (
                        <>
                          <RefreshCw className="animate-spin" size={14} /> Generating Insights...
                        </>
                      ) : (
                        <>
                          <Bot size={14} /> Generate AI Insights
                        </>
                      )}
                    </button>
                  </div>

                  {insightsLoading ? (
                    <div className="py-12 text-center space-y-2">
                      <div className="inline-block relative w-8 h-8">
                        <div className="absolute inset-0 border-2 border-brand-500/20 rounded-full" />
                        <div className="absolute inset-0 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                      <p className="text-xs text-gray-500 animate-pulse">Groq AI Agent parsing holdings telemetry, sector exposure weights, and risk parameters...</p>
                    </div>
                  ) : aiInsights ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 animate-slide-up">
                      {/* Strategic Review Card */}
                      <div className="p-4 bg-white/[0.01] border border-white/[0.03] rounded-2xl space-y-2 hover:border-white/10 transition-colors duration-300">
                        <h4 className="text-xs font-bold text-brand-400 uppercase tracking-wider">Strategic Allocation Review</h4>
                        <p className="text-xs text-gray-300 leading-relaxed font-sans">{renderSafeInsight(aiInsights.strategic_review)}</p>
                      </div>
                      
                      {/* Tail-Risk Analysis Card */}
                      <div className="p-4 bg-white/[0.01] border border-white/[0.03] rounded-2xl space-y-2 hover:border-white/10 transition-colors duration-300">
                        <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Tail-Risk Analysis</h4>
                        <p className="text-xs text-gray-300 leading-relaxed font-sans">{renderSafeInsight(aiInsights.risk_analysis)}</p>
                      </div>
                      
                      {/* Opportunities Card */}
                      <div className="p-4 bg-white/[0.01] border border-white/[0.03] rounded-2xl space-y-2 hover:border-white/10 transition-colors duration-300">
                        <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Reallocation Opportunities</h4>
                        <p className="text-xs text-gray-300 leading-relaxed font-sans">{renderSafeInsight(aiInsights.opportunities)}</p>
                      </div>

                      {/* Tactical Action Bullet List */}
                      {aiInsights.tactical_actions && aiInsights.tactical_actions.length > 0 && (
                        <div className="md:col-span-3 p-4 bg-brand-500/[0.02] border border-brand-500/10 rounded-2xl space-y-3">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                            <CheckCircle size={12} className="text-brand-400" /> Prescribed Tactical Reallocations
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-300 font-sans">
                            {aiInsights.tactical_actions.map((act: string, idx: number) => (
                              <div key={idx} className="flex items-start gap-2 bg-black/40 p-2.5 rounded-xl border border-white/5">
                                <span className="text-brand-400 font-bold shrink-0">{idx + 1}.</span>
                                <p className="leading-normal">{act}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-gray-500 font-semibold">
                      Click "Generate AI Insights" above to synthesize holding intelligence using Llama 3.3.
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="card text-center py-12 text-xs text-gray-500">Failed to calculate health analytics.</div>
            )}
          </div>
        )}

        {/* ── TAB 3: WHAT-IF SIMULATOR ────────────────────────── */}
        {activeTab === 'whatif' && (
          <div className="space-y-6">
            <div className="card bg-white/[0.01] border-white/5 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-white">Stress Test Simulator</h3>
                <p className="text-xs text-gray-500 mt-0.5">Model the simulated impact of global macroeconomic shifts on your asset valuations.</p>
              </div>

              {/* Stress Input forms */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Select Scenario</label>
                  <select 
                    value={whatIfScenario} 
                    onChange={(e: any) => setWhatIfScenario(e.target.value)}
                    className="input bg-black mt-1 py-2 px-3 border border-white/10"
                  >
                    <option value="market_crash">Broad Market Correction</option>
                    <option value="interest_rate">Interest Rate Hike</option>
                    <option value="inflation">Hyper-Inflation Shock</option>
                    <option value="sector_shock">Regulatory Sector Shock</option>
                  </select>
                </div>

                {whatIfScenario === 'market_crash' && (
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Correction Severity</label>
                    <select
                      value={whatIfInputs.severity}
                      onChange={(e) => setWhatIfInputs({ ...whatIfInputs, severity: Number(e.target.value) })}
                      className="input bg-black mt-1 py-2 px-3 border border-white/10"
                    >
                      <option value={10}>-10% (Technical Correction)</option>
                      <option value={20}>-20% (Bear Market)</option>
                      <option value={35}>-35% (Systemic Crash)</option>
                    </select>
                  </div>
                )}

                {whatIfScenario === 'interest_rate' && (
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Hike Size</label>
                    <select
                      value={whatIfInputs.rate_hike_bps}
                      onChange={(e) => setWhatIfInputs({ ...whatIfInputs, rate_hike_bps: Number(e.target.value) })}
                      className="input bg-black mt-1 py-2 px-3 border border-white/10"
                    >
                      <option value={50}>+50 bps (0.5%)</option>
                      <option value={100}>+100 bps (1.0%)</option>
                      <option value={250}>+250 bps (2.5%)</option>
                    </select>
                  </div>
                )}

                {whatIfScenario === 'inflation' && (
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Inflation Severity</label>
                    <select
                      value={whatIfInputs.inflation_severity}
                      onChange={(e) => setWhatIfInputs({ ...whatIfInputs, inflation_severity: e.target.value })}
                      className="input bg-black mt-1 py-2 px-3 border border-white/10"
                    >
                      <option value="moderate">Moderate Rise (+3.5%)</option>
                      <option value="high">High Inflation (+7.0%)</option>
                      <option value="hyper">Hyper-Inflation (+12.0%)</option>
                    </select>
                  </div>
                )}

                {whatIfScenario === 'sector_shock' && (
                  <>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Target Sector</label>
                      <select
                        value={whatIfInputs.target_sector}
                        onChange={(e) => setWhatIfInputs({ ...whatIfInputs, target_sector: e.target.value })}
                        className="input bg-black mt-1 py-2 px-3 border border-white/10"
                      >
                        <option value="IT">Information Technology</option>
                        <option value="Pharma">Pharmaceuticals</option>
                        <option value="Energy">Energy / Oil & Gas</option>
                        <option value="Financial">Banking & Finance</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Decline Size</label>
                      <select
                        value={whatIfInputs.severity}
                        onChange={(e) => setWhatIfInputs({ ...whatIfInputs, severity: Number(e.target.value) })}
                        className="input bg-black mt-1 py-2 px-3 border border-white/10"
                      >
                        <option value={10}>-10%</option>
                        <option value={20}>-20%</option>
                        <option value={30}>-30%</option>
                      </select>
                    </div>
                  </>
                )}

                <button 
                  onClick={runSimulation}
                  disabled={whatIfLoading}
                  className="btn-primary py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 hover:shadow-[0_0_15px_rgba(38,163,102,0.15)] transition-all shrink-0 text-xs"
                >
                  {whatIfLoading ? <RefreshCw className="animate-spin" size={14} /> : <Activity size={14} />}
                  Run Simulator
                </button>
              </div>
            </div>

            {/* Simulation Output results */}
            {whatIfResults && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up">
                {/* Result Overview card */}
                <div className="md:col-span-1 space-y-6">
                  <div className="card bg-white/[0.01] border-white/5 space-y-4">
                    <h3 className="section-title text-white">Impact Analysis</h3>
                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-gray-500">Projected Change</span>
                        <div className={`text-3xl font-extrabold font-mono mt-1 ${
                          whatIfResults.simulated_change_pct >= 0 ? 'text-brand-400' : 'text-red-400'
                        }`}>
                          {whatIfResults.simulated_change_pct >= 0 ? '+' : ''}{whatIfResults.simulated_change_pct}%
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-gray-500">Simulated P&L</span>
                        <div className={`text-md font-bold font-mono mt-2 ${
                          whatIfResults.simulated_pnl >= 0 ? 'text-brand-400' : 'text-red-400'
                        }`}>
                          ₹{whatIfResults.simulated_pnl.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    <div className="divider" />

                    <div>
                      <span className="text-[9px] uppercase font-bold text-gray-500">Original Valuation</span>
                      <div className="text-sm font-semibold text-white font-mono mt-0.5">₹{whatIfResults.total_value.toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-gray-500">Simulated Valuation</span>
                      <div className="text-sm font-semibold text-white font-mono mt-0.5">₹{whatIfResults.simulated_value.toLocaleString('en-IN')}</div>
                    </div>
                  </div>

                  {/* Recovery advise */}
                  <div className="card bg-brand-500/5 border border-brand-500/10 space-y-3">
                    <h3 className="section-title text-brand-400"><Sparkles size={14} /> AI Recovery Advice</h3>
                    <p className="text-xs text-gray-300 leading-relaxed">{whatIfResults.stress_recovery_advice}</p>
                  </div>
                </div>

                {/* Individual stock impacts */}
                <div className="md:col-span-2 card bg-white/[0.01] border-white/5 space-y-4">
                  <h3 className="section-title text-white">Asset-Level Stress Impact</h3>
                  <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-surface-border text-gray-500">
                          <th className="py-2.5 font-bold">Ticker</th>
                          <th className="py-2.5 font-bold text-right">Price (Old)</th>
                          <th className="py-2.5 font-bold text-right">Price (Sim)</th>
                          <th className="py-2.5 font-bold text-right">Impact</th>
                          <th className="py-2.5 font-bold text-right">Simulated P&L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {whatIfResults.positions.map((pos: any, i: number) => (
                          <tr key={i} className="border-b border-surface-border/50 hover:bg-white/[0.01] transition-colors group">
                            <td className="py-3 font-semibold text-white flex flex-col">
                              <span>{pos.ticker}</span>
                              <span className="text-[9px] text-gray-500 font-normal mt-0.5 max-w-xs">{pos.impact_reason}</span>
                            </td>
                            <td className="py-3 text-right text-gray-400 font-mono">₹{pos.current_price.toLocaleString('en-IN')}</td>
                            <td className="py-3 text-right text-white font-mono">₹{pos.simulated_price.toLocaleString('en-IN')}</td>
                            <td className={`py-3 text-right font-semibold font-mono ${
                              pos.change_pct >= 0 ? 'text-brand-400' : 'text-red-400'
                            }`}>
                              {pos.change_pct >= 0 ? '+' : ''}{pos.change_pct}%
                            </td>
                            <td className={`py-3 text-right font-bold font-mono ${
                              pos.simulated_pnl >= 0 ? 'text-brand-400' : 'text-red-400'
                            }`}>
                              ₹{pos.simulated_pnl.toLocaleString('en-IN')}
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
        )}

        {/* ── TAB 4: AI CIO EXECUTIVE BRIEFING ────────────────── */}
        {activeTab === 'briefing' && (
          <div className="space-y-6 animate-slide-up">
            {cioLoading ? (
              <div className="card text-center py-16 flex flex-col items-center justify-center gap-3 bg-white/[0.01] border-white/5">
                <RefreshCw className="animate-spin text-brand-500" size={24} />
                <span className="text-xs text-gray-500">Syncing AI CIO briefing streams, market regimes, and watchlist alerts...</span>
              </div>
            ) : isPortfolioEmpty ? (
              <EmptyStatePrompt sectionTitle="Executive CIO Briefing" />
            ) : marketIntelData ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
                {/* Executive AI Briefing Block */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Macro indicators grid */}
                  {marketIntelData.macro_indicators && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-black/60 border border-white/5 rounded-2xl">
                        <span className="text-[9px] uppercase font-bold text-gray-500 block">NIFTY 50</span>
                        <div className="text-xs font-black text-white font-mono mt-1">
                          {marketIntelData.macro_indicators.nifty_50.value}
                        </div>
                        <span className="text-[8px] text-brand-400 font-mono block mt-0.5">+{marketIntelData.macro_indicators.nifty_50.change} ({marketIntelData.macro_indicators.nifty_50.trend})</span>
                      </div>
                      <div className="p-3 bg-black/60 border border-white/5 rounded-2xl">
                        <span className="text-[9px] uppercase font-bold text-gray-500 block">INDIA VIX</span>
                        <div className="text-xs font-black text-white font-mono mt-1">
                          {marketIntelData.macro_indicators.india_vix.value}
                        </div>
                        <span className="text-[8px] text-brand-400 font-mono block mt-0.5">{marketIntelData.macro_indicators.india_vix.sentiment}</span>
                      </div>
                      <div className="p-3 bg-black/60 border border-white/5 rounded-2xl">
                        <span className="text-[9px] uppercase font-bold text-gray-500 block">BRENT CRUDE</span>
                        <div className="text-xs font-black text-white font-mono mt-1">
                          ${marketIntelData.macro_indicators.brent_crude.value}
                        </div>
                        <span className="text-[8px] text-gray-500 font-mono block mt-0.5">Stable trend</span>
                      </div>
                      <div className="p-3 bg-black/60 border border-white/5 rounded-2xl">
                        <span className="text-[9px] uppercase font-bold text-gray-500 block">USD / INR</span>
                        <div className="text-xs font-black text-white font-mono mt-1">
                          ₹{marketIntelData.macro_indicators.usdinr.value}
                        </div>
                        <span className="text-[8px] text-gray-500 font-mono block mt-0.5">Rangebound</span>
                      </div>
                    </div>
                  )}

                  {/* Portfolio attribution cards */}
                  {marketIntelData.portfolio_attribution && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 bg-brand-500/[0.02] border border-brand-500/10 rounded-2xl flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-gray-500 block">Top Contributor</span>
                          <span className="text-xs font-bold text-white uppercase block mt-0.5">{marketIntelData.portfolio_attribution.top_contributor}</span>
                        </div>
                        <span className="text-brand-400 font-black font-mono">
                          {marketIntelData.portfolio_attribution.top_contributor_pnl > 0 ? '+' : ''}₹{marketIntelData.portfolio_attribution.top_contributor_pnl.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="p-3 bg-red-500/[0.02] border border-red-500/10 rounded-2xl flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-gray-500 block">Top Detractor</span>
                          <span className="text-xs font-bold text-white uppercase block mt-0.5">{marketIntelData.portfolio_attribution.top_detractor}</span>
                        </div>
                        <span className="text-red-400 font-black font-mono">
                          ₹{marketIntelData.portfolio_attribution.top_detractor_pnl.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="card bg-black/80 backdrop-blur-2xl border-white/[0.08] p-6 space-y-4 rounded-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-brand-500/[0.04] blur-3xl rounded-full pointer-events-none animate-pulse" />
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <h3 className="text-base font-black text-white tracking-tight uppercase flex items-center gap-2">
                        <Sparkles size={16} className="text-brand-400" /> Executive AI CIO Briefing
                      </h3>
                      <span className="text-[10px] text-gray-500 font-mono">Dynamic daily digest</span>
                    </div>
                    
                    <div className="text-sm text-gray-200 leading-relaxed font-sans space-y-3 font-medium">
                      <p>{marketIntelData.personal_cio?.briefing_text}</p>
                      <div className="p-4 bg-black/40 border border-white/5 rounded-xl space-y-2">
                        <span className="text-[9px] uppercase font-bold text-gray-500">Weekly Outlook Strategy</span>
                        <p className="text-xs text-gray-300">{marketIntelData.personal_cio?.weekly_outlook}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-2 font-mono text-xs">
                      <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                        <span className="text-[9px] text-gray-500 uppercase font-bold block">Market Regime</span>
                        <span className="text-brand-400 font-bold block mt-1">{marketIntelData.personal_cio?.regime}</span>
                      </div>
                      <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                        <span className="text-[9px] text-gray-500 uppercase font-bold block">CIO Cash Recommendation</span>
                        <span className="text-white font-bold block mt-1">{marketIntelData.personal_cio?.cash_recommendation}</span>
                      </div>
                    </div>
                  </div>

                  {/* Why Today Engine */}
                  <div className="card bg-black/40 border border-white/5 p-6 rounded-2xl space-y-4">
                    <h3 className="text-base font-black text-white uppercase flex items-center gap-2">
                      <Activity size={16} className="text-blue-400" /> AI "Why Today" Catalysts
                    </h3>
                    <div className="space-y-3">
                      {marketIntelData.why_today?.map((item: any, idx: number) => (
                        <div key={idx} className="p-3.5 bg-white/[0.01] border border-white/5 rounded-xl flex items-start justify-between gap-4 font-mono text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white uppercase">{item.ticker}</span>
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                item.change_pct >= 0 ? 'bg-brand-500/10 text-brand-400' : 'bg-red-500/10 text-red-400'
                              }`}>{item.change_pct >= 0 ? '+' : ''}{item.change_pct}%</span>
                            </div>
                            <p className="text-xs text-gray-400 leading-normal font-sans">{item.catalyst}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[9px] text-gray-500 uppercase block font-bold">Future Impact</span>
                            <span className="text-xs text-white font-bold block mt-0.5 font-sans">{item.future_impact}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Institutional Block Deals */}
                  {marketIntelData.block_deals && (
                    <div className="card bg-black/40 border border-white/5 p-6 rounded-2xl space-y-4">
                      <h3 className="text-base font-black text-white uppercase flex items-center gap-2">
                        <Layers size={16} className="text-brand-400" /> Smart Money Block Deals
                      </h3>
                      <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-xs text-left border-collapse font-mono">
                          <thead>
                            <tr className="border-b border-white/5 text-gray-500 text-[10px]">
                              <th className="py-2 font-bold uppercase">Ticker</th>
                              <th className="py-2 font-bold uppercase">Institution / Client</th>
                              <th className="py-2 font-bold uppercase text-center">Type</th>
                              <th className="py-2 font-bold uppercase text-right">Shares</th>
                              <th className="py-2 font-bold uppercase text-right">Avg Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {marketIntelData.block_deals.map((deal: any, idx: number) => {
                              const isBuy = deal.type === "BUY"
                              return (
                                <tr key={idx} className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors">
                                  <td className="py-2.5 font-bold text-white uppercase">{deal.ticker}</td>
                                  <td className="py-2.5 text-gray-400 font-sans">{deal.client}</td>
                                  <td className="py-2.5 text-center">
                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                      isBuy ? 'bg-brand-500/10 text-brand-400' : 'bg-red-500/10 text-red-400'
                                    }`}>{deal.type}</span>
                                  </td>
                                  <td className="py-2.5 text-right text-gray-300">{deal.qty}</td>
                                  <td className="py-2.5 text-right text-white font-bold">{deal.price}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Alerts, Smart Money & What Changed */}
                <div className="space-y-6">
                  {/* Smart Money intelligence */}
                  <div className="card bg-black/40 border border-white/5 p-5 rounded-2xl space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase flex items-center gap-1.5">
                      <DollarSign size={14} className="text-brand-400" /> Smart Money Flow
                    </h3>
                    <div className="space-y-3 text-xs">
                      <div className="flex items-center justify-between p-2.5 bg-white/[0.01] border border-white/5 rounded-xl">
                        <span className="text-gray-400">Smart Money score</span>
                        <span className="text-brand-400 font-bold font-mono">{marketIntelData.smart_money?.smart_money_score}/100</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2 bg-white/[0.01] border border-white/5 rounded-xl">
                          <span className="text-gray-500 block">FII Trend</span>
                          <span className="text-white font-bold block mt-0.5 font-mono">{marketIntelData.smart_money?.fii_trend}</span>
                        </div>
                        <div className="p-2 bg-white/[0.01] border border-white/5 rounded-xl">
                          <span className="text-gray-500 block">DII Trend</span>
                          <span className="text-white font-bold block mt-0.5 font-mono">{marketIntelData.smart_money?.dii_trend}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-normal italic font-semibold">
                        MF Strategy: {marketIntelData.smart_money?.mutual_fund_activity}. Delivery ratio averages {marketIntelData.smart_money?.delivery_pct_avg}.
                      </p>
                    </div>
                  </div>

                  {/* Sector Rotation matrix */}
                  {marketIntelData.sector_rotation && (
                    <div className="card bg-black/40 border border-white/5 p-5 rounded-2xl space-y-4">
                      <h3 className="text-sm font-bold text-white uppercase flex items-center gap-1.5">
                        <Compass size={14} className="text-brand-400" /> Sector Rotation Flow
                      </h3>
                      <div className="space-y-2.5">
                        {marketIntelData.sector_rotation.map((sec: any, idx: number) => {
                          const isBull = sec.strength.includes("Bullish")
                          const isBear = sec.strength.includes("Correcting")
                          return (
                            <div key={idx} className="flex items-center justify-between p-2.5 bg-white/[0.01] border border-white/5 rounded-xl text-xs font-mono">
                              <span className="font-semibold text-white font-sans">{sec.sector}</span>
                              <div className="text-right">
                                <span className={`font-bold ${isBull ? 'text-brand-400' : isBear ? 'text-red-400' : 'text-gray-400'}`}>{sec.strength}</span>
                                <span className="text-[9px] text-gray-500 block mt-0.5">{sec.flow}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Active Smart Alerts feed */}
                  <div className="card bg-black/40 border border-white/5 p-5 rounded-2xl space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-amber-400" /> Active Smart Alerts
                    </h3>
                    <div className="space-y-2.5">
                      {decisionLayerData?.smart_alerts?.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-2">No active alert triggers detected.</p>
                      ) : (
                        decisionLayerData?.smart_alerts?.map((alert: any, idx: number) => (
                          <div key={idx} className="p-3 bg-amber-500/[0.02] border border-amber-500/10 rounded-xl flex items-start gap-2.5 animate-pulse">
                            <AlertTriangle size={12} className="text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-500/5 px-1.5 py-0.5 rounded">{alert.ticker}</span>
                              <p className="text-[11px] text-gray-400 mt-1 leading-normal">{alert.desc}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Economic Event Calendar */}
                  {marketIntelData.economic_events && (
                    <div className="card bg-black/40 border border-white/5 p-5 rounded-2xl space-y-4">
                      <h3 className="text-sm font-bold text-white uppercase flex items-center gap-1.5">
                        <Clock size={14} className="text-blue-400" /> Macro Event Calendar
                      </h3>
                      <div className="space-y-2.5">
                        {marketIntelData.economic_events.map((evt: any, idx: number) => {
                          const isHigh = evt.impact_level === "High"
                          return (
                            <div key={idx} className="p-3 bg-white/[0.01] border border-white/5 rounded-xl space-y-1.5 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-white font-sans">{evt.event}</span>
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                                  isHigh ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                }`}>{evt.impact_level} Impact</span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                                <span>Date: {evt.date}</span>
                                <span className="text-gray-400">Forecast: {evt.forecast}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* What Changed log */}
                  <div className="card bg-black/40 border border-white/5 p-5 rounded-2xl space-y-4">
                    <h3 className="text-sm font-bold text-white uppercase flex items-center gap-1.5">
                      <Clock size={14} className="text-blue-400" /> What Changed?
                    </h3>
                    <div className="space-y-3">
                      {marketIntelData.what_changed?.map((item: any, idx: number) => (
                        <div key={idx} className="p-3 bg-white/[0.01] border border-white/5 rounded-xl space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white">{item.ticker} ({item.timeframe})</span>
                            <span className="text-[9px] text-gray-500">{item.change_type}</span>
                          </div>
                          <p className="text-[11px] text-gray-400 leading-normal">{item.description}</p>
                          <p className="text-[10px] text-brand-400 font-semibold mt-1">Action: {item.recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card text-center py-12 text-xs text-gray-500">No market data streams indexed.</div>
            )}
          </div>
        )}

        {/* ── TAB 5: ACTION CENTER & OPTIMIZER ────────────────── */}
        {activeTab === 'optimizer' && (
          <div className="space-y-6 animate-slide-up">
            {cioLoading ? (
              <div className="card text-center py-16 flex flex-col items-center justify-center gap-3 bg-white/[0.01] border-white/5">
                <RefreshCw className="animate-spin text-brand-500" size={24} />
                <span className="text-xs text-gray-500">Auditing active target allocations, rebalance sizing models, and tax offsets...</span>
              </div>
            ) : isPortfolioEmpty ? (
              <EmptyStatePrompt sectionTitle="Rebalancing & Optimization" />
            ) : decisionLayerData ? (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Action Center checklist */}
                <div className="xl:col-span-2 space-y-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-black text-white uppercase">AI Action Center</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Transparent action directives based on active fundamental audits.</p>
                    </div>

                    <div className="space-y-3">
                      {decisionLayerData.action_center?.map((item: any, idx: number) => (
                        <div key={idx} className="p-4 bg-black/60 border border-white/5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-xl border shrink-0 ${
                              item.action === "Increase Position" ? "bg-brand-500/10 border-brand-500/20 text-brand-400" :
                              item.action === "Reduce Position" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                              item.action === "Exit Completely" ? "bg-red-500/10 border-red-500/20 text-red-400" :
                              "bg-blue-500/10 border-blue-500/20 text-blue-400"
                            }`}>
                              <ShieldAlert size={18} />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white uppercase">{item.ticker}</span>
                                <span className="text-[10px] text-gray-400 font-semibold">— {item.action}</span>
                                <span className="text-[9px] font-mono text-gray-500">Confidence: {item.confidence}%</span>
                              </div>
                              <p className="text-xs text-gray-400 leading-normal">{item.reason}</p>
                              
                              {/* Explainability metadata block */}
                              <div className="pt-2 border-t border-white/[0.04] mt-2 flex items-center gap-2 text-[9px] text-gray-600 font-mono">
                                <Info size={10} />
                                <span>Formula parameters: ROCE & PE ratios | Source: Live MongoDB Scraper</span>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 self-end sm:self-center">
                            <button
                              onClick={() => toast.success(`Simulated order executed for ${item.ticker}`)}
                              className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-[10px] font-bold rounded-lg transition-all active:scale-95 shadow-md shadow-brand-500/10"
                            >
                              Execute Model
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tax harvesting Audit */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase">AI Tax Loss Harvester</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Scans paper losses in positions to trigger offsets against STCG/LTCG tax bills.</p>
                    </div>
                    <div className="p-5 bg-black/60 border border-white/5 rounded-2xl">
                      {portfolioV2Data?.tax_loss_harvesting?.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-2">No tax loss harvesting opportunities detected in positions.</p>
                      ) : (
                        <div className="space-y-3">
                          {portfolioV2Data?.tax_loss_harvesting?.map((opp: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-white/[0.01] border border-white/5 rounded-xl text-xs">
                              <div>
                                <span className="font-bold text-white uppercase">{opp.ticker}</span>
                                <span className="text-gray-400 block mt-0.5">{opp.shares} shares | Strategy: {opp.action}</span>
                              </div>
                              <span className="text-brand-400 font-black font-mono">Book Loss: -₹{opp.loss.toLocaleString('en-IN')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Capital Allocator Slider & Portfolio Optimizer */}
                <div className="space-y-6">
                  {/* Smart Capital Allocation */}
                  <div className="card bg-black/60 border border-white/5 p-5 rounded-2xl space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase">Smart Capital Allocator</h3>
                      <p className="text-xs text-gray-500 mt-0.5">AI-suggested weight distribution of fresh target capital injection.</p>
                    </div>

                    <div className="space-y-3 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Target Fresh Cash:</span>
                        <span className="text-white font-bold">₹1,00,000</span>
                      </div>
                      <div className="divider" />
                      <div className="space-y-2">
                        <div className="flex justify-between"><span>Cash / Buffer</span><span className="text-white">₹40,000 (40%)</span></div>
                        <div className="flex justify-between"><span>RECLTD / Core</span><span className="text-brand-400">₹25,000 (25%)</span></div>
                        <div className="flex justify-between"><span>NBCC / Alpha</span><span className="text-brand-400">₹20,000 (20%)</span></div>
                        <div className="flex justify-between"><span>KPEL / Growth</span><span className="text-brand-400">₹15,000 (15%)</span></div>
                      </div>
                      <p className="text-[10px] font-sans text-gray-500 italic leading-normal pt-2 font-semibold">
                        Reasoning: Favors capital-efficient compounders with low current weights to preserve balance index bounds.
                      </p>
                    </div>
                  </div>

                  {/* Portfolio Optimizer comparison */}
                  <div className="card bg-black/60 border border-white/5 p-5 rounded-2xl space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase">AI Allocation Optimizer</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Target weights optimization to maximize Sharpe ratio indices.</p>
                    </div>

                    <div className="space-y-3">
                      {portfolioV2Data?.optimized_allocation?.map((opt: any, idx: number) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-bold text-white uppercase">{opt.ticker}</span>
                            <span className="text-gray-400 font-mono">{opt.current_weight}% → {opt.optimized_weight}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden flex">
                            <div className="h-full bg-gray-600" style={{ width: `${opt.current_weight}%` }} />
                            <div className="h-full bg-brand-500" style={{ width: `${opt.optimized_weight}%` }} />
                          </div>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-[10px] font-mono text-gray-500">
                        <div>Return Improv: <span className="text-brand-400 font-bold block">+3.4%</span></div>
                        <div>Risk Reduction: <span className="text-brand-400 font-bold block">-1.2%</span></div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="card text-center py-12 text-xs text-gray-500">No optimization streams loaded.</div>
            )}
          </div>
        )}

        {/* ── TAB 6: HOLDINGS PLAYBOOK & JOURNAL ──────────────── */}
        {activeTab === 'playbook' && (
          <div className="space-y-6 animate-slide-up">
            {cioLoading ? (
              <div className="card text-center py-16 flex flex-col items-center justify-center gap-3 bg-white/[0.01] border-white/5">
                <RefreshCw className="animate-spin text-brand-500" size={24} />
                <span className="text-xs text-gray-500">Retrieving active holdings playbooks, timelines, and thesis validations...</span>
              </div>
            ) : isPortfolioEmpty ? (
              <EmptyStatePrompt sectionTitle="Thesis Playbook & Journal" />
            ) : decisionLayerData ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-black text-white uppercase">AI Holdings Playbook & Journal</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Continuous verification trackers matching core thesis assumptions against real quarterly numbers.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {decisionLayerData.playbook_v3?.map((play: any, idx: number) => {
                    const validation = decisionLayerData.thesis_validations?.find((v: any) => v.ticker === play.ticker)
                    const timeline = decisionLayerData.timelines?.[play.ticker] || []
                    const customTimeline = customLogs[play.ticker] || []
                    const fullTimeline = [...timeline, ...customTimeline]
                    
                    // Dynamic check parameters
                    const isStillValid = validation?.status === "Still Valid"
                    const convScore = isStillValid ? 95 : (validation?.status === "Partially Valid" ? 70 : 45)

                    return (
                      <div key={idx} className="card bg-black/60 border border-white/5 p-6 rounded-2xl space-y-5 hover:border-white/10 transition-all flex flex-col justify-between">
                        {/* Header with Title and Status */}
                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                          <div>
                            <span className="text-sm font-black text-white uppercase">{play.ticker}</span>
                            <span className="text-[9px] text-gray-500 block mt-0.5">Holdings Audit</span>
                          </div>
                          
                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                            isStillValid 
                              ? "bg-brand-500/10 text-brand-400 border-brand-500/20" 
                              : "bg-red-500/10 text-red-400 border-red-500/20"
                          }`}>
                            Thesis: {validation?.status || "Still Valid"}
                          </span>
                        </div>

                        {/* Confidence Progress Ring & Original Thesis */}
                        <div className="flex items-start gap-4 bg-white/[0.01] p-3.5 rounded-xl border border-white/5">
                          <div className="relative w-12 h-12 shrink-0">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                              <path className="text-white/5" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                              <path className={isStillValid ? "text-brand-500" : "text-red-500"} strokeDasharray={`${convScore}, 100`} strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white font-mono">{convScore}%</span>
                          </div>
                          <div className="text-xs">
                            <span className="text-[9px] uppercase font-bold text-gray-500 font-mono block">Investment Thesis Log</span>
                            <p className="text-gray-200 mt-1 leading-normal font-sans">{validation?.original_thesis}</p>
                          </div>
                        </div>

                        {/* Deterioration alert if invalid */}
                        {!isStillValid && validation?.current_reality && (
                          <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl text-xs text-red-400 leading-normal font-sans">
                            <strong>Deterioration Warning:</strong> {validation.current_reality}
                          </div>
                        )}

                        {/* Audit Parameters Badges Checklist */}
                        <div className="grid grid-cols-3 gap-2 text-[10px] text-center font-mono">
                          <div className="p-2 rounded-xl bg-white/[0.01] border border-white/5 text-brand-400">
                            <span className="block text-[8px] uppercase text-gray-500 font-bold">ROCE Check</span>
                            <span className="font-bold">PASS ✓</span>
                          </div>
                          <div className="p-2 rounded-xl bg-white/[0.01] border border-white/5 text-brand-400">
                            <span className="block text-[8px] uppercase text-gray-500 font-bold">P/E Check</span>
                            <span className="font-bold">PASS ✓</span>
                          </div>
                          <div className="p-2 rounded-xl bg-white/[0.01] border border-white/5 text-brand-400">
                            <span className="block text-[8px] uppercase text-gray-500 font-bold">Debt Check</span>
                            <span className="font-bold">PASS ✓</span>
                          </div>
                        </div>

                        {/* Playbook Targets */}
                        <div className="grid grid-cols-2 gap-3 font-mono text-[10px] bg-white/[0.01] p-3.5 rounded-xl border border-white/5">
                          <div>Buy Accumulation: <span className="text-brand-400 block font-bold mt-0.5">{play.accumulation_zone}</span></div>
                          <div>Target Sell: <span className="text-white block font-bold mt-0.5">₹{play.target_price}</span></div>
                          <div className="col-span-2 border-t border-white/5 pt-2 mt-1">
                            <div>Primary Catalysts: <span className="text-gray-400 block font-sans mt-0.5 text-[9px] leading-normal">{play.catalysts}</span></div>
                          </div>
                        </div>

                        {/* Journey Timeline */}
                        <div className="space-y-3">
                          <span className="text-[9px] uppercase font-bold text-gray-500 block">Investment Timeline Journey</span>
                          <div className="space-y-3 pl-3 border-l border-white/10 font-mono text-[10px]">
                            {fullTimeline.map((evt: any, tIdx: number) => (
                              <div key={tIdx} className="relative text-left">
                                <div className={`absolute -left-[16px] top-1.5 w-1.5 h-1.5 rounded-full ${
                                  evt.event === "Journal Entry" ? "bg-amber-400" : "bg-brand-500"
                                }`} />
                                <span className="text-white font-bold block">{evt.event}</span>
                                <span className="text-gray-500 block text-[9px] mt-0.5 font-sans leading-normal">{evt.detail}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Interactive Journal Observation Form */}
                        <div className="pt-3 border-t border-white/5 space-y-2">
                          <span className="text-[8px] uppercase font-bold text-gray-500 block font-mono">Add Journal Observation</span>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Enter earnings result, news event, or broker upgrades..."
                              value={activeNoteText[play.ticker] || ''}
                              onChange={(e) => setActiveNoteText(prev => ({ ...prev, [play.ticker]: e.target.value }))}
                              className="bg-black/60 border border-white/5 px-3 py-1.5 rounded-xl text-xs flex-1 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500/30 transition-colors font-sans"
                            />
                            <button
                              onClick={() => addJournalEntry(play.ticker)}
                              className="bg-brand-500 hover:bg-brand-600 px-3 py-1.5 rounded-xl text-[10px] font-bold text-white uppercase transition-colors shrink-0"
                            >
                              Save Note
                            </button>
                          </div>
                        </div>

                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="card text-center py-12 text-xs text-gray-500">No playbook records saved.</div>
            )}
          </div>
        )}



        {/* ── TAB 8: AI WEALTH PLANNER ───────────────────────── */}
        {activeTab === 'planner' && (
          <div className="space-y-6 animate-slide-up">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Inputs Form */}
              <div className="lg:col-span-1 card bg-black/60 border border-white/5 p-6 rounded-2xl space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase">Wealth Simulation Parameters</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Test future savings allocations against expected market horizons.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Monthly SIP Allocation (₹)</label>
                    <input 
                      type="number" 
                      value={sipInput}
                      onChange={(e) => setSipInput(parseFloat(e.target.value) || 0)}
                      className="input bg-black border border-white/10 w-full text-white rounded-lg px-3 py-2 text-xs focus:border-brand-500 transition-all font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Lump Sum Contribution (₹)</label>
                    <input 
                      type="number" 
                      value={lumpSumInput}
                      onChange={(e) => setLumpSumInput(parseFloat(e.target.value) || 0)}
                      className="input bg-black border border-white/10 w-full text-white rounded-lg px-3 py-2 text-xs focus:border-brand-500 transition-all font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Horizon (Years)</label>
                      <input 
                        type="number" 
                        value={horizonInput}
                        onChange={(e) => setHorizonInput(parseInt(e.target.value) || 5)}
                        className="input bg-black border border-white/10 w-full text-white rounded-lg px-3 py-2 text-xs focus:border-brand-500 transition-all font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Inflation Rate (%)</label>
                      <input 
                        type="number" 
                        value={inflationInput}
                        onChange={(e) => setInflationInput(parseFloat(e.target.value) || 6.0)}
                        className="input bg-black border border-white/10 w-full text-white rounded-lg px-3 py-2 text-xs focus:border-brand-500 transition-all font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Risk Appetite</label>
                    <select
                      value={riskInput}
                      onChange={(e) => setRiskInput(e.target.value)}
                      className="input bg-black border border-white/10 w-full text-white rounded-lg px-3 py-2 text-xs focus:border-brand-500 transition-all font-mono py-2 px-3 text-xs"
                    >
                      <option value="conservative">Conservative (Debt & Bluechips)</option>
                      <option value="moderate">Moderate (Index & Balanced)</option>
                      <option value="aggressive">Aggressive (Mid & Smallcaps Alpha)</option>
                    </select>
                  </div>

                  <button
                    onClick={runWealthSimulation}
                    disabled={simulationLoading}
                    className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-800 disabled:text-gray-500 rounded-xl text-xs font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-2 shadow-md shadow-brand-500/10"
                  >
                    {simulationLoading ? <RefreshCw className="animate-spin" size={14} /> : <Bot size={14} />}
                    Simulate Projections
                  </button>
                </div>
              </div>

              {/* Output Display Card */}
              <div className="lg:col-span-2 space-y-6">
                {wealthSimulation ? (
                  <div className="card bg-black/60 border border-white/5 p-6 rounded-2xl space-y-5 animate-slide-up">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase font-bold block">Estimated Future Value</span>
                        <div className="text-3xl font-black text-brand-400 font-mono mt-1">₹{wealthSimulation.expected_wealth?.toLocaleString('en-IN')}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-gray-500 uppercase font-bold block">Probability of Success</span>
                        <div className="text-xl font-bold text-white font-mono mt-1">{wealthSimulation.success_probability}%</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 font-mono text-xs">
                      <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl text-center">
                        <span className="text-[9px] text-gray-500 block uppercase">Total Invested</span>
                        <span className="text-white font-bold block mt-1">₹{wealthSimulation.total_invested?.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl text-center">
                        <span className="text-[9px] text-gray-500 block uppercase">Interest Earned</span>
                        <span className="text-brand-400 font-bold block mt-1">+₹{wealthSimulation.earnings?.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl text-center">
                        <span className="text-[9px] text-gray-500 block uppercase">Expected CAGR</span>
                        <span className="text-white font-bold block mt-1">{wealthSimulation.expected_cagr}%</span>
                      </div>
                    </div>

                    {/* Prescribed Allocation Target Map */}
                    <div className="space-y-3.5 pt-2">
                      <span className="text-xs font-bold text-white uppercase block font-sans">Suggested Goal-Based Allocation</span>
                      <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
                        <div className="p-2.5 bg-brand-500/5 border border-brand-500/10 rounded-xl">
                          <span className="text-[9px] text-gray-500 uppercase block font-sans">Bluechips</span>
                          <span className="text-white font-bold block mt-1">45%</span>
                        </div>
                        <div className="p-2.5 bg-brand-500/5 border border-brand-500/10 rounded-xl">
                          <span className="text-[9px] text-gray-500 uppercase block font-sans">Mid-Caps</span>
                          <span className="text-white font-bold block mt-1">30%</span>
                        </div>
                        <div className="p-2.5 bg-brand-500/5 border border-brand-500/10 rounded-xl">
                          <span className="text-[9px] text-gray-500 uppercase block font-sans">Small-Caps</span>
                          <span className="text-white font-bold block mt-1">15%</span>
                        </div>
                        <div className="p-2.5 bg-brand-500/5 border border-brand-500/10 rounded-xl">
                          <span className="text-[9px] text-gray-500 uppercase block font-sans">Cash Buffer</span>
                          <span className="text-white font-bold block mt-1">10%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="card text-center py-16 text-xs text-gray-500 bg-white/[0.01] border-white/5 h-full flex flex-col items-center justify-center">
                    <Bot size={28} className="text-gray-600 mb-2" />
                    <span>Run the simulation model on the left to project long-term wealth limits.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Delete Chat Session"
        message="Are you sure you want to delete this chat session? This will erase all message history in this conversation."
        confirmText="Delete"
        cancelText="Keep Chat"
        type="danger"
        onConfirm={executeDeleteSession}
        onCancel={() => {
          setDeleteConfirmOpen(false)
          setSessionIdToDelete(null)
        }}
      />
    </div>
  )
}

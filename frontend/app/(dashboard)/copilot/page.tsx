'use client'
import { useState, useEffect, useRef } from 'react'
import { 
  Bot, Send, Trash2, Plus, RefreshCw, AlertTriangle, 
  TrendingUp, TrendingDown, Search, Sparkles, Activity, 
  Percent, ShieldAlert, DollarSign, Layers, CheckCircle 
} from 'lucide-react'
import { copilotApi } from '@/lib/api'
import toast from 'react-hot-toast'
import ConfirmModal from '@/components/ui/ConfirmModal'

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

export default function CopilotPage() {
  const [activeTab, setActiveTab] = useState<'chat' | 'portfolio' | 'whatif' | 'screener' | 'earnings' | 'recommendations'>('chat')
  
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

  // ── Initial Load ───────────────────────────────────────────
  useEffect(() => {
    fetchSessions()
    loadPortfolioIntel()
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
            { id: 'portfolio', label: 'Portfolio Intel' },
            { id: 'whatif', label: 'What-If Stress' },
            { id: 'screener', label: 'AI Screener' },
            { id: 'earnings', label: 'Earnings Agent' },
            { id: 'recommendations', label: 'Recommender' }
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id)
                if (tab.id === 'portfolio') loadPortfolioIntel()
                if (tab.id === 'recommendations') loadRecommendations()
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
                  </div>

                  {/* Drawdown Warning Card */}
                  <div className="card bg-white/[0.01] border-white/5 space-y-3.5">
                    <h3 className="section-title text-red-400"><TrendingDown size={14} /> Stress Limitations</h3>
                    <p className="text-xs text-gray-400 leading-relaxed">Estimates the maximum projected asset drop under standard 95% Value-at-Risk market conditions.</p>
                    <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl flex items-center justify-between">
                      <span className="text-xs font-semibold text-red-400">Max Projected Drop</span>
                      <span className="text-sm font-bold text-red-400 font-mono">-{portfolioIntel.max_drawdown_est}%</span>
                    </div>
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

        {/* ── TAB 4: AI STOCK SCREENER ────────────────────────── */}
        {activeTab === 'screener' && (
          <div className="space-y-6">
            <div className="card bg-white/[0.01] border-white/5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">AI Stock Screener</h3>
                <p className="text-xs text-gray-500 mt-0.5">Filter database equities against core financial criteria paired with AI highlights.</p>
              </div>

              {/* Selection Pills */}
              <div className="flex flex-wrap gap-2 pt-2 border-b border-surface-border/50 pb-4">
                {([
                  { type: 'growth', label: '🚀 Growth Opportunities' },
                  { type: 'value', label: '💎 Traditional Value' },
                  { type: 'dividend', label: '💵 High Yield Dividend' },
                  { type: 'momentum', label: '📈 Relative Momentum' },
                  { type: 'undervalued', label: '🔥 Undervalued compounders' }
                ] as const).map(pill => (
                  <button
                    key={pill.type}
                    onClick={() => {
                      setScreenerType(pill.type)
                      runScreener(pill.type)
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      screenerType === pill.type
                        ? 'bg-brand-500/10 border-brand-500/30 text-brand-400'
                        : 'border-white/5 hover:border-white/10 hover:bg-white/[0.01] text-gray-400'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              {/* Loader */}
              {screenerLoading && (
                <div className="text-center py-12 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="animate-spin text-brand-500" size={20} />
                  <span className="text-xs text-gray-500">Querying database matching criteria…</span>
                </div>
              )}

              {/* Screener Results */}
              {!screenerLoading && screenerData && (
                <div className="space-y-4 pt-2 animate-slide-up">
                  <p className="text-xs text-gray-400 italic">Screener Details: {screenerData.description}</p>
                  
                  {screenerData.stocks.length === 0 ? (
                    <div className="text-center py-6 text-xs text-gray-500">No stocks matching criteria found in database.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {screenerData.stocks.map((stk: any, i: number) => (
                        <div key={i} className="p-4 bg-white/[0.01] border border-white/[0.03] rounded-2xl space-y-3 relative overflow-hidden hover:border-brand-500/20 transition-all duration-300">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xs font-bold text-white uppercase bg-white/[0.03] border border-white/5 px-2 py-0.5 rounded">
                                {stk.ticker}
                              </span>
                              <span className="text-[10px] text-gray-500 font-mono">{stk.sector}</span>
                            </div>
                            <span className="text-xs font-bold text-white font-mono">₹{stk.current_price?.toLocaleString('en-IN')}</span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-400 font-mono bg-black/20 p-2 rounded-xl">
                            <div>P/E: <span className="text-white font-bold">{stk.pe ? `${stk.pe}x` : 'N/A'}</span></div>
                            <div>ROCE: <span className="text-white font-bold">{stk.roce ? `${stk.roce}%` : 'N/A'}</span></div>
                            <div>Yield: <span className="text-white font-bold">{stk.dividend_yield ? `${stk.dividend_yield}%` : '0%'}</span></div>
                          </div>

                          {/* AI Narrative highlight */}
                          <div className="p-3 bg-brand-500/5 border border-brand-500/10 rounded-xl flex items-start gap-2.5 text-[11px] text-brand-300 leading-relaxed font-semibold">
                            <Sparkles size={12} className="shrink-0 mt-0.5 text-brand-400" />
                            <p>{stk.ai_highlight}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 5: EARNINGS AGENT ───────────────────────────── */}
        {activeTab === 'earnings' && (
          <div className="space-y-6">
            <div className="card bg-white/[0.01] border-white/5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Earnings Intelligence Agent</h3>
                <p className="text-xs text-gray-500 mt-0.5">Parse recent quarterly financials, sentiment indicators, and guidance outputs.</p>
              </div>

              {/* Ticker Search input */}
              <form onSubmit={searchEarnings} className="flex gap-2 max-w-sm pt-2">
                <input
                  type="text"
                  placeholder="Enter Ticker (e.g. SIGMAADV)"
                  value={earningsTicker}
                  onChange={(e) => setEarningsTicker(e.target.value.toUpperCase())}
                  disabled={earningsLoading}
                  className="input bg-black border border-white/10"
                />
                <button
                  type="submit"
                  disabled={earningsLoading || !earningsTicker.trim()}
                  className="btn-primary py-2 px-4 rounded-xl flex items-center justify-center gap-2 hover:shadow-[0_0_15px_rgba(38,163,102,0.15)] transition-all shrink-0 text-xs font-semibold"
                >
                  {earningsLoading ? <RefreshCw className="animate-spin" size={14} /> : <Search size={14} />}
                  Analyze
                </button>
              </form>
            </div>

            {/* Results card */}
            {earningsData && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up">
                
                {/* Sentiment & Outlook overview */}
                <div className="md:col-span-1 space-y-6">
                  {/* Sentiment summary */}
                  <div className="card bg-white/[0.01] border-white/5 space-y-4">
                    <h3 className="section-title text-white">Earnings Sentiment</h3>
                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-gray-500">Maturity Sentiment</span>
                        <div className={`text-2xl font-extrabold mt-0.5 ${
                          earningsData.sentiment === 'Positive' ? 'text-brand-400' : 
                          (earningsData.sentiment === 'Negative' ? 'text-red-400' : 'text-gray-400')
                        }`}>{earningsData.sentiment}</div>
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 border border-white/10 font-bold font-mono">
                        {earningsData.sentiment === 'Positive' ? '▲' : (earningsData.sentiment === 'Negative' ? '▼' : '■')}
                      </div>
                    </div>

                    <div className="divider" />

                    <div>
                      <span className="text-[9px] uppercase font-bold text-gray-500">Guidance Outlook</span>
                      <div className="text-xs font-semibold text-white mt-1">{earningsData.guidance_outlook}</div>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-gray-500">Management Confidence</span>
                      <div className="text-xs font-semibold text-white mt-1">{earningsData.management_confidence} Level</div>
                    </div>
                  </div>
                </div>

                {/* Narrative Earnings Summary */}
                <div className="md:col-span-2 card bg-white/[0.01] border-white/5 space-y-4">
                  <h3 className="section-title text-brand-400"><Sparkles size={14} /> Synthesized Earnings Summary</h3>
                  <p className="text-xs text-gray-200 leading-relaxed font-semibold">{earningsData.earnings_summary}</p>
                  
                  {earningsData.recent_quarter && (
                    <div className="mt-4 p-4 bg-black/40 border border-white/[0.03] rounded-2xl space-y-3">
                      <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Recent Quarter reported metrics</span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1 font-mono text-xs">
                        <div>Sales: <span className="text-white font-bold block mt-0.5">₹{earningsData.recent_quarter.sales} Cr</span></div>
                        <div>Net Profit: <span className="text-white font-bold block mt-0.5">₹{earningsData.recent_quarter.net_profit} Cr</span></div>
                        <div>OPM: <span className="text-white font-bold block mt-0.5">{earningsData.recent_quarter.opm_pct}%</span></div>
                        <div>Quarter: <span className="text-white font-bold block mt-0.5">{earningsData.recent_quarter.quarter || 'N/A'}</span></div>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

        {/* ── TAB 6: RECOMMENDATION ENGINE ────────────────────── */}
        {activeTab === 'recommendations' && (
          <div className="space-y-6">
            {recsLoading ? (
              <div className="card text-center py-12 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="animate-spin text-brand-500" size={24} />
                <span className="text-xs text-gray-500">Analyzing watchlist and holdings parameters…</span>
              </div>
            ) : recsData ? (
              <div className="card bg-white/[0.01] border-white/5 space-y-4 animate-slide-up">
                <div>
                  <h3 className="text-sm font-semibold text-white">AI Portfolio Recommender</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Personalized adjustments generated dynamically based on active technical indicators and holdings.</p>
                </div>

                <div className="space-y-3 pt-2">
                  {recsData.recommendations.map((rec: any, i: number) => (
                    <div key={i} className="p-4 bg-white/[0.01] border border-white/[0.03] rounded-2xl flex items-start gap-4 hover:border-white/10 transition-colors duration-300">
                      <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold border ${
                        rec.type === 'portfolio' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-brand-500/10 border-brand-500/20 text-brand-400'
                      }`}>
                        {rec.type === 'portfolio' ? 'P' : 'W'}
                      </div>
                      
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{rec.action}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            rec.impact === 'High' ? 'bg-red-500/15 text-red-400' : 'bg-brand-500/15 text-brand-400'
                          }`}>{rec.impact} Impact</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-normal">{rec.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card text-center py-12 text-xs text-gray-500">No suggestions compiled. Add tickers to watchlist or portfolio.</div>
            )}
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

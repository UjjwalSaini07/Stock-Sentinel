'use client'
import { useState, useEffect } from 'react'
import { 
  Send, CheckCircle2, ExternalLink, Copy, ChevronDown, 
  Eye, EyeOff, Server, MessageSquare, RefreshCw, Trash2, AlertTriangle 
} from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { userApi } from '@/lib/api'
import toast from 'react-hot-toast'

export default function TelegramLinkCard() {
  const { user, refreshUser } = useAuthStore()
  const [showInstructions, setShowInstructions] = useState(true)
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectStep, setConnectStep] = useState(0)
  const [testSending, setTestSending] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Load existing credentials if linked
  useEffect(() => {
    if (user?.telegram_linked) {
      setBotToken(user.telegram_bot_token || '')
      setChatId(user.telegram_chat_id || '')
      setShowInstructions(false)
    } else {
      setShowInstructions(true)
    }
  }, [user])

  // Connection steps telemetry
  const stepsLogs = [
    { text: 'Resolving secure API route to Telegram gateway...', delay: 0 },
    { text: 'Transmitting handshake to bot authorization node...', delay: 1200 },
    { text: 'Syncing telemetry parameters to MongoDB Atlas cluster...', delay: 2600 },
    { text: 'Activating notification callback channels...', delay: 3800 }
  ]

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    if (!botToken.trim() || !chatId.trim()) {
      toast.error('Please fill in both Bot Token and Chat ID')
      return
    }

    setIsConnecting(true)
    setConnectStep(0)

    // Simulate logs sequence for premium feel before calling API
    const timer1 = setTimeout(() => setConnectStep(1), 1200)
    const timer2 = setTimeout(() => setConnectStep(2), 2600)
    const timer3 = setTimeout(() => setConnectStep(3), 3800)

    try {
      // Perform API request in parallel, but wait for the animations to look complete
      const apiCall = userApi.linkTelegram(chatId.trim(), botToken.trim())
      
      // Wait for minimum animation duration (4.5 seconds) to ensure fluid motion experience
      await Promise.all([
        apiCall,
        new Promise(resolve => setTimeout(resolve, 4500))
      ])

      await refreshUser()
      toast.success('Telegram Bot linked successfully!')
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || 'Failed to establish connection'
      toast.error(errMsg)
    } finally {
      // Clear timers in case of early errors
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
      setIsConnecting(false)
      setConnectStep(0)
    }
  }

  async function handleDisconnect() {
    try {
      await userApi.linkTelegram('', '')
      await refreshUser()
      setBotToken('')
      setChatId('')
      setShowConfirm(false)
      toast.success('Telegram bot disconnected')
    } catch {
      toast.error('Failed to disconnect bot')
    }
  }

  async function handleSendTest() {
    setTestSending(true)
    try {
      await userApi.testTelegram()
      toast.success('Test welcome message transmitted successfully!')
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || 'Failed to send test message'
      toast.error(errMsg)
    } finally {
      setTestSending(false)
    }
  }

  // Render Connected State
  if (user?.telegram_linked) {
    if (showConfirm) {
      return (
        <div className="card relative overflow-hidden border-red-500/20 bg-red-950/10 p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.3)] animate-fade-in">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-red-500/5 blur-[80px] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0 shadow-lg shadow-red-500/5 animate-pulse">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="font-bold text-base text-red-300 font-sans">Disconnect Telegram Bot?</h3>
                <p className="text-gray-400 text-xs mt-1">
                  Once disconnected, you will stop receiving real-time stock alerts and summaries.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl text-white text-xs font-semibold transition-all duration-150 active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 border border-red-500/30 rounded-xl text-white text-xs font-bold transition-all duration-150 active:scale-95 shadow-lg shadow-red-500/10"
              >
                Yes, Disconnect
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="card relative overflow-hidden border-emerald-500/20 bg-emerald-950/10 p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.3)] animate-fade-in">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-emerald-500/5 blur-[80px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/5">
              <CheckCircle2 size={24} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-emerald-300">Telegram Console Linked</h3>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] uppercase font-mono rounded-full font-bold tracking-wider animate-pulse">
                  ACTIVE
                </span>
              </div>
              <p className="text-gray-400 text-xs mt-1">
                Real-time stock alerts will be transmitted to your private bot channel.
              </p>
              
              <div className="mt-3.5 flex flex-wrap gap-2.5 font-mono text-[10px] text-gray-500">
                <span className="px-2.5 py-1 bg-white/[0.02] border border-white/[0.04] rounded-lg">
                  BOT: <strong className="text-emerald-400">@{user.telegram_bot_username || 'CustomBot'}</strong> ({user.telegram_bot_name || 'Active'})
                </span>
                <span className="px-2.5 py-1 bg-white/[0.02] border border-white/[0.04] rounded-lg">
                  CHAT_ID: <strong className="text-gray-300">{user.telegram_chat_id}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleSendTest}
              disabled={testSending}
              className="px-4 py-2.5 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl text-emerald-400 text-xs font-semibold flex items-center gap-2 transition-all duration-150 active:scale-95 disabled:opacity-50"
            >
              {testSending ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Send size={13} />
              )}
              Transmit Test Alert
            </button>
            
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="p-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 rounded-xl transition-all duration-150 active:scale-95"
              title="Disconnect Telegram Bot"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card relative overflow-hidden border-white/5 bg-surface-card/65 p-6 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-fade-in">
      {/* CSS Stylesheet Injector for Premium Animations */}
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 0.3; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @keyframes flow-gradient {
          0% { stroke-dashoffset: 40; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes glow-breath {
          0%, 100% { opacity: 0.05; transform: scale(1); }
          50% { opacity: 0.15; transform: scale(1.08); }
        }
        .animate-pulse-ring {
          animation: pulse-ring 2.2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }
        .animate-flow-dash {
          stroke-dasharray: 8 5;
          animation: flow-gradient 1.5s linear infinite;
        }
        .animate-glow-breath {
          animation: glow-breath 4s ease-in-out infinite;
        }
      `}</style>

      {/* Background glow overlay */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-brand-500/5 animate-glow-breath blur-[100px] pointer-events-none" />

      {isConnecting ? (
        /* CONNECTING MOTION ANIMATION STATE */
        <div className="relative z-10 py-8 flex flex-col items-center justify-center min-h-[300px] text-center">
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-widest mb-1.5 animate-pulse">
            Establishing Secured Bridge
          </h3>
          <p className="text-gray-500 text-[10px] font-mono mb-8 uppercase tracking-wider">
            Connection Node Status: In Progress
          </p>

          {/* Node Link Graphic */}
          <div className="flex items-center justify-center gap-12 w-full max-w-sm mb-8 relative">
            
            {/* Left Node: StockSentinel */}
            <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/30 text-brand-400 shadow-[0_0_20px_rgba(38,163,102,0.15)] z-10">
              <div className="absolute inset-0 rounded-2xl border border-brand-500/40 animate-pulse-ring" />
              <Server size={22} className="relative z-10" />
              <span className="absolute -bottom-6 text-[8px] font-mono text-gray-500 uppercase tracking-widest font-bold">
                SENTINEL_SRV
              </span>
            </div>

            {/* Link Connector (SVG Flow Line) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
              <svg className="w-full h-8 px-14" viewBox="0 0 100 10" preserveAspectRatio="none">
                <line 
                  x1="0" y1="5" x2="100" y2="5" 
                  stroke="rgba(38, 163, 102, 0.4)" 
                  strokeWidth="1.5" 
                  className="animate-flow-dash" 
                />
              </svg>
            </div>

            {/* Right Node: Telegram API */}
            <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 shadow-[0_0_20px_rgba(14,165,233,0.15)] z-10">
              <div className="absolute inset-0 rounded-2xl border border-sky-500/40 animate-pulse-ring" style={{ animationDelay: '0.7s' }} />
              <MessageSquare size={22} className="relative z-10" />
              <span className="absolute -bottom-6 text-[8px] font-mono text-gray-500 uppercase tracking-widest font-bold">
                TELEGRAM_API
              </span>
            </div>
          </div>

          {/* Running Console Log */}
          <div className="w-full max-w-sm card bg-black/45 border border-white/5 p-4 rounded-xl font-mono text-[10px] text-left text-gray-400 space-y-2 mt-4 shadow-inner">
            {stepsLogs.map((log, idx) => (
              <div 
                key={idx} 
                className={`flex items-start gap-2 transition-all duration-300 ${
                  connectStep >= idx ? 'opacity-100 text-brand-400' : 'opacity-20'
                }`}
              >
                <span className="text-gray-600">▶</span>
                <div>
                  <span className="text-gray-500 font-bold">[{idx === 0 ? 'CONNECT' : idx === 1 ? 'AUTH' : idx === 2 ? 'DATABASE' : 'ACTIVE'}]</span>{' '}
                  {log.text}
                  {connectStep === idx && (
                    <span className="inline-block w-1.5 h-3 bg-brand-400 ml-1 animate-[pulse_0.8s_infinite]" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* INPUT CONFIGURATION STATE */
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-400">
                <Send size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Custom Telegram Bot Alerts</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Establish a secure connection with your own bot to receive stock alert telemetry.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="btn-outline text-xs flex items-center gap-1.5 py-1.5"
            >
              Setup Guide
              <ChevronDown size={13} className={`transition-transform duration-200 ${showInstructions ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* STEP BY STEP INSTRUCTIONS PANEL */}
          {showInstructions && (
            <div className="mt-5 space-y-4 p-4 border border-white/[0.04] bg-black/25 rounded-xl animate-fade-in relative">
              <div className="absolute top-3 right-3 text-[10px] font-mono text-gray-600 uppercase font-bold tracking-wider">
                GUIDE // SETUP_V2
              </div>
              
              <div className="space-y-3.5">
                {/* Step 1 */}
                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 font-mono">
                    01
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-300 font-semibold">Generate Bot via BotFather</p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Search for <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline inline-flex items-center gap-0.5 font-semibold">@BotFather <ExternalLink size={10} /></a> on Telegram. Send <code className="bg-white/5 px-1 py-0.5 rounded text-gray-300">/newbot</code>, name your bot, and copy the generated <strong>HTTP API Bot Token</strong>.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 font-mono">
                     02
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-300 font-semibold">Retrieve Your Chat ID</p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Start your new bot by pressing <strong>Start</strong>. Then, search for <a href="https://t.me/getidsbot" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline inline-flex items-center gap-0.5 font-semibold">@getidsbot <ExternalLink size={10} /></a> on Telegram, send a message, and copy your numerical <strong>User ID</strong> (shown as Chat ID).
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 font-mono">
                    03
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-300 font-semibold">Verify Connection</p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Paste both credentials into the inputs below and click <strong>Establish Bot Connection</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CREDENTIALS FORM */}
          <form onSubmit={handleConnect} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bot Token Field */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">
                  Telegram Bot HTTP API Token
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="e.g. 8618326216:AAE-LzhD36..."
                    className="w-full bg-white/[0.02] border border-white/10 focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 rounded-xl px-4 py-3 text-xs text-white placeholder-gray-600 transition-all duration-200 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Chat ID Field */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-gray-400">
                  Telegram Chat ID / User ID
                </label>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="e.g. 1458044416"
                  className="w-full bg-white/[0.02] border border-white/10 focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 rounded-xl px-4 py-3 text-xs text-white placeholder-gray-600 transition-all duration-200"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="w-full md:w-auto px-6 py-3 bg-brand-500 hover:bg-brand-600 text-black text-xs font-bold rounded-xl transition-all duration-150 active:scale-95 shadow-lg shadow-brand-500/10 flex items-center justify-center gap-2"
              >
                <Send size={13} />
                Establish Bot Connection
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

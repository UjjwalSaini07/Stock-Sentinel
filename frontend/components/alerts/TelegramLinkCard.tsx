'use client'
import { useState } from 'react'
import { Send, CheckCircle2, ExternalLink, Copy, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import toast from 'react-hot-toast'

export default function TelegramLinkCard() {
  const { user } = useAuthStore()
  const [showInstructions, setShowInstructions] = useState(false)
  const accessToken = typeof window !== 'undefined' ? localStorage.getItem('access_token') : ''
  const botUsername = 'YourStockSentinelBot'

  function copyToken() {
    if (accessToken) {
      navigator.clipboard.writeText(`/start ${accessToken}`)
      toast.success('Command copied!')
    }
  }

  if (user?.telegram_linked) {
    return (
      <div className="card flex items-center gap-4 border-brand-500/20 bg-brand-500/5">
        <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center shrink-0">
          <CheckCircle2 className="text-brand-400" size={20} />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm text-brand-300">Telegram Connected</div>
          <div className="text-xs text-gray-500 mt-0.5">Price alerts will be sent to your Telegram instantly</div>
        </div>
        <span className="badge-green">Active</span>
      </div>
    )
  }

  return (
    <div className="card border-amber-500/15 bg-amber-500/3">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
          <Send className="text-amber-400" size={18} />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm text-white">Connect Telegram</div>
          <div className="text-xs text-gray-500 mt-0.5">Get instant alerts when your price targets are hit</div>
        </div>
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="btn-outline text-xs flex items-center gap-1.5"
        >
          Link Bot
          <ChevronDown size={13} className={`transition-transform ${showInstructions ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {showInstructions && (
        <div className="mt-4 space-y-3 animate-slide-up">
          <div className="divider" />
          {[
            {
              step: '1',
              text: <>Open Telegram and search <strong className="text-white font-mono">@{botUsername}</strong></>
            },
            {
              step: '2',
              text: <>Tap <strong className="text-white">Start</strong>, then send this command:</>
            },
          ].map(s => (
            <div key={s.step} className="flex gap-3">
              <div className="w-5 h-5 rounded-full bg-surface-border text-xs font-bold flex items-center justify-center text-gray-400 shrink-0 mt-0.5">{s.step}</div>
              <p className="text-xs text-gray-400">{s.text}</p>
            </div>
          ))}
          <div className="ml-8 relative group">
            <code className="block bg-surface-card border border-surface-border rounded-lg px-3 py-2.5 text-xs font-mono text-brand-400 break-all pr-10">
              /start {accessToken ? `${accessToken.slice(0, 20)}…` : '<your-token>'}
            </code>
            <button
              onClick={copyToken}
              className="absolute right-2 top-1/2 -translate-y-1/2 btn-icon opacity-0 group-hover:opacity-100 transition-opacity"
              title="Copy command"
            >
              <Copy size={13} />
            </button>
          </div>
          <div className="flex gap-3 ml-8">
            <div className="w-5 h-5 rounded-full bg-surface-border text-xs font-bold flex items-center justify-center text-gray-400 shrink-0">3</div>
            <p className="text-xs text-gray-400">You'll receive a confirmation. Refresh this page to see status ✅</p>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'
import { Trash2, Target, ShieldAlert, Clock, CheckCircle2 } from 'lucide-react'
import { Alert } from '@/types'

interface Props {
  alert: Alert
  onDelete: (id: string) => void
  onToggle: (id: string) => void
}

export default function AlertCard({ alert, onDelete, onToggle }: Props) {
  const triggered = !!alert.triggered_at
  const createdAt = new Date(alert.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

  return (
    <div className={`group flex items-center gap-4 p-4 rounded-xl border transition-all duration-150 ${
      triggered
        ? 'bg-surface-muted/50 border-surface-border opacity-70'
        : alert.is_active
          ? 'bg-surface-muted border-surface-border hover:border-brand-500/25'
          : 'bg-surface-muted/50 border-surface-border'
    }`}>
      {/* Ticker avatar */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
        triggered ? 'bg-amber-500/10 text-amber-400' :
        alert.is_active ? 'bg-brand-500/10 text-brand-400' :
        'bg-surface-card text-gray-500'
      }`}>
        {triggered ? <CheckCircle2 size={18} /> : alert.ticker.slice(0, 2)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm">{alert.ticker}</span>
          {triggered && <span className="badge-amber text-[10px]">Triggered</span>}
          {!alert.is_active && !triggered && <span className="badge-gray text-[10px]">Paused</span>}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {alert.buy_price && (
            <span className="text-gray-400 font-medium bg-surface-border/50 px-1.5 py-0.5 rounded">
              Buy: ₹{alert.buy_price.toLocaleString('en-IN')}
            </span>
          )}
          {alert.target_price && (
            <span className="flex items-center gap-1 text-brand-400/80">
              <Target size={11} />
              ₹{alert.target_price.toLocaleString('en-IN')}
            </span>
          )}
          {alert.stop_loss && (
            <span className="flex items-center gap-1 text-red-400/80">
              <ShieldAlert size={11} />
              ₹{alert.stop_loss.toLocaleString('en-IN')}
            </span>
          )}
          <span className="flex items-center gap-1 text-gray-600">
            <Clock size={10} /> {triggered && alert.triggered_at
              ? `Hit ${new Date(alert.triggered_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
              : createdAt}
          </span>
        </div>
        {alert.note && <p className="text-xs text-gray-600 mt-1 truncate">{alert.note}</p>}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 shrink-0">
        {!triggered && (
          <button
            onClick={() => onToggle(alert.id)}
            className={`relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30 ${
              alert.is_active ? 'bg-brand-500' : 'bg-surface-border'
            }`}
            title={alert.is_active ? 'Pause alert' : 'Activate alert'}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
              alert.is_active ? 'translate-x-4' : ''
            }`} />
          </button>
        )}
        <button
          onClick={() => onDelete(alert.id)}
          className="btn-icon opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all"
          title="Delete alert"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

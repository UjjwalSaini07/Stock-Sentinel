'use client'
import Link from 'next/link'
import { PortfolioEntry } from '@/types'
import { Trash2, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react'

interface Props {
  entry: PortfolioEntry
  onRemove: (ticker: string) => void
}

export default function HoldingRow({ entry, onRemove }: Props) {
  const pnl = entry.pnl ?? 0
  const pnlPct = entry.pnl_percent ?? 0
  const positive = pnl >= 0
  const currentValue = (entry.current_price ?? entry.buy_price) * entry.quantity
  const invested = entry.buy_price * entry.quantity
  const gainPct = Math.min(Math.max(pnlPct, -100), 100)
  const barWidth = Math.abs(gainPct)

  return (
    <div className="group flex items-center gap-3 py-3.5 px-4 hover:bg-surface-muted/60 rounded-xl transition-all duration-150 border border-transparent hover:border-surface-border">
      {/* Avatar */}
      <Link href={`/stock/${entry.ticker}`} className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
          positive
            ? 'bg-brand-500/12 text-brand-400 group-hover:bg-brand-500/20'
            : 'bg-red-500/12 text-red-400 group-hover:bg-red-500/20'
        }`}>
          {entry.ticker.slice(0, 2)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{entry.ticker}</span>
            <span className="text-[10px] text-gray-600">{entry.exchange}</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {entry.quantity} × ₹{entry.buy_price.toLocaleString('en-IN')}
          </div>
          {/* Mini P&L bar */}
          <div className="mt-1.5 h-0.5 w-20 bg-surface-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${positive ? 'bg-brand-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(barWidth, 100)}%` }}
            />
          </div>
        </div>
      </Link>

      {/* Values */}
      <div className="text-right shrink-0">
        <div className="font-mono font-semibold text-sm">
          ₹{currentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </div>
        <div className={`flex items-center justify-end gap-0.5 text-xs font-semibold mt-0.5 ${positive ? 'text-brand-400' : 'text-red-400'}`}>
          {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {positive ? '+' : ''}₹{Math.abs(pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          <span className="text-gray-600 font-normal ml-0.5">({positive ? '+' : ''}{pnlPct.toFixed(1)}%)</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
        <Link href={`/stock/${entry.ticker}`} className="btn-icon">
          <ChevronRight size={15} />
        </Link>
        <button
          onClick={(e) => { e.preventDefault(); onRemove(entry.ticker) }}
          className="btn-icon hover:text-red-400 hover:bg-red-500/10"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

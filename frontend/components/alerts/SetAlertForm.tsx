'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Target, ShieldAlert, Bell, Info, BadgeDollarSign } from 'lucide-react'
import { alertApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'

interface Props {
  ticker: string
  currentPrice: number | null
  onCreated: () => void
}

export default function SetAlertForm({ ticker, currentPrice, onCreated }: Props) {
  const { user } = useAuthStore()
  const holding = user?.portfolio?.find(p => p.ticker === ticker.toUpperCase())

  const [buyPrice, setBuyPrice] = useState('')
  const [target, setTarget] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (holding?.buy_price) {
      setBuyPrice(holding.buy_price.toString())
    }
  }, [holding])

  const targetNum = parseFloat(target)
  const slNum = parseFloat(stopLoss)
  const targetPct = currentPrice && target ? ((targetNum - currentPrice) / currentPrice * 100) : null
  const slPct = currentPrice && stopLoss ? ((slNum - currentPrice) / currentPrice * 100) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!target && !stopLoss) { toast.error('Set at least a target or stop loss'); return }
    if (target && currentPrice && targetNum <= currentPrice) { toast.error('Target price should be above current price'); return }
    if (stopLoss && currentPrice && slNum >= currentPrice) { toast.error('Stop loss should be below current price'); return }
    setLoading(true)
    try {
      await alertApi.create({
        ticker,
        exchange: 'NSE',
        buy_price: buyPrice ? parseFloat(buyPrice) : null,
        target_price: target ? parseFloat(target) : null,
        stop_loss: stopLoss ? parseFloat(stopLoss) : null,
        note: note.trim() || null,
      })
      toast.success(`Alert set for ${ticker}`)
      setTarget(''); setStopLoss(''); setNote('')
      onCreated()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to set alert')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Buy Price */}
      <div>
        <label className="stat-label flex items-center gap-1 mb-1.5">
          <BadgeDollarSign size={11} className="text-brand-400" /> Buy Price (optional)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
          <input
            className="input pl-7 font-mono"
            type="number"
            step="0.01"
            min="0.01"
            placeholder={currentPrice ? currentPrice.toFixed(0) : '0'}
            value={buyPrice}
            onChange={e => setBuyPrice(e.target.value)}
          />
        </div>
        <p className="text-[10px] text-gray-500 mt-1">
          Used to calculate alert triggers and display returns relative to purchase price.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Target */}
        <div>
          <label className="stat-label flex items-center gap-1 mb-1.5">
            <Target size={11} className="text-brand-400" /> Target Price
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
            <input
              className="input pl-7 font-mono"
              type="number"
              step="0.01"
              min="0.01"
              placeholder={currentPrice ? (currentPrice * 1.1).toFixed(0) : '0'}
              value={target}
              onChange={e => setTarget(e.target.value)}
            />
          </div>
          {targetPct !== null && (
            <p className={`text-xs mt-1 font-mono ${targetPct > 0 ? 'text-brand-400' : 'text-red-400'}`}>
              {targetPct > 0 ? '▲' : '▼'} {Math.abs(targetPct).toFixed(1)}% from current
            </p>
          )}
        </div>

        {/* Stop Loss */}
        <div>
          <label className="stat-label flex items-center gap-1 mb-1.5">
            <ShieldAlert size={11} className="text-red-400" /> Stop Loss
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
            <input
              className="input pl-7 font-mono"
              type="number"
              step="0.01"
              min="0.01"
              placeholder={currentPrice ? (currentPrice * 0.9).toFixed(0) : '0'}
              value={stopLoss}
              onChange={e => setStopLoss(e.target.value)}
            />
          </div>
          {slPct !== null && (
            <p className={`text-xs mt-1 font-mono ${slPct < 0 ? 'text-red-400' : 'text-brand-400'}`}>
              {slPct > 0 ? '▲' : '▼'} {Math.abs(slPct).toFixed(1)}% from current
            </p>
          )}
        </div>
      </div>

      {/* Note */}
      <div>
        <label className="stat-label block mb-1.5">Note (optional)</label>
        <input
          className="input"
          placeholder="e.g. Breakout target, Quarterly results play"
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </div>

      <button className="btn-primary w-full flex items-center justify-center gap-2" type="submit" disabled={loading}>
        {loading
          ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : <><Bell size={15} /> Set Alert</>
        }
      </button>
      <div className="flex items-center gap-1.5 text-xs text-gray-500 justify-center">
        <Info size={11} />
        You'll receive a Telegram notification when triggered
      </div>
    </form>
  )
}

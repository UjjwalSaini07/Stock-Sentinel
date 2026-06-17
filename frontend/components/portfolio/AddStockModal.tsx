'use client'
import { useState, useEffect } from 'react'
import { X, Search, Plus, Calendar, FileText, Hash } from 'lucide-react'
import toast from 'react-hot-toast'
import { userApi, stockApi } from '@/lib/api'

interface Props {
  onClose: () => void
  onAdded: () => void
}

export default function AddStockModal({ onClose, onAdded }: Props) {
  const [ticker, setTicker] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [buyDate, setBuyDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [exchange, setExchange] = useState('NSE')
  const [loading, setLoading] = useState(false)
  const [livePrice, setLivePrice] = useState<number | null>(null)
  const [fetchingPrice, setFetchingPrice] = useState(false)

  // Fetch live price when ticker changes
  useEffect(() => {
    if (ticker.length < 2) { setLivePrice(null); return }
    const t = setTimeout(async () => {
      setFetchingPrice(true)
      try {
        const { data } = await stockApi.get(ticker.toUpperCase())
        if (data.current_price) setLivePrice(data.current_price)
      } catch { setLivePrice(null) } finally { setFetchingPrice(false) }
    }, 500)
    return () => clearTimeout(t)
  }, [ticker])

  const totalValue = buyPrice && quantity ? parseFloat(buyPrice) * parseFloat(quantity) : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!buyPrice || !quantity || parseFloat(buyPrice) <= 0 || parseFloat(quantity) <= 0) {
      toast.error('Enter valid price and quantity')
      return
    }
    setLoading(true)
    try {
      await userApi.addToPortfolio({
        ticker: ticker.toUpperCase().trim(),
        exchange,
        buy_price: parseFloat(buyPrice),
        quantity: parseFloat(quantity),
        buy_date: buyDate,
        notes: notes.trim() || null,
      })
      toast.success(`${ticker.toUpperCase()} added to portfolio`)
      onAdded()
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to add stock')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold">Add to Portfolio</h2>
            <p className="text-xs text-gray-500 mt-0.5">Track a new stock position</p>
          </div>
          <button onClick={onClose} className="btn-icon"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Ticker + Exchange row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="stat-label block mb-1.5">Ticker Symbol</label>
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  className="input pl-9 uppercase"
                  value={ticker}
                  onChange={e => setTicker(e.target.value)}
                  placeholder="RELIANCE"
                  required
                  autoFocus
                />
              </div>
              {livePrice && (
                <p className="text-xs text-brand-400 mt-1 font-mono">
                  Live: ₹{livePrice.toLocaleString('en-IN')}
                  <button type="button" onClick={() => setBuyPrice(livePrice.toString())} className="ml-2 text-brand-300 hover:text-brand-200 underline">
                    Use price
                  </button>
                </p>
              )}
              {fetchingPrice && <p className="text-xs text-gray-500 mt-1">Fetching price…</p>}
            </div>
            <div>
              <label className="stat-label block mb-1.5">Exchange</label>
              <select
                className="input"
                value={exchange}
                onChange={e => setExchange(e.target.value)}
              >
                <option value="NSE">NSE</option>
                <option value="BSE">BSE</option>
              </select>
            </div>
          </div>

          {/* Price + Qty */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="stat-label block mb-1.5">
                <span className="flex items-center gap-1"><Hash size={11} /> Buy Price (₹)</span>
              </label>
              <input
                className="input font-mono"
                type="number"
                step="0.01"
                min="0.01"
                value={buyPrice}
                onChange={e => setBuyPrice(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className="stat-label block mb-1.5">
                <span className="flex items-center gap-1"><Hash size={11} /> Quantity</span>
              </label>
              <input
                className="input font-mono"
                type="number"
                step="1"
                min="1"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="1"
                required
              />
            </div>
          </div>

          {/* Total value preview */}
          {totalValue > 0 && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-brand-500/8 border border-brand-500/15">
              <span className="text-xs text-gray-400">Total invested</span>
              <span className="font-mono font-bold text-brand-400">
                ₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="stat-label block mb-1.5">
              <span className="flex items-center gap-1"><Calendar size={11} /> Buy Date</span>
            </label>
            <input
              className="input"
              type="date"
              value={buyDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setBuyDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="stat-label block mb-1.5">
              <span className="flex items-center gap-1"><FileText size={11} /> Notes (optional)</span>
            </label>
            <input
              className="input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Long term hold, SIP, etc."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline flex-1">Cancel</button>
            <button className="btn-primary flex-1 flex items-center justify-center gap-2" type="submit" disabled={loading}>
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><Plus size={16} /> Add Stock</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

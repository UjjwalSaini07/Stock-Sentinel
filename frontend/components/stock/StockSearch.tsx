'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, TrendingUp, TrendingDown, Loader2 } from 'lucide-react'
import { stockApi } from '@/lib/api'
import { SearchResult } from '@/types'

interface Props {
  compact?: boolean
  onSelect?: () => void
}

export default function StockSearch({ compact, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return }
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const { data } = await stockApi.search(query)
        setResults(data)
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 280)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Global "/" shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  function handleSelect(ticker: string) {
    router.push(`/stock/${ticker}`)
    setOpen(false)
    setQuery('')
    onSelect?.()
  }

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        {searching
          ? <Loader2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400 animate-spin" />
          : <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
        }
        <input
          ref={inputRef}
          className={`input ${compact ? 'pl-9 py-2 text-xs' : 'pl-10 py-3'}`}
          placeholder={compact ? 'Search ticker…' : 'Search NSE stocks — e.g. RELIANCE, INFY, TCS'}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute mt-2 w-full bg-surface-card border border-surface-border rounded-xl shadow-2xl z-50 overflow-hidden animate-slide-up">
          <div className="px-3 py-2 border-b border-surface-border">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
              {results.length} results
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {results.map(r => {
              const pos = r.change_pct !== null && r.change_pct !== undefined ? r.change_pct >= 0 : null
              return (
                <button
                  key={r.ticker}
                  onClick={() => handleSelect(r.ticker)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-muted text-left transition-colors border-b border-surface-border/50 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface-muted flex items-center justify-center text-xs font-bold text-brand-400 shrink-0">
                      {r.ticker.slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{r.ticker}</div>
                      {r.company_name && <div className="text-xs text-gray-500">{r.company_name}</div>}
                      {!r.company_name && <div className="text-xs text-gray-600">{r.exchange}</div>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-medium">
                      {r.current_price ? `₹${r.current_price.toLocaleString('en-IN')}` : '—'}
                    </div>
                    {pos !== null && r.change_pct !== undefined && r.change_pct !== null && (
                      <div className={`flex items-center justify-end gap-0.5 text-xs font-medium ${pos ? 'text-brand-400' : 'text-red-400'}`}>
                        {pos ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {pos ? '+' : ''}{r.change_pct.toFixed(2)}%
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
          <button
            onClick={() => handleSelect(query.toUpperCase())}
            className="w-full flex items-center gap-2 px-4 py-3 bg-surface-muted/30 hover:bg-surface-muted text-left transition-colors border-t border-surface-border text-brand-400 text-xs font-semibold"
          >
            <Search size={14} /> Scrape & Track custom ticker "{query.toUpperCase()}"
          </button>
        </div>
      )}

      {open && query.length > 0 && results.length === 0 && !searching && (
        <div className="absolute mt-2 w-full bg-surface-card border border-surface-border rounded-xl shadow-2xl z-50 p-5 text-center animate-fade-in">
          <p className="text-gray-400 text-sm font-medium">No results in database for <span className="text-white">"{query}"</span></p>
          <p className="text-gray-600 text-xs mt-1 mb-4">Try checking if Screener or Google Finance lists it.</p>
          <button
            onClick={() => handleSelect(query.toUpperCase())}
            className="btn-primary w-full py-2 text-xs flex items-center justify-center gap-1.5"
          >
            <Search size={13} /> Scrape & Track "{query.toUpperCase()}"
          </button>
        </div>
      )}
    </div>
  )
}

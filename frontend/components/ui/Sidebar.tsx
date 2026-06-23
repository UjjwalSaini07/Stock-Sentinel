'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Eye, Bell, LogOut, TrendingUp, ChevronRight, Search, Bot, Cpu, Globe } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { useState } from 'react'
import StockSearch from '@/components/stock/StockSearch'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, desc: 'Portfolio overview' },
  { href: '/watchlist', label: 'Watchlist', icon: Eye, desc: 'Track stocks' },
  { href: '/intel', label: 'Market Intelligence', icon: Globe, desc: 'Bloomberg-style terminal' },
  { href: '/alerts', label: 'Alerts', icon: Bell, desc: 'Price notifications' },
  { href: '/copilot', label: 'AI Copilot', icon: Bot, desc: 'AI assistant' },
  { href: '/quant', label: 'Quant Lab', icon: TrendingUp, desc: 'Quantitative research' },
  { href: '/architecture', label: 'System Architecture', icon: Cpu, desc: 'Platform blueprint' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [showSearch, setShowSearch] = useState(false)

  function handleLogout() {
    logout()
    router.push('/login')
  }

  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'

  return (
    <aside className="w-[240px] h-screen bg-surface-card/65 backdrop-blur-xl border-r border-surface-border/50 flex flex-col fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-surface-border/40">
        <div className="flex items-center gap-2.5">
          <img src="/mainLogo2Style.png" alt="StockSentinel Logo" className="w-8 h-8 object-contain shrink-0" />
          <div>
            <span className="font-bold text-base tracking-tight">StockSentinel</span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="dot-live" />
              <span className="text-[10px] text-gray-500 font-medium">Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick search */}
      <div className="px-3 py-3 border-b border-surface-border/40">
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-muted hover:bg-surface-hover text-gray-500 hover:text-white transition-all text-sm border border-white/[0.03]"
        >
          <Search size={14} />
          <span className="flex-1 text-left">Quick search…</span>
          <kbd className="text-[10px] bg-surface-border px-1.5 py-0.5 rounded font-mono border border-white/5">/</kbd>
        </button>
        {showSearch && (
          <div className="mt-2">
            <StockSearch compact onSelect={() => setShowSearch(false)} />
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest px-3 mb-2">Navigation</p>
        {NAV.map(({ href, label, icon: Icon, desc }) => {
          const active = pathname === href || pathname?.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative border border-transparent ${
                active
                  ? 'bg-gradient-to-r from-brand-500/10 to-transparent text-brand-400 border-brand-500/20 shadow-[0_0_15px_rgba(38,163,102,0.04)]'
                  : 'text-gray-400 hover:bg-surface-muted hover:text-white'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-brand-500 rounded-full shadow-[0_0_8px_rgba(38,163,102,0.8)]" />
              )}
              <Icon size={17} className={active ? 'text-brand-400' : ''} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} className="text-brand-500/50" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-surface-border space-y-2">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-muted">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500/30 to-brand-700/30 border border-brand-500/20 flex items-center justify-center text-xs font-bold text-brand-300 shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">{user?.name}</div>
            <div className="text-[10px] text-gray-500 truncate">{user?.email}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/8 transition-all duration-150 font-medium"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  )
}

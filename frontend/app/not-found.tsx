'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  TrendingDown, 
  Home, 
  LineChart, 
  Cpu, 
  User, 
  Github, 
  Mail, 
  Activity, 
  Compass,
  Layers,
  Globe,
  Linkedin,
  Twitter,
  ArrowRight,
  Terminal
} from 'lucide-react'

interface HealthData {
  status: string
  uptime: string
  services: {
    mongodb: { status: string; latency_ms?: number }
    redis: { status: string; latency_ms?: number }
  }
}

export default function NotFound() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loadingHealth, setLoadingHealth] = useState(true)
  
  const pathname = usePathname()
  const router = useRouter()
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    if (pathname !== '/404') {
      router.replace('/404')
    } else {
      setShouldRender(true)
    }
  }, [pathname, router])

  useEffect(() => {
    if (pathname !== '/404') return

    const fetchHealth = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://stock-sentinel-server.onrender.com'
        const res = await fetch(`${apiUrl}/health`)
        if (res.ok) {
          const data = await res.json()
          setHealth(data)
        }
      } catch (err) {
        console.error('Failed to fetch backend health status:', err)
      } finally {
        setLoadingHealth(false)
      }
    }
    fetchHealth()
  }, [pathname])

  if (pathname !== '/404' || !shouldRender) {
    return null
  }

  return (
    <div className="min-h-screen h-auto lg:h-screen lg:max-h-screen bg-black text-white relative flex flex-col justify-between overflow-y-auto lg:overflow-hidden selection:bg-brand/35 selection:text-white font-sans antialiased">
      {/* Glow Backdrops */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[10%] w-[300px] h-[300px] rounded-full bg-brand-500/10 blur-[120px] opacity-60" />
        <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] rounded-full bg-blue-500/10 blur-[150px] opacity-60" />
      </div>

      {/* Header */}
      <header className="z-10 px-6 py-3 border-b border-white/5 backdrop-blur-md bg-black/35 flex items-center justify-between shrink-0">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center group-hover:border-brand-500/50 transition-colors">
            <LineChart className="w-3.5 h-3.5 text-brand-500" />
          </div>
          <span className="font-bold text-sm tracking-tight font-mono text-gray-200">
            STOCKSENTINEL_NODE // 404
          </span>
        </Link>
        <div className="flex items-center gap-2 text-[9px] text-gray-500 uppercase tracking-widest font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live Telemetry Connection
        </div>
      </header>

      {/* Main Container - Strict layout fitting viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 flex flex-col lg:flex-row items-stretch justify-between gap-6 z-10 overflow-visible lg:overflow-hidden py-4">
        {/* Left Column: Ticker Crash & Terminal */}
        <div className="w-full lg:w-[48%] flex flex-col justify-between gap-4 h-auto lg:h-full">
          {/* Headline & Description */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-mono uppercase tracking-wider flex items-center gap-1">
                <TrendingDown className="w-3 h-3" /> Halted (Limit Down)
              </span>
              <span className="text-gray-600 font-mono text-[10px]">ROUTE_NOT_FOUND_INDEX_DRIFT</span>
            </div>

            <div className="space-y-1.5">
              <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight leading-none bg-gradient-to-r from-white via-white to-gray-500 bg-clip-text text-transparent uppercase font-mono">
                Liquidity Disruption
              </h1>
              <p className="text-gray-400 text-xs leading-relaxed max-w-md">
                The requested endpoint has drifted outside the active trading parameters. The router terminated connection to prevent architectural degradation.
              </p>
            </div>
          </div>

          {/* SVG Candlestick Crash (Compact) */}
          <div className="w-full bg-black/40 border border-white/5 rounded-xl p-3 flex-1 flex items-center justify-center min-h-[110px] max-h-[160px] overflow-hidden">
            <svg viewBox="0 0 400 130" className="w-full h-full">
              {/* Grid Lines */}
              <line x1="0" y1="25" x2="400" y2="25" stroke="rgba(255,255,255,0.02)" />
              <line x1="0" y1="50" x2="400" y2="50" stroke="rgba(255,255,255,0.02)" />
              <line x1="0" y1="75" x2="400" y2="75" stroke="rgba(255,255,255,0.02)" />
              <line x1="0" y1="100" x2="400" y2="100" stroke="rgba(255,255,255,0.02)" />
              
              {/* green candle 1 */}
              <line x1="40" y1="20" x2="40" y2="70" stroke="#26a366" strokeWidth="1" />
              <rect x="35" y="30" width="10" height="25" fill="#26a366" rx="1" />

              {/* green candle 2 */}
              <line x1="100" y1="15" x2="100" y2="55" stroke="#26a366" strokeWidth="1" />
              <rect x="95" y="25" width="10" height="20" fill="#26a366" rx="1" />

              {/* red candle 3 */}
              <line x1="160" y1="45" x2="160" y2="85" stroke="#ef4444" strokeWidth="1" />
              <rect x="155" y="50" width="10" height="25" fill="#ef4444" rx="1" />

              {/* green candle 4 */}
              <line x1="220" y1="35" x2="220" y2="75" stroke="#26a366" strokeWidth="1" />
              <rect x="215" y="40" width="10" height="25" fill="#26a366" rx="1" />

              {/* CRASH red candle 5 */}
              <line x1="280" y1="60" x2="280" y2="125" stroke="#ef4444" strokeWidth="1.2" />
              <rect x="275" y="65" width="10" height="50" fill="#ef4444" rx="1" />
              
              {/* Crash line to flat */}
              <path d="M 280 120 L 400 120" stroke="#ef4444" strokeWidth="1.2" strokeDasharray="3 3" />
              
              <text x="292" y="112" fill="#ef4444" fontSize="7.5" fontFamily="monospace" fontWeight="bold">LIMIT DOWN (₹0.00)</text>
              <text x="292" y="80" fill="#ef4444" fontSize="8.5" fontWeight="bold" fontFamily="monospace">ERR: 404</text>
            </svg>
          </div>

          {/* Diagnostic Console Monitor */}
          <div className="card font-mono text-[10px] text-gray-400 border border-white/5 bg-black/60 p-4 rounded-xl flex flex-col gap-1 shadow-md shrink-0">
            <div className="absolute top-3 right-3 flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500/60" />
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500/60" />
              <span className="w-1.5 h-1.5 rounded-full bg-green-500/60" />
            </div>
            
            <p className="text-gray-500 font-bold border-b border-white/5 pb-1 mb-1 flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-brand" /> LIVE TELEMETRY SURVEILLANCE
            </p>
            <p><span className="text-yellow-500/80">[WARN]</span> Target path: <span className="text-gray-500">ROUTE_UNRESOLVED</span></p>
            <p><span className="text-red-500/80">[FAIL]</span> Margin status triggered: Delisting sequence active.</p>
            <p className="border-t border-white/5 pt-1.5 mt-1 text-gray-500 flex items-center justify-between">
              <span>FastAPI Server status:</span>
              {loadingHealth ? (
                <span className="text-yellow-500 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-yellow-500 animate-ping" />
                  Querying health...
                </span>
              ) : health ? (
                <span className="text-brand-500 font-semibold flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-brand-500 animate-pulse" />
                  ONLINE ({health.status.toUpperCase()})
                </span>
              ) : (
                <span className="text-red-500 font-semibold flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-red-500" />
                  OFFLINE
                </span>
              )}
            </p>

            {health && (
              <div className="pl-3.5 mt-0.5 border-l border-white/5 flex flex-col gap-0.5 text-gray-500 text-[9.5px]">
                <p>MongoDB Atlas Cluster: <span className={health.services.mongodb.status === 'healthy' ? "text-emerald-500" : "text-red-500"}>{health.services.mongodb.status} ({health.services.mongodb.latency_ms ? `${health.services.mongodb.latency_ms.toFixed(1)}ms` : 'N/A'})</span></p>
                <p>Upstash TLS Redis Cache: <span className={health.services.redis.status === 'healthy' ? "text-emerald-500" : "text-red-500"}>{health.services.redis.status} ({health.services.redis.latency_ms ? `${health.services.redis.latency_ms.toFixed(1)}ms` : 'N/A'})</span></p>
                <p>System Uptime: <span className="text-blue-400 font-medium">{health.uptime}</span></p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Platform Architecture & Author Details (Hacker / Quant terminal design) */}
        <div className="w-full lg:w-[48%] flex flex-col justify-between gap-4 h-auto lg:h-full">
          {/* Card 1: Platform Architecture Grid */}
          <div className="card border border-brand-500/20 bg-black/60 p-4.5 rounded-xl flex flex-col gap-3 shadow-lg flex-1">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2 shrink-0">
              <div className="p-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20">
                <Layers className="w-4 h-4 text-brand" />
              </div>
              <h3 className="font-bold text-xs text-white uppercase tracking-wider font-mono">
                System Topology & Metrics
              </h3>
            </div>

            <div className="flex-1 flex flex-col justify-center gap-2 font-mono text-[10.5px]">
              <div className="p-2.5 rounded-lg bg-white/[0.01] border border-white/[0.03] space-y-1.5">
                <p className="text-brand-400 font-bold uppercase tracking-wider text-[9px] mb-1">Architecture Summary</p>
                <p className="text-gray-400 leading-relaxed text-[10.5px]">
                  End-to-end platform routing stock data from an Apify Screener.in scraper to MongoDB Atlas. Cached via Upstash secure TLS Redis database. Forecasts triggered via Groq AI (Llama 3.3) and active alert dispatchers handled via Telegram Bot API integrations.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 rounded-lg bg-white/[0.01] border border-white/[0.03] flex flex-col gap-0.5">
                  <span className="text-gray-500 uppercase text-[8.5px] tracking-wider">Frontend Engine</span>
                  <span className="text-gray-300 font-bold">Next.js 14 Framework</span>
                  <span className="text-gray-500">Zustand State, Tailwind Grid</span>
                </div>
                <div className="p-2 rounded-lg bg-white/[0.01] border border-white/[0.03] flex flex-col gap-0.5">
                  <span className="text-gray-500 uppercase text-[8.5px] tracking-wider">Backend Gateway</span>
                  <span className="text-gray-300 font-bold">FastAPI Async API</span>
                  <span className="text-gray-500">Uvicorn ASGI, Pydantic Schema</span>
                </div>
                <div className="p-2 rounded-lg bg-white/[0.01] border border-white/[0.03] flex flex-col gap-0.5">
                  <span className="text-gray-500 uppercase text-[8.5px] tracking-wider">Cache Layer</span>
                  <span className="text-gray-300 font-bold">Upstash Secure Redis</span>
                  <span className="text-gray-500">TLS Encryption, 10m TTL</span>
                </div>
                <div className="p-2 rounded-lg bg-white/[0.01] border border-white/[0.03] flex flex-col gap-0.5">
                  <span className="text-gray-500 uppercase text-[8.5px] tracking-wider">Quant Engine</span>
                  <span className="text-gray-300 font-bold">Monte Carlo Engine</span>
                  <span className="text-gray-500">Geometric Brownian Motion</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Author Profile (Architecture page data source) */}
          <div className="card border border-brand-500/20 bg-black/60 p-4.5 rounded-xl flex flex-col gap-3 shadow-lg shrink-0">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <User className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-xs text-white uppercase tracking-wider font-mono">Ujjwal Saini</h3>
                <p className="text-[9px] text-brand-400 uppercase tracking-widest font-mono mt-0.5">Founder, Lead Engineer & System Architect</p>
              </div>
            </div>

            <div className="font-mono text-[10.5px] space-y-2">
              <p className="text-gray-400 leading-normal text-[10.5px]">
                Passionate Full-Stack Engineer specializing in AI-powered systems, real-time analytics, secure database designs, and scalable platform architectures. Focused on building production-grade solutions that transform raw operational data into actionable business intelligence. Ujjwal brings bold ideas to life through stunning interfaces and seamless user experiences, always chasing clarity in every interaction.
              </p>
              
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-1 text-[9.5px] border-t border-white/5">
                <a href="https://ujjwalsaini.vercel.app" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white flex items-center gap-1 transition-colors">
                  <Globe className="w-3 h-3 text-brand" /> ujjwalsaini.vercel.app
                </a>
                <a href="https://github.com/UjjwalSaini07" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white flex items-center gap-1 transition-colors">
                  <Github className="w-3 h-3 text-brand" /> UjjwalSaini07
                </a>
                <a href="https://linkedin.com/in/ujjwalsaini07" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white flex items-center gap-1 transition-colors">
                  <Linkedin className="w-3 h-3 text-brand" /> in/ujjwalsaini07
                </a>
                <a href="mailto:ujjwalsaini1947@gmail.com" className="text-gray-500 hover:text-white flex items-center gap-1 transition-colors">
                  <Mail className="w-3 h-3 text-brand" /> ujjwalsaini1947@gmail.com
                </a>
              </div>
            </div>
          </div>

          {/* Quick Navigation Buttons (Single-line row) */}
          <div className="flex gap-3 shrink-0">
            <Link href="/dashboard" className="btn-primary flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-semibold uppercase tracking-wider font-mono">
              <Home className="w-3.5 h-3.5" /> Return to Trading Floor
            </Link>
            <Link href="/quant" className="btn-outline flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-semibold uppercase tracking-wider font-mono">
              <Compass className="w-3.5 h-3.5" /> Quant Simulator
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="z-10 py-3 border-t border-white/5 px-6 text-center text-[9px] text-gray-600 font-mono shrink-0 uppercase tracking-widest">
        © 2026 STOCKSENTINEL_SYSTEM // QUANTITATIVE ANALYSIS TERMINAL
      </footer>
    </div>
  )
}

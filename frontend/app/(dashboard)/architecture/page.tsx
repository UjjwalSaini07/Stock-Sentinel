'use client'
import { useState, useEffect } from 'react'
import { 
  Cpu, Globe, Github, Linkedin, Twitter, Mail, 
  Layers, Database, Zap, Workflow, Layout, ExternalLink, ChevronRight, CheckCircle, Terminal 
} from 'lucide-react'

interface ArchNode {
  id: string
  title: string
  subtitle: string
  icon: any
  color: string
  glowColor: string
  techs: string[]
  details: string[]
}

const NODES: ArchNode[] = [
  {
    id: 'scraper',
    title: 'Ingestion Engine',
    subtitle: 'Python, BeautifulSoup, Yahoo Finance',
    icon: Layers,
    color: 'border-red-500/30 text-red-400 bg-red-500/5 hover:border-red-500/50',
    glowColor: 'rgba(239, 68, 68, 0.4)',
    techs: ['Scheduled Scrapes', 'Screener.in Parsing', 'Yahoo Price Feed', 'News Aggregator'],
    details: [
      'Fetches quarterly results, shareholdings, and annual profit tables.',
      'Calculates trailing 12-month YoY price returns.',
      'Scans for Additional Surveillance Measure (ASM) regulatory flags.',
      'Aggregates Google News RSS headlines for sentiment checks.'
    ]
  },
  {
    id: 'caching',
    title: 'Cache Layer',
    subtitle: 'Redis cache & TTL eviction',
    icon: Workflow,
    color: 'border-purple-500/30 text-purple-400 bg-purple-500/5 hover:border-purple-500/50',
    glowColor: 'rgba(139, 92, 246, 0.4)',
    techs: ['Redis String Store', 'Key Expiry (TTL)', 'High Performance Buffer'],
    details: [
      'Caches core stock fundamentals (10m TTL) matching scraper schedules.',
      'Temporarily stores active alert criteria to minimize DB read pressure.',
      'Stores hot session states and streaming price indicators.'
    ]
  },
  {
    id: 'database',
    title: 'Persistence DB',
    subtitle: 'MongoDB, Motor, PyMongo',
    icon: Database,
    color: 'border-amber-500/30 text-amber-400 bg-amber-500/5 hover:border-amber-500/50',
    glowColor: 'rgba(245, 158, 11, 0.4)',
    techs: ['MongoDB Collections', 'Async Motor Client', 'Compound Indexes'],
    details: [
      'Persists user credentials, profile arrays, and custom watchlists.',
      'Stores price history records to generate candlestick historical charts.',
      'Index-driven search optimizations for tickers and user references.'
    ]
  },
  {
    id: 'backend',
    title: 'FastAPI Gateway',
    subtitle: 'FastAPI, Uvicorn, PyJWT',
    icon: Zap,
    color: 'border-blue-500/30 text-blue-400 bg-blue-500/5 hover:border-blue-500/50',
    glowColor: 'rgba(59, 130, 246, 0.4)',
    techs: ['Async FastAPI', 'JWT Token Rotation', 'Pydantic Models', 'Asyncio Tasks'],
    details: [
      'Token validation guards separating public and private endpoints.',
      'Background alert checking loop running every 60 seconds.',
      'AI Multi-Agent orchestrator querying Groq Llama 3.3 in JSON mode.',
      'Asynchronous Event Streams pushing text tokens directly to client.'
    ]
  },
  {
    id: 'frontend',
    title: 'Frontend Client',
    subtitle: 'Next.js 14, Tailwind, Zustand',
    icon: Layout,
    color: 'border-brand-500/30 text-brand-400 bg-brand-500/5 hover:border-brand-500/50',
    glowColor: 'rgba(38, 163, 102, 0.4)',
    techs: ['Next.js App Router', 'Zustand State', 'Tailwind CSS', 'Recharts'],
    details: [
      'Interactive glassmorphic dashboard panels matching real-time updates.',
      'Custom client-side Server-Sent Events (SSE) chat stream parser.',
      'Visual charts displaying volatility range estimates and revenue trends.',
      'Route-guard layouts locking access until JWT authentication resolves.'
    ]
  }
]

export default function ArchitecturePage() {
  const [selectedNode, setSelectedNode] = useState<string>('frontend')
  const [projectTab, setProjectTab] = useState<'stocksentinel' | 'wanderdesk'>('stocksentinel')
  const [systemStatus, setSystemStatus] = useState<'normal' | 'scraping' | 'evicting' | 'ai_streaming'>('normal')
  const [metrics, setMetrics] = useState({
    latency: 12,
    cacheRatio: 98.4,
    mongoConns: 4,
    wsStatus: 'ACTIVE',
    scraperFreq: '60s'
  })
  
  const [logs, setLogs] = useState<string[]>([
    'System initialized successfully.',
    'MongoDB connection pool established.',
    'Redis cache pre-warmed with 63 tracking symbols.',
    'FastAPI backend ready on port 8000.',
    'Event streaming channel connected.'
  ])

  // Simulated real-time log execution
  useEffect(() => {
    if (systemStatus !== 'normal') return

    const logPool = [
      'SCRAPER: Polled Yahoo Finance for active watchlists.',
      'REDIS: Cache renewed for active tickers (TTL 10m).',
      'MONGO: DB query resolved in 1.8ms.',
      'AI COPILOT: Initialized sentiment indexing logic.',
      'ALERTS: Checked 14 volatile price conditions.',
      'FASTAPI: WebSocket broadcast sent (1 active socket).',
      'WS: Real-time price feed synchronized.',
      'AI SCREENER: Evaluated market cap threshold queries.'
    ]

    const interval = setInterval(() => {
      const timestamp = new Date().toLocaleTimeString()
      const randomMsg = logPool[Math.floor(Math.random() * logPool.length)]
      setLogs(prev => [...prev.slice(-5), `[${timestamp}] ${randomMsg}`])
    }, 4500)

    return () => clearInterval(interval)
  }, [systemStatus])

  // Simulator Actions
  const triggerScrapeSimulation = () => {
    setSystemStatus('scraping')
    setMetrics(m => ({ ...m, latency: 19, scraperFreq: 'INGESTING...' }))
    
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [
      ...prev,
      `[${timestamp}] SIMULATOR: Manual Scrape Ingestion Triggered.`,
      `[${timestamp}] SCRAPER: Pulling price data from YFinance API...`,
      `[${timestamp}] SCRAPER: Parsing shareholding changes from Screener...`,
      `[${timestamp}] MONGO: Writing bulk ticker ticks to db...`,
      `[${timestamp}] REDIS: Hot Cache renewed (TTL 10m).`
    ].slice(-6))

    setTimeout(() => {
      setSystemStatus('normal')
      setMetrics(m => ({ ...m, latency: 12, scraperFreq: '60s' }))
    }, 4000)
  }

  const triggerCacheEviction = () => {
    setSystemStatus('evicting')
    setMetrics(m => ({ ...m, cacheRatio: 42.1, latency: 31 }))
    
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [
      ...prev,
      `[${timestamp}] SIMULATOR: Cache Invalidation Event Fired.`,
      `[${timestamp}] REDIS: Flushing fundamentals cache string keys.`,
      `[${timestamp}] MONGO: Resolving client request direct from database...`,
      `[${timestamp}] SYSTEM: Latency penalty incurred (31ms).`
    ].slice(-6))

    setTimeout(() => {
      setSystemStatus('normal')
      setMetrics(m => ({ ...m, cacheRatio: 98.4, latency: 12 }))
    }, 4000)
  }

  const triggerAiStream = () => {
    setSystemStatus('ai_streaming')
    setMetrics(m => ({ ...m, latency: 285 }))
    
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [
      ...prev,
      `[${timestamp}] SIMULATOR: AI Forecast request received.`,
      `[${timestamp}] AI ORCHESTRATOR: Running multi-agent stress tests...`,
      `[${timestamp}] FastAPI: Directing Groq SSE stream handler.`,
      `[${timestamp}] SSE: Pipe opened. Emitting chat stream tokens...`
    ].slice(-6))

    setTimeout(() => {
      setSystemStatus('normal')
      setMetrics(m => ({ ...m, latency: 12 }))
    }, 5000)
  }

  const activeNode = NODES.find(n => n.id === selectedNode) || NODES[0]
  const ActiveIcon = activeNode.icon

  return (
    <div className="space-y-6 pb-12 animate-fade-in text-white">
      {/* CSS Styles injection for animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: inline-flex;
          animation: marquee 30s linear infinite;
        }
        @keyframes dash {
          to {
            stroke-dashoffset: -20;
          }
        }
        .animate-dash {
          stroke-dasharray: 6, 4;
          animation: dash 1.5s linear infinite;
        }
        .animate-dash-reverse {
          stroke-dasharray: 6, 4;
          animation: dash 1.5s linear infinite reverse;
        }
      `}} />

      {/* Title */}
      <div className="border-b border-surface-border/50 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cpu className="text-brand-400" /> Platform Architecture & Blueprint
          </h1>
          <p className="text-gray-500 text-xs mt-1">Detailed system blueprint and developer overview</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono bg-white/[0.02] border border-white/[0.04] px-3 py-1.5 rounded-full shrink-0">
          <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
          <span className="text-gray-400">Environment:</span>
          <span className="text-brand-400 font-bold">Production-Grade</span>
        </div>
      </div>

      {/* Real-time System Metrics Ticker Tape */}
      <div className="w-full bg-black/40 border border-white/[0.03] rounded-2xl overflow-hidden py-2.5 px-4 flex items-center gap-4 text-[11px] font-mono text-gray-400">
        <span className="flex items-center gap-1.5 text-brand-400 font-bold shrink-0 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
          <span className="h-2 w-2 rounded-full bg-brand-500 animate-ping" />
          SYSTEM METRICS
        </span>
        <div className="flex-1 overflow-hidden relative w-full flex items-center">
          <div className="animate-marquee flex gap-12 whitespace-nowrap">
            <span>FASTAPI LATENCY: <span className="text-brand-400 font-bold">{metrics.latency}ms ▲ 1%</span></span>
            <span>REDIS CACHE RATIO: <span className="text-brand-400 font-bold">{metrics.cacheRatio}%</span></span>
            <span>MONGODB POOL: <span className="text-brand-400 font-bold">{metrics.mongoConns} ACTIVE CONNS</span></span>
            <span>WS STREAM: <span className="text-purple-400 font-bold">{metrics.wsStatus} (100ms PING)</span></span>
            <span>PRICE SCAPE FREQ: <span className="text-brand-400 font-bold">{metrics.scraperFreq}</span></span>
            <span>AI ORCHESTRATOR: <span className="text-brand-400 font-bold">ONLINE</span></span>
            <span>MEM DECAY: <span className="text-brand-400 font-bold">0.02%</span></span>
            <span>WANDER-DESK DESIGN: <span className="text-brand-400 font-bold">NORMALIZED</span></span>
            {/* Duplicate for infinite loop */}
            <span>FASTAPI LATENCY: <span className="text-brand-400 font-bold">{metrics.latency}ms ▲ 1%</span></span>
            <span>REDIS CACHE RATIO: <span className="text-brand-400 font-bold">{metrics.cacheRatio}%</span></span>
            <span>MONGODB POOL: <span className="text-brand-400 font-bold">{metrics.mongoConns} ACTIVE CONNS</span></span>
            <span>WS STREAM: <span className="text-purple-400 font-bold">{metrics.wsStatus} (100ms PING)</span></span>
            <span>PRICE SCAPE FREQ: <span className="text-brand-400 font-bold">{metrics.scraperFreq}</span></span>
            <span>AI ORCHESTRATOR: <span className="text-brand-400 font-bold">ONLINE</span></span>
            <span>MEM DECAY: <span className="text-brand-400 font-bold">0.02%</span></span>
            <span>WANDER-DESK DESIGN: <span className="text-brand-400 font-bold">NORMALIZED</span></span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ── LEFT COLUMN: ARCHITECT PROFILE & SIMULATOR ───────── */}
        <div className="lg:col-span-5 space-y-6">
          <div className="card bg-gradient-to-br from-white/[0.01] to-transparent border-white/5 space-y-6 relative overflow-hidden group">
            {/* Glowing effect */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl group-hover:bg-brand-500/15 transition-all duration-500" />

            <div className="space-y-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-300 font-bold text-lg shadow-[0_0_15px_rgba(38,163,102,0.12)] shrink-0">
                  US
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Ujjwal Saini</h2>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-brand-400 block mt-0.5">Founder, Lead Engineer & System Architect</span>
                </div>
              </div>

              <p className="text-gray-400 text-xs leading-relaxed">
                Passionate Full-Stack Engineer specializing in AI-powered systems, real-time analytics, secure database designs, and scalable platform architectures. Focused on building production-grade solutions that transform raw operational data into actionable business intelligence. Ujjwal brings bold ideas to life through stunning interfaces and seamless user experiences, always chasing clarity in every interaction.
              </p>

              {/* Projects Tabs */}
              <div className="space-y-3">
                <div className="flex border-b border-white/5 text-[11px] font-mono font-bold">
                  <button 
                    onClick={() => setProjectTab('stocksentinel')}
                    className={`pb-2 px-3 border-b-2 transition-all ${projectTab === 'stocksentinel' ? 'border-brand-500 text-brand-300' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                  >
                    StockSentinel Design
                  </button>
                  <button 
                    onClick={() => setProjectTab('wanderdesk')}
                    className={`pb-2 px-3 border-b-2 transition-all ${projectTab === 'wanderdesk' ? 'border-brand-500 text-brand-300' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                  >
                    Wander-Desk Design
                  </button>
                </div>

                <div className="p-3.5 bg-white/[0.01] border border-white/[0.03] rounded-xl text-xs text-gray-300 leading-normal min-h-[105px]">
                  {projectTab === 'stocksentinel' ? (
                    <div>
                      <span className="font-semibold text-white block mb-1 text-[11px] text-brand-400 uppercase tracking-wider">Architecture Contribution:</span>
                      For <strong className="text-brand-300 font-bold">StockSentinel</strong>, Ujjwal designed and implemented the complete end-to-end platform — from MongoDB schema normalization and Redis caching strategies to AI-driven Stock Forecast agents, what-if stress engines, and the premium glassmorphic trading terminal.
                    </div>
                  ) : (
                    <div>
                      <span className="font-semibold text-white block mb-1 text-[11px] text-brand-400 uppercase tracking-wider">Architecture Contribution:</span>
                      For <strong className="text-brand-300 font-bold">Wander-Desk</strong>, Ujjwal designed and implemented the complete end-to-end platform — from Supabase schema normalization and RLS security configurations to AI-driven traveler DNA profiling, Sales Copilot priority engines, and the Founder Command Center dashboard.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="divider" />

            {/* Links & Contact */}
            <div className="space-y-2 relative z-10">
              <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">Contact & Links</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  { label: 'Portfolio', icon: Globe, href: 'https://ujjwalsaini.vercel.app', text: 'ujjwalsaini.vercel.app' },
                  { label: 'GitHub', icon: Github, href: 'https://github.com/UjjwalSaini07', text: 'UjjwalSaini07' },
                  { label: 'LinkedIn', icon: Linkedin, href: 'https://linkedin.com/in/ujjwalsaini07', text: 'in/ujjwalsaini07' },
                  { label: 'Twitter/X', icon: Twitter, href: 'https://x.com/UjjwalSx007', text: '@UjjwalSx007' }
                ].map((link, i) => {
                  const Icon = link.icon
                  return (
                    <a
                      key={i}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.01] border border-white/[0.04] text-gray-400 hover:text-white hover:border-brand-500/20 transition-all duration-200"
                    >
                      <Icon size={12} className="shrink-0 text-brand-400" />
                      <div className="min-w-0">
                        <div className="text-[8px] text-gray-600 font-semibold">{link.label}</div>
                        <div className="truncate text-[10px] font-mono">{link.text}</div>
                      </div>
                      <ExternalLink size={10} className="ml-auto opacity-30 hover:opacity-100 shrink-0" />
                    </a>
                  )
                })}
              </div>

              <a
                href="mailto:ujjwalsaini0007+stocks@gmail.com"
                className="flex items-center gap-3 p-2.5 rounded-xl bg-brand-500/5 hover:bg-brand-500/10 border border-brand-500/10 hover:border-brand-500/35 transition-all duration-300 text-xs text-brand-300 font-medium"
              >
                <Mail size={14} className="shrink-0 text-brand-400 animate-pulse" />
                <span className="truncate">ujjwalsaini0007+stocks@gmail.com</span>
                <ChevronRight size={14} className="ml-auto shrink-0" />
              </a>
            </div>
          </div>

          {/* Real-time System Execution Logs terminal */}
          <div className="card bg-black border border-white/5 p-4 space-y-3 font-mono text-[10px] relative overflow-hidden">
            <div className="flex items-center justify-between text-gray-500 border-b border-white/5 pb-2">
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <Terminal size={12} className="text-brand-400" /> Live Execution Stream
              </span>
              <span className="text-[8px] text-brand-500/60 uppercase tracking-widest animate-pulse">Running</span>
            </div>
            <div className="space-y-1.5 min-h-[90px] flex flex-col justify-end text-gray-400">
              {logs.map((log, i) => (
                <div key={i} className="truncate">
                  <span className="text-brand-400">&gt; </span>
                  {log}
                </div>
              ))}
            </div>
          </div>

          {/* Simulation Control Board */}
          <div className="card bg-white/[0.01] border-white/5 p-4 space-y-3">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">System Pipeline Simulator</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Click actions below to trigger visual traffic events along the pipeline.</p>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={triggerScrapeSimulation}
                disabled={systemStatus !== 'normal'}
                className={`flex items-center gap-3 p-2 rounded-xl border text-xs font-medium transition-all text-left ${
                  systemStatus === 'scraping' 
                    ? 'border-red-500 bg-red-500/10 text-red-300' 
                    : 'border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10 text-gray-300'
                }`}
              >
                <div className="p-1.5 rounded-lg bg-red-500/10 text-red-400 shrink-0">
                  <Layers size={14} className={systemStatus === 'scraping' ? 'animate-bounce' : ''} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[10px]">Ingestion Burst</div>
                  <div className="text-[9px] text-gray-500 truncate font-mono">Speeds up scraper flow paths</div>
                </div>
                <ChevronRight size={12} className="text-gray-600 ml-auto shrink-0" />
              </button>

              <button
                onClick={triggerCacheEviction}
                disabled={systemStatus !== 'normal'}
                className={`flex items-center gap-3 p-2 rounded-xl border text-xs font-medium transition-all text-left ${
                  systemStatus === 'evicting' 
                    ? 'border-amber-500 bg-amber-500/10 text-amber-300' 
                    : 'border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10 text-gray-300'
                }`}
              >
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
                  <Workflow size={14} className={systemStatus === 'evicting' ? 'animate-spin' : ''} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[10px]">Evict cache keys</div>
                  <div className="text-[9px] text-gray-500 truncate font-mono">Glows lines red, spikes latency</div>
                </div>
                <ChevronRight size={12} className="text-gray-600 ml-auto shrink-0" />
              </button>

              <button
                onClick={triggerAiStream}
                disabled={systemStatus !== 'normal'}
                className={`flex items-center gap-3 p-2 rounded-xl border text-xs font-medium transition-all text-left ${
                  systemStatus === 'ai_streaming' 
                    ? 'border-purple-500 bg-purple-500/10 text-purple-300' 
                    : 'border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10 text-gray-300'
                }`}
              >
                <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 shrink-0">
                  <Zap size={14} className={systemStatus === 'ai_streaming' ? 'animate-pulse' : ''} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[10px]">Stream AI Forecast</div>
                  <div className="text-[9px] text-gray-500 truncate font-mono">Pipes SSE tokens directly to frontend</div>
                </div>
                <ChevronRight size={12} className="text-gray-600 ml-auto shrink-0" />
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: INTERACTIVE BLUEPRINT ──────────────── */}
        <div className="lg:col-span-7 space-y-6">
          <div className="card bg-white/[0.01] border-white/5 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-white">Live System Pipeline & Visual Topology</h3>
              <p className="text-xs text-gray-500 mt-0.5">Interactive architecture map. Click components to display specifications.</p>
            </div>

            {/* Premium Interactive SVG Architecture Canvas */}
            <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-white/10">
              <div className="min-w-[760px] h-[300px] relative mx-auto select-none bg-black/40 rounded-2xl border border-white/[0.03] overflow-hidden">
                {/* SVG connection lines with glowing dash animations */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                  {/* Background inactive connection paths */}
                  <path d="M 150 150 H 180 V 60 H 210" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
                  <path d="M 150 150 H 180 V 240 H 210" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
                  <path d="M 350 60 H 385 V 150 H 420" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
                  <path d="M 350 240 H 385 V 150 H 420" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />
                  <path d="M 560 150 H 610" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" fill="none" />

                  {/* Active glowing connection lines */}
                  <path 
                    d="M 150 150 H 180 V 60 H 210" 
                    stroke={systemStatus === 'evicting' ? '#ef4444' : '#3b82f6'} 
                    strokeWidth="1.5" 
                    fill="none" 
                    className="animate-dash opacity-80" 
                    style={{ animationDuration: systemStatus === 'scraping' ? '0.3s' : '1.5s' }}
                  />
                  <path 
                    d="M 150 150 H 180 V 240 H 210" 
                    stroke={systemStatus === 'evicting' ? '#ef4444' : '#f59e0b'} 
                    strokeWidth="1.5" 
                    fill="none" 
                    className="animate-dash opacity-80" 
                    style={{ animationDuration: systemStatus === 'scraping' ? '0.3s' : '1.5s' }}
                  />
                  <path 
                    d="M 350 60 H 385 V 150 H 420" 
                    stroke={systemStatus === 'evicting' ? '#ef4444' : '#8b5cf6'} 
                    strokeWidth="1.5" 
                    fill="none" 
                    className="animate-dash opacity-80" 
                    style={{ animationDuration: systemStatus === 'scraping' ? '0.6s' : systemStatus === 'ai_streaming' ? '0.3s' : '1.5s' }}
                  />
                  <path 
                    d="M 350 240 H 385 V 150 H 420" 
                    stroke={systemStatus === 'evicting' ? '#ef4444' : '#f59e0b'} 
                    strokeWidth="1.5" 
                    fill="none" 
                    className="animate-dash opacity-80" 
                    style={{ animationDuration: systemStatus === 'scraping' ? '0.6s' : systemStatus === 'ai_streaming' ? '0.3s' : '1.5s' }}
                  />
                  <path 
                    d="M 560 150 H 610" 
                    stroke={systemStatus === 'evicting' ? '#ef4444' : '#26a366'} 
                    strokeWidth="1.5" 
                    fill="none" 
                    className="animate-dash opacity-80" 
                    style={{ animationDuration: systemStatus === 'ai_streaming' ? '0.3s' : '1.5s' }}
                  />
                </svg>

                {/* Absolute overlay HTML cards for Nodes */}
                {NODES.map(node => {
                  const Icon = node.icon
                  const active = selectedNode === node.id

                  // Map of absolute positions
                  const posMap: Record<string, { left: string; top: string; width: string }> = {
                    scraper: { left: '20px', top: '110px', width: '130px' },
                    caching: { left: '210px', top: '20px', width: '140px' },
                    database: { left: '210px', top: '200px', width: '140px' },
                    backend: { left: '420px', top: '110px', width: '140px' },
                    frontend: { left: '610px', top: '110px', width: '130px' }
                  }

                  const pos = posMap[node.id]

                  return (
                    <button
                      key={node.id}
                      onClick={() => setSelectedNode(node.id)}
                      style={{
                        position: 'absolute',
                        left: pos.left,
                        top: pos.top,
                        width: pos.width,
                        height: '80px',
                        boxShadow: active ? `0 0 16px ${node.glowColor}` : undefined
                      }}
                      className={`z-10 rounded-xl border p-2.5 flex flex-col justify-between text-left transition-all duration-300 cursor-pointer outline-none ${
                        active
                          ? 'border-brand-500 bg-brand-500/[0.04]'
                          : 'border-white/[0.04] bg-[#050507] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${active ? 'text-brand-300' : 'text-gray-400'}`}>
                          {node.id}
                        </span>
                        <div className={`p-1 rounded-md ${active ? 'bg-brand-500/10 text-brand-400' : 'bg-white/5 text-gray-500'}`}>
                          <Icon size={12} className={active ? 'animate-pulse' : ''} />
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-bold truncate text-white">{node.title}</div>
                        <div className="text-[9px] text-gray-500 font-mono truncate mt-0.5">{node.subtitle}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Details Card */}
            {activeNode && (
              <div className="p-5 bg-black/40 border border-white/[0.03] rounded-2xl space-y-4 animate-slide-up">
                <div className="flex items-center gap-2.5">
                  <ActiveIcon size={16} className="text-brand-400 animate-pulse" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">{activeNode.title} Specification</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {activeNode.techs.map((tech, i) => (
                    <span 
                      key={i}
                      className="text-[9px] font-mono font-bold text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full"
                    >
                      {tech}
                    </span>
                  ))}
                </div>

                <div className="space-y-2">
                  {activeNode.details.map((detail, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs text-gray-400 leading-relaxed">
                      <CheckCircle size={12} className="text-brand-400 shrink-0 mt-0.5" />
                      <p>{detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

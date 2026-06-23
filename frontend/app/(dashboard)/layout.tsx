'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/ui/Sidebar'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { LineChart, Cpu, Activity } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuthGuard()
  const [loading, setLoading] = useState(true)
  const [windowWidth, setWindowWidth] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
      setIsMobile(window.innerWidth < 720)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        setLoading(false)
      } else {
        const timer = setTimeout(() => {
          setLoading(false)
        }, 1200)
        return () => clearTimeout(timer)
      }
    }
  }, [authLoading, user])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
        {/* Ambient background glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-brand-500/5 blur-[120px] pointer-events-none" />
        
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.02]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '32px 32px'
          }}
        />

        <div className="relative z-10 flex flex-col items-center max-w-sm w-full px-6 text-center animate-fade-in">
          {/* Animated Candlestick Chart Loading Graphic */}
          <div className="flex items-end justify-center gap-2.5 h-16 mb-8 relative">
            <div className="absolute inset-0 bg-brand-500/10 blur-xl rounded-full scale-150 animate-pulse pointer-events-none" />
            
            {/* Candle 1 (Green) */}
            <div className="flex flex-col items-center w-2.5 h-full justify-end relative">
              <div className="w-0.5 h-12 bg-brand-500/20 absolute bottom-0" />
              <div 
                className="w-2.5 h-7 bg-brand-500 rounded-sm shadow-[0_0_12px_rgba(38,163,102,0.4)] animate-bounce relative z-10" 
                style={{ animationDelay: '0.1s', animationDuration: '1.4s' }} 
              />
            </div>

            {/* Candle 2 (Green, larger) */}
            <div className="flex flex-col items-center w-2.5 h-full justify-end relative">
              <div className="w-0.5 h-16 bg-brand-500/20 absolute bottom-0" />
              <div 
                className="w-2.5 h-11 bg-brand-500 rounded-sm shadow-[0_0_15px_rgba(38,163,102,0.5)] animate-bounce relative z-10" 
                style={{ animationDelay: '0.3s', animationDuration: '1.6s' }} 
              />
            </div>

            {/* Candle 3 (Red, pull-back) */}
            <div className="flex flex-col items-center w-2.5 h-full justify-end relative">
              <div className="w-0.5 h-10 bg-red-500/20 absolute bottom-0" />
              <div 
                className="w-2.5 h-5 bg-red-500 rounded-sm shadow-[0_0_10px_rgba(239,68,68,0.4)] animate-bounce relative z-10" 
                style={{ animationDelay: '0.5s', animationDuration: '1.2s' }} 
              />
            </div>

            {/* Candle 4 (Green breakout) */}
            <div className="flex flex-col items-center w-2.5 h-full justify-end relative">
              <div className="w-0.5 h-14 bg-brand-500/20 absolute bottom-0" />
              <div 
                className="w-2.5 h-9 bg-brand-500 rounded-sm shadow-[0_0_12px_rgba(38,163,102,0.4)] animate-bounce relative z-10" 
                style={{ animationDelay: '0.7s', animationDuration: '1.5s' }} 
              />
            </div>
          </div>

          {/* Brand header */}
          <div className="inline-flex items-center gap-2 mb-2">
            <img src="/mainLogo2Style.png" alt="StockSentinel Logo" className="w-6 h-6 object-contain shrink-0 animate-pulse" />
            <span className="text-md font-bold tracking-tight text-white">StockSentinel</span>
          </div>

          {/* Status logs */}
          <p className="text-gray-400 text-xs font-medium tracking-wide">Syncing portfolio and live market feeds...</p>
          <p className="text-gray-600 text-[10px] font-mono mt-1.5 animate-pulse">Establishing secure API connection</p>

          {/* Progress Bar with custom scan-progress animation */}
          <div className="w-40 h-0.5 bg-white/[0.04] border border-white/[0.02] rounded-full mt-6 overflow-hidden relative">
            <div 
              className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-transparent via-brand-500 to-transparent w-2/3 rounded-full animate-[scan-progress_1.6s_ease-in-out_infinite]"
            />
          </div>
        </div>
      </div>
    )
  }

  if (windowWidth !== null && isMobile) {
    return (
      <div className="min-h-screen bg-black text-white relative flex flex-col justify-between overflow-y-auto selection:bg-brand/35 selection:text-white font-sans antialiased">
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[10%] w-[250px] h-[250px] rounded-full bg-brand-500/10 blur-[100px] opacity-75" />
          <div className="absolute bottom-[10%] right-[10%] w-[350px] h-[350px] rounded-full bg-blue-500/10 blur-[130px] opacity-75" />
        </div>

        {/* Header */}
        <header className="z-10 px-6 py-4 border-b border-white/5 backdrop-blur-md bg-black/35 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center">
              <LineChart className="w-3.5 h-3.5 text-brand-500" />
            </div>
            <span className="font-bold text-sm tracking-tight font-mono text-gray-200">
              STOCKSENTINEL
            </span>
          </div>
        </header>

        {/* Blocker Content */}
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>

          <div className="space-y-1.5 shrink-0">
            <h1 className="text-2xl font-black font-mono tracking-tight text-white uppercase">
              Desktop Workstation Required
            </h1>
            <p className="text-gray-400 text-xs leading-relaxed max-w-sm mx-auto">
              This terminal contains advanced trading graphics, Monte Carlo simulator engines, and ML indicators that are incompatible with small mobile screens.
            </p>
          </div>

          {/* Metrics Telemetry Box */}
          <div className="w-full max-w-xs card font-mono text-[10px] text-gray-400 border border-white/5 bg-black/60 p-4 rounded-xl flex flex-col gap-1.5 text-left shadow-lg shrink-0">
            <p className="text-gray-500 font-bold border-b border-white/5 pb-1 mb-1.5 flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-red-500" /> SCREEN RESOLUTION ERROR
            </p>
            <p>REQUIRED_RESOLUTION : &gt;= 720px width</p>
            <p>CURRENT_RESOLUTION  : <span className="text-red-400 font-bold">{windowWidth}px width</span></p>
            <p>RESTRICTION_STATE  : <span className="text-red-400 font-bold">TERMINAL_HALTED</span></p>
            <p className="border-t border-white/5 pt-1.5 mt-1.5 text-gray-500 text-[9.5px]">
              Please switch to a desktop browser or rotate your device to landscape to establish telemetry access.
            </p>
          </div>

          {/* Architect/Author Telemetry Box */}
          <div className="w-full max-w-xs card font-mono text-[9px] text-gray-500 border border-white/5 bg-black/60 p-3.5 rounded-xl flex flex-col gap-1.5 text-left shadow-lg shrink-0">
            <p className="text-gray-400 font-bold border-b border-white/5 pb-1 mb-1 uppercase tracking-wider">
              System Architect Telemetry
            </p>
            <p>AUTHOR_NAME : Ujjwal Saini</p>
            <p>CLASSIFY   : Founder & Lead Engineer</p>
            <p>PORTFOLIO  : <a href="https://ujjwalsaini.vercel.app" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">ujjwalsaini.vercel.app</a></p>
            <p>GITHUB     : <a href="https://github.com/UjjwalSaini07" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">github/UjjwalSaini07</a></p>
          </div>
        </main>

        <footer className="z-10 py-3 border-t border-white/5 px-6 text-center text-[9px] text-gray-600 font-mono shrink-0 uppercase tracking-widest">
          © 2026 STOCKSENTINEL_SYSTEM // VIEWPORT_CHECK_FAILURE
        </footer>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-surface flex">
      <Sidebar />
      <main className="flex-1 ml-[240px] min-h-screen">
        <div className="max-w-7xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}

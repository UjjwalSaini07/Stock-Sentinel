'use client'
import { useState, useEffect } from 'react'
import Sidebar from '@/components/ui/Sidebar'
import { useAuthGuard } from '@/hooks/useAuthGuard'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuthGuard()
  const [loading, setLoading] = useState(true)

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

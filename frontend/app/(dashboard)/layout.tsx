'use client'
import Sidebar from '@/components/ui/Sidebar'
import { useAuthGuard } from '@/hooks/useAuthGuard'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthGuard()

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
          <span className="text-gray-500 text-sm">Loading your portfolio…</span>
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

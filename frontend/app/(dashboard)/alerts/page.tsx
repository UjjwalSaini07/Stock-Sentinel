'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Bell, Plus, Activity, CheckCircle2, Clock } from 'lucide-react'
import { alertApi } from '@/lib/api'
import { Alert } from '@/types'
import AlertCard from '@/components/alerts/AlertCard'
import TelegramLinkCard from '@/components/alerts/TelegramLinkCard'

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'active' | 'history'>('active')

  async function fetchAlerts() {
    try {
      const { data } = await alertApi.list()
      setAlerts(data)
    } catch { toast.error('Failed to load alerts') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAlerts() }, [])

  async function handleDelete(id: string) {
    try {
      await alertApi.delete(id)
      setAlerts(prev => prev.filter(a => a.id !== id))
      toast.success('Alert removed')
    } catch { toast.error('Failed to delete') }
  }

  async function handleToggle(id: string) {
    try {
      const { data } = await alertApi.toggle(id)
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_active: data.is_active } : a))
    } catch { toast.error('Failed to update') }
  }

  const active    = alerts.filter(a => a.is_active && !a.triggered_at)
  const triggered = alerts.filter(a => !!a.triggered_at)
  const paused    = alerts.filter(a => !a.is_active && !a.triggered_at)
  const history   = [...triggered, ...paused]

  const tabData = tab === 'active' ? active : history

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-0.5">Alerts</h1>
          <p className="text-gray-500 text-sm">Price notifications sent to your Telegram</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="badge-green flex items-center gap-1.5">
            <Activity size={11} /> {active.length} active
          </div>
          {triggered.length > 0 && (
            <div className="badge-amber flex items-center gap-1.5">
              <CheckCircle2 size={11} /> {triggered.length} triggered
            </div>
          )}
        </div>
      </div>

      {/* Telegram card */}
      <TelegramLinkCard />

      {/* Tabs */}
      <div className="card">
        <div className="flex items-center gap-1 mb-5 p-1 bg-surface-muted rounded-xl w-fit">
          {([
            { key: 'active', label: 'Active', count: active.length, icon: Bell },
            { key: 'history', label: 'History', count: history.length, icon: Clock },
          ] as const).map(({ key, label, count, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === key ? 'bg-surface-card text-white shadow-sm' : 'text-gray-500 hover:text-white'
              }`}
            >
              <Icon size={14} />
              {label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                tab === key ? 'bg-brand-500/20 text-brand-300' : 'bg-surface-border text-gray-500'
              }`}>{count}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
          </div>
        ) : tabData.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-2xl bg-surface-muted flex items-center justify-center mx-auto mb-3">
              {tab === 'active' ? <Bell size={20} className="text-gray-600" /> : <Clock size={20} className="text-gray-600" />}
            </div>
            <p className="text-gray-400 font-medium mb-1">
              {tab === 'active' ? 'No active alerts' : 'No history yet'}
            </p>
            <p className="text-gray-600 text-sm">
              {tab === 'active'
                ? 'Go to any stock\'s page to set a target price or stop loss'
                : 'Triggered and paused alerts will appear here'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tabData.map(a => (
              <AlertCard key={a.id} alert={a} onDelete={handleDelete} onToggle={handleToggle} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

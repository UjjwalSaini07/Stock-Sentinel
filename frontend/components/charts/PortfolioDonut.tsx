'use client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { PortfolioEntry } from '@/types'

const COLORS = ['#26a366','#3b82f6','#8b5cf6','#f59e0b','#06b6d4','#ec4899','#14b8a6','#f97316']

interface Props { portfolio: PortfolioEntry[] }

export default function PortfolioDonut({ portfolio }: Props) {
  const data = portfolio.map((p, i) => ({
    name: p.ticker,
    value: (p.current_price ?? p.buy_price) * p.quantity,
    color: COLORS[i % COLORS.length],
  })).sort((a, b) => b.value - a.value)

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="flex items-center gap-6">
      <div className="w-28 h-28 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={32} outerRadius={52} paddingAngle={2} dataKey="value" stroke="none">
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#0e1420', border: '1px solid #182030', borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => [`₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, '']}
              labelStyle={{ color: '#fff' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-1.5 min-w-0">
        {data.slice(0, 6).map(d => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-xs text-gray-400 flex-1 truncate">{d.name}</span>
            <span className="text-xs font-mono font-medium text-white">{((d.value / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
        {data.length > 6 && <p className="text-xs text-gray-600">+{data.length - 6} more</p>}
      </div>
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string
  subValue?: string
  change?: string
  positive?: boolean
  neutral?: boolean
  icon?: React.ReactNode
  trend?: 'up' | 'down' | null
  loading?: boolean
  accentColor?: string
}

export default function StatCard({ label, value, subValue, change, positive, neutral, icon, loading, accentColor }: StatCardProps) {
  if (loading) {
    return (
      <div className="card">
        <div className="skeleton h-3 w-20 mb-4 rounded" />
        <div className="skeleton h-7 w-32 mb-2 rounded" />
        <div className="skeleton h-3 w-16 rounded" />
      </div>
    )
  }

  return (
    <div className="card relative overflow-hidden group hover:border-surface-hover transition-all duration-200">
      {/* Subtle top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-px ${
        accentColor ? accentColor :
        positive === true ? 'bg-gradient-to-r from-transparent via-brand-500/40 to-transparent' :
        positive === false ? 'bg-gradient-to-r from-transparent via-red-500/40 to-transparent' :
        'bg-gradient-to-r from-transparent via-surface-border to-transparent'
      }`} />

      <div className="flex items-start justify-between mb-3">
        <span className="stat-label">{label}</span>
        {icon && (
          <div className={`p-1.5 rounded-lg ${
            positive === true ? 'bg-brand-500/10 text-brand-400' :
            positive === false ? 'bg-red-500/10 text-red-400' :
            'bg-surface-muted text-gray-500'
          }`}>
            {icon}
          </div>
        )}
      </div>
      <div className="stat-value leading-none mb-1">{value}</div>
      {subValue && <div className="text-xs text-gray-500 mt-1">{subValue}</div>}
      {change && (
        <div className={`inline-flex items-center gap-1 text-xs font-semibold mt-2 px-2 py-0.5 rounded-full ${
          neutral ? 'bg-surface-muted text-gray-400' :
          positive ? 'bg-brand-500/12 text-brand-400' : 'bg-red-500/12 text-red-400'
        }`}>
          {!neutral && <span>{positive ? '▲' : '▼'}</span>}
          {change}
        </div>
      )}
    </div>
  )
}

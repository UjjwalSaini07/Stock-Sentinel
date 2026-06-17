interface Props {
  label: string
  value: string | number | null
  suffix?: string
  positive?: boolean | null
  highlight?: boolean
}

export default function MetricTile({ label, value, suffix = '', positive, highlight }: Props) {
  const isEmpty = value === null || value === undefined || value === ''
  return (
    <div className={`rounded-xl p-3.5 transition-all duration-300 border ${
      highlight
        ? 'bg-brand-500/10 border-brand-500/30 shadow-[0_0_15px_rgba(38,163,102,0.15)]'
        : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]'
    }`}>
      <div className="stat-label mb-1.5 text-gray-500 text-[10px] uppercase tracking-wider">{label}</div>
      <div className={`font-mono font-bold text-sm ${
        isEmpty ? 'text-gray-600' :
        positive === true ? 'text-brand-400' :
        positive === false ? 'text-red-400' :
        'text-white'
      }`}>
        {isEmpty ? '—' : `${value}${suffix}`}
      </div>
    </div>
  )
}

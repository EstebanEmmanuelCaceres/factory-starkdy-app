// Barra de progreso de producción (0-100 %) con el porcentaje al lado
export default function ProgressBar({
  value,
  className = '',
  title
}: {
  value: number
  className?: string
  title?: string
}) {
  const pct = Math.max(0, Math.min(100, value))
  // Color según avance: menos de 25 % azul, desde 25 % amarillo, 100 % verde
  const color = pct >= 100 ? 'bg-emerald-500' : pct >= 25 ? 'bg-amber-400' : 'bg-blue-500'

  return (
    <div className={`flex items-center gap-2 ${className}`} title={title}>
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 shrink-0 text-right text-xs font-bold tabular-nums text-slate-300">
        {Math.round(pct)}%
      </span>
    </div>
  )
}

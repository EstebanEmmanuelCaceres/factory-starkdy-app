import type { CobroEstado } from '@/lib/cobros'

const STYLES: Record<CobroEstado, { label: string; className: string }> = {
  pagado: { label: 'Pagado', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  pendiente: { label: 'Pendiente', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  anulado: { label: 'Anulado', className: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
}

export const CobroEstadoBadge = ({ estado }: { estado: CobroEstado }) => {
  const style = STYLES[estado] ?? { label: estado, className: 'bg-slate-500/10 text-slate-400 border-slate-500/20' }
  return (
    <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${style.className}`}>
      {style.label}
    </span>
  )
}

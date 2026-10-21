import { MEDIOS_PAGO, TIPOS_COBRO, type TipoCobro } from '@/lib/cobros'

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 })

export const formatMoney = (amount: number) => money.format(amount || 0)

/**
 * Las fechas de cobro se guardan en UTC y los cobros cargados "por día" quedan a las 00:00 UTC.
 * Se muestran en UTC para que el día coincida con el que se cargó (y con los filtros del back).
 */
export const formatFechaCobro = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

// YYYY-MM-DD para inputs type="date"
export const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '')

export const todayInput = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const currentMonthRange = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = d.getMonth()
  const pad = (n: number) => String(n).padStart(2, '0')
  const lastDay = new Date(y, m + 1, 0).getDate()
  return { desde: `${y}-${pad(m + 1)}-01`, hasta: `${y}-${pad(m + 1)}-${pad(lastDay)}` }
}

// Los registros viejos pueden tener medios fuera de la lista: se muestra el valor tal cual
export const medioPagoLabel = (medio: string | null) =>
  medio ? MEDIOS_PAGO.find((m) => m.value === medio)?.label ?? medio : '—'

export const tipoCobroLabel = (tipo: TipoCobro | null) =>
  tipo ? TIPOS_COBRO.find((t) => t.value === tipo)?.label ?? tipo : '—'

// Clases compartidas de los formularios
export const inputClass =
  'w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition [color-scheme:dark]'
export const labelClass = 'block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5'

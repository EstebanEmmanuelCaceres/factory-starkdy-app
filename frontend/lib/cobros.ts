import api from './api'

export type CobroEstado = 'pendiente' | 'pagado' | 'anulado'
export type TipoCobro = 'seña' | 'parcial' | 'saldo' | 'unico'

export const TIPOS_COBRO: { value: TipoCobro; label: string }[] = [
  { value: 'seña', label: 'Seña' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'saldo', label: 'Saldo' },
  { value: 'unico', label: 'Pago único' },
]

// Mismos valores que guarda el PaymentModal
export const MEDIOS_PAGO: { value: string; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'mercado_pago', label: 'Mercado Pago' },
  { value: 'otro', label: 'Otro' },
]

export const ESTADOS_COBRO: { value: CobroEstado; label: string }[] = [
  { value: 'pagado', label: 'Pagado' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'anulado', label: 'Anulado' },
]

interface CobroClienteRef {
  nombre_cliente: string
  nombre_empresa: string
}

/** Item del listado (GET /admin/cobros): solo lo que muestra la tabla. */
export interface CobroListItem {
  id: number
  // ISO 8601 en UTC (si se cargó solo la fecha, queda a las 00:00 UTC)
  fecha_pago: string | null
  pedido: { id: number; codigo: string } | null
  cliente: CobroClienteRef | null
  vendedor: string | null
  medio_pago: string | null
  tipo_cobro: TipoCobro | null
  monto: number
  estado: CobroEstado
}

/** Detalle de un cobro (GET /admin/cobros/{id} y respuestas de crear / editar / cancelar). */
export interface CobroDetail {
  id: number
  estado: CobroEstado
  monto: number
  fecha_pago: string | null
  medio_pago: string | null
  tipo_cobro: TipoCobro | null
  pedido: { id: number; codigo: string; precio: number } | null
  cliente: CobroClienteRef | null
  vendedor: { id: number; name: string } | null
  registrado_por: string | null
  observaciones: string | null
  referencia_externa: string | null
  comprobante_url: string | null
}

export type OrdenFecha = 'asc' | 'desc'

export interface CobroFilters {
  pedido_id?: number
  vendedor_id?: number
  estado?: CobroEstado
  medio_pago?: string
  tipo_cobro?: TipoCobro
  fecha_desde?: string
  fecha_hasta?: string
  page?: number
  // Orden por fecha de cobro (por defecto desc: más recientes primero)
  orden?: OrdenFecha
  per_page?: number
}

export interface PaginationMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
  // Suma de los cobros 'pagado' con los filtros aplicados (todas las páginas)
  total_cobrado: number
}

export interface CreateCobroInput {
  pedido_id: number
  monto: number
  medio_pago: string
  tipo_cobro: TipoCobro
  fecha_pago?: string | null
  vendedor_id?: number | null
  observaciones?: string | null
  referencia_externa?: string | null
  comprobante_url?: string | null
}

export type UpdateCobroInput = Partial<Omit<CreateCobroInput, 'pedido_id'>>

// Quita los filtros vacíos para no mandar `?estado=` al back
const cleanParams = (filters?: CobroFilters) =>
  Object.fromEntries(Object.entries(filters ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== ''))

export async function fetchCobros(filters?: CobroFilters): Promise<{ data: CobroListItem[]; meta: PaginationMeta }> {
  const { data } = await api.get<{ status: string; data: CobroListItem[]; meta: PaginationMeta }>('/admin/cobros', {
    params: cleanParams(filters),
  })
  return { data: data.data, meta: data.meta }
}

/**
 * Descarga un CSV con todos los cobros que cumplen los filtros (sin paginar, mismo orden que el listado).
 * Va por axios (y no por un link directo) porque el endpoint necesita el token de autenticación.
 */
export async function exportCobrosCsv(filters?: CobroFilters): Promise<void> {
  const { data } = await api.get<Blob>('/admin/cobros/exportar', {
    params: cleanParams(filters),
    responseType: 'blob',
  })
  const nombre = `cobros_${filters?.fecha_desde ?? 'inicio'}_${filters?.fecha_hasta ?? 'hoy'}.csv`
  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = nombre
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/**
 * Buscador por pedido (código) o cliente. Va por otro endpoint y no usa los filtros del listado.
 * Devuelve como máximo 100 cobros; meta.total indica cuántos coinciden en total.
 */
export async function searchCobros(q: string, orden: OrdenFecha = 'desc'): Promise<{ data: CobroListItem[]; meta: { total: number; total_cobrado: number } }> {
  const { data } = await api.get<{ status: string; data: CobroListItem[]; meta: { total: number; total_cobrado: number } }>(
    '/admin/cobros/buscar',
    { params: { q, orden } },
  )
  return { data: data.data, meta: data.meta }
}

export async function getCobro(id: number): Promise<CobroDetail> {
  const { data } = await api.get<{ status: string; data: CobroDetail }>(`/admin/cobros/${id}`)
  return data.data
}

export async function createCobro(input: CreateCobroInput): Promise<CobroDetail> {
  const { data } = await api.post<{ status: string; data: CobroDetail }>('/admin/cobros', input)
  return data.data
}

export async function updateCobro(id: number, input: UpdateCobroInput): Promise<CobroDetail> {
  const { data } = await api.patch<{ status: string; data: CobroDetail }>(`/admin/cobros/${id}`, input)
  return data.data
}

export async function cancelCobro(id: number, motivo?: string): Promise<CobroDetail> {
  const { data } = await api.patch<{ status: string; data: CobroDetail }>(`/admin/cobros/${id}/cancelar`, { motivo: motivo || null })
  return data.data
}

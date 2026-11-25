import api from '../api'
import type { Prioridad } from '@/components/order-cart/Types'

// Reposición: un pedido que se vuelve a hacer porque el original llegó mal (no es una venta).
// El backend la valida en CrearReposicionRequest / ReposicionService.

export type MotivoReposicion = 'falla_produccion' | 'error_diseno' | 'danado_envio' | 'faltante' | 'otro'

// Mismas claves y etiquetas que Pedido::MOTIVOS_REPOSICION del backend
export const MOTIVOS_REPOSICION: { value: MotivoReposicion; label: string; icon: string }[] = [
  { value: 'falla_produccion', label: 'Falla de producción', icon: '🛠️' },
  { value: 'error_diseno', label: 'Error de diseño', icon: '🎨' },
  { value: 'danado_envio', label: 'Dañado en el envío', icon: '📦' },
  { value: 'faltante', label: 'Faltante', icon: '➖' },
  { value: 'otro', label: 'Otro', icon: '📝' },
]

// Quiénes pueden crear reposiciones (CrearReposicionRequest::ROLES_PERMITIDOS)
export const ROLES_REPOSICION = ['admin', 'encargado']
export const puedeCrearReposicion = (role?: string | null) => !!role && ROLES_REPOSICION.includes(role)

// Body de POST /api/pedidos/{id}/reposicion: qué líneas del pedido se reponen y cuántas unidades
export interface CrearReposicionInput {
  motivo: MotivoReposicion
  detalle: string | null
  lineas: { linea_id: number; cantidad: number }[]
  fecha_entrega: string | null
  prioridad: Prioridad | null
}

// Respuesta del backend (ReposicionResource)
export interface Reposicion {
  id: number
  codigo: string
  tipo: 'reposicion'
  estado: string
  prioridad: Prioridad
  fecha_entrega: string | null
  motivo: { clave: MotivoReposicion; etiqueta: string }
  pedido_origen: { id: number; codigo: string }
  cliente: { id: number; nombre_cliente: string; nombre_empresa: string }
  vendedor: { id: number; name: string } | null
  lineas: {
    id: number
    producto_id: number
    producto: string
    cantidad: number
    atributos: { clave: string; etiqueta: string; valor: string }[]
  }[]
  unidades: number
  created_at: string
}

export async function crearReposicion(pedidoId: number, input: CrearReposicionInput): Promise<Reposicion> {
  const { data } = await api.post<{ status: string; data: Reposicion }>(`/pedidos/${pedidoId}/reposicion`, input)
  return data.data
}

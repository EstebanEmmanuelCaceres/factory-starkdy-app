import api from './api'
import { type Cliente } from './clientes'
import { type Product } from './products'
import { type User } from './auth'

export interface Pago {
  id: number
  pedido_id: number
  registrado_por: number
  medio: string
  estado: string
  monto: number
  moneda: string
  referencia_externa: string | null
  comprobante_url: string | null
  pagado_at: string | null
  created_at: string
  updated_at: string
}

export interface Pedido {
  id: number
  cliente_id: number
  user_id: number
  codigo: string
  estado: string
  prioridad: 'baja' | 'normal' | 'alta' | 'critica'
  fecha_entrega: string | null
  dias_vencimiento: number | null
  observaciones: string | null
  created_at: string
  updated_at: string
  cliente?: Cliente
  user?: User
  productos?: (Product & { pivot?: { cantidad: number } })[]
  pago?: Pago
}

export interface CreatePedidoInput {
  cliente_id: number
  codigo: string
  prioridad: 'baja' | 'normal' | 'alta' | 'critica'
  fecha_entrega?: string | null
  dias_vencimiento?: number | null
  observaciones?: string | null
  pago_monto?: number | null
  pago_estado?: 'pagado' | 'pendiente' | null
  productos?: { id: number; cantidad: number }[]
}

export interface UpdatePedidoInput {
  cliente_id?: number
  codigo?: string
  estado?: string
  prioridad?: 'baja' | 'normal' | 'alta' | 'critica'
  fecha_entrega?: string | null
  dias_vencimiento?: number | null
  observaciones?: string | null
  pago_monto?: number | null
  pago_estado?: 'pagado' | 'pendiente' | null
  productos?: { id: number; cantidad: number }[]
}

export interface PedidoFilters {
  search?: string
  estado?: string
  prioridad?: string
  fecha_desde?: string
  fecha_hasta?: string
  pago_estado?: string
}

export async function fetchPedidos(filters?: PedidoFilters): Promise<Pedido[]> {
  const { data } = await api.get<{ status: string; data: Pedido[] }>('/pedidos', { params: filters })
  return data.data
}

export async function createPedido(input: CreatePedidoInput): Promise<Pedido> {
  const { data } = await api.post<{ status: string; data: Pedido }>('/pedidos', input)
  return data.data
}

export async function getPedido(id: number): Promise<Pedido> {
  const { data } = await api.get<{ status: string; data: Pedido }>(`/pedidos/${id}`)
  return data.data
}

export async function updatePedido(id: number, input: UpdatePedidoInput): Promise<Pedido> {
  const { data } = await api.patch<{ status: string; data: Pedido }>(`/pedidos/${id}`, input)
  return data.data
}

export async function deletePedido(id: number): Promise<void> {
  await api.delete(`/pedidos/${id}`)
}

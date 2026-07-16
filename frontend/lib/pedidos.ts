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
  precio: number | null
  created_at: string
  updated_at: string
  cliente?: Cliente
  user?: User
  productos?: (Product & { pivot?: { cantidad: number } })[]
  pago?: Pago
}

export interface CreatePedidoInput {
  cliente_id?: number | null
  cliente?: any
  codigo: string
  prioridad: 'baja' | 'normal' | 'alta' | 'critica'
  fecha_entrega?: string | null
  precio?: number | null
  productos?: { id: number; cantidad: number }[]
  etapas?: { id?: number; producto_id: number; nombre: string; orden: number; temp_id?: string }[]
  asignaciones?: { etapa_id?: number; etapa_temp_id?: string; user_id: number | null }[]
}

export interface UpdatePedidoInput {
  cliente_id?: number
  codigo?: string
  estado?: string
  prioridad?: 'baja' | 'normal' | 'alta' | 'critica'
  fecha_entrega?: string | null
  precio?: number | null
  productos?: { id: number; cantidad: number }[]
  etapas?: { id?: number; producto_id: number; nombre: string; orden: number; temp_id?: string }[]
  asignaciones?: { etapa_id?: number; etapa_temp_id?: string; user_id: number | null }[]
}

export async function fetchPedidos(filters?: { search?: string; prioridad?: string; estado?: string }): Promise<Pedido[]> {
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

export async function generatePedidoTasks(id: number): Promise<void> {
  await api.post(`/pedidos/${id}/generar-tareas`)
}

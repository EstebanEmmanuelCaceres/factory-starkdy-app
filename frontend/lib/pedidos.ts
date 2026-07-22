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
  tipo_cobro: 'seña' | 'parcial' | 'saldo' | 'unico'
  vendedor_id: number | null
  medio_pago: string | null
  observaciones: string | null
  fecha_pago: string | null
  created_at: string
  updated_at: string
  vendedor?: User
}

export interface ComentarioPedido {
  id: number
  pedido_id: number
  user_id: number
  cuerpo: string
  created_at: string
  updated_at: string
  user?: User
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
  comentario?: string | null
  tipo_pago: 'unico' | 'parcial'
  created_at: string
  updated_at: string
  cliente?: Cliente
  user?: User
  productos?: (Product & { pivot?: { cantidad: number } })[]
  pago?: Pago
  pagos?: Pago[]
  monto_pagado?: number
  saldo_pendiente?: number
  porcentaje_pagado?: number
  estado_pago?: 'sin_pago' | 'parcial' | 'pagado'
  comentarios?: ComentarioPedido[]
  tareas?: any[]
}

export interface CreatePedidoInput {
  cliente_id?: number | null
  cliente?: any
  codigo: string
  prioridad: 'baja' | 'normal' | 'alta' | 'critica'
  fecha_entrega?: string | null
  precio?: number | null
  comentario?: string | null
  tipo_pago?: 'unico' | 'parcial'
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
  comentario?: string | null
  tipo_pago?: 'unico' | 'parcial'
  productos?: { id: number; cantidad: number }[]
  etapas?: { id?: number; producto_id: number; nombre: string; orden: number; temp_id?: string }[]
  asignaciones?: { etapa_id?: number; etapa_temp_id?: string; user_id: number | null }[]
}

export interface PedidoFilters {
  search?: string
  prioridad?: string
  estado?: string
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

export async function generatePedidoTasks(id: number): Promise<void> {
  await api.post(`/pedidos/${id}/generar-tareas`)
}

// ── Llamadas API de Pagos ───────────────────────────────────────
export async function fetchPedidoPagos(pedidoId: number): Promise<Pago[]> {
  const { data } = await api.get<{ status: string; data: Pago[] }>(`/pedidos/${pedidoId}/pagos`)
  return data.data
}

export async function createPedidoPago(pedidoId: number, input: {
  monto: number
  medio_pago: string
  tipo_cobro: 'seña' | 'parcial' | 'saldo' | 'unico'
  observaciones?: string
  fecha_pago?: string
}): Promise<{ status: string; message: string; data: Pago; pedido: Pedido }> {
  const { data } = await api.post<{ status: string; message: string; data: Pago; pedido: Pedido }>(`/pedidos/${pedidoId}/pagos`, input)
  return data
}

export async function updatePedidoPago(pagoId: number, input: {
  monto?: number
  medio_pago?: string
  tipo_cobro?: 'seña' | 'parcial' | 'saldo' | 'unico'
  observaciones?: string
  fecha_pago?: string
  estado?: 'pendiente' | 'pagado' | 'anulado'
}): Promise<{ status: string; message: string; data: Pago; pedido: Pedido }> {
  const { data } = await api.patch<{ status: string; message: string; data: Pago; pedido: Pedido }>(`/pagos/${pagoId}`, input)
  return data
}

// destroy hace anulación lógica, pasándole el ID de pago
export async function deletePedidoPago(pagoId: number): Promise<{ status: string; message: string; data: Pago; pedido: Pedido }> {
  const { data } = await api.delete<{ status: string; message: string; data: Pago; pedido: Pedido }>(`/pagos/${pagoId}`)
  return data
}

// ── Llamadas API de Comentarios ─────────────────────────────────
export async function fetchPedidoComentarios(pedidoId: number): Promise<ComentarioPedido[]> {
  const { data } = await api.get<{ status: string; data: ComentarioPedido[] }>(`/pedidos/${pedidoId}/comentarios`)
  return data.data
}

export async function createPedidoComentario(pedidoId: number, cuerpo: string): Promise<ComentarioPedido> {
  const { data } = await api.post<{ status: string; data: ComentarioPedido }>(`/pedidos/${pedidoId}/comentarios`, { cuerpo })
  return data.data
}

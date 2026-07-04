import api from './api'
import { type Cliente } from './clientes'
import { type Product } from './products'
import { type User } from './auth'

export interface Pedido {
  id: number
  cliente_id: number
  user_id: number
  codigo: string
  estado: string
  prioridad: 'baja' | 'normal' | 'alta' | 'critica'
  fecha_entrega: string | null
  created_at: string
  updated_at: string
  cliente?: Cliente
  user?: User
  productos?: Product[]
}

export interface CreatePedidoInput {
  cliente_id: number
  codigo: string
  prioridad: 'baja' | 'normal' | 'alta' | 'critica'
  fecha_entrega?: string | null
  productos?: number[]
}

export interface UpdatePedidoInput {
  cliente_id?: number
  codigo?: string
  estado?: string
  prioridad?: 'baja' | 'normal' | 'alta' | 'critica'
  fecha_entrega?: string | null
  productos?: number[]
}

export async function fetchPedidos(filters?: { search?: string }): Promise<Pedido[]> {
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

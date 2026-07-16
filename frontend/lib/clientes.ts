import api from './api'
import { type Pedido } from './pedidos'

export interface Cliente {
  id: number
  nombre_cliente: string
  nombre_empresa: string
  email: string | null
  telefono: string | null
  dni: string | null
  direccion: string | null
  provincia: string | null
  cp: string | null
  localidad: string | null
  ingreso: number
  valor_total: number
  saldo: number
  observaciones: string | null
  created_at: string
  updated_at: string
  pedidos?: Pedido[]
}

export interface CreateClienteInput {
  nombre_cliente: string
  nombre_empresa: string
  email?: string | null
  telefono: string
  dni?: string | null
  direccion?: string | null
  provincia?: string | null
  cp?: string | null
  localidad?: string | null
  ingreso?: number
  valor_total?: number
  saldo?: number
  observaciones?: string | null
}

export interface UpdateClienteInput {
  nombre_cliente?: string
  nombre_empresa?: string
  email?: string | null
  telefono?: string
  dni?: string | null
  direccion?: string | null
  provincia?: string | null
  cp?: string | null
  localidad?: string | null
  ingreso?: number
  valor_total?: number
  saldo?: number
  observaciones?: string | null
}

export async function fetchClientes(filters?: { search?: string; nombre_empresa?: string; nombre_cliente?: string; with_pedidos?: boolean }): Promise<Cliente[]> {
  const { data } = await api.get<{ status: string; data: Cliente[] }>('/clientes', { params: filters })
  return data.data
}

export async function createCliente(input: CreateClienteInput): Promise<Cliente> {
  const { data } = await api.post<{ status: string; data: Cliente }>('/clientes', input)
  return data.data
}

export async function getCliente(id: number): Promise<Cliente> {
  const { data } = await api.get<{ status: string; data: Cliente }>(`/clientes/${id}`)
  return data.data
}

export async function updateCliente(id: number, input: UpdateClienteInput): Promise<Cliente> {
  const { data } = await api.patch<{ status: string; data: Cliente }>(`/clientes/${id}`, input)
  return data.data
}

export async function deleteCliente(id: number): Promise<void> {
  await api.delete(`/clientes/${id}`)
}

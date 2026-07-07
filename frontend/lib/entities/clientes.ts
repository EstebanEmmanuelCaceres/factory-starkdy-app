import api from '../api'

export interface Cliente {
  id: number
  nombre_cliente: string
  nombre_empresa: string
  telefono: string
  email: string | null
  created_at: string
  updated_at: string
}

export interface CreateClienteInput {
  nombre_cliente: string
  nombre_empresa: string
  telefono: string
  email?: string | null
}

export interface UpdateClienteInput {
  nombre_cliente?: string
  nombre_empresa?: string
  telefono?: string
  email?: string | null
}

export async function fetchClientes(filters?: { nombre_cliente?: string; nombre_empresa?: string }): Promise<Cliente[]> {
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

import api from '../api'

export interface Responsabilidad {
  id: number
  nombre: string
  descripcion: string | null
  created_at: string
  updated_at: string
}

export interface CreateResponsabilidadInput {
  nombre: string
  descripcion?: string | null
}

export interface UpdateResponsabilidadInput {
  nombre?: string
  descripcion?: string | null
}

export async function fetchResponsabilidades(filters?: { nombre?: string }): Promise<Responsabilidad[]> {
  const { data } = await api.get<{ status: string; data: Responsabilidad[] }>('/responsabilidades', { params: filters })
  return data.data
}

export async function createResponsabilidad(input: CreateResponsabilidadInput): Promise<Responsabilidad> {
  const { data } = await api.post<{ status: string; data: Responsabilidad }>('/responsabilidades', input)
  return data.data
}

export async function getResponsabilidad(id: number): Promise<Responsabilidad> {
  const { data } = await api.get<{ status: string; data: Responsabilidad }>(`/responsabilidades/${id}`)
  return data.data
}

export async function updateResponsabilidad(id: number, input: UpdateResponsabilidadInput): Promise<Responsabilidad> {
  const { data } = await api.patch<{ status: string; data: Responsabilidad }>(`/responsabilidades/${id}`, input)
  return data.data
}

export async function deleteResponsabilidad(id: number): Promise<void> {
  await api.delete(`/responsabilidades/${id}`)
}

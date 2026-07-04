import api from '../api'
import type { User } from '../auth'

export interface Responsabilidad {
  id: number
  nombre: string
  slug: string
  descripcion: string | null
}

export interface Etapa {
  id: number
  producto_id: number
  nombre: string
  posicion: number
  estado: string
  fecha_inicio: string | null
  fecha_fin: string | null
  created_at: string
  updated_at: string
  operarios?: User[]
  responsabilidades?: Responsabilidad[]
}

export interface CreateEtapaInput {
  producto_id: number
  nombre: string
  posicion?: number
  estado?: string
  fecha_inicio?: string | null
  fecha_fin?: string | null
}

export interface UpdateEtapaInput {
  producto_id?: number
  nombre?: string
  posicion?: number
  estado?: string
  fecha_inicio?: string | null
  fecha_fin?: string | null
}

export async function fetchEtapas(filters?: { producto_id?: number; estado?: string }): Promise<Etapa[]> {
  const { data } = await api.get<{ status: string; data: Etapa[] }>('/etapas', { params: filters })
  return data.data
}

export async function createEtapa(input: CreateEtapaInput): Promise<Etapa> {
  const { data } = await api.post<{ status: string; data: Etapa }>('/etapas', input)
  return data.data
}

export async function getEtapa(id: number): Promise<Etapa> {
  const { data } = await api.get<{ status: string; data: Etapa }>(`/etapas/${id}`)
  return data.data
}

export async function updateEtapa(id: number, input: UpdateEtapaInput): Promise<Etapa> {
  const { data } = await api.patch<{ status: string; data: Etapa }>(`/etapas/${id}`, input)
  return data.data
}

export async function deleteEtapa(id: number): Promise<void> {
  await api.delete(`/etapas/${id}`)
}

export async function asignarOperario(etapaId: number, userId: number): Promise<void> {
  await api.post(`/etapas/${etapaId}/operarios`, { user_id: userId })
}

export async function desasignarOperario(etapaId: number, userId: number): Promise<void> {
  await api.delete(`/etapas/${etapaId}/operarios/${userId}`)
}

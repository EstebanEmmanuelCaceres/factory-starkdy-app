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
  orden: number
  created_at: string
  updated_at: string
  dependencias?: Etapa[]
  responsabilidades?: Responsabilidad[]
  producto?: {
    id: number
    nombre: string
    sku: string | null
  }
}

export interface CreateEtapaInput {
  producto_id: number
  nombre: string
  orden?: number
  depende_de_ids?: number[]
}

export interface UpdateEtapaInput {
  producto_id?: number
  nombre?: string
  orden?: number
  depende_de_ids?: number[]
}

export async function fetchEtapas(filters?: { producto_id?: number }): Promise<Etapa[]> {
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

export interface SyncEtapaItemInput {
  id?: number | null
  temp_id?: string | null
  nombre: string
  orden: number
  depende_de_ids: (number | string)[]
}

export async function syncEtapas(productId: number, etapas: SyncEtapaItemInput[]): Promise<Etapa[]> {
  const { data } = await api.post<{ status: string; message: string; data: Etapa[] }>(`/productos/${productId}/etapas/sync`, { etapas })
  return data.data
}

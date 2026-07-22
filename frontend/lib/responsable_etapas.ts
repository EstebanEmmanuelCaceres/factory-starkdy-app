import api from './api'
import type { User } from './auth'
import type { Etapa } from './entities/etapas'
import type { Pedido } from './pedidos'

export interface ResponsableEtapa {
  id: number
  pedido_id: number
  etapa_id: number
  user_id: number
  estado: string
  fecha_inicio: string | null
  fecha_fin: string | null
  created_at: string
  updated_at: string
  pedido?: Pedido
  etapa?: Etapa
  user?: User
  dependencias_info?: { id: number; nombre: string; estado: string }[]
}

export interface AssignTaskInput {
  pedido_id: number
  etapa_id: number
  user_id: number
  estado?: string
}

export async function fetchResponsablesEtapas(filters?: {
  pedido_id?: number
  user_id?: number
  estado?: string
}): Promise<ResponsableEtapa[]> {
  const { data } = await api.get<{ status: string; data: ResponsableEtapa[] }>('/responsables-etapas', { params: filters })
  return data.data
}

export async function assignTask(input: AssignTaskInput): Promise<ResponsableEtapa> {
  const { data } = await api.post<{ status: string; data: ResponsableEtapa }>('/responsables-etapas', input)
  return data.data
}

export async function removeTaskAssignment(id: number): Promise<void> {
  await api.delete(`/responsables-etapas/${id}`)
}

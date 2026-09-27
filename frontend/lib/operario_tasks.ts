import api from './api'
import type { ResponsableEtapa } from './responsable_etapas'

export async function fetchOperarioTasks(params?: { user_id?: number }): Promise<ResponsableEtapa[]> {
  const { data } = await api.get<{ status: string; data: ResponsableEtapa[] }>('/operario/tasks', { params })
  return data.data
}

export async function startOperarioTask(id: number): Promise<ResponsableEtapa> {
  const { data } = await api.post<{ status: string; data: ResponsableEtapa }>(`/operario/tasks/${id}/start`)
  return data.data
}

export async function cancelOperarioTask(id: number): Promise<ResponsableEtapa> {
  const { data } = await api.post<{ status: string; data: ResponsableEtapa }>(`/operario/tasks/${id}/cancel`)
  return data.data
}

export async function completeOperarioTask(id: number): Promise<{
  task: ResponsableEtapa
}> {
  const { data } = await api.post<{
    status: string
    data: { task: ResponsableEtapa }
  }>(`/operario/tasks/${id}/complete`)
  return data.data
}

export async function fetchOperarioHistorial(): Promise<ResponsableEtapa[]> {
  const { data } = await api.get<{ status: string; data: ResponsableEtapa[] }>('/operario/historial')
  return data.data
}

export interface TaskPorCategoria {
  id: number
  pedido_id: number
  nombre_pedido: string
  nombre_etapa: string
  user_asignado: string
  usuarios_habilitados: string[]
  fecha_fin_etapa_anterior: string | null
  estado: string
}

export async function fetchTasksPorCategoria(categoriaId?: number): Promise<TaskPorCategoria[]> {
  const { data } = await api.get<{ status: string; data: TaskPorCategoria[] }>('/operario/tasks/por-categoria', {
    params: categoriaId ? { categoria_id: categoriaId } : {}
  })
  return data.data
}

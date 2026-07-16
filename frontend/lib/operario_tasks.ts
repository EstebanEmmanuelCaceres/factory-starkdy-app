import api from './api'
import type { ResponsableEtapa } from './responsable_etapas'

export async function fetchOperarioTasks(): Promise<ResponsableEtapa[]> {
  const { data } = await api.get<{ status: string; data: ResponsableEtapa[] }>('/operario/tasks')
  return data.data
}

export async function startOperarioTask(id: number): Promise<ResponsableEtapa> {
  const { data } = await api.post<{ status: string; data: ResponsableEtapa }>(`/operario/tasks/${id}/start`)
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

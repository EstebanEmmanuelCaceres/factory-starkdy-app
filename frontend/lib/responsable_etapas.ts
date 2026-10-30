import api from './api'
import type { User } from './auth'
import type { Etapa } from './entities/etapas'
import type { Pedido } from './pedidos'

export interface ResponsableEtapa {
  id: number
  pedido_id: number
  etapa_id: number
  user_id: number | null
  estado: string
  fecha_inicio: string | null
  fecha_fin: string | null
  created_at: string
  updated_at: string
  pedido?: Pedido
  etapa?: Etapa
  etapaProducto?: any
  user?: User
  dependencias_info?: { id: number; nombre: string; estado: string }[]
}

export interface AssignTaskInput {
  pedido_id: number
  etapa_id: number
  user_id: number | null
  estado?: string
}

export async function fetchResponsablesEtapas(filters?: {
  pedido_id?: number
  user_id?: number
  estado?: string
  fecha_desde?: string
  fecha_hasta?: string
}): Promise<ResponsableEtapa[]> {
  const { data } = await api.get<{ status: string; data: ResponsableEtapa[] }>('/responsables-etapas', { params: filters })
  return data.data
}

// Etapas de un pedido armadas desde sus tareas: cada pedido conserva las etapas que tenía cada producto
// cuando entró al pedido (agregar o quitar etapas al producto después no lo afecta).
// Solo se conservan las dependencias que el pedido también tiene como tarea.
export function etapasDesdeTareas(tareas: ResponsableEtapa[]): Etapa[] {
  const etapas = tareas.map((t) => t.etapa).filter((e): e is Etapa => !!e)
  const idsDelPedido = new Set(etapas.map((e) => e.id))

  return etapas.map((e) => ({
    id: e.id,
    producto_id: e.producto_id,
    nombre: e.nombre,
    orden: e.orden,
    dependencias: (e.dependencias || [])
      .filter((dep) => idsDelPedido.has(dep.id))
      .map((dep) => ({ id: dep.id, producto_id: e.producto_id, nombre: '', orden: 0 }))
  }))
}

export async function assignTask(input: AssignTaskInput): Promise<ResponsableEtapa> {
  const { data } = await api.post<{ status: string; data: ResponsableEtapa }>('/responsables-etapas', input)
  return data.data
}

export async function removeTaskAssignment(id: number): Promise<void> {
  await api.delete(`/responsables-etapas/${id}`)
}

export async function uncompleteTask(id: number): Promise<ResponsableEtapa> {
  const { data } = await api.post<{ status: string; data: { task: ResponsableEtapa } }>(`/operario/tasks/${id}/uncomplete`)
  return data.data.task
}

export async function fetchDisenosPendientes(filters?: { vendedor_id?: string }): Promise<ResponsableEtapa[]> {
  const { data } = await api.get<{ status: string; data: ResponsableEtapa[] }>('/disenos-pendientes', { params: filters })
  return data.data
}

export async function completarDisenosPedido(pedidoId: number, taskIdsCompletadas: number[]): Promise<void> {
  await api.post(`/pedidos/${pedidoId}/completar-disenos`, {
    task_ids_completadas: taskIdsCompletadas
  })
}

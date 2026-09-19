import api from '../api'

export interface EtapaCatalog {
  id: number
  nombre: string
  descripcion: string | null
}

export interface Etapa {
  id: number
  producto_id: number
  etapa_id?: number
  nombre: string
  orden: number
  created_at?: string
  updated_at?: string
  dependencias?: Etapa[]
  etapa?: EtapaCatalog
  producto?: { id: number; nombre: string }
}

export interface SyncEtapaItemInput {
  id?: number | null
  temp_id?: string | null
  etapa_id?: number | null
  nombre: string
  orden: number
  depende_de_ids: (number | string)[]
}

// Obtener etapas del catálogo maestro con búsqueda opcional
export async function fetchEtapasCatalog(search?: string): Promise<EtapaCatalog[]> {
  const { data } = await api.get<{ status: string; data: EtapaCatalog[] }>('/etapas', {
    params: search ? { search } : {}
  })
  return data.data
}

// Crear una etapa en el catálogo maestro si no existe
export async function createEtapaCatalog(nombre: string, descripcion?: string): Promise<EtapaCatalog> {
  const { data } = await api.post<{ status: string; data: EtapaCatalog }>('/etapas', {
    nombre,
    descripcion
  })
  return data.data
}

// Obtener las etapas configuradas para un producto
export async function fetchEtapas(filters?: { producto_id?: number }): Promise<Etapa[]> {
  if (filters?.producto_id) {
    const { data } = await api.get<{ status: string; data: any[] }>(`/productos/${filters.producto_id}/etapas`)
    return data.data.map(item => ({
      id: item.id,
      producto_id: item.producto_id,
      etapa_id: item.etapa_id,
      nombre: item.etapa?.nombre || item.nombre || '',
      orden: item.orden,
      created_at: item.created_at,
      updated_at: item.updated_at,
      dependencias: item.dependencias?.map((d: any) => ({
        id: d.id,
        producto_id: d.producto_id,
        nombre: d.etapa?.nombre || d.nombre || '',
        orden: d.orden
      })),
      etapa: item.etapa
    }))
  }
  
  const { data } = await api.get<{ status: string; data: EtapaCatalog[] }>('/etapas')
  return data.data.map(item => ({
    id: item.id,
    producto_id: 0,
    nombre: item.nombre,
    orden: 0,
  }))
}

// Sincronizar las etapas de un producto
export async function syncEtapas(productId: number, etapas: SyncEtapaItemInput[]): Promise<Etapa[]> {
  const { data } = await api.post<{ status: string; message: string; data: any[] }>(`/productos/${productId}/etapas/sync`, { etapas })
  return data.data.map(item => ({
    id: item.id,
    producto_id: item.producto_id,
    etapa_id: item.etapa_id,
    nombre: item.etapa?.nombre || item.nombre || '',
    orden: item.orden,
    created_at: item.created_at,
    updated_at: item.updated_at,
    dependencias: item.dependencias?.map((d: any) => ({
      id: d.id,
      producto_id: d.producto_id,
      nombre: d.etapa?.nombre || d.nombre || '',
      orden: d.orden
    })),
    etapa: item.etapa
  }))
}

// Ordenar etapas topológicamente en base a sus dependencias
export function topologicalSortEtapas(etapas: Etapa[]): Etapa[] {
  if (!etapas || etapas.length === 0) return []

  const stageMap = new Map<number | string, Etapa>()
  const inDegree = new Map<number | string, number>()
  const adj = new Map<number | string, (number | string)[]>()
  const originalOrdenMap = new Map<number | string, number>()

  etapas.forEach((stage, idx) => {
    const key = stage.id || (stage as any).temp_id || `idx_${idx}`
    stageMap.set(key, stage)
    inDegree.set(key, 0)
    adj.set(key, [])
    originalOrdenMap.set(key, stage.orden ?? idx + 1)
  })

  etapas.forEach((stage, idx) => {
    const key = stage.id || (stage as any).temp_id || `idx_${idx}`
    if (stage.dependencias && stage.dependencias.length > 0) {
      stage.dependencias.forEach((dep) => {
        const depKey = dep.id || (dep as any).temp_id
        if (depKey !== undefined && stageMap.has(depKey)) {
          // dep -> key (stage depende de dep)
          adj.get(depKey)?.push(key)
          inDegree.set(key, (inDegree.get(key) || 0) + 1)
        }
      })
    }
  })

  const queue: (number | string)[] = []
  stageMap.forEach((_, key) => {
    if (inDegree.get(key) === 0) {
      queue.push(key)
    }
  })

  queue.sort((a, b) => (originalOrdenMap.get(a) || 0) - (originalOrdenMap.get(b) || 0))

  const sortedResult: Etapa[] = []

  while (queue.length > 0) {
    const currentKey = queue.shift()!
    const stageObj = stageMap.get(currentKey)
    if (stageObj) {
      sortedResult.push(stageObj)
    }

    const neighbors = adj.get(currentKey) || []
    neighbors.forEach((neighborKey) => {
      const currentInDegree = (inDegree.get(neighborKey) || 0) - 1
      inDegree.set(neighborKey, currentInDegree)
      if (currentInDegree === 0) {
        queue.push(neighborKey)
        queue.sort((a, b) => (originalOrdenMap.get(a) || 0) - (originalOrdenMap.get(b) || 0))
      }
    })
  }

  if (sortedResult.length < etapas.length) {
    etapas.forEach((s) => {
      if (!sortedResult.includes(s)) {
        sortedResult.push(s)
      }
    })
  }

  return sortedResult.map((stage, idx) => ({
    ...stage,
    orden: idx + 1
  }))
}

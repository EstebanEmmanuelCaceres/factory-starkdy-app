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

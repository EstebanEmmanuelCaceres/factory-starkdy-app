import api from '../api'

export interface OrderImage {
  id: number
  pedido_id: number
  url: string
  path_almacenamiento: string | null
  orden: number
  es_principal: boolean
  created_at: string
  updated_at: string
}

export async function fetchOrderImages(orderId: number): Promise<OrderImage[]> {
  const { data } = await api.get<{ status: string; data: OrderImage[] }>(`/pedidos/${orderId}/imagenes`)
  return data.data
}

export async function uploadOrderImages(orderId: number, files?: File[], urls?: string[]): Promise<OrderImage[]> {
  const formData = new FormData()
  if (files && files.length > 0) {
    files.forEach(file => {
      formData.append('imagenes[]', file)
    })
  }
  if (urls && urls.length > 0) {
    urls.forEach(url => {
      formData.append('urls[]', url)
    })
  }

  const { data } = await api.post<{ status: string; data: OrderImage[] }>(
    `/pedidos/${orderId}/imagenes`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  )
  return data.data
}

export async function setPrimaryOrderImage(orderId: number, imageId: number): Promise<OrderImage[]> {
  const { data } = await api.patch<{ status: string; data: OrderImage[] }>(
    `/pedidos/${orderId}/imagenes/${imageId}/principal`
  )
  return data.data
}

export async function deleteOrderImage(orderId: number, imageId: number): Promise<OrderImage[]> {
  const { data } = await api.delete<{ status: string; data: OrderImage[] }>(
    `/pedidos/${orderId}/imagenes/${imageId}`
  )
  return data.data
}

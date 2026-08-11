import api from '../api'

export interface ProductImage {
  id: number
  producto_id: number
  url: string
  path_almacenamiento: string | null
  orden: number
  es_principal: boolean
  created_at: string
  updated_at: string
}

export async function fetchProductImages(productId: number): Promise<ProductImage[]> {
  const { data } = await api.get<{ status: string; data: ProductImage[] }>(`/productos/${productId}/imagenes`)
  return data.data
}

export async function uploadProductImages(productId: number, files?: File[], urls?: string[]): Promise<ProductImage[]> {
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

  const { data } = await api.post<{ status: string; data: ProductImage[] }>(
    `/productos/${productId}/imagenes`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  )
  return data.data
}

export async function setPrimaryProductImage(productId: number, imageId: number): Promise<ProductImage[]> {
  const { data } = await api.patch<{ status: string; data: ProductImage[] }>(
    `/productos/${productId}/imagenes/${imageId}/principal`
  )
  return data.data
}

export async function deleteProductImage(productId: number, imageId: number): Promise<ProductImage[]> {
  const { data } = await api.delete<{ status: string; data: ProductImage[] }>(
    `/productos/${productId}/imagenes/${imageId}`
  )
  return data.data
}

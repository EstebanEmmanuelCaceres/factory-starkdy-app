import api from './api'
import type { ProductImage } from './entities/productImages'
import type { AtributoProducto } from './entities/atributos'

export interface Product {
  id: number
  nombre: string
  sku?: string | null
  descripcion: string | null
  created_at: string
  updated_at: string
  imagenes?: ProductImage[]
  imagen_principal?: ProductImage | null
  precio: number | null
  atributos: AtributoProducto[]
}

export interface CreateProductInput {
  nombre: string
  sku?: string | null
  descripcion?: string | null
}

export interface UpdateProductInput {
  nombre?: string
  sku?: string | null
  descripcion?: string | null
  // Lista completa: reemplaza los atributos que tenía el producto
  atributos?: AtributoProducto[]
}

export async function fetchProducts(filters?: { nombre?: string }): Promise<Product[]> {
  const { data } = await api.get<{ status: string; data: Product[] }>('/productos', { params: filters })
  return data.data
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const { data } = await api.post<{ status: string; data: Product }>('/productos', input)
  return data.data
}

export async function getProduct(id: number): Promise<Product> {
  const { data } = await api.get<{ status: string; data: Product }>(`/productos/${id}`)
  return data.data
}

export async function updateProduct(id: number, input: UpdateProductInput): Promise<Product> {
  const { data } = await api.patch<{ status: string; data: Product }>(`/productos/${id}`, input)
  return data.data
}

export async function deleteProduct(id: number): Promise<void> {
  await api.delete(`/productos/${id}`)
}

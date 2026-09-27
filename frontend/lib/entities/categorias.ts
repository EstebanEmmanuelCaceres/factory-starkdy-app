import api from '../api'

export interface Categoria {
  id: number,
  nombre: string
}

/**
 * Obtener todas las categorías
 */
export async function fetchCategorias(): Promise<Categoria[]> {
  const { data } = await api.get<{ status: string; data: Categoria[] }>('/categorias')
  return data.data
}

/**
 * Crear una nueva categoría
 */
export async function createCategoria(nombre: string): Promise<Categoria> {
  const { data } = await api.post<{ status: string; data: Categoria }>('/categorias', {
    nombre
  })
  return data.data
}

/**
 * Actualizar una categoría
 */
// export async function updateCategoria(id: number, input: { nombre?: string; descripcion?: string }): Promise<Categoria> {
//   const { data } = await api.patch<{ status: string; data: Categoria }>(`/categorias/${id}`, input)
//   return data.data
// }

/**
 * Eliminar una categoría
 */
// export async function deleteCategoria(id: number): Promise<void> {
//   await api.delete(`/categorias/${id}`)
// }



export const toggleSelected = (list: number[], id: number) => {
  if (list.includes(id)) {
    return list.filter(item => item !== id)
  }
  return [...list, id]
}

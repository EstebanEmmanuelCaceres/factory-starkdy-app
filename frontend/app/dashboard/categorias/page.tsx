'use client'

import { useEffect, useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import Modal from '@/components/Modal'
import Pagination from '@/components/Pagination'
import {
  fetchCategorias,
  createCategoria,
  updateCategoria,
  deleteCategoria,
  type Categoria
} from '@/lib/entities/categorias'

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalError, setModalError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Filtros y Búsqueda
  const [searchQuery, setSearchQuery] = useState('')

  // Paginación
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Modales
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // Categoría seleccionada para edicion / eliminacion
  const [selectedCategoria, setSelectedCategoria] = useState<Categoria | null>(null)

  // Form State (solo nombre)
  const [nombre, setNombre] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadCategorias = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchCategorias()
      setCategorias(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar las categorías')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategorias()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const showNotification = (msg: string) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(''), 4000)
  }

  // Abrir modal para crear
  const handleOpenCreateModal = () => {
    setSelectedCategoria(null)
    setNombre('')
    setModalError('')
    setIsFormModalOpen(true)
  }

  // Abrir modal para editar
  const handleOpenEditModal = (categoria: Categoria) => {
    setSelectedCategoria(categoria)
    setNombre(categoria.nombre)
    setModalError('')
    setIsFormModalOpen(true)
  }

  // Submit Form (Crear o Editar)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre.trim()) {
      setModalError('El nombre es obligatorio.')
      return
    }

    setSubmitting(true)
    setModalError('')

    try {
      if (selectedCategoria) {
        // Actualizar
        const updated = await updateCategoria(selectedCategoria.id, nombre.trim())
        showNotification(`Categoría "${updated.nombre}" actualizada con éxito.`)
      } else {
        // Crear
        const created = await createCategoria(nombre.trim())
        showNotification(`Categoría "${created.nombre}" creada con éxito.`)
      }
      setIsFormModalOpen(false)
      loadCategorias()
    } catch (err: any) {
      const serverMsg = err?.response?.data?.errors?.nombre?.[0] || err?.response?.data?.message || err?.message || 'Error al procesar la solicitud'
      setModalError(serverMsg)
    } finally {
      setSubmitting(false)
    }
  }

  // Abrir modal de confirmación de eliminación
  const handleOpenDeleteModal = (categoria: Categoria) => {
    setSelectedCategoria(categoria)
    setModalError('')
    setIsDeleteModalOpen(true)
  }

  // Submit Eliminación
  const handleDelete = async () => {
    if (!selectedCategoria) return

    setSubmitting(true)
    setModalError('')

    try {
      await deleteCategoria(selectedCategoria.id)
      showNotification(`Categoría "${selectedCategoria.nombre}" eliminada correctamente.`)
      setIsDeleteModalOpen(false)
      loadCategorias()
    } catch (err: any) {
      const serverMsg = err?.response?.data?.message || err?.message || 'Error al eliminar la categoría'
      setModalError(serverMsg)
    } finally {
      setSubmitting(false)
    }
  }

  // Filtrado
  const filteredCategorias = categorias.filter((cat) =>
    cat.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalItems = filteredCategorias.length
  const paginatedCategorias = filteredCategorias.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  return (
    <RoleGuard allowedRoles={['admin']}>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800/80 backdrop-blur-md">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">Gestión de Categorías</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {categorias.length} {categorias.length === 1 ? 'categoría' : 'categorías'}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Administración rápida de categorías de productos y etapas.
            </p>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-blue-600/20 active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Nueva Categoría
          </button>
        </div>

        {/* Notificaciones */}
        {successMessage && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm flex items-center gap-2 animate-in fade-in">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Búsqueda */}
        <div className="relative">
          <svg className="w-5 h-5 absolute left-3.5 top-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar categoría por nombre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-sm"
          />
        </div>

        {/* Tabla */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
              <p>Cargando categorías...</p>
            </div>
          ) : paginatedCategorias.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <p className="text-base font-medium">No hay categorías registradas</p>
              <p className="text-xs text-slate-500 mt-1">Haz clic en &quot;Nueva Categoría&quot; para agregar la primera.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                    <th className="py-4 px-6 w-20">ID</th>
                    <th className="py-4 px-6">Nombre</th>
                    <th className="py-4 px-6 text-right w-36">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paginatedCategorias.map((cat) => (
                    <tr key={cat.id} className="hover:bg-slate-800/40 transition group">
                      <td className="py-4 px-6 text-slate-500 font-mono text-xs">#{cat.id}</td>
                      <td className="py-4 px-6 font-medium text-slate-200">
                        <span className="inline-flex items-center gap-2 bg-purple-950/40 text-purple-300 border border-purple-800/50 px-3 py-1 rounded-lg text-sm">
                          🏷️ {cat.nombre}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditModal(cat)}
                            title="Editar Categoría"
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleOpenDeleteModal(cat)}
                            title="Eliminar Categoría"
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación */}
          {totalItems > pageSize && (
            <div className="p-4 border-t border-slate-800 bg-slate-950/30">
              <Pagination
                currentPage={currentPage}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={(page) => setCurrentPage(page)}
              />
            </div>
          )}
        </div>

        {/* MODAL: Crear / Editar Categoría */}
        <Modal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} className="w-full lg:w-1/2">
          <div className="p-6">
            <h2 className="text-xl font-bold text-white mb-1">
              {selectedCategoria ? 'Editar Categoría' : 'Nueva Categoría'}
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              {selectedCategoria
                ? 'Modifica el nombre de la categoría seleccionada.'
                : 'Ingresa el nombre para dar de alta una nueva categoría.'}
            </p>

            {modalError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nombre de la Categoría
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ej: Sublimación, Bordados, Impresiones..."
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition disabled:opacity-50"
                >
                  {submitting
                    ? 'Guardando...'
                    : selectedCategoria
                    ? 'Guardar Cambios'
                    : 'Crear Categoría'}
                </button>
              </div>
            </form>
          </div>
        </Modal>

        {/* MODAL: Confirmar Eliminación */}
        <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} className="w-full lg:w-1/2">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Eliminar Categoría</h2>
                <p className="text-xs text-slate-400">Esta acción no se puede deshacer.</p>
              </div>
            </div>

            {modalError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
                {modalError}
              </div>
            )}

            <p className="text-sm text-slate-300 mb-6">
              ¿Estás seguro de que deseas eliminar permanentemente la categoría{' '}
              <strong className="text-white">&quot;{selectedCategoria?.nombre}&quot;</strong>?
            </p>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-xl transition disabled:opacity-50"
              >
                {submitting ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </RoleGuard>
  )
}

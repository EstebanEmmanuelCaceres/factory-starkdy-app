'use client'

import { useEffect, useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import Pagination from '@/components/Pagination'
import {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  type Product,
  type CreateProductInput,
  type UpdateProductInput
} from '@/lib/products'
import {
  fetchEtapas,
  syncEtapas,
  type Etapa,
  type SyncEtapaItemInput
} from '@/lib/entities/etapas'

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Paginación
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // Filtros
  const [searchName, setSearchName] = useState('')

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  // Gestión de Etapas
  const [isStagesModalOpen, setIsStagesModalOpen] = useState(false)
  const [selectedProductForStages, setSelectedProductForStages] = useState<Product | null>(null)
  const [stages, setStages] = useState<Etapa[]>([])
  const [loadingStages, setLoadingStages] = useState(false)
  const [stagesError, setStagesError] = useState('')
  const [editingStage, setEditingStage] = useState<Etapa | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Formulario de Etapa
  const [stageFormData, setStageFormData] = useState({
    nombre: '',
    orden: '',
    depende_de_ids: [] as (number | string)[]
  })

  // Datos de Formulario
  const [formData, setFormData] = useState<CreateProductInput>({
    nombre: '',
    descripcion: ''
  })

  const loadStages = async (productId: number) => {
    setLoadingStages(true)
    setStagesError('')
    try {
      const data = await fetchEtapas({ producto_id: productId })
      setStages(data)
      setHasUnsavedChanges(false)
    } catch (err: unknown) {
      setStagesError(err instanceof Error ? err.message : 'Error al cargar las etapas')
    } finally {
      setLoadingStages(false)
    }
  }

  const handleOpenStagesModal = (product: Product) => {
    setSelectedProductForStages(product)
    setEditingStage(null)
    setStageFormData({
      nombre: '',
      orden: '1',
      depende_de_ids: []
    })
    setHasUnsavedChanges(false)
    setIsStagesModalOpen(true)
    loadStages(product.id)
  }

  // Auto-calcular orden por defecto al abrir modal en modo creación o cuando cambien las etapas
  useEffect(() => {
    if (isStagesModalOpen && !editingStage) {
      const nextOrder = stages.length > 0 ? Math.max(...stages.map(s => s.orden)) + 1 : 1
      setStageFormData(prev => ({
        ...prev,
        orden: nextOrder.toString()
      }))
    }
  }, [stages, editingStage, isStagesModalOpen])

  const handleStartEditStage = (stage: Etapa) => {
    setEditingStage(stage)
    setStageFormData({
      nombre: stage.nombre,
      orden: stage.orden.toString(),
      depende_de_ids: stage.dependencias?.map(d => d.id) || []
    })
  }

  const handleCancelEditStage = () => {
    setEditingStage(null)
    setStageFormData({
      nombre: '',
      orden: (stages.length > 0 ? Math.max(...stages.map(s => s.orden)) + 1 : 1).toString(),
      depende_de_ids: []
    })
  }

  const handleStageSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProductForStages) return

    const selectedDeps = stages.filter(s => stageFormData.depende_de_ids.includes(s.id))

    if (editingStage) {
      // Editar localmente
      const updated = stages.map(s => {
        if (s.id === editingStage.id) {
          return {
            ...s,
            nombre: stageFormData.nombre,
            dependencias: selectedDeps
          }
        }
        return s
      })
      setStages(updated)
      setEditingStage(null)
      showNotification('Etapa modificada localmente')
    } else {
      // Crear localmente con ID temporal
      const tempId = 'temp_' + Date.now()
      const nextOrder = stages.length > 0 ? Math.max(...stages.map(s => s.orden)) + 1 : 1
      const newStage: Etapa = {
        id: tempId as any,
        producto_id: selectedProductForStages.id,
        nombre: stageFormData.nombre,
        orden: nextOrder,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        dependencias: selectedDeps
      }
      setStages([...stages, newStage])
      showNotification('Etapa agregada localmente')
    }

    setStageFormData({
      nombre: '',
      orden: '',
      depende_de_ids: []
    })
    setHasUnsavedChanges(true)
  }

  const handleDeleteStage = (stageId: number) => {
    if (!selectedProductForStages) return
    if (!confirm('¿Estás seguro de que deseas eliminar esta etapa localmente? Las dependencias se actualizarán automáticamente.')) return

    const stageToDelete = stages.find(s => s.id === stageId)
    if (!stageToDelete) return

    const prereqs = stageToDelete.dependencias || []
    const deletedOrden = stageToDelete.orden

    const updated = stages
      .filter(s => s.id !== stageId)
      .map(s => {
        const dependsOnTarget = s.dependencias?.some(dep => dep.id === stageId)
        if (dependsOnTarget) {
          const otherDeps = s.dependencias?.filter(dep => dep.id !== stageId) || []
          const newDeps = [...otherDeps]
          prereqs.forEach(pr => {
            if (!newDeps.some(d => d.id === pr.id)) {
              newDeps.push(pr)
            }
          })
          return { ...s, dependencias: newDeps }
        }
        return s
      })
      .map(s => {
        if (s.orden > deletedOrden) {
          return { ...s, orden: s.orden - 1 }
        }
        return s
      })

    setStages(updated)
    setEditingStage(null)
    setHasUnsavedChanges(true)
    showNotification('Etapa eliminada localmente')
  }

  const handleToggleDependency = (id: number | string) => {
    setStageFormData(prev => {
      const alreadySelected = prev.depende_de_ids.includes(id)
      const newDeps = alreadySelected
        ? prev.depende_de_ids.filter(depId => depId !== id)
        : [...prev.depende_de_ids, id]
      return { ...prev, depende_de_ids: newDeps }
    })
  }

  const handleSaveChangesToServer = async () => {
    if (!selectedProductForStages) return
    setStagesError('')
    setLoadingStages(true)

    const formattedEtapas: SyncEtapaItemInput[] = stages.map(s => {
      const isTemp = typeof s.id === 'string' && (s.id as string).startsWith('temp_');
      return {
        id: isTemp ? null : s.id,
        temp_id: isTemp ? s.id.toString() : null,
        nombre: s.nombre,
        orden: s.orden,
        depende_de_ids: s.dependencias?.map(d => d.id) || []
      }
    })

    try {
      const updatedData = await syncEtapas(selectedProductForStages.id, formattedEtapas)
      setStages(updatedData)
      setHasUnsavedChanges(false)
      showNotification('Etapas guardadas en el servidor correctamente')
    } catch (err: unknown) {
      setStagesError(err instanceof Error ? err.message : 'Error al guardar los cambios en el servidor')
    } finally {
      setLoadingStages(false)
    }
  }

  const loadProducts = async (resetPage = false, overrideName?: string) => {
    setLoading(true)
    setError('')
    try {
      const filters: { nombre?: string } = {}
      const nameToSearch = overrideName !== undefined ? overrideName : searchName
      if (nameToSearch) filters.nombre = nameToSearch

      const data = await fetchProducts(filters)
      setProducts(data)
      if (resetPage) {
        setCurrentPage(1)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar los productos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(products.length / pageSize))
    if (currentPage > maxPage) {
      setCurrentPage(maxPage)
    }
  }, [products.length, pageSize, currentPage])

  const showNotification = (message: string) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  const handleOpenCreateModal = () => {
    setFormData({
      nombre: '',
      descripcion: ''
    })
    setIsCreateModalOpen(true)
  }

  const handleOpenEditModal = (product: Product) => {
    setSelectedProduct(product)
    setFormData({
      nombre: product.nombre,
      descripcion: product.descripcion || ''
    })
    setIsEditModalOpen(true)
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await createProduct(formData)
      setIsCreateModalOpen(false)
      showNotification('Producto creado correctamente')
      loadProducts()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear el producto')
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct) return
    setError('')

    const payload: UpdateProductInput = {}
    if (formData.nombre !== selectedProduct.nombre) payload.nombre = formData.nombre
    if (formData.descripcion !== selectedProduct.descripcion) payload.descripcion = formData.descripcion || null

    try {
      await updateProduct(selectedProduct.id, payload)
      setIsEditModalOpen(false)
      showNotification('Producto actualizado correctamente')
      loadProducts()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el producto')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este producto?')) return
    setError('')
    try {
      await deleteProduct(id)
      showNotification('Producto eliminado correctamente')
      loadProducts()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el producto')
    }
  }

  return (
    <RoleGuard allowedRoles={['admin', 'encargado']}>
      <main className="page-content p-6 max-w-7xl mx-auto bg-[#1E293B]">
        {/* Notificación de Éxito */}
        {successMessage && (
          <div className="fixed top-4 right-4 z-50 bg-emerald-500 text-white px-4 py-3 rounded-lg shadow-xl border border-emerald-400 flex items-center gap-2 animate-bounce">
            <span>✅</span>
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {/* Notificación de Error */}
        {error && (
          <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-200 px-4 py-3 rounded-lg flex items-center gap-2">
            <span>❌</span>
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Encabezado y Filtros */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Panel de Productos</h1>
            <p className="text-sm text-slate-400">Administra el catálogo y estado de productos fabricados</p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2.5 rounded-lg shadow transition duration-200 text-sm self-start md:self-auto"
          >
            <span>➕</span> Nuevo Producto
          </button>
        </div>

        {/* Barra de Filtros */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {/* Buscador */}
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadProducts(true)}
                className="w-full sm:w-64 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3.5 py-2 pl-9 text-sm text-white placeholder-slate-500 focus:outline-none transition duration-150"
              />
              <span className="absolute left-3.5 top-2.5 text-slate-500 text-sm">🔍</span>
            </div>
            <button
              onClick={() => loadProducts(true)}
              className="bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium px-3.5 py-2 rounded-lg transition"
            >
              Filtrar
            </button>
          </div>
        </div>

        {/* Listado de Productos */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col h-[calc(100vh-360px)] md:h-[calc(100vh-310px)] min-h-[400px]">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
              <span className="text-sm">Cargando productos de la base de datos...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
              <span className="text-4xl">📦</span>
              <span className="text-sm font-medium">No se encontraron productos registrados</span>
              {searchName && (
                <button
                  onClick={() => {
                    setSearchName('')
                    loadProducts(true, '')
                  }}
                  className="text-xs text-blue-500 hover:underline mt-1"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Producto</th>
                      <th className="px-6 py-4">Descripción</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {products.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((product) => (
                      <tr key={product.id} className="hover:bg-slate-800/40 text-slate-300 transition duration-100">
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">#{product.id}</td>
                        <td className="px-6 py-4">
                          <span className="font-semibold text-white">{product.nombre}</span>
                        </td>
                        <td className="px-6 py-4 max-w-xs truncate text-slate-400" title={product.descripcion || ''}>
                          {product.descripcion || <span className="text-slate-600 italic">Sin descripción</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2.5">
                            <button
                              onClick={() => handleOpenStagesModal(product)}
                              className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition flex items-center justify-center text-xs"
                              title="Gestionar etapas"
                            >
                              ⚙️
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(product)}
                              className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition"
                              title="Editar producto"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDelete(product.id)}
                              className="text-rose-400 hover:text-rose-300 p-1 hover:bg-rose-500/10 rounded transition"
                              title="Eliminar producto"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={currentPage}
                totalItems={products.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>

        {/* Modal de Creación */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
              <h2 className="text-xl font-bold text-white mb-4">Crear Nuevo Producto</h2>
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Nombre del Producto *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Descripción
                  </label>
                  <textarea
                    rows={3}
                    value={formData.descripcion || ''}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition resize-none"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md transition"
                  >
                    Crear Producto
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Edición (PATCH) */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
              <h2 className="text-xl font-bold text-white mb-4">Editar Producto (Parcial)</h2>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Nombre del Producto
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Descripción
                  </label>
                  <textarea
                    rows={3}
                    value={formData.descripcion || ''}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition resize-none"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md transition"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Gestión de Etapas */}
        {isStagesModalOpen && selectedProductForStages && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[85vh] shadow-2xl p-6 relative flex flex-col animate-in fade-in zoom-in-95 duration-150 text-slate-300">

              {/* Header */}
              <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Etapas de Fabricación</h2>
                  <p className="text-xs text-slate-400">Configura el proceso para: <span className="text-blue-400 font-semibold">{selectedProductForStages.nombre}</span></p>
                </div>
                <div className="flex items-center gap-3">
                  {hasUnsavedChanges && (
                    <span className="bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[10px] px-2.5 py-1 rounded-full font-medium animate-pulse">
                      ⚠️ Cambios sin guardar
                    </span>
                  )}
                  <button
                    onClick={handleSaveChangesToServer}
                    disabled={loadingStages || !hasUnsavedChanges}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md transition"
                  >
                    {loadingStages ? 'Guardando...' : 'Guardar en Servidor'}
                  </button>
                  <button
                    onClick={() => {
                      if (hasUnsavedChanges && !confirm('Tienes cambios sin guardar en el servidor. ¿Deseas cerrar igualmente y descartar los cambios?')) return;
                      setIsStagesModalOpen(false)
                    }}
                    className="text-slate-400 hover:text-white text-lg font-bold p-1 ml-1"
                    title="Cerrar modal"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Error inside modal */}
              {stagesError && (
                <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-200 px-4 py-2.5 rounded-lg flex items-center gap-2 text-xs">
                  <span>❌</span>
                  <span className="font-medium">{stagesError}</span>
                </div>
              )}

              {/* Flujo actual del proceso */}
              <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 mb-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Flujo actual del proceso</h3>
                {stages.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No hay etapas creadas para este producto.</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    {stages.map((stage, idx) => (
                      <div key={stage.id} className="flex items-center gap-3">
                        <div
                          className={`px-4 py-2 rounded-lg border text-sm font-semibold transition ${editingStage?.id === stage.id
                              ? 'bg-blue-600/10 border-blue-500 text-white'
                              : 'bg-slate-950 border border-slate-300 text-white'
                            }`}
                        >
                          {stage.nombre}
                        </div>
                        {idx < stages.length - 1 && (
                          <span className="text-slate-600 font-bold text-lg">→</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Main content body (Two Panes) */}
              <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-6 overflow-hidden">

                {/* Left Pane: List of Stages */}
                <div className="flex-1 flex flex-col min-h-0 bg-slate-950/30 border border-slate-800/50 rounded-xl p-4 overflow-y-auto">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <span>📋</span> Listado de Etapas ({stages.length})
                  </h3>

                  {loadingStages ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
                      <span className="text-xs">Cargando etapas...</span>
                    </div>
                  ) : stages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2 py-10">
                      <span className="text-3xl">⚙️</span>
                      <span className="text-xs font-medium">Este producto aún no tiene etapas configuradas.</span>
                      <span className="text-[10px] text-slate-600">Usa el formulario para agregar la primera etapa.</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {stages.map((stage) => {
                        const hasDeps = stage.dependencias && stage.dependencias.length > 0;
                        return (
                          <div
                            key={stage.id}
                            className={`p-3 rounded-lg border transition ${editingStage?.id === stage.id
                                ? 'bg-blue-600/10 border-blue-500/50'
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                              }`}
                          >
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex items-center gap-2.5">
                                <span className="bg-slate-800 text-slate-300 border border-slate-700 w-6 h-6 rounded-md flex items-center justify-center text-xs font-mono font-bold">
                                  {stage.orden}
                                </span>
                                <div>
                                  <span className="font-semibold text-white text-sm">{stage.nombre}</span>
                                  {hasDeps && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      <span className="text-[10px] text-slate-500 self-center mr-1">Requiere:</span>
                                      {stage.dependencias?.map(dep => (
                                        <span key={dep.id} className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded border border-slate-700">
                                          {dep.nombre}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditStage(stage)}
                                  className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded text-xs transition"
                                  title="Editar etapa"
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStage(stage.id)}
                                  className="text-rose-400 hover:text-rose-300 p-1 hover:bg-rose-500/10 rounded text-xs transition"
                                  title="Eliminar etapa"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Right Pane: Form for Creating/Editing Stage */}
                <div className="w-full md:w-1/2 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col overflow-y-auto">
                  <h3 className="text-lg font-bold text-white mb-1">
                    {editingStage ? 'Editar etapa' : 'Agregar nueva etapa'}
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Completa el nombre y decide si depende de otra etapa ya creada.
                  </p>

                  <form onSubmit={handleStageSubmit} className="space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                      {/* Nombre */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                          Nombre de la etapa
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: Pintado, Pulido, Empaquetado"
                          value={stageFormData.nombre}
                          onChange={(e) => setStageFormData({ ...stageFormData, nombre: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                        />
                      </div>

                      {/* Dependencias Checkboxes */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-2">
                          Selecciona qué etapas deben completarse primero:
                        </label>

                        {stages.filter(s => !editingStage || s.id !== editingStage.id).length === 0 ? (
                          <p className="text-xs text-slate-500 italic py-2">No hay otras etapas disponibles para establecer dependencias.</p>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {stages
                              .filter(s => !editingStage || s.id !== editingStage.id)
                              .map(s => {
                                const isChecked = stageFormData.depende_de_ids.includes(s.id);
                                return (
                                  <label
                                    key={s.id}
                                    className={`flex items-center gap-3 p-3.5 rounded-lg border cursor-pointer select-none transition ${isChecked
                                        ? 'bg-slate-950 border-blue-500 text-white'
                                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                                      }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleDependency(s.id)}
                                      className="rounded bg-slate-900 border-slate-800 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                                    />
                                    <span className="text-sm font-semibold">{s.nombre}</span>
                                  </label>
                                )
                              })}
                          </div>
                        )}
                      </div>

                      {/* Info Preview Box */}
                      {stageFormData.depende_de_ids.length > 0 && (
                        <div className="bg-slate-950 border border-slate-800/80 text-slate-400 px-4 py-3 rounded-lg flex items-start gap-2.5 text-xs leading-relaxed">
                          <span className="text-slate-400 font-bold">ⓘ</span>
                          <span>
                            Esta etapa solo podrá comenzar cuando terminen:{' '}
                            <span className="text-white font-semibold">
                              {stages
                                .filter(s => stageFormData.depende_de_ids.includes(s.id))
                                .map(s => s.nombre)
                                .join(', ')}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-800 mt-6 flex gap-3">
                      {editingStage && (
                        <button
                          type="button"
                          onClick={handleCancelEditStage}
                          className="flex-1 bg-slate-850 hover:bg-slate-800 text-slate-300 px-4 py-3 rounded-lg text-sm font-semibold border border-slate-800 transition"
                        >
                          Cancelar Edición
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={loadingStages}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white px-4 py-3 rounded-lg text-sm font-bold shadow-md transition"
                      >
                        {editingStage ? 'Guardar Cambios' : 'Crear etapa'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </RoleGuard>
  )
}

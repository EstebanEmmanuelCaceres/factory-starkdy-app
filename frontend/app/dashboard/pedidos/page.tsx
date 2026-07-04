'use client'

import { useEffect, useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import {
  fetchPedidos,
  createPedido,
  updatePedido,
  deletePedido,
  type Pedido,
  type CreatePedidoInput,
  type UpdatePedidoInput
} from '@/lib/pedidos'
import { fetchClientes, type Cliente } from '@/lib/clientes'
import { fetchProducts, type Product } from '@/lib/products'

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Filtros
  const [searchQuery, setSearchQuery] = useState('')

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)

  // Datos de Formulario
  const [formData, setFormData] = useState({
    cliente_id: '',
    codigo: '',
    prioridad: 'normal' as 'baja' | 'normal' | 'alta' | 'critica',
    fecha_entrega: '',
    estado: 'pendiente',
    selectedProductIds: [] as number[]
  })

  const loadData = async (search?: string) => {
    setLoading(true)
    setError('')
    try {
      const filters: { search?: string } = {}
      if (search !== undefined) {
        if (search) filters.search = search
      } else if (searchQuery) {
        filters.search = searchQuery
      }

      const [pedidosData, clientesData, productosData] = await Promise.all([
        fetchPedidos(filters),
        fetchClientes(),
        fetchProducts()
      ])

      setPedidos(pedidosData)
      setClientes(clientesData)
      setProductos(productosData)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showNotification = (message: string) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  const handleOpenCreateModal = () => {
    setFormData({
      cliente_id: clientes[0]?.id.toString() || '',
      codigo: 'PED-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      prioridad: 'normal',
      fecha_entrega: '',
      estado: 'pendiente',
      selectedProductIds: []
    })
    setIsCreateModalOpen(true)
  }

  const handleOpenEditModal = (pedido: Pedido) => {
    setSelectedPedido(pedido)
    setFormData({
      cliente_id: pedido.cliente_id.toString(),
      codigo: pedido.codigo,
      prioridad: pedido.prioridad,
      fecha_entrega: pedido.fecha_entrega || '',
      estado: pedido.estado,
      selectedProductIds: pedido.productos?.map((p) => p.id) || []
    })
    setIsEditModalOpen(true)
  }

  const handleProductCheckboxChange = (productId: number) => {
    setFormData((prev) => {
      const alreadySelected = prev.selectedProductIds.includes(productId)
      const updated = alreadySelected
        ? prev.selectedProductIds.filter((id) => id !== productId)
        : [...prev.selectedProductIds, productId]
      return { ...prev, selectedProductIds: updated }
    })
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!formData.cliente_id) {
      setError('Por favor, selecciona un cliente')
      return
    }

    try {
      const payload: CreatePedidoInput = {
        cliente_id: parseInt(formData.cliente_id),
        codigo: formData.codigo.trim(),
        prioridad: formData.prioridad,
        fecha_entrega: formData.fecha_entrega || null,
        productos: formData.selectedProductIds
      }
      await createPedido(payload)
      setIsCreateModalOpen(false)
      showNotification('Pedido creado correctamente')
      loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear el pedido')
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPedido) return
    setError('')

    if (!formData.cliente_id) {
      setError('Por favor, selecciona un cliente')
      return
    }

    // Construir payload PATCH
    const payload: UpdatePedidoInput = {}
    const parsedClienteId = parseInt(formData.cliente_id)

    if (parsedClienteId !== selectedPedido.cliente_id) {
      payload.cliente_id = parsedClienteId
    }
    if (formData.codigo.trim() !== selectedPedido.codigo) {
      payload.codigo = formData.codigo.trim()
    }
    if (formData.prioridad !== selectedPedido.prioridad) {
      payload.prioridad = formData.prioridad
    }
    if ((formData.fecha_entrega || null) !== selectedPedido.fecha_entrega) {
      payload.fecha_entrega = formData.fecha_entrega || null
    }
    if (formData.estado !== selectedPedido.estado) {
      payload.estado = formData.estado
    }

    // Comprobar si los productos cambiaron
    const prevProductIds = selectedPedido.productos?.map((p) => p.id) || []
    const productsChanged =
      prevProductIds.length !== formData.selectedProductIds.length ||
      !prevProductIds.every((id) => formData.selectedProductIds.includes(id))

    if (productsChanged) {
      payload.productos = formData.selectedProductIds
    }

    if (Object.keys(payload).length === 0) {
      setIsEditModalOpen(false)
      return
    }

    try {
      await updatePedido(selectedPedido.id, payload)
      setIsEditModalOpen(false)
      showNotification('Pedido actualizado correctamente')
      loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el pedido')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas dar de baja este pedido? Las asociaciones de productos también serán borradas lógicamente.')) return
    setError('')
    try {
      await deletePedido(id)
      showNotification('Pedido dado de baja correctamente')
      loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al dar de baja al pedido')
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      loadData()
    }
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    loadData('')
  }

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'critica':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
      case 'alta':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
      case 'normal':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
      case 'baja':
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completado':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
      case 'en_progreso':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
      case 'cancelado':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
      case 'pendiente':
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
    }
  }

  return (
    <RoleGuard allowedRoles={['admin', 'supervisor']}>
      <main className="page-content p-6 max-w-7xl mx-auto text-white">
        {/* Notificaciones */}
        {successMessage && (
          <div className="fixed top-4 right-4 z-50 bg-emerald-500 text-white px-4 py-3 rounded-lg shadow-xl border border-emerald-400 flex items-center gap-2 animate-bounce">
            <span>✅</span>
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-200 px-4 py-3 rounded-lg flex items-center gap-2">
            <span>❌</span>
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Encabezado */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Panel de Pedidos</h1>
            <p className="text-sm text-slate-400">Gestiona los pedidos de fabricación, asocia productos y asigna prioridades.</p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2.5 rounded-lg shadow transition duration-200 text-sm self-start md:self-auto hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>➕</span> Nuevo Pedido
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-md">
          <div className="w-full flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Buscar por nombre o correo del cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3.5 py-2 pl-9 text-sm text-white placeholder-slate-500 focus:outline-none transition duration-150"
              />
              <span className="absolute left-3.5 top-2.5 text-slate-500 text-sm">🔍</span>
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 text-sm"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={() => loadData()}
              className="bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition hover:scale-[1.02] active:scale-[0.98]"
            >
              Buscar
            </button>
          </div>
        </div>

        {/* Listado de Pedidos */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
              <span className="text-sm">Cargando pedidos...</span>
            </div>
          ) : pedidos.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <span className="text-4xl">📋</span>
              <span className="text-sm font-medium">No se encontraron pedidos registrados</span>
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="text-xs text-blue-500 hover:underline mt-1"
                >
                  Limpiar búsqueda
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                    <th className="px-6 py-4">Código</th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4 text-center">Productos</th>
                    <th className="px-6 py-4">Prioridad</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4">Fecha Entrega</th>
                    <th className="px-6 py-4">Registrado por</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm">
                  {pedidos.map((pedido) => (
                    <tr key={pedido.id} className="hover:bg-slate-800/40 text-slate-300 transition duration-100">
                      <td className="px-6 py-4 font-mono font-bold text-white text-xs">{pedido.codigo}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-white">{pedido.cliente?.razon_social}</span>
                          <span className="text-xs text-slate-500">{pedido.cliente?.email || 'Sin correo'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs text-center">
                        {pedido.productos && pedido.productos.length > 0 ? (
                          <div className="flex flex-wrap gap-1 justify-center">
                            {pedido.productos.map((prod) => (
                              <span key={prod.id} className="bg-slate-950 text-slate-400 border border-slate-800 text-xs px-2 py-0.5 rounded" title={prod.descripcion || ''}>
                                {prod.nombre}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-600 italic text-xs">Ninguno</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize ${getPriorityBadgeClass(pedido.prioridad)}`}>
                          {pedido.prioridad}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${getStatusBadgeClass(pedido.estado)}`}>
                          {pedido.estado.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {pedido.fecha_entrega ? (
                          new Date(pedido.fecha_entrega + 'T00:00:00').toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })
                        ) : (
                          <span className="text-slate-600 italic">No planificada</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">{pedido.user?.name || 'Desconocido'}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2.5">
                          <button
                            onClick={() => handleOpenEditModal(pedido)}
                            className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition"
                            title="Editar pedido"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(pedido.id)}
                            className="text-rose-400 hover:text-rose-300 p-1 hover:bg-rose-500/10 rounded transition"
                            title="Dar de baja pedido"
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
          )}
        </div>

        {/* Modal de Creación */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-white mb-4">Registrar Nuevo Pedido</h2>
              <form onSubmit={handleCreateSubmit} className="space-y-4 text-slate-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Código Único *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.codigo}
                      onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Cliente *
                    </label>
                    <select
                      required
                      value={formData.cliente_id}
                      onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    >
                      <option value="" disabled>Selecciona un cliente</option>
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>{c.razon_social} ({c.email || 'sin email'})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Prioridad *
                    </label>
                    <select
                      value={formData.prioridad}
                      onChange={(e) => setFormData({ ...formData, prioridad: e.target.value as any })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    >
                      <option value="baja">Baja</option>
                      <option value="normal">Normal</option>
                      <option value="alta">Alta</option>
                      <option value="critica">Crítica</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Fecha Estimada de Entrega
                    </label>
                    <input
                      type="date"
                      value={formData.fecha_entrega}
                      onChange={(e) => setFormData({ ...formData, fecha_entrega: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                {/* Selección de Productos */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Asociar Productos (Opcional)
                  </label>
                  {productos.length === 0 ? (
                    <p className="text-slate-500 italic text-xs">No hay productos cargados en el catálogo.</p>
                  ) : (
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                      {productos.map((prod) => (
                        <label key={prod.id} className="flex items-center gap-2.5 text-sm cursor-pointer hover:text-white transition">
                          <input
                            type="checkbox"
                            checked={formData.selectedProductIds.includes(prod.id)}
                            onChange={() => handleProductCheckboxChange(prod.id)}
                            className="rounded border-slate-800 bg-slate-900 text-blue-600 focus:ring-blue-500/20"
                          />
                          <span className="font-semibold">{prod.nombre}</span>
                          <span className="text-xs text-slate-500">({prod.sku || 'sin sku'})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium shadow transition hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Crear Pedido
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Edición */}
        {isEditModalOpen && selectedPedido && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-white mb-4">Editar Pedido</h2>
              <form onSubmit={handleEditSubmit} className="space-y-4 text-slate-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Código Único *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.codigo}
                      onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Cliente *
                    </label>
                    <select
                      required
                      value={formData.cliente_id}
                      onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    >
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>{c.razon_social} ({c.email || 'sin email'})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Prioridad *
                    </label>
                    <select
                      value={formData.prioridad}
                      onChange={(e) => setFormData({ ...formData, prioridad: e.target.value as any })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    >
                      <option value="baja">Baja</option>
                      <option value="normal">Normal</option>
                      <option value="alta">Alta</option>
                      <option value="critica">Crítica</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Estado *
                    </label>
                    <select
                      value={formData.estado}
                      onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="en_progreso">En Progreso</option>
                      <option value="completado">Completado</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Fecha Entrega
                    </label>
                    <input
                      type="date"
                      value={formData.fecha_entrega}
                      onChange={(e) => setFormData({ ...formData, fecha_entrega: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                {/* Selección de Productos */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Asociar Productos (Opcional)
                  </label>
                  {productos.length === 0 ? (
                    <p className="text-slate-500 italic text-xs">No hay productos cargados en el catálogo.</p>
                  ) : (
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                      {productos.map((prod) => (
                        <label key={prod.id} className="flex items-center gap-2.5 text-sm cursor-pointer hover:text-white transition">
                          <input
                            type="checkbox"
                            checked={formData.selectedProductIds.includes(prod.id)}
                            onChange={() => handleProductCheckboxChange(prod.id)}
                            className="rounded border-slate-800 bg-slate-900 text-blue-600 focus:ring-blue-500/20"
                          />
                          <span className="font-semibold">{prod.nombre}</span>
                          <span className="text-xs text-slate-500">({prod.sku || 'sin sku'})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium shadow transition hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </RoleGuard>
  )
}

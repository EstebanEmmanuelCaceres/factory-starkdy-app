'use client'

import { useEffect, useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import {
  fetchClientes,
  createCliente,
  updateCliente,
  deleteCliente,
  type Cliente,
  type CreateClienteInput,
  type UpdateClienteInput
} from '@/lib/clientes'
import { fetchPedidos, type Pedido } from '@/lib/pedidos'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Filtros y búsqueda
  const [searchQuery, setSearchQuery] = useState('')

  // Cliente seleccionado para el "Panel de Vista General"
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [viewingCliente, setViewingCliente] = useState<Cliente | null>(null)

  // Datos de Formulario
  const [formData, setFormData] = useState<CreateClienteInput>({
    nombre_cliente: '',
    nombre_empresa: '',
    email: '',
    telefono: '',
    dni: '',
    direccion: '',
    provincia: '',
    cp: '',
    localidad: '',
    ingreso: 0,
    valor_total: 0,
    saldo: 0,
    observaciones: ''
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

      const [clientesData, pedidosData] = await Promise.all([
        fetchClientes(filters),
        fetchPedidos()
      ])

      setClientes(clientesData)
      setPedidos(pedidosData)

      // Seleccionar el primer cliente de la lista por defecto si hay clientes cargados
      if (clientesData.length > 0) {
        // Conservar el seleccionado si sigue existiendo en el nuevo dataset
        const exists = clientesData.find(c => c.id === selectedCliente?.id)
        if (!exists) {
          setSelectedCliente(clientesData[0])
        } else {
          setSelectedCliente(exists)
        }
      } else {
        setSelectedCliente(null)
      }
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
      nombre_cliente: '',
      nombre_empresa: '',
      email: '',
      telefono: '',
      dni: '',
      direccion: '',
      provincia: '',
      cp: '',
      localidad: '',
      ingreso: 0,
      valor_total: 0,
      saldo: 0,
      observaciones: ''
    })
    setIsCreateModalOpen(true)
  }

  const handleOpenEditModal = (cliente: Cliente, e: React.MouseEvent) => {
    e.stopPropagation() // Evitar seleccionar la fila
    setSelectedCliente(cliente)
    setFormData({
      nombre_cliente: cliente.nombre_cliente,
      nombre_empresa: cliente.nombre_empresa,
      email: cliente.email || '',
      telefono: cliente.telefono || '',
      dni: cliente.dni || '',
      direccion: cliente.direccion || '',
      provincia: cliente.provincia || '',
      cp: cliente.cp || '',
      localidad: cliente.localidad || '',
      ingreso: cliente.ingreso ?? 0,
      valor_total: cliente.valor_total ?? 0,
      saldo: cliente.saldo ?? 0,
      observaciones: cliente.observaciones || ''
    })
    setIsEditModalOpen(true)
  }

  const handleOpenViewModal = (cliente: Cliente, e: React.MouseEvent) => {
    e.stopPropagation() // Evitar seleccionar la fila
    setViewingCliente(cliente)
    setIsViewModalOpen(true)
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const payload = {
        nombre_cliente: formData.nombre_cliente.trim(),
        nombre_empresa: formData.nombre_empresa.trim(),
        email: formData.email?.trim() || null,
        telefono: formData.telefono.trim(),
        dni: formData.dni?.trim() || null,
        direccion: formData.direccion?.trim() || null,
        provincia: formData.provincia?.trim() || null,
        cp: formData.cp?.trim() || null,
        localidad: formData.localidad?.trim() || null,
        ingreso: Number(formData.ingreso) || 0,
        valor_total: Number(formData.valor_total) || 0,
        saldo: Number(formData.saldo) || 0,
        observaciones: formData.observaciones?.trim() || null
      }
      await createCliente(payload)
      setIsCreateModalOpen(false)
      showNotification('Cliente registrado correctamente')
      loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrar el cliente')
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCliente) return
    setError('')

    const payload: UpdateClienteInput = {}
    const emailValue = formData.email?.trim() || null
    const telefonoValue = formData.telefono?.trim() || ''
    const dniValue = formData.dni?.trim() || null
    const direccionValue = formData.direccion?.trim() || null
    const provinciaValue = formData.provincia?.trim() || null
    const cpValue = formData.cp?.trim() || null
    const localidadValue = formData.localidad?.trim() || null
    const ingresoValue = Number(formData.ingreso) || 0
    const valorTotalValue = Number(formData.valor_total) || 0
    const saldoValue = Number(formData.saldo) || 0
    const observacionesValue = formData.observaciones?.trim() || null

    if (formData.nombre_cliente !== selectedCliente.nombre_cliente) {
      payload.nombre_cliente = formData.nombre_cliente
    }
    if (formData.nombre_empresa !== selectedCliente.nombre_empresa) {
      payload.nombre_empresa = formData.nombre_empresa
    }
    if (nombreEmpresaValue !== selectedCliente.nombre_empresa) {
      payload.nombre_empresa = nombreEmpresaValue
    }
    if (telefonoValue !== selectedCliente.telefono) {
      payload.telefono = telefonoValue
    }
    if (dniValue !== selectedCliente.dni) {
      payload.dni = dniValue
    }
    if (direccionValue !== selectedCliente.direccion) {
      payload.direccion = direccionValue
    }
    if (provinciaValue !== selectedCliente.provincia) {
      payload.provincia = provinciaValue
    }
    if (cpValue !== selectedCliente.cp) {
      payload.cp = cpValue
    }
    if (localidadValue !== selectedCliente.localidad) {
      payload.localidad = localidadValue
    }
    if (ingresoValue !== selectedCliente.ingreso) {
      payload.ingreso = ingresoValue
    }
    if (valorTotalValue !== selectedCliente.valor_total) {
      payload.valor_total = valorTotalValue
    }
    if (saldoValue !== selectedCliente.saldo) {
      payload.saldo = saldoValue
    }
    if (observacionesValue !== selectedCliente.observaciones) {
      payload.observaciones = observacionesValue
    }

    if (Object.keys(payload).length === 0) {
      setIsEditModalOpen(false)
      return
    }

    try {
      await updateCliente(selectedCliente.id, payload)
      setIsEditModalOpen(false)
      showNotification('Cliente actualizado correctamente')
      loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el cliente')
    }
  }

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation() // Evitar seleccionar la fila
    if (!confirm('¿Estás seguro de que deseas dar de baja a este cliente?')) return
    setError('')
    try {
      await deleteCliente(id)
      showNotification('Cliente dado de baja correctamente')
      if (selectedCliente?.id === id) {
        setSelectedCliente(null)
      }
      loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al dar de baja al cliente')
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

  // Obtener pedidos del cliente seleccionado
  const clientPedidos = selectedCliente
    ? pedidos.filter((p) => p.cliente_id === selectedCliente.id)
    : []

  const stats = {
    total: clientPedidos.length,
    pendiente: clientPedidos.filter(p => p.estado === 'pendiente').length,
    enProgreso: clientPedidos.filter(p => p.estado === 'en_progreso').length,
    completado: clientPedidos.filter(p => p.estado === 'completado').length,
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
    <RoleGuard allowedRoles={['admin', 'encargado', 'vendedor', 'disenador']}>
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
            <h1 className="text-2xl font-bold text-white tracking-tight">Buscador y Panel de Clientes</h1>
            <p className="text-sm text-slate-400">Encuentra clientes, visualiza su historial de pedidos y gestiona su información de contacto.</p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2.5 rounded-lg shadow transition duration-200 text-sm self-start md:self-auto hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>➕</span> Nuevo Cliente
          </button>
        </div>

        {/* Barra de Búsqueda */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-md">
          <div className="w-full flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Buscar cliente por nombre o correo..."
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

        {/* Layout Split-Pane */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Listado de Clientes (Columna Izquierda) */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                <span className="text-sm">Cargando clientes...</span>
              </div>
            ) : clientes.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                <span className="text-4xl">👥</span>
                <span className="text-sm font-medium">No se encontraron clientes</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                      <th className="px-6 py-4">Nombre / Razón Social</th>
                      <th className="px-6 py-4">Correo</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {clientes.map((cliente) => (
                      <tr
                        key={cliente.id}
                        onClick={() => setSelectedCliente(cliente)}
                        className={`cursor-pointer transition duration-100 ${selectedCliente?.id === cliente.id
                            ? 'bg-blue-600/10 text-white border-l-2 border-l-blue-500'
                            : 'hover:bg-slate-800/40 text-slate-300'
                          }`}
                      >
                        <td className="px-6 py-4">
                          <div className="font-semibold text-white">{cliente.nombre_cliente}</div>
                          <div className="text-xs text-slate-500">{cliente.nombre_empresa}</div>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400">
                          {cliente.email || <span className="text-slate-600 italic">No especificado</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={(e) => handleOpenViewModal(cliente, e)}
                              className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition text-xs"
                              title="Ver detalles completos"
                            >
                              👁️
                            </button>
                            <button
                              onClick={(e) => handleOpenEditModal(cliente, e)}
                              className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition text-xs"
                              title="Editar cliente"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={(e) => handleDelete(cliente.id, e)}
                              className="text-rose-400 hover:text-rose-300 p-1 hover:bg-rose-500/10 rounded transition text-xs"
                              title="Dar de baja cliente"
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

          {/* Panel de Vista General del Cliente (Columna Derecha) */}
          <div className="lg:col-span-5">
            {selectedCliente ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
                {/* Cabecera del Perfil */}
                <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                    {selectedCliente.nombre_cliente.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white leading-tight">{selectedCliente.nombre_cliente}</h2>
                    <span className="text-xs text-slate-500">{selectedCliente.nombre_empresa} (ID: #{selectedCliente.id})</span>
                  </div>
                </div>

                {/* Detalles de Contacto */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block mb-0.5">Correo Electrónico</span>
                    <span className="text-slate-200 font-semibold">{selectedCliente.email || 'No especificado'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">Teléfono de Contacto</span>
                    <span className="text-slate-200 font-semibold">{selectedCliente.telefono || 'No especificado'}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-500 block mb-0.5">Registrado el</span>
                    <span className="text-slate-300 font-medium">
                      {new Date(selectedCliente.created_at).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                </div>

                {/* Indicadores de Pedidos */}
                <div className="border-t border-slate-800/80 pt-4">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Estadísticas de Ventas</h3>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <span className="text-2xl font-bold text-white block">{stats.total}</span>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Pedidos</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <span className="text-2xl font-bold text-emerald-400 block">{stats.completado}</span>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Completados</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <span className="text-2xl font-bold text-amber-400 block">{stats.enProgreso}</span>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">En Progreso</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <span className="text-2xl font-bold text-slate-400 block">{stats.pendiente}</span>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Pendientes</span>
                    </div>
                  </div>
                </div>

                {/* Pedidos Recientes */}
                <div className="border-t border-slate-800/80 pt-4">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Pedidos Recientes</h3>
                  {clientPedidos.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-2">Este cliente no registra pedidos asociados aún.</p>
                  ) : (
                    <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                      {clientPedidos.slice(0, 5).map((p) => (
                        <div key={p.id} className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between text-xs hover:border-slate-700 transition">
                          <div>
                            <span className="font-mono font-bold text-white block">{p.codigo}</span>
                            <span className="text-[10px] text-slate-500">
                              {p.fecha_entrega ? `Entrega: ${p.fecha_entrega}` : 'Sin fecha programada'}
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${getStatusBadgeClass(p.estado)}`}>
                            {p.estado.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-10 text-center text-slate-500 text-sm italic">
                Selecciona un cliente de la lista para ver su perfil general y el historial de pedidos.
              </div>
            )}
          </div>
        </div>

        {/* Modal de Creación */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
              <h2 className="text-xl font-bold text-white mb-4">Registrar Nuevo Cliente</h2>
              <form onSubmit={handleCreateSubmit} className="space-y-4 text-slate-300 max-h-[75vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Nombre del Cliente *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nombre_cliente}
                      onChange={(e) => setFormData({ ...formData, nombre_cliente: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                      placeholder="Ej. Juan Pérez"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Nombre de la Empresa *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nombre_empresa}
                      onChange={(e) => setFormData({ ...formData, nombre_empresa: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                      placeholder="Ej. Empresa S.A."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Teléfono *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.telefono || ''}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                      placeholder="Ej. +54 9 11 1234-5678"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                      placeholder="ejemplo@correo.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      DNI
                    </label>
                    <input
                      type="text"
                      value={formData.dni || ''}
                      onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                      placeholder="Ej. 12345678"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Localidad
                    </label>
                    <input
                      type="text"
                      value={formData.localidad || ''}
                      onChange={(e) => setFormData({ ...formData, localidad: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                      placeholder="Ej. Lanús"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Provincia
                    </label>
                    <input
                      type="text"
                      value={formData.provincia || ''}
                      onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                      placeholder="Ej. Buenos Aires"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Código Postal (CP)
                    </label>
                    <input
                      type="text"
                      value={formData.cp || ''}
                      onChange={(e) => setFormData({ ...formData, cp: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                      placeholder="Ej. 1824"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={formData.direccion || ''}
                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    placeholder="Ej. Av. 9 de Julio 1234"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Valor Total ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.valor_total}
                      onChange={(e) => setFormData({ ...formData, valor_total: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Ingreso ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.ingreso}
                      onChange={(e) => setFormData({ ...formData, ingreso: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Saldo ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.saldo}
                      onChange={(e) => setFormData({ ...formData, saldo: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Observaciones
                  </label>
                  <textarea
                    rows={2}
                    value={formData.observaciones || ''}
                    onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    placeholder="Notas sobre el cliente..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    placeholder="ejemplo@correo.com"
                  />
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
                    Registrar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Edición */}
        {isEditModalOpen && selectedCliente && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
              <h2 className="text-xl font-bold text-white mb-4">Editar Cliente</h2>
              <form onSubmit={handleEditSubmit} className="space-y-4 text-slate-300 max-h-[75vh] overflow-y-auto pr-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Nombre del Cliente *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nombre_cliente}
                      onChange={(e) => setFormData({ ...formData, nombre_cliente: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Nombre de la Empresa *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nombre_empresa}
                      onChange={(e) => setFormData({ ...formData, nombre_empresa: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Teléfono *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.telefono || ''}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      DNI
                    </label>
                    <input
                      type="text"
                      value={formData.dni || ''}
                      onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                      placeholder="Ej. 12345678"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Localidad
                    </label>
                    <input
                      type="text"
                      value={formData.localidad || ''}
                      onChange={(e) => setFormData({ ...formData, localidad: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Provincia
                    </label>
                    <input
                      type="text"
                      value={formData.provincia || ''}
                      onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Código Postal (CP)
                    </label>
                    <input
                      type="text"
                      value={formData.cp || ''}
                      onChange={(e) => setFormData({ ...formData, cp: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={formData.direccion || ''}
                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Valor Total ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.valor_total}
                      onChange={(e) => setFormData({ ...formData, valor_total: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Ingreso ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.ingreso}
                      onChange={(e) => setFormData({ ...formData, ingreso: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Saldo ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.saldo}
                      onChange={(e) => setFormData({ ...formData, saldo: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Observaciones
                  </label>
                  <textarea
                    rows={2}
                    value={formData.observaciones || ''}
                    onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                  />
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

        {/* Modal de Vista de Detalles (Read-only) */}
        {isViewModalOpen && viewingCliente && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 text-slate-300">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
              <h2 className="text-xl font-bold text-white mb-4">Detalles Completos del Cliente</h2>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 text-left">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Nombre del Cliente
                    </label>
                    <input
                      type="text"
                      disabled
                      value={viewingCliente.nombre_cliente}
                      className="w-full bg-slate-950/50 border border-slate-850 rounded-lg px-3.5 py-2 text-sm text-slate-300 focus:outline-none cursor-not-allowed opacity-80"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Nombre de la Empresa
                    </label>
                    <input
                      type="text"
                      disabled
                      value={viewingCliente.nombre_empresa}
                      className="w-full bg-slate-950/50 border border-slate-850 rounded-lg px-3.5 py-2 text-sm text-slate-300 focus:outline-none cursor-not-allowed opacity-80"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Teléfono
                    </label>
                    <input
                      type="text"
                      disabled
                      value={viewingCliente.telefono || 'No especificado'}
                      className="w-full bg-slate-950/50 border border-slate-850 rounded-lg px-3.5 py-2 text-sm text-slate-300 focus:outline-none cursor-not-allowed opacity-80"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Correo Electrónico
                    </label>
                    <input
                      type="text"
                      disabled
                      value={viewingCliente.email || 'No especificado'}
                      className="w-full bg-slate-950/50 border border-slate-850 rounded-lg px-3.5 py-2 text-sm text-slate-300 focus:outline-none cursor-not-allowed opacity-80"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      DNI
                    </label>
                    <input
                      type="text"
                      disabled
                      value={viewingCliente.dni || 'No especificado'}
                      className="w-full bg-slate-950/50 border border-slate-850 rounded-lg px-3.5 py-2 text-sm text-slate-300 focus:outline-none cursor-not-allowed opacity-80"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Localidad
                    </label>
                    <input
                      type="text"
                      disabled
                      value={viewingCliente.localidad || 'No especificado'}
                      className="w-full bg-slate-950/50 border border-slate-850 rounded-lg px-3.5 py-2 text-sm text-slate-300 focus:outline-none cursor-not-allowed opacity-80"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Provincia
                    </label>
                    <input
                      type="text"
                      disabled
                      value={viewingCliente.provincia || 'No especificado'}
                      className="w-full bg-slate-950/50 border border-slate-850 rounded-lg px-3.5 py-2 text-sm text-slate-300 focus:outline-none cursor-not-allowed opacity-80"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Código Postal (CP)
                    </label>
                    <input
                      type="text"
                      disabled
                      value={viewingCliente.cp || 'No especificado'}
                      className="w-full bg-slate-950/50 border border-slate-850 rounded-lg px-3.5 py-2 text-sm text-slate-300 focus:outline-none cursor-not-allowed opacity-80"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Dirección
                  </label>
                  <input
                    type="text"
                    disabled
                    value={viewingCliente.direccion || 'No especificada'}
                    className="w-full bg-slate-950/50 border border-slate-850 rounded-lg px-3.5 py-2 text-sm text-slate-300 focus:outline-none cursor-not-allowed opacity-80"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Valor Total
                    </label>
                    <div className="w-full bg-slate-950/50 border border-slate-850 rounded-lg px-3.5 py-2 text-sm text-blue-400 font-bold opacity-80 select-none">
                      ${Number(viewingCliente.valor_total || 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Ingreso
                    </label>
                    <div className="w-full bg-slate-950/50 border border-slate-850 rounded-lg px-3.5 py-2 text-sm text-emerald-400 font-bold opacity-80 select-none">
                      ${Number(viewingCliente.ingreso || 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Saldo
                    </label>
                    <div className={`w-full bg-slate-950/50 border border-slate-850 rounded-lg px-3.5 py-2 text-sm font-bold opacity-80 select-none ${Number(viewingCliente.saldo || 0) > 0 ? 'text-amber-500' : 'text-slate-300'}`}>
                      ${Number(viewingCliente.saldo || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Observaciones
                  </label>
                  <textarea
                    rows={3}
                    disabled
                    value={viewingCliente.observaciones || 'Sin observaciones'}
                    className="w-full bg-slate-950/50 border border-slate-850 rounded-lg px-3.5 py-2 text-sm text-slate-300 focus:outline-none cursor-not-allowed opacity-80 resize-none italic"
                  />
                </div>

                <div className="flex items-center justify-end pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsViewModalOpen(false)}
                    className="px-5 py-2 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-white font-medium shadow transition hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </RoleGuard>
  )
}

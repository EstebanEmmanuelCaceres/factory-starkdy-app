'use client'

import { useEffect, useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import {
  fetchPedidos,
  createPedido,
  updatePedido,
  deletePedido,
  generatePedidoTasks,
  type Pedido,
  type CreatePedidoInput,
  type UpdatePedidoInput
} from '@/lib/pedidos'
import { fetchClientes, createCliente as createNewClient, type Cliente } from '@/lib/clientes'
import { fetchProducts, type Product } from '@/lib/products'
import { getStoredUser, fetchUsers, type User } from '@/lib/auth'
import { fetchEtapas, createEtapa, deleteEtapa, type Etapa } from '@/lib/entities/etapas'
import {
  fetchResponsablesEtapas,
  assignTask,
  removeTaskAssignment,
  type ResponsableEtapa
} from '@/lib/responsable_etapas'

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Product[]>([])
  const [operarios, setOperarios] = useState<User[]>([])
  const [allStages, setAllStages] = useState<Etapa[]>([])
  const [taskAssignments, setTaskAssignments] = useState<ResponsableEtapa[]>([])

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Filtros
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPrioridad, setFilterPrioridad] = useState('')
  const [filterEstado, setFilterEstado] = useState('')

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)

  // Estados para el flujo Wizard de creación
  const [wizardStep, setWizardStep] = useState<'select_client' | 'client_confirmation' | 'order_details' | 'order_confirmation'>('select_client')
  const [selectedWizardClient, setSelectedWizardClient] = useState<Cliente | null>(null)
  const [createdPedidoResult, setCreatedPedidoResult] = useState<Pedido | null>(null)
  const [clientMode, setClientMode] = useState<'search' | 'create'>('search')
  const [wizardNewClient, setWizardNewClient] = useState<any | null>(null)

  const [formData, setFormData] = useState({
    cliente_id: '',
    codigo: '',
    prioridad: 'normal' as 'baja' | 'normal' | 'alta' | 'critica',
    fecha_entrega: '',
    estado: 'pendiente',
    selectedProductIds: [] as number[],
    productQuantities: {} as Record<number, number>,
    precio: ''
  })

  const [clientSearchText, setClientSearchText] = useState('')
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false)
  const [productSearchQuery, setProductSearchQuery] = useState('')
  const [isCreateClienteModalOpen, setIsCreateClienteModalOpen] = useState(false)
  const [newStageNames, setNewStageNames] = useState<Record<number, string>>({})
  const [localEtapas, setLocalEtapas] = useState<any[]>([])
  const [localAssignments, setLocalAssignments] = useState<Record<string, number | null>>({})
  const [clienteFormData, setClienteFormData] = useState({
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

  const loadData = async (search?: string, priority?: string, status?: string) => {
    setLoading(true)
    setError('')
    try {
      const filters: { search?: string; prioridad?: string; estado?: string } = {}

      if (search !== undefined) {
        if (search) filters.search = search
      } else if (searchQuery) {
        filters.search = searchQuery
      }

      if (priority !== undefined) {
        if (priority) filters.prioridad = priority
      } else if (filterPrioridad) {
        filters.prioridad = filterPrioridad
      }

      if (status !== undefined) {
        if (status) filters.estado = status
      } else if (filterEstado) {
        filters.estado = filterEstado
      }

      const [pedidosData, clientesData, productosData, usersData, stagesData] = await Promise.all([
        fetchPedidos(filters),
        fetchClientes(),
        fetchProducts(),
        fetchUsers(),
        fetchEtapas()
      ])

      setPedidos(pedidosData)
      setClientes(clientesData)
      setProductos(productosData)
      setOperarios(usersData.filter(u => u.role === 'operario' || u.role === 'operator'))
      setAllStages(stagesData)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }

  const loadTaskAssignments = async (pedidoId: number) => {
    try {
      const assignments = await fetchResponsablesEtapas({ pedido_id: pedidoId })
      setTaskAssignments(assignments)
    } catch (err) {
      console.error('Error al cargar asignaciones de tareas:', err)
    }
  }

  const reloadStages = async () => {
    try {
      const stagesData = await fetchEtapas()
      setAllStages(stagesData)
    } catch (err) {
      console.error('Error al recargar etapas:', err)
    }
  }

  const handleAddStage = (productId: number) => {
    const name = newStageNames[productId]?.trim()
    if (!name) return

    const productStages = localEtapas.filter(s => s.producto_id === productId)
    const nextOrden = productStages.length > 0 ? Math.max(...productStages.map(s => s.orden || 0)) + 1 : 1

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const newStage = {
      temp_id: tempId,
      producto_id: productId,
      nombre: name,
      orden: nextOrden
    }

    setLocalEtapas(prev => [...prev, newStage])
    setNewStageNames(prev => ({ ...prev, [productId]: '' }))
  }

  const handleDeleteStage = (stageIdOrTempId: number | string) => {
    setLocalEtapas(prev => prev.filter(s => {
      if (s.id && s.id === stageIdOrTempId) return false
      if (s.temp_id && s.temp_id === stageIdOrTempId) return false
      return true
    }))

    const key = stageIdOrTempId.toString()
    setLocalAssignments(prev => {
      const copy = { ...prev }
      delete copy[key]
      return copy
    })
  }

  useEffect(() => {
    setCurrentUser(getStoredUser())
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showNotification = (message: string) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  const handleOpenCreateModal = () => {
    setSelectedPedido(null)
    setLocalEtapas([])
    setLocalAssignments({})
    setFormData({
      cliente_id: '',
      codigo: `PD-${Date.now().toString().slice(-6)}`,
      prioridad: 'normal',
      fecha_entrega: '',
      estado: 'pendiente',
      selectedProductIds: [],
      productQuantities: {},
      precio: ''
    })
    setClientSearchText('')
    setProductSearchQuery('')

    // Reset wizard steps
    setWizardStep('select_client')
    setSelectedWizardClient(null)
    setCreatedPedidoResult(null)
    setClientMode('search')
    setWizardNewClient(null)

    setIsCreateModalOpen(true)
  }

  const handleOpenEditModal = async (pedido: Pedido) => {
    setSelectedPedido(pedido)
    const productIds = pedido.productos?.map((p) => p.id) || []

    // Cargar etapas locales desde la plantilla global
    const initialStages = allStages.filter((s) => productIds.includes(s.producto_id))
    setLocalEtapas(initialStages)

    const quantities = pedido.productos?.reduce((acc, curr) => {
      const qty = (curr as any).pivot?.cantidad || 1
      acc[curr.id] = qty
      return acc
    }, {} as Record<number, number>) || {}

    setFormData({
      cliente_id: pedido.cliente_id.toString(),
      codigo: pedido.codigo,
      prioridad: pedido.prioridad,
      fecha_entrega: pedido.fecha_entrega || '',
      estado: pedido.estado,
      selectedProductIds: productIds,
      productQuantities: quantities,
      precio: pedido.precio !== null && pedido.precio !== undefined ? pedido.precio.toString() : ''
    })
    const assignedClient = clientes.find((c) => c.id === pedido.cliente_id)
    setClientSearchText(assignedClient ? `${assignedClient.nombre_cliente} - ${assignedClient.nombre_empresa}` : '')
    setProductSearchQuery('')

    // Cargar asignaciones de tareas existentes y mapearlas al estado local
    try {
      const assignments = await fetchResponsablesEtapas({ pedido_id: pedido.id })
      setTaskAssignments(assignments)
      const mapped: Record<string, number | null> = {}
      assignments.forEach((a) => {
        mapped[a.etapa_id.toString()] = a.user_id
      })
      setLocalAssignments(mapped)
    } catch (err) {
      console.error('Error al precargar asignaciones:', err)
    }

    setIsEditModalOpen(true)
  }

  const handleProductCheckboxChange = (productId: number) => {
    setFormData((prev) => {
      const alreadySelected = prev.selectedProductIds.includes(productId)
      const updatedIds = alreadySelected
        ? prev.selectedProductIds.filter((id) => id !== productId)
        : [...prev.selectedProductIds, productId]

      const updatedQuantities = { ...prev.productQuantities }
      if (alreadySelected) {
        delete updatedQuantities[productId]
        setLocalEtapas((stages) => stages.filter((s) => s.producto_id !== productId))
      } else {
        updatedQuantities[productId] = 1
        const newStages = allStages.filter((s) => s.producto_id === productId)
        setLocalEtapas((stages) => [...stages, ...newStages])
      }

      return {
        ...prev,
        selectedProductIds: updatedIds,
        productQuantities: updatedQuantities
      }
    })
  }

  const handleProductQuantityChange = (productId: number, val: number) => {
    setFormData((prev) => ({
      ...prev,
      productQuantities: {
        ...prev.productQuantities,
        [productId]: val
      }
    }))
  }

  const handleOpenCreateClienteModal = () => {
    setClienteFormData({
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
    setIsCreateClienteModalOpen(true)
  }

  const handleCreateClienteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const payload = {
        nombre_cliente: clienteFormData.nombre_cliente.trim(),
        nombre_empresa: clienteFormData.nombre_empresa.trim(),
        email: clienteFormData.email?.trim() || null,
        telefono: clienteFormData.telefono.trim(),
        dni: clienteFormData.dni?.trim() || null,
        direccion: clienteFormData.direccion?.trim() || null,
        provincia: clienteFormData.provincia?.trim() || null,
        cp: clienteFormData.cp?.trim() || null,
        localidad: clienteFormData.localidad?.trim() || null,
        ingreso: Number(clienteFormData.ingreso) || 0,
        valor_total: Number(clienteFormData.valor_total) || 0,
        saldo: Number(clienteFormData.saldo) || 0,
        observaciones: clienteFormData.observaciones?.trim() || null
      }
      const newClient = await createNewClient(payload)
      setIsCreateClienteModalOpen(false)
      showNotification('Cliente registrado correctamente')

      // Recargar clientes
      const updatedClients = await fetchClientes()
      setClientes(updatedClients)

      // Auto seleccionar
      setFormData((prev) => ({
        ...prev,
        cliente_id: newClient.id.toString()
      }))
      setClientSearchText(`${newClient.nombre_cliente} - ${newClient.nombre_empresa}`)
      setIsClientDropdownOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrar el cliente')
    }
  }

  const handleWizardCreateClienteSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const payload = {
      nombre_cliente: clienteFormData.nombre_cliente.trim(),
      nombre_empresa: clienteFormData.nombre_empresa.trim(),
      email: clienteFormData.email?.trim() || null,
      telefono: clienteFormData.telefono.trim(),
      dni: clienteFormData.dni?.trim() || null,
      direccion: clienteFormData.direccion?.trim() || null,
      provincia: clienteFormData.provincia?.trim() || null,
      cp: clienteFormData.cp?.trim() || null,
      localidad: clienteFormData.localidad?.trim() || null,
      ingreso: Number(clienteFormData.ingreso) || 0,
      valor_total: Number(clienteFormData.valor_total) || 0,
      saldo: Number(clienteFormData.saldo) || 0,
      observaciones: clienteFormData.observaciones?.trim() || null
    }

    setWizardNewClient(payload)

    const tempClient: Cliente = {
      id: 0,
      nombre_cliente: payload.nombre_cliente,
      nombre_empresa: payload.nombre_empresa,
      telefono: payload.telefono,
      email: payload.email,
      dni: payload.dni,
      direccion: payload.direccion,
      provincia: payload.provincia,
      cp: payload.cp,
      localidad: payload.localidad,
      ingreso: payload.ingreso,
      valor_total: payload.valor_total,
      saldo: payload.saldo,
      observaciones: payload.observaciones,
      created_at: '',
      updated_at: ''
    }

    setSelectedWizardClient(tempClient)
    setFormData((prev) => ({
      ...prev,
      cliente_id: 'new'
    }))
    setClientSearchText(`${payload.nombre_cliente} - ${payload.nombre_empresa}`)

    setWizardStep('order_details')
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.cliente_id) {
      setError('Por favor, selecciona un cliente')
      return
    }

    try {
      const isNewClient = formData.cliente_id === 'new'
      const payload: CreatePedidoInput = {
        cliente_id: isNewClient ? null : parseInt(formData.cliente_id),
        cliente: isNewClient ? wizardNewClient : null,
        codigo: formData.codigo.trim(),
        prioridad: formData.prioridad,
        fecha_entrega: formData.fecha_entrega || null,
        precio: formData.precio ? parseFloat(formData.precio) : null,
        productos: formData.selectedProductIds.map((id) => ({
          id,
          cantidad: formData.productQuantities[id] || 1
        })),
        etapas: localEtapas.map((s, index) => ({
          id: s.id || null,
          temp_id: s.temp_id || null,
          producto_id: s.producto_id,
          nombre: s.nombre,
          orden: index + 1
        })),
        asignaciones: Object.entries(localAssignments).map(([key, userId]) => {
          if (key.startsWith('temp_')) {
            return { etapa_temp_id: key, user_id: userId }
          } else {
            return { etapa_id: parseInt(key), user_id: userId }
          }
        })
      }
      const newPedido = await createPedido(payload)
      showNotification('Pedido creado correctamente')
      setCreatedPedidoResult(newPedido)

      // Recargar la lista de pedidos en segundo plano para cuando se cierre el wizard
      loadData()

      // Pasar al paso final del wizard
      setWizardStep('order_confirmation')
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

    try {
      const payload: UpdatePedidoInput = {
        cliente_id: parseInt(formData.cliente_id),
        codigo: formData.codigo.trim(),
        prioridad: formData.prioridad,
        fecha_entrega: formData.fecha_entrega || null,
        estado: formData.estado,
        precio: formData.precio ? parseFloat(formData.precio) : null,
        productos: formData.selectedProductIds.map((id) => ({
          id,
          cantidad: formData.productQuantities[id] || 1
        })),
        etapas: localEtapas.map((s, index) => ({
          id: s.id || null,
          temp_id: s.temp_id || null,
          producto_id: s.producto_id,
          nombre: s.nombre,
          orden: index + 1
        })),
        asignaciones: Object.entries(localAssignments).map(([key, userId]) => {
          if (key.startsWith('temp_')) {
            return { etapa_temp_id: key, user_id: userId }
          } else {
            return { etapa_id: parseInt(key), user_id: userId }
          }
        })
      }

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

  const handleAssignTask = (stageIdOrTempId: number | string, userIdString: string) => {
    const key = stageIdOrTempId.toString()
    const userId = userIdString ? parseInt(userIdString) : null
    setLocalAssignments(prev => ({
      ...prev,
      [key]: userId
    }))
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      loadData()
    }
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setFilterPrioridad('')
    setFilterEstado('')
    loadData('', '', '')
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
      case 'bloqueada':
        return 'bg-slate-800/80 text-slate-500 border border-slate-700/60'
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

  // Filtrado de pedidos según el rol del usuario (vendedor y diseñador solo ven los suyos)
  const displayedPedidos = pedidos.filter((p) => {
    if (!currentUser) return false
    if (currentUser.role === 'vendedor' || currentUser.role === 'disenador') {
      return p.user_id === currentUser.id
    }
    return true
  })

  return (
    <RoleGuard allowedRoles={['admin', 'supervisor', 'encargado', 'vendedor', 'disenador']}>
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
            <p className="text-sm text-slate-400">
              {currentUser?.role === 'vendedor' || currentUser?.role === 'disenador'
                ? 'Visualiza y gestiona las ventas y pedidos asignados a tu cuenta.'
                : 'Gestiona los pedidos de fabricación, asocia productos y asigna operarios a etapas.'}
            </p>
          </div>
          <div className="flex items-center gap-3 self-start md:self-auto">
            <button
              onClick={handleOpenCreateClienteModal}
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-medium px-4 py-2.5 rounded-lg shadow transition duration-200 text-sm hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>➕</span> Nuevo Cliente
            </button>
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2.5 rounded-lg shadow transition duration-200 text-sm hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>➕</span> Nuevo Pedido
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-md">
          <div className="w-full flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Buscar por nombre o empresa del cliente..."
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

            <select
              value={filterPrioridad}
              onChange={(e) => {
                setFilterPrioridad(e.target.value)
                loadData(undefined, e.target.value, undefined)
              }}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3.5 py-2 focus:outline-none focus:border-blue-500 transition duration-150"
            >
              <option value="">Todas las Prioridades</option>
              <option value="baja">Prioridad Baja</option>
              <option value="normal">Prioridad Normal</option>
              <option value="alta">Prioridad Alta</option>
              <option value="critica">Prioridad Crítica</option>
            </select>

            <select
              value={filterEstado}
              onChange={(e) => {
                setFilterEstado(e.target.value)
                loadData(undefined, undefined, e.target.value)
              }}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-lg px-3.5 py-2 focus:outline-none focus:border-blue-500 transition duration-150"
            >
              <option value="">Todos los Estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="en_progreso">En Progreso</option>
              <option value="completado">Completado</option>
              <option value="cancelado">Cancelado</option>
            </select>

            <button
              onClick={() => loadData()}
              className="bg-slate-850 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-lg border border-slate-800 transition hover:scale-[1.02] active:scale-[0.98]"
            >
              Buscar
            </button>

            {(searchQuery || filterPrioridad || filterEstado) && (
              <button
                onClick={handleClearSearch}
                className="text-xs text-rose-400 hover:text-rose-300 font-semibold transition ml-auto sm:ml-0 self-center"
              >
                Limpiar Filtros
              </button>
            )}
          </div>
        </div>

        {/* Listado de Pedidos */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
              <span className="text-sm">Cargando pedidos...</span>
            </div>
          ) : displayedPedidos.length === 0 ? (
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
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4 text-center">Productos</th>
                    <th className="px-6 py-4">Prioridad</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4">Fecha Entrega</th>
                    <th className="px-6 py-4 text-right">Precio</th>
                    <th className="px-6 py-4">Registrado por</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm">
                  {displayedPedidos.map((pedido) => (
                    <tr key={pedido.id} className="hover:bg-slate-800/40 text-slate-300 transition duration-100">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-white">{pedido.cliente?.nombre_cliente} - {pedido.cliente?.nombre_empresa}</span>
                          <span className="text-xs text-slate-500">{pedido.cliente?.email || 'Sin correo'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        {pedido.productos && pedido.productos.length > 0 ? (
                          <div className="flex flex-col gap-1.5 items-stretch justify-center">
                            {pedido.productos.map((prod) => {
                              const qty = (prod as any).pivot?.cantidad
                              return (
                                <span
                                  key={prod.id}
                                  className="bg-slate-950 border border-slate-800 text-slate-200 text-sm px-3 py-1.5 rounded-lg text-center font-medium shadow-sm transition hover:border-slate-700"
                                  title={prod.descripcion || ''}
                                >
                                  {prod.nombre} {qty ? `(x${qty})` : ''}
                                </span>
                              )
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-650 italic text-xs block text-center">Ninguno</span>
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
                          /^\d{4}-\d{2}-\d{2}$/.test(pedido.fecha_entrega) ? (
                            new Date(pedido.fecha_entrega + 'T00:00:00').toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })
                          ) : (
                            <span>{pedido.fecha_entrega}</span>
                          )
                        ) : (
                          <span className="text-slate-600 italic">No planificada</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-semibold text-white">
                        {pedido.precio !== null && pedido.precio !== undefined ? (
                          `$ ${parseFloat(pedido.precio.toString()).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                        ) : (
                          <span className="text-slate-600 italic">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">{pedido.user?.name || 'Desconocido'}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2.5">
                          <button
                            onClick={() => handleOpenEditModal(pedido)}
                            className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition"
                            title="Editar/Asignar pedido"
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

        {/* Modal de Creación (Wizard) */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-white mb-4">Registrar Nuevo Pedido</h2>

              {/* Stepper Indicator */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-all ${wizardStep === 'select_client' || wizardStep === 'client_confirmation'
                      ? 'bg-blue-600 text-white shadow-[0_0_8px_rgba(37,99,235,0.6)]'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                    {['order_details', 'order_confirmation'].includes(wizardStep) ? '✓' : '1'}
                  </span>
                  <span className={`text-xs font-semibold ${wizardStep === 'select_client' || wizardStep === 'client_confirmation' ? 'text-blue-400' : 'text-slate-400'
                    }`}>
                    Cliente
                  </span>
                </div>

                <div className="flex-1 h-px bg-slate-800 mx-4" />

                <div className="flex items-center gap-2">
                  <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-all ${wizardStep === 'order_details'
                      ? 'bg-blue-600 text-white shadow-[0_0_8px_rgba(37,99,235,0.6)]'
                      : wizardStep === 'order_confirmation'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-500 border border-slate-700/30'
                    }`}>
                    {wizardStep === 'order_confirmation' ? '✓' : '2'}
                  </span>
                  <span className={`text-xs font-semibold ${wizardStep === 'order_details' ? 'text-blue-450' : 'text-slate-500'
                    }`}>
                    Pedido
                  </span>
                </div>

                <div className="flex-1 h-px bg-slate-800 mx-4" />

                <div className="flex items-center gap-2">
                  <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-all ${wizardStep === 'order_confirmation'
                      ? 'bg-blue-600 text-white shadow-[0_0_8px_rgba(37,99,235,0.6)]'
                      : 'bg-slate-800 text-slate-500 border border-slate-700/30'
                    }`}>
                    3
                  </span>
                  <span className={`text-xs font-semibold ${wizardStep === 'order_confirmation' ? 'text-blue-450' : 'text-slate-500'
                    }`}>
                    Resumen
                  </span>
                </div>
              </div>

              {/* Errores internos del wizard */}
              {error && (
                <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-200 px-3 py-2 rounded-lg flex items-center gap-2 text-xs">
                  <span>❌</span>
                  <span className="font-semibold">{error}</span>
                </div>
              )}

              {/* Paso 1: Selección o Registro de Cliente */}
              {wizardStep === 'select_client' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Seleccionar o Registrar Cliente</h3>

                  {/* Selector de modo */}
                  <div className="flex bg-slate-950/80 p-1 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setClientMode('search')
                        setError('')
                      }}
                      className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-md transition ${clientMode === 'search'
                          ? 'bg-blue-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                      🔍 Buscar Cliente Existente
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setClientMode('create')
                        setError('')
                      }}
                      className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-md transition ${clientMode === 'create'
                          ? 'bg-blue-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                      ➕ Registrar Nuevo Cliente
                    </button>
                  </div>

                  {clientMode === 'search' ? (
                    <div className="space-y-3 relative text-left">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Buscar Cliente *
                      </label>
                      <input
                        type="text"
                        placeholder="Escribe el nombre o empresa del cliente..."
                        value={clientSearchText}
                        onChange={(e) => {
                          setClientSearchText(e.target.value)
                          setIsClientDropdownOpen(true)
                        }}
                        onFocus={() => setIsClientDropdownOpen(true)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                      />

                      {isClientDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsClientDropdownOpen(false)} />
                          <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg shadow-xl divide-y divide-slate-900 text-left">
                            {clientes
                              .filter((c) => {
                                const query = clientSearchText.toLowerCase()
                                return (
                                  c.nombre_cliente.toLowerCase().includes(query) ||
                                  c.nombre_empresa.toLowerCase().includes(query) ||
                                  (c.email || '').toLowerCase().includes(query)
                                )
                              })
                              .map((c) => (
                                <div
                                  key={c.id}
                                  onClick={() => {
                                    setFormData({ ...formData, cliente_id: c.id.toString() })
                                    setClientSearchText(`${c.nombre_cliente} - ${c.nombre_empresa}`)
                                    setSelectedWizardClient(c)
                                    setIsClientDropdownOpen(false)
                                  }}
                                  className="px-3.5 py-2 hover:bg-slate-900 cursor-pointer text-sm text-slate-300 hover:text-white transition flex justify-between"
                                >
                                  <div>
                                    <span className="font-semibold block">{c.nombre_cliente}</span>
                                    <span className="text-xs text-slate-500">{c.nombre_empresa}</span>
                                  </div>
                                  {c.email && <span className="text-xs text-slate-500 self-center">{c.email}</span>}
                                </div>
                              ))}
                            {clientes.filter((c) => {
                              const query = clientSearchText.toLowerCase()
                              return (
                                c.nombre_cliente.toLowerCase().includes(query) ||
                                c.nombre_empresa.toLowerCase().includes(query) ||
                                (c.email || '').toLowerCase().includes(query)
                              )
                            }).length === 0 && (
                                <div className="px-3.5 py-2 text-xs text-slate-500 italic text-center">
                                  No se encontraron clientes con ese nombre.
                                </div>
                              )}
                          </div>
                        </>
                      )}

                      {/* Tarjeta de cliente seleccionado */}
                      {selectedWizardClient && (
                        <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-1">
                            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Cliente Seleccionado</span>
                            <span className="text-emerald-400 text-xs">✓ Listo</span>
                          </div>
                          <div>
                            <span className="text-sm font-bold text-white">{selectedWizardClient.nombre_cliente}</span>
                            <span className="text-xs text-slate-400 block">{selectedWizardClient.nombre_empresa}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-1">
                            <div>📞 {selectedWizardClient.telefono || 'Sin teléfono'}</div>
                            <div>✉️ {selectedWizardClient.email || 'Sin correo'}</div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800 mt-6">
                        <button
                          type="button"
                          onClick={() => setIsCreateModalOpen(false)}
                          className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={!formData.cliente_id}
                          onClick={() => setWizardStep('order_details')}
                          className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium shadow transition hover:scale-[1.02] active:scale-[0.98] disabled:scale-100"
                        >
                          Continuar ➡️
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Formulario de Registro Rápido integrado */
                    <form onSubmit={handleWizardCreateClienteSubmit} className="space-y-4 text-left">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                            Nombre del Cliente *
                          </label>
                          <input
                            type="text"
                            required
                            value={clienteFormData.nombre_cliente}
                            onChange={(e) => setClienteFormData({ ...clienteFormData, nombre_cliente: e.target.value })}
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
                            value={clienteFormData.nombre_empresa}
                            onChange={(e) => setClienteFormData({ ...clienteFormData, nombre_empresa: e.target.value })}
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
                            value={clienteFormData.telefono || ''}
                            onChange={(e) => setClienteFormData({ ...clienteFormData, telefono: e.target.value })}
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
                            value={clienteFormData.email || ''}
                            onChange={(e) => setClienteFormData({ ...clienteFormData, email: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                            placeholder="ejemplo@correo.com"
                          />
                        </div>
                      </div>

                      <details className="group border border-slate-800 rounded-lg bg-slate-950/30 overflow-hidden">
                        <summary className="list-none flex items-center justify-between p-3 text-xs text-slate-400 font-semibold cursor-pointer select-none hover:bg-slate-950/60 transition">
                          <span>Información Adicional (Dirección, Facturación, etc.)</span>
                          <span className="transition-transform group-open:rotate-180">▼</span>
                        </summary>
                        <div className="p-3 border-t border-slate-800 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                                DNI
                              </label>
                              <input
                                type="text"
                                value={clienteFormData.dni || ''}
                                onChange={(e) => setClienteFormData({ ...clienteFormData, dni: e.target.value })}
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
                                value={clienteFormData.localidad || ''}
                                onChange={(e) => setClienteFormData({ ...clienteFormData, localidad: e.target.value })}
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
                                value={clienteFormData.provincia || ''}
                                onChange={(e) => setClienteFormData({ ...clienteFormData, provincia: e.target.value })}
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
                                value={clienteFormData.cp || ''}
                                onChange={(e) => setClienteFormData({ ...clienteFormData, cp: e.target.value })}
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
                              value={clienteFormData.direccion || ''}
                              onChange={(e) => setClienteFormData({ ...clienteFormData, direccion: e.target.value })}
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
                                value={clienteFormData.valor_total}
                                onChange={(e) => setClienteFormData({ ...clienteFormData, valor_total: Number(e.target.value) })}
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
                                value={clienteFormData.ingreso}
                                onChange={(e) => setClienteFormData({ ...clienteFormData, ingreso: Number(e.target.value) })}
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
                                value={clienteFormData.saldo}
                                onChange={(e) => setClienteFormData({ ...clienteFormData, saldo: Number(e.target.value) })}
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
                              value={clienteFormData.observaciones || ''}
                              onChange={(e) => setClienteFormData({ ...clienteFormData, observaciones: e.target.value })}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                              placeholder="Notas sobre el cliente..."
                            />
                          </div>
                        </div>
                      </details>

                      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800 mt-6">
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
                          Registrar y Continuar ➡️
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Paso 1.5: Confirmación de Registro de Cliente */}
              {wizardStep === 'client_confirmation' && selectedWizardClient && (
                <div className="space-y-6 text-center py-6 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-center mx-auto w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-405 rounded-full text-2xl shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    ✅
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white">¡Cliente Registrado con Éxito!</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Se ha guardado la ficha del cliente en el sistema y se ha seleccionado automáticamente para este pedido.
                    </p>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 text-left max-w-md mx-auto space-y-3">
                    <div className="border-b border-slate-850 pb-2 flex justify-between items-center">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Ficha de Cliente</span>
                      <span className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-mono">ID: #{selectedWizardClient.id}</span>
                    </div>
                    <div>
                      <span className="text-sm font-bold text-white block">{selectedWizardClient.nombre_cliente}</span>
                      <span className="text-xs text-slate-400 font-medium block">{selectedWizardClient.nombre_empresa}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400 pt-2 border-t border-slate-850/50">
                      <div>📞 {selectedWizardClient.telefono || 'Sin teléfono'}</div>
                      <div>✉️ {selectedWizardClient.email || 'Sin correo'}</div>
                      <div className="sm:col-span-2">📍 {selectedWizardClient.direccion ? `${selectedWizardClient.direccion}, ${selectedWizardClient.localidad || ''}` : 'Sin dirección registrada'}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-6 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setWizardStep('select_client')}
                      className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    >
                      Atrás
                    </button>
                    <button
                      type="button"
                      onClick={() => setWizardStep('order_details')}
                      className="px-5 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow transition hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Continuar al Pedido ➡️
                    </button>
                  </div>
                </div>
              )}

              {/* Paso 2: Creación de Pedido */}
              {wizardStep === 'order_details' && (
                <form onSubmit={handleCreateSubmit} className="space-y-4 text-slate-300">
                  {/* Banner de Cliente pre-seleccionado */}
                  {selectedWizardClient ? (
                    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">👤</span>
                        <div className="text-left">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block leading-tight">Cliente Asignado</span>
                          <span className="text-xs font-bold text-white">{selectedWizardClient.nombre_cliente} - <span className="text-slate-400 font-medium">{selectedWizardClient.nombre_empresa}</span></span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setWizardStep('select_client')}
                        className="text-xs text-blue-400 hover:underline hover:text-blue-300 font-medium"
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-200 p-3 rounded-lg text-sm flex justify-between items-center">
                      <span>No hay cliente asignado a este pedido.</span>
                      <button
                        type="button"
                        onClick={() => setWizardStep('select_client')}
                        className="text-xs underline"
                      >
                        Asignar ahora
                      </button>
                    </div>
                  )}

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
                        Precio ($)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. 1500"
                        value={formData.precio}
                        onChange={(e) => {
                          const val = e.target.value
                          if (/^[0-9]*$/.test(val)) {
                            setFormData({ ...formData, precio: val })
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                      />
                    </div>
                  </div>

                  {/* Selección de Productos */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Asociar Productos (Opcional)
                    </label>
                    <div className="mb-2">
                      <input
                        type="text"
                        placeholder="Filtrar productos..."
                        value={productSearchQuery}
                        onChange={(e) => setProductSearchQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                      />
                    </div>
                    {productos.length === 0 ? (
                      <p className="text-slate-500 italic text-xs">No hay productos cargados en el catálogo.</p>
                    ) : (
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                        {productos
                          .filter((prod) => {
                            const query = productSearchQuery.toLowerCase()
                            return (
                              prod.nombre.toLowerCase().includes(query)
                            )
                          })
                          .map((prod) => {
                            const isSelected = formData.selectedProductIds.includes(prod.id)
                            return (
                              <div key={prod.id} className="flex items-center justify-between text-sm hover:text-white transition p-1 hover:bg-slate-900/60 rounded">
                                <label className="flex items-center gap-2.5 cursor-pointer flex-grow text-left">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleProductCheckboxChange(prod.id)}
                                    className="rounded border-slate-800 bg-slate-900 text-blue-600 focus:ring-blue-500/20"
                                  />
                                  <span className="font-semibold ml-1">{prod.nombre}</span>
                                </label>
                                {isSelected && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Cant:</span>
                                    <input
                                      type="number"
                                      min="1"
                                      value={formData.productQuantities[prod.id] || 1}
                                      onChange={(e) => handleProductQuantityChange(prod.id, parseInt(e.target.value) || 1)}
                                      className="w-16 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-blue-500 text-center"
                                    />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                      </div>
                    )}
                  </div>

                  {/* Etapas de Fabricación por Producto */}
                  {formData.selectedProductIds.length > 0 && (
                    <div className="border-t border-slate-800 pt-4 mt-4 space-y-3">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Etapas de Fabricación y Asignación de Operarios
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Se muestran las etapas de fabricación preconfiguradas para los productos seleccionados. Puede asignar el operario responsable de cada etapa.
                      </p>
                      <div className="space-y-4 max-h-[300px] overflow-y-auto bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                        {formData.selectedProductIds.map((prodId) => {
                          const product = productos.find(p => p.id === prodId)
                          const productStages = localEtapas
                            .filter(s => s.producto_id === prodId)
                            .sort((a, b) => a.orden - b.orden)

                          return (
                            <div key={prodId} className="space-y-2 bg-slate-900/60 p-3 rounded-lg border border-slate-800/40">
                              <div className="flex items-center justify-between border-b border-slate-850 pb-1.5">
                                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                                  {product?.nombre}
                                </span>
                                <span className="text-[10px] bg-slate-850 text-slate-400 px-2 py-0.5 rounded-full">
                                  {productStages.length} {productStages.length === 1 ? 'etapa' : 'etapas'}
                                </span>
                              </div>

                              {productStages.length === 0 ? (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 py-2">
                                  <span className="text-xs text-slate-500 italic">No hay etapas configuradas.</span>
                                </div>
                              ) : (
                                <div className="space-y-1.5 py-1">
                                  {productStages.map((stage) => {
                                    const stageIdOrTempId = stage.id || stage.temp_id
                                    const stageKey = stageIdOrTempId.toString()
                                    return (
                                      <div key={stageKey} className="flex items-center justify-between text-xs bg-slate-950 border border-slate-850/60 p-2 rounded-lg">
                                        <div>
                                          <span className="font-semibold block text-slate-200">{stage.orden}. {stage.nombre}</span>
                                        </div>

                                        {currentUser && ['admin', 'supervisor', 'encargado'].includes(currentUser.role) ? (
                                          <select
                                            value={localAssignments[stageKey] || ''}
                                            onChange={(e) => handleAssignTask(stageIdOrTempId, e.target.value)}
                                            className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                                          >
                                            <option value="">Sin Asignar</option>
                                            {operarios.map((op) => (
                                              <option key={op.id} value={op.id}>
                                                {op.name}
                                              </option>
                                            ))}
                                          </select>
                                        ) : (
                                          (() => {
                                            const assignedOp = operarios.find(o => o.id === localAssignments[stageKey])
                                            return assignedOp ? (
                                              <span className="text-slate-400 text-xs italic">
                                                Asignado: {assignedOp.name}
                                              </span>
                                            ) : (
                                              <span className="text-slate-500 text-xs italic">
                                                Sin asignar
                                              </span>
                                            )
                                          })()
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800 mt-6">
                    <button
                      type="button"
                      onClick={() => setWizardStep('select_client')}
                      className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    >
                      Atrás
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow transition hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Crear Pedido ➡️
                    </button>
                  </div>
                </form>
              )}

              {/* Paso 3: Confirmación de Pedido */}
              {wizardStep === 'order_confirmation' && createdPedidoResult && (
                <div className="space-y-6 text-center py-6 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-center mx-auto w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-405 rounded-full text-3xl shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    🎉
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-white">¡Pedido Creado con Éxito!</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      El pedido de fabricación ha sido registrado correctamente y está listo para ser procesado.
                    </p>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 text-left max-w-md mx-auto space-y-3">
                    <div className="border-b border-slate-850 pb-2 flex justify-between items-center">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Ficha de Pedido</span>
                      <span className="text-xs font-mono font-bold text-white bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg">{createdPedidoResult.codigo}</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Cliente Asignado</span>
                      <span className="text-sm font-bold text-white block">{selectedWizardClient?.nombre_cliente || 'N/A'}</span>
                      <span className="text-xs text-slate-400 block">{selectedWizardClient?.nombre_empresa || 'N/A'}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-850/50 text-xs">
                      <div>
                        <span className="text-slate-500 block mb-0.5">Prioridad</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize ${getPriorityBadgeClass(createdPedidoResult.prioridad)}`}>
                          {createdPedidoResult.prioridad}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-550 block mb-0.5">Fecha de Entrega</span>
                        <span className="font-semibold text-slate-350">{createdPedidoResult.fecha_entrega || 'No planificada'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-0.5">Precio</span>
                        <span className="font-semibold text-slate-350">
                          {createdPedidoResult.precio !== null && createdPedidoResult.precio !== undefined ? (
                            `$ ${parseFloat(createdPedidoResult.precio.toString()).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                          ) : (
                            'Sin precio'
                          )}
                        </span>
                      </div>
                    </div>

                    {formData.selectedProductIds.length > 0 && (
                      <div className="pt-3 border-t border-slate-850/50 space-y-1.5">
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Productos Asociados</span>
                        <div className="flex flex-wrap gap-1.5">
                          {formData.selectedProductIds.map((pId) => {
                            const p = productos.find(prod => prod.id === pId)
                            const qty = formData.productQuantities[pId] || 1
                            return p ? (
                              <span key={pId} className="bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2.5 py-1 rounded-md">
                                {p.nombre} <span className="text-slate-500 font-bold ml-1">x{qty}</span>
                              </span>
                            ) : null
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-6 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreateModalOpen(false)
                        // Resetear wizard para la próxima vez
                        setWizardStep('select_client')
                        setSelectedWizardClient(null)
                        setCreatedPedidoResult(null)
                      }}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow transition hover:scale-[1.02] active:scale-[0.98] rounded-lg text-sm"
                    >
                      Finalizar y Ver en Panel
                    </button>
                  </div>
                </div>
              )}
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
                  <div className="relative">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Cliente *</span>
                      <button
                        type="button"
                        onClick={handleOpenCreateClienteModal}
                        className="text-xs text-blue-450 hover:text-blue-300 font-semibold"
                      >
                        + Nuevo Cliente
                      </button>
                    </label>
                    <input
                      type="text"
                      placeholder="Buscar cliente..."
                      value={clientSearchText}
                      onChange={(e) => {
                        setClientSearchText(e.target.value)
                        setIsClientDropdownOpen(true)
                      }}
                      onFocus={() => setIsClientDropdownOpen(true)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                    {isClientDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsClientDropdownOpen(false)} />
                        <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg shadow-xl divide-y divide-slate-900 text-left">
                          {clientes
                            .filter((c) => {
                              const query = clientSearchText.toLowerCase()
                              return (
                                c.nombre_cliente.toLowerCase().includes(query) ||
                                c.nombre_empresa.toLowerCase().includes(query) ||
                                (c.email || '').toLowerCase().includes(query)
                              )
                            })
                            .map((c) => (
                              <div
                                key={c.id}
                                onClick={() => {
                                  setFormData({ ...formData, cliente_id: c.id.toString() })
                                  setClientSearchText(`${c.nombre_cliente} - ${c.nombre_empresa}`)
                                  setIsClientDropdownOpen(false)
                                }}
                                className="px-3.5 py-2.5 hover:bg-slate-900 cursor-pointer text-sm text-slate-300 hover:text-white transition flex justify-between"
                              >
                                <div>
                                  <span className="font-semibold block">{c.nombre_cliente}</span>
                                  <span className="text-xs text-slate-500">{c.nombre_empresa}</span>
                                </div>
                                {c.email && <span className="text-xs text-slate-500 self-center">{c.email}</span>}
                              </div>
                            ))}
                          {clientes.filter((c) => {
                            const query = clientSearchText.toLowerCase()
                            return (
                              c.nombre_cliente.toLowerCase().includes(query) ||
                              c.nombre_empresa.toLowerCase().includes(query) ||
                              (c.email || '').toLowerCase().includes(query)
                            )
                          }).length === 0 && (
                              <div className="px-3.5 py-2.5 text-xs text-slate-500 italic text-center">
                                No se encontraron clientes.{" "}
                                <button
                                  type="button"
                                  onClick={handleOpenCreateClienteModal}
                                  className="text-blue-450 hover:underline font-semibold"
                                >
                                  Crear nuevo cliente
                                </button>
                              </div>
                            )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Precio ($)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. 1500"
                      value={formData.precio}
                      onChange={(e) => {
                        const val = e.target.value
                        if (/^[0-9]*$/.test(val)) {
                          setFormData({ ...formData, precio: val })
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                {/* Selección de Productos */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Observaciones
                  </label>
                  <div className="mb-2">
                    <input
                      type="text"
                      placeholder="Filtrar productos..."
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  {productos.length === 0 ? (
                    <p className="text-slate-500 italic text-xs">No hay productos cargados en el catálogo.</p>
                  ) : (
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                      {productos
                        .filter((prod) => {
                          const query = productSearchQuery.toLowerCase()
                          return (
                            prod.nombre.toLowerCase().includes(query)
                          )
                        })
                        .map((prod) => {
                          const isSelected = formData.selectedProductIds.includes(prod.id)
                          return (
                            <div key={prod.id} className="flex items-center justify-between text-sm hover:text-white transition p-1 hover:bg-slate-900/60 rounded">
                              <label className="flex items-center gap-2.5 cursor-pointer flex-grow text-left">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleProductCheckboxChange(prod.id)}
                                  className="rounded border-slate-800 bg-slate-900 text-blue-600 focus:ring-blue-500/20"
                                />
                                <span className="font-semibold ml-1">{prod.nombre}</span>
                              </label>
                              {isSelected && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Cant:</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={formData.productQuantities[prod.id] || 1}
                                    onChange={(e) => handleProductQuantityChange(prod.id, parseInt(e.target.value) || 1)}
                                    className="w-16 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-blue-500 text-center"
                                  />
                                </div>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  )}
                </div>
                {/* Etapas de Fabricación y Asignación */}
                <div className="border-t border-slate-800 pt-4 mt-4 space-y-3">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Etapas de Fabricación y Asignación de Operarios
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Se muestran las etapas de fabricación preconfiguradas para los productos seleccionados. Puede asignar el operario responsable de cada etapa.
                  </p>

                  {formData.selectedProductIds.length === 0 ? (
                    <p className="text-slate-500 italic text-xs">Asocia productos al pedido para ver sus etapas.</p>
                  ) : (
                    <div className="space-y-4 max-h-[300px] overflow-y-auto bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                      {formData.selectedProductIds.map((prodId) => {
                        const product = productos.find(p => p.id === prodId)
                        const productStages = localEtapas
                          .filter(s => s.producto_id === prodId)
                          .sort((a, b) => a.orden - b.orden)

                        return (
                          <div key={prodId} className="space-y-2 bg-slate-900/60 p-3 rounded-lg border border-slate-800/40">
                            <div className="flex items-center justify-between border-b border-slate-850 pb-1.5">
                              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                                {product?.nombre}
                              </span>
                              <span className="text-[10px] bg-slate-850 text-slate-400 px-2 py-0.5 rounded-full">
                                {productStages.length} {productStages.length === 1 ? 'etapa' : 'etapas'}
                              </span>
                            </div>

                            {productStages.length === 0 ? (
                              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 py-2">
                                <span className="text-xs text-slate-500 italic">No hay etapas configuradas.</span>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {productStages.map((stage) => {
                                  const stageIdOrTempId = stage.id || stage.temp_id
                                  const stageKey = stageIdOrTempId.toString()
                                  return (
                                    <div key={stageKey} className="flex items-center justify-between text-xs bg-slate-950 border border-slate-850/60 p-2 rounded-lg">
                                      <div className="flex items-center gap-2">
                                        <div>
                                          <span className="font-semibold block text-slate-200">{stage.orden}. {stage.nombre}</span>
                                        </div>
                                      </div>

                                      {currentUser && ['admin', 'supervisor', 'encargado'].includes(currentUser.role) ? (
                                        <select
                                          value={localAssignments[stageKey] || ''}
                                          onChange={(e) => handleAssignTask(stageIdOrTempId, e.target.value)}
                                          className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                                        >
                                          <option value="">Sin Asignar</option>
                                          {operarios.map((op) => (
                                            <option key={op.id} value={op.id}>
                                              {op.name}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        (() => {
                                          const assignedOp = operarios.find(o => o.id === localAssignments[stageKey])
                                          return assignedOp ? (
                                            <span className="text-slate-400 text-xs italic">
                                              Asignado: {assignedOp.name}
                                            </span>
                                          ) : (
                                            <span className="text-slate-500 text-xs italic">
                                              Sin asignar
                                            </span>
                                          )
                                        })()
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
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

        {/* Modal de Creación de Cliente Rápido */}
        {isCreateClienteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 text-slate-300">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
              <h2 className="text-xl font-bold text-white mb-4">Registrar Nuevo Cliente</h2>
              <form onSubmit={handleCreateClienteSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 text-left">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Nombre del Cliente *
                    </label>
                    <input
                      type="text"
                      required
                      value={clienteFormData.nombre_cliente}
                      onChange={(e) => setClienteFormData({ ...clienteFormData, nombre_cliente: e.target.value })}
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
                      value={clienteFormData.nombre_empresa}
                      onChange={(e) => setClienteFormData({ ...clienteFormData, nombre_empresa: e.target.value })}
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
                      value={clienteFormData.telefono || ''}
                      onChange={(e) => setClienteFormData({ ...clienteFormData, telefono: e.target.value })}
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
                      value={clienteFormData.email || ''}
                      onChange={(e) => setClienteFormData({ ...clienteFormData, email: e.target.value })}
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
                      value={clienteFormData.dni || ''}
                      onChange={(e) => setClienteFormData({ ...clienteFormData, dni: e.target.value })}
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
                      value={clienteFormData.localidad || ''}
                      onChange={(e) => setClienteFormData({ ...clienteFormData, localidad: e.target.value })}
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
                      value={clienteFormData.provincia || ''}
                      onChange={(e) => setClienteFormData({ ...clienteFormData, provincia: e.target.value })}
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
                      value={clienteFormData.cp || ''}
                      onChange={(e) => setClienteFormData({ ...clienteFormData, cp: e.target.value })}
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
                    value={clienteFormData.direccion || ''}
                    onChange={(e) => setClienteFormData({ ...clienteFormData, direccion: e.target.value })}
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
                      value={clienteFormData.valor_total}
                      onChange={(e) => setClienteFormData({ ...clienteFormData, valor_total: Number(e.target.value) })}
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
                      value={clienteFormData.ingreso}
                      onChange={(e) => setClienteFormData({ ...clienteFormData, ingreso: Number(e.target.value) })}
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
                      value={clienteFormData.saldo}
                      onChange={(e) => setClienteFormData({ ...clienteFormData, saldo: Number(e.target.value) })}
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
                    value={clienteFormData.observaciones || ''}
                    onChange={(e) => setClienteFormData({ ...clienteFormData, observaciones: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    placeholder="Notas sobre el cliente..."
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCreateClienteModalOpen(false)}
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
      </main>
    </RoleGuard>
  )
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'bloqueada':
      return '🔒 Bloqueada'
    case 'completado':
      return 'Completado'
    case 'en_progreso':
      return 'En Progreso'
    case 'pendiente':
    default:
      return 'Pendiente'
  }
}

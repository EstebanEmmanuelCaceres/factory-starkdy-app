'use client'

import { useEffect, useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import {
  fetchPedidos,
  createPedido,
  updatePedido,
  deletePedido,
  generatePedidoTasks,
  fetchPedidoPagos,
  createPedidoPago,
  deletePedidoPago,
  createPedidoComentario,
  type Pedido,
  type CreatePedidoInput,
  type UpdatePedidoInput,
  type Pago,
  type ComentarioPedido
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

  // Estados para el Modal de Visualización Trello
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [selectedPedidoForView, setSelectedPedidoForView] = useState<Pedido | null>(null)
  const [nuevoComentario, setNuevoComentario] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [isEditCommentActive, setIsEditCommentActive] = useState(false)
  const [tempComentario, setTempComentario] = useState('')
  const [openAccordions, setOpenAccordions] = useState<Record<number, boolean>>({})
  const [verTodosProductos, setVerTodosProductos] = useState(false)

  // Estados para Gestión de Pagos Parciales/Únicos
  const [isPaymentsModalOpen, setIsPaymentsModalOpen] = useState(false)
  const [selectedPedidoForPayments, setSelectedPedidoForPayments] = useState<Pedido | null>(null)
  const [pedidoPayments, setPedidoPayments] = useState<Pago[]>([])
  const [paymentFormData, setPaymentFormData] = useState({
    monto: '',
    medio_pago: 'efectivo',
    tipo_cobro: 'parcial' as 'seña' | 'parcial' | 'saldo' | 'unico',
    observaciones: '',
    fecha_pago: ''
  })
  const [paymentError, setPaymentError] = useState('')
  const [paymentSuccess, setPaymentSuccess] = useState('')
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)

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
    precio: '',
    comentario: '',
    tipo_pago: 'unico' as 'unico' | 'parcial'
  })

  // Ordenamiento
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Paginación
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterPrioridad, filterEstado])

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

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

    // Calcular fecha por defecto: hoy + 15 días
    const defaultDeliveryDate = (() => {
      const d = new Date()
      d.setDate(d.getDate() + 15)
      return d.toISOString().split('T')[0]
    })()

    setFormData({
      cliente_id: '',
      codigo: `PD-${Date.now().toString().slice(-6)}`,
      prioridad: 'normal',
      fecha_entrega: defaultDeliveryDate,
      estado: 'pendiente',
      selectedProductIds: [],
      productQuantities: {},
      precio: '',
      comentario: '',
      tipo_pago: 'unico'
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

    // Si no tiene fecha de entrega, usar hoy + 15 días
    const defaultDeliveryDate = (() => {
      const d = new Date()
      d.setDate(d.getDate() + 15)
      return d.toISOString().split('T')[0]
    })()

    setFormData({
      cliente_id: pedido.cliente_id.toString(),
      codigo: pedido.codigo,
      prioridad: pedido.prioridad,
      fecha_entrega: pedido.fecha_entrega || defaultDeliveryDate,
      estado: pedido.estado,
      selectedProductIds: productIds,
      productQuantities: quantities,
      precio: pedido.precio !== null && pedido.precio !== undefined ? pedido.precio.toString() : '',
      comentario: pedido.comentario || '',
      tipo_pago: pedido.tipo_pago || 'unico'
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
        comentario: formData.comentario || null,
        tipo_pago: formData.tipo_pago,
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
        comentario: formData.comentario || null,
        tipo_pago: formData.tipo_pago,
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

  const getProductCurrentStage = (pedidoId: number, productStages: Etapa[], tasks: ResponsableEtapa[]) => {
    const pedidoTasks = tasks.filter(t => t.pedido_id === pedidoId)
    const sortedStages = [...productStages].sort((a, b) => a.orden - b.orden)

    // Buscar la primera tarea que no esté completada
    for (const stage of sortedStages) {
      const task = pedidoTasks.find(t => t.etapa_id === stage.id)
      if (task && task.estado !== 'completado') {
        return { stage, task }
      }
    }
    // Si están todas completadas
    if (sortedStages.length > 0) {
      const lastStage = sortedStages[sortedStages.length - 1]
      const lastTask = pedidoTasks.find(t => t.etapa_id === lastStage.id)
      return { stage: lastStage, task: lastTask }
    }
    return null
  }

  const handleOpenViewModal = async (pedido: Pedido) => {
    setSelectedPedidoForView(pedido)
    setTempComentario(pedido.comentario || '')
    setNuevoComentario('')
    setIsEditCommentActive(false)
    setOpenAccordions({})
    setVerTodosProductos(false)
    setIsViewModalOpen(true)

    // Cargar asignaciones de tareas para este pedido
    await loadTaskAssignments(pedido.id)
  }

  // ── Gestores de Pagos Parciales/Únicos ─────────────────────────────
  const handleOpenPaymentsModal = async (pedido: Pedido) => {
    setSelectedPedidoForPayments(pedido)
    setPaymentError('')
    setPaymentSuccess('')

    const precio = Number(pedido.precio) || 0
    const currentPaid = pedido.pagos
      ? pedido.pagos.filter(p => p.estado === 'pagado').reduce((sum, p) => sum + Number(p.monto), 0)
      : (pedido.pago && pedido.pago.estado === 'pagado' ? Number(pedido.pago.monto) : 0)
    const saldo = Math.max(0, precio - currentPaid)

    setPaymentFormData({
      monto: saldo > 0 ? saldo.toString() : '',
      medio_pago: 'efectivo',
      tipo_cobro: pedido.tipo_pago === 'unico' ? 'unico' : 'parcial',
      observaciones: '',
      fecha_pago: new Date().toISOString().split('T')[0]
    })

    try {
      const pagos = await fetchPedidoPagos(pedido.id)
      setPedidoPayments(pagos)
    } catch (err) {
      console.error('Error fetching payments:', err)
      setPedidoPayments(pedido.pagos || (pedido.pago ? [pedido.pago] : []))
    }

    setIsPaymentsModalOpen(true)
  }

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPedidoForPayments) return
    setPaymentError('')
    setPaymentSuccess('')
    setIsSubmittingPayment(true)

    const monto = parseFloat(paymentFormData.monto)
    if (isNaN(monto) || monto <= 0) {
      setPaymentError('Por favor ingrese un monto válido mayor a 0.')
      setIsSubmittingPayment(false)
      return
    }

    try {
      const res = await createPedidoPago(selectedPedidoForPayments.id, {
        monto,
        medio_pago: paymentFormData.medio_pago,
        tipo_cobro: paymentFormData.tipo_cobro,
        observaciones: paymentFormData.observaciones || undefined,
        fecha_pago: paymentFormData.fecha_pago || undefined
      })

      setPaymentSuccess(res.message || 'Pago registrado con éxito.')

      const updatedPagos = await fetchPedidoPagos(selectedPedidoForPayments.id)
      setPedidoPayments(updatedPagos)

      const updatedPedido = res.pedido
      setSelectedPedidoForPayments(updatedPedido)
      const precio = Number(updatedPedido.precio) || 0
      const currentPaid = updatedPedido.pagos
        ? updatedPedido.pagos.filter(p => p.estado === 'pagado').reduce((sum, p) => sum + Number(p.monto), 0)
        : (updatedPedido.pago && updatedPedido.pago.estado === 'pagado' ? Number(updatedPedido.pago.monto) : 0)
      const newSaldo = Math.max(0, precio - currentPaid)

      setPaymentFormData({
        monto: newSaldo > 0 ? newSaldo.toString() : '',
        medio_pago: 'efectivo',
        tipo_cobro: updatedPedido.tipo_pago === 'unico' ? 'unico' : 'parcial',
        observaciones: '',
        fecha_pago: new Date().toISOString().split('T')[0]
      })

      loadData()
    } catch (err: any) {
      setPaymentError(err instanceof Error ? err.message : 'Error al registrar el pago.')
    } finally {
      setIsSubmittingPayment(false)
    }
  }

  const handleAnnulPayment = async (pagoId: number) => {
    if (!confirm('¿Estás seguro de que deseas anular este pago? Esta acción no se puede deshacer.')) return
    setPaymentError('')
    setPaymentSuccess('')

    try {
      const res = await deletePedidoPago(pagoId)
      setPaymentSuccess('Pago anulado con éxito.')

      if (selectedPedidoForPayments) {
        const updatedPagos = await fetchPedidoPagos(selectedPedidoForPayments.id)
        setPedidoPayments(updatedPagos)

        const updatedPedido = res.pedido
        setSelectedPedidoForPayments(updatedPedido)
        const precio = Number(updatedPedido.precio) || 0
        const currentPaid = updatedPedido.pagos
          ? updatedPedido.pagos.filter(p => p.estado === 'pagado').reduce((sum, p) => sum + Number(p.monto), 0)
          : (updatedPedido.pago && updatedPedido.pago.estado === 'pagado' ? Number(updatedPedido.pago.monto) : 0)
        const newSaldo = Math.max(0, precio - currentPaid)

        setPaymentFormData(prev => ({
          ...prev,
          monto: newSaldo > 0 ? newSaldo.toString() : ''
        }))
      }

      loadData()
    } catch (err: any) {
      setPaymentError(err instanceof Error ? err.message : 'Error al anular el pago.')
    }
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

  // Filtrado y ordenamiento de pedidos
  const filteredAndSortedPedidos = pedidos
    .filter((p) => {
      if (!currentUser) return false
      if (currentUser.role === 'vendedor' || currentUser.role === 'disenador') {
        return p.user_id === currentUser.id
      }
      return true
    })
    .sort((a, b) => {
      if (!sortField) return 0

      let valA: any = ''
      let valB: any = ''

      if (sortField === 'cliente') {
        valA = `${a.cliente?.nombre_cliente || ''} ${a.cliente?.nombre_empresa || ''}`.trim().toLowerCase()
        valB = `${b.cliente?.nombre_cliente || ''} ${b.cliente?.nombre_empresa || ''}`.trim().toLowerCase()
      } else if (sortField === 'productos') {
        valA = a.productos?.length || 0
        valB = b.productos?.length || 0
      } else if (sortField === 'prioridad') {
        const priorityOrder = { baja: 1, normal: 2, alta: 3, critica: 4 }
        valA = priorityOrder[a.prioridad] || 0
        valB = priorityOrder[b.prioridad] || 0
      } else if (sortField === 'estado') {
        valA = a.estado.toLowerCase()
        valB = b.estado.toLowerCase()
      } else if (sortField === 'fecha_entrega') {
        valA = a.fecha_entrega ? new Date(a.fecha_entrega).getTime() : 0
        valB = b.fecha_entrega ? new Date(b.fecha_entrega).getTime() : 0
      } else if (sortField === 'precio') {
        valA = a.precio ? parseFloat(a.precio.toString()) : 0
        valB = b.precio ? parseFloat(b.precio.toString()) : 0
      } else if (sortField === 'user') {
        valA = (a.user?.name || '').toLowerCase()
        valB = (b.user?.name || '').toLowerCase()
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

  const totalPages = Math.ceil(filteredAndSortedPedidos.length / 5)
  const displayedPedidos = filteredAndSortedPedidos.slice(
    (currentPage - 1) * 5,
    currentPage * 5
  )

  return (
    <RoleGuard allowedRoles={['admin', 'supervisor', 'encargado', 'vendedor', 'disenador']}>
      <main className="page-content p-6 text-white">
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
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold text-xs uppercase tracking-wider select-none">
                    <th onClick={() => handleSort('cliente')} className="px-6 py-4 cursor-pointer hover:text-white transition text-left">
                      Cliente {sortField === 'cliente' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th onClick={() => handleSort('productos')} className="px-6 py-4 text-center cursor-pointer hover:text-white transition">
                      Productos {sortField === 'productos' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th onClick={() => handleSort('prioridad')} className="px-6 py-4 cursor-pointer hover:text-white transition text-left">
                      Prioridad {sortField === 'prioridad' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th onClick={() => handleSort('estado')} className="px-6 py-4 cursor-pointer hover:text-white transition text-left">
                      Estado {sortField === 'estado' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th onClick={() => handleSort('fecha_entrega')} className="px-6 py-4 cursor-pointer hover:text-white transition text-left">
                      Fecha Entrega {sortField === 'fecha_entrega' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th onClick={() => handleSort('precio')} className="px-6 py-4 text-right cursor-pointer hover:text-white transition">
                      Precio {sortField === 'precio' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                    <th onClick={() => handleSort('user')} className="px-6 py-4 cursor-pointer hover:text-white transition text-left">
                      Registrado por {sortField === 'user' ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
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
                          {pedido.comentario && (
                            <span className="text-[11px] text-slate-400 mt-1 italic flex items-center gap-1 max-w-xs truncate" title={pedido.comentario}>
                              <span>💬</span>
                              <span>{pedido.comentario}</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        {pedido.productos && pedido.productos.length > 0 ? (
                          <div className="flex flex-col gap-1.5 items-stretch justify-center">
                            {pedido.productos.slice(0, 2).map((prod) => {
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
                            {pedido.productos.length > 2 && (
                              <span className="text-[10px] text-slate-500 font-bold text-center mt-0.5 select-none">
                                + {pedido.productos.length - 2} más
                              </span>
                            )}
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
                            onClick={() => handleOpenViewModal(pedido)}
                            className="text-blue-400 hover:text-blue-300 p-1 hover:bg-blue-500/10 rounded transition"
                            title="Ver detalles del pedido (Trello)"
                          >
                            👁️
                          </button>
                          <button
                            onClick={() => handleOpenPaymentsModal(pedido)}
                            className="text-emerald-400 hover:text-emerald-300 p-1 hover:bg-emerald-500/10 rounded transition"
                            title="Gestionar pagos del pedido"
                          >
                            💵
                          </button>
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

              {/* Controles de Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/20 px-6 py-4">
                  <div className="text-xs text-slate-400">
                    Mostrando <span className="font-semibold text-white">{(currentPage - 1) * 5 + 1}</span> a <span className="font-semibold text-white">{Math.min(currentPage * 5, filteredAndSortedPedidos.length)}</span> de <span className="font-semibold text-white">{filteredAndSortedPedidos.length}</span> pedidos
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(1)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-xs text-slate-200 transition font-medium"
                    >
                      ⏮️
                    </button>
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-xs text-slate-200 transition font-medium"
                    >
                      Anterior
                    </button>
                    <span className="px-3 py-1 bg-slate-900 border border-slate-850 rounded text-xs text-slate-300 font-semibold self-center">
                      Pág. {currentPage} de {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-xs text-slate-200 transition font-medium"
                    >
                      Siguiente
                    </button>
                    <button
                      type="button"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-xs text-slate-200 transition font-medium"
                    >
                      ⏭️
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal de Creación (Wizard) */}
        {isCreateModalOpen && (
          <>
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm" onClick={() => {
              setIsCreateModalOpen(false)
              setWizardStep('select_client')
              setSelectedWizardClient(null)
              setCreatedPedidoResult(null)
            }} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
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
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Tipo de Cobro / Pago
                      </label>
                      <select
                        value={formData.tipo_pago}
                        onChange={(e) => setFormData({ ...formData, tipo_pago: e.target.value as 'unico' | 'parcial' })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                      >
                        <option value="unico">Pago Único</option>
                        <option value="parcial">Pagos Parciales (Abonos)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Comentario
                    </label>
                    <textarea
                      placeholder="Escribe un comentario o notas adicionales para el pedido..."
                      value={formData.comentario}
                      onChange={(e) => setFormData({ ...formData, comentario: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition h-20 resize-none"
                    />
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
                  {formData.selectedProductIds.length > 0 && currentUser?.role !== 'vendedor' && (
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

                                        {currentUser && ['admin', 'encargado'].includes(currentUser.role) ? (
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
          </>
        )}

        {/* Modal de Edición */}
        {isEditModalOpen && selectedPedido && (
          <>
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
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
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Tipo de Cobro / Pago
                    </label>
                    <select
                      value={formData.tipo_pago}
                      onChange={(e) => setFormData({ ...formData, tipo_pago: e.target.value as 'unico' | 'parcial' })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    >
                      <option value="unico">Pago Único</option>
                      <option value="parcial">Pagos Parciales (Abonos)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Comentario
                  </label>
                  <textarea
                    placeholder="Escribe un comentario o notas adicionales para el pedido..."
                    value={formData.comentario}
                    onChange={(e) => setFormData({ ...formData, comentario: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition h-20 resize-none mb-4"
                  />
                </div>

                {/* Selección de Productos */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
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
                {/* Etapas de Fabricación y Asignación */}
                {currentUser?.role !== 'vendedor' && (
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

                                        {currentUser && ['admin', 'encargado'].includes(currentUser.role) ? (
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
                )}

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
          </>
        )}

        {/* Modal de Creación de Cliente Rápido */}
        {isCreateClienteModalOpen && (
          <>
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsCreateClienteModalOpen(false)} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150 text-slate-300">
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
          </>
        )}

        {/* Modal de Gestión de Pagos */}
        {isPaymentsModalOpen && selectedPedidoForPayments && (
          <>
            <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsPaymentsModalOpen(false)} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => setIsPaymentsModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition text-lg"
                title="Cerrar"
              >
                ✕
              </button>

              <h2 className="text-xl font-bold text-white mb-1">
                Gestión de Pagos: {selectedPedidoForPayments.codigo}
              </h2>
              <p className="text-xs text-slate-400 mb-5">
                Cliente: <span className="font-semibold text-slate-200">{selectedPedidoForPayments.cliente?.nombre_cliente} ({selectedPedidoForPayments.cliente?.nombre_empresa})</span> |
                Tipo: <span className="ml-1 uppercase text-blue-400 font-bold">{selectedPedidoForPayments.tipo_pago === 'unico' ? 'Pago Único' : 'Pagos Parciales'}</span>
              </p>

              {paymentError && (
                <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 p-3 rounded-lg text-xs font-semibold">
                  ⚠️ {paymentError}
                </div>
              )}
              {paymentSuccess && (
                <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-3 rounded-lg text-xs font-semibold">
                  ✓ {paymentSuccess}
                </div>
              )}

              {/* Grid Principal */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Lado Izquierdo: Resumen y Listado de Pagos */}
                <div className="lg:col-span-7 space-y-5 text-left">

                  {/* Resumen Financiero */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/60 space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Resumen de Cobros</h3>
                    <div className="grid grid-cols-3 gap-2 text-center sm:text-left">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Pedido</span>
                        <span className="text-sm font-bold text-white font-mono">
                          $ {Number(selectedPedidoForPayments.precio || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block font-semibold">Cobrado</span>
                        <span className="text-sm font-bold text-emerald-400 font-mono">
                          $ {Number(selectedPedidoForPayments.monto_pagado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block font-semibold">Saldo Pendiente</span>
                        <span className="text-sm font-bold text-amber-500 font-mono">
                          $ {Number(selectedPedidoForPayments.saldo_pendiente || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Barra de progreso */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                        <span>Progreso de cobro</span>
                        <span>{selectedPedidoForPayments.porcentaje_pagado || 0}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2">
                        <div
                          className="bg-emerald-500 h-2 rounded-full transition-all duration-350"
                          style={{ width: `${Math.min(100, selectedPedidoForPayments.porcentaje_pagado || 0)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Listado / Historial de Pagos */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Historial de Transacciones</h3>
                    {pedidoPayments.length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-4 text-center bg-slate-950/20 rounded-lg border border-slate-850">
                        No hay cobros registrados para este pedido.
                      </p>
                    ) : (
                      <div className="max-h-[220px] overflow-y-auto border border-slate-800/80 rounded-lg divide-y divide-slate-850">
                        {pedidoPayments.map((pago) => (
                          <div
                            key={pago.id}
                            className={`p-3 text-xs flex justify-between items-center transition ${pago.estado === 'anulado' ? 'bg-slate-950/20 opacity-50' : 'bg-slate-900/40 hover:bg-slate-950/20'
                              }`}
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-white">
                                  $ {Number(pago.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                                <span className="text-[9px] px-1 rounded bg-slate-850 border border-slate-800 text-slate-300 font-semibold uppercase">
                                  {pago.medio_pago || pago.medio}
                                </span>
                                {pago.estado === 'anulado' ? (
                                  <span className="text-[8px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1 rounded">ANULADO</span>
                                ) : (
                                  <span className="text-[8px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 rounded">{pago.tipo_cobro}</span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-2">
                                <span>Fecha: {pago.fecha_pago ? new Date(pago.fecha_pago + 'T00:00:00').toLocaleDateString('es-AR') : new Date(pago.created_at).toLocaleDateString('es-AR')}</span>
                                <span>•</span>
                                <span>Por: {pago.vendedor?.name || 'Sistema'}</span>
                              </div>
                              {pago.observaciones && (
                                <p className="text-[10px] text-slate-400 italic mt-0.5">Nota: "{pago.observaciones}"</p>
                              )}
                            </div>

                            {/* Botón para anular pago */}
                            {pago.estado !== 'anulado' && currentUser && ['admin', 'encargado', 'vendedor'].includes(currentUser.role) && (
                              <button
                                onClick={() => handleAnnulPayment(pago.id)}
                                className="text-[10px] text-rose-455 hover:text-rose-300 font-bold hover:bg-rose-500/10 px-2 py-1 rounded transition"
                                title="Anular Cobro"
                              >
                                Anular
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Lado Derecho: Registrar Nuevo Pago */}
                <div className="lg:col-span-5 bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-left">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">Registrar Nuevo Cobro</h3>

                  {selectedPedidoForPayments.tipo_pago === 'unico' && pedidoPayments.some(p => p.estado === 'pagado') ? (
                    <div className="text-xs text-slate-500 italic py-8 text-center">
                      🔒 Este pedido es de **Pago Único** y ya tiene un cobro activo registrado. No es posible agregar más cobros.
                    </div>
                  ) : (selectedPedidoForPayments.saldo_pendiente ?? 0) <= 0 ? (
                    <div className="text-xs text-slate-500 italic py-8 text-center">
                      🎉 Este pedido se encuentra **completamente cobrado**. Saldo pendiente: $0.00.
                    </div>
                  ) : (
                    <form onSubmit={handleCreatePayment} className="space-y-3.5">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          Monto a Cobrar ($) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          max={selectedPedidoForPayments.saldo_pendiente ?? 0}
                          value={paymentFormData.monto}
                          onChange={(e) => setPaymentFormData({ ...paymentFormData, monto: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                          placeholder="Ej. 500"
                        />
                        <span className="text-[9px] text-slate-500 block mt-0.5">Máximo disponible: ${selectedPedidoForPayments.saldo_pendiente ?? 0}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                            Medio de Pago *
                          </label>
                          <select
                            value={paymentFormData.medio_pago}
                            onChange={(e) => setPaymentFormData({ ...paymentFormData, medio_pago: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                          >
                            <option value="efectivo">💵 Efectivo</option>
                            <option value="transferencia">🏦 Transferencia</option>
                            <option value="tarjeta">💳 Tarjeta</option>
                            <option value="mercado_pago">📱 Mercado Pago</option>
                            <option value="otro">⚙️ Otro</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                            Tipo de Cobro *
                          </label>
                          <select
                            value={paymentFormData.tipo_cobro}
                            onChange={(e) => setPaymentFormData({ ...paymentFormData, tipo_cobro: e.target.value as any })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                          >
                            {selectedPedidoForPayments.tipo_pago === 'unico' ? (
                              <option value="unico">Cobro Único</option>
                            ) : (
                              <>
                                <option value="seña">Seña / Adelanto</option>
                                <option value="parcial">Abono Parcial</option>
                                <option value="saldo">Saldo Final</option>
                              </>
                            )}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          Fecha de Pago
                        </label>
                        <input
                          type="date"
                          value={paymentFormData.fecha_pago}
                          onChange={(e) => setPaymentFormData({ ...paymentFormData, fecha_pago: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          Observaciones / Notas
                        </label>
                        <textarea
                          rows={2}
                          value={paymentFormData.observaciones}
                          onChange={(e) => setPaymentFormData({ ...paymentFormData, observaciones: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition resize-none"
                          placeholder="Detalles de la transferencia, banco, etc."
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmittingPayment}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition active:scale-[0.98] disabled:opacity-50"
                      >
                        {isSubmittingPayment ? 'Registrando...' : 'Registrar Cobro'}
                      </button>
                    </form>
                  )}
                </div>

              </div>

              <div className="flex items-center justify-end pt-4 border-t border-slate-800 mt-5">
                <button
                  type="button"
                  onClick={() => setIsPaymentsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cerrar
                </button>
              </div>

            </div>
          </>
        )}

        {isViewModalOpen && selectedPedidoForView && (() => {
          const pds = selectedPedidoForView.productos || []
          const displayedProducts = verTodosProductos ? pds : pds.slice(0, 2)

          return (
            <>
              <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm" onClick={() => { setIsViewModalOpen(false); setSelectedPedidoForView(null); }} />
              <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto flex flex-col animate-in fade-in zoom-in-95 duration-150">
                {/* Header de la Tarjeta Trello */}
                <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4">
                  <div className="text-left">
                    {/* Estado del Pedido como Dropdown */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado:</span>
                      <select
                        value={selectedPedidoForView.estado}
                        onChange={async (e) => {
                          try {
                            const newEstado = e.target.value
                            const updated = await updatePedido(selectedPedidoForView.id, { estado: newEstado })
                            setSelectedPedidoForView(updated)
                            setPedidos(prev => prev.map(p => p.id === updated.id ? updated : p))
                          } catch (err: any) {
                            console.error("Error al actualizar estado:", err)
                          }
                        }}
                        className="bg-slate-950 border border-slate-800 text-xs font-semibold text-blue-400 focus:outline-none focus:border-blue-500 rounded px-2 py-0.5"
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="en_progreso">En Progreso</option>
                        <option value="completado">Completado</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    </div>

                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      📋 {selectedPedidoForView.codigo}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Cliente: <span className="text-slate-200 font-bold">{selectedPedidoForView.cliente?.nombre_cliente}</span> ({selectedPedidoForView.cliente?.nombre_empresa})
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setIsViewModalOpen(false)
                      setSelectedPedidoForView(null)
                    }}
                    className="text-slate-400 hover:text-white transition text-lg p-1 hover:bg-slate-800 rounded-lg"
                    title="Cerrar"
                  >
                    ✕
                  </button>
                </div>

                {/* Cuerpo Principal: Dos Columnas */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-grow overflow-y-auto">
                  {/* Columna Izquierda (8 cols) */}
                  <div className="md:col-span-8 space-y-6 text-left">
                    {/* Sección: Descripción */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <span>📝</span> Descripción
                        </h3>
                        <button
                          type="button"
                          onClick={() => setIsEditCommentActive(!isEditCommentActive)}
                          className="text-xs bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 px-2 py-1 rounded transition font-semibold"
                        >
                          {isEditCommentActive ? 'Cancelar' : 'Editar'}
                        </button>
                      </div>

                      {isEditCommentActive ? (
                        <div className="space-y-2">
                          <textarea
                            value={tempComentario || ''}
                            onChange={(e) => setTempComentario(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500 transition h-24"
                            placeholder="Agregar una descripción más detallada..."
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const updated = await updatePedido(selectedPedidoForView.id, { comentario: tempComentario })
                                  setSelectedPedidoForView(updated)
                                  setPedidos(prev => prev.map(p => p.id === updated.id ? updated : p))
                                  setIsEditCommentActive(false)
                                } catch (err: any) {
                                  console.error("Error al actualizar comentario/descripción:", err)
                                }
                              }}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold"
                            >
                              Guardar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-950/40 border border-slate-855 p-4 rounded-xl">
                          {selectedPedidoForView.comentario ? (
                            <p className="text-sm text-slate-300 whitespace-pre-wrap">{selectedPedidoForView.comentario}</p>
                          ) : (
                            <p className="text-sm text-slate-500 italic">No hay descripción añadida. Haz clic en Editar para agregar una.</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Sección: Productos y sus Etapas */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>📦</span> Productos y Etapas de Fabricación
                      </h3>

                      {pds.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">No hay productos asociados a este pedido.</p>
                      ) : (
                        <div className="space-y-3">
                          {displayedProducts.map((prod) => {
                            const prodStages = allStages.filter(s => s.producto_id === prod.id).sort((a, b) => a.orden - b.orden)
                            const qty = prod.pivot?.cantidad || 1
                            const currentInfo = getProductCurrentStage(selectedPedidoForView.id, prodStages, taskAssignments)
                            const isAccordionOpen = openAccordions[prod.id] || false

                            return (
                              <div key={prod.id} className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-3 transition hover:border-slate-750">
                                {/* Cabecera del producto */}
                                <div className="flex items-center justify-between">
                                  <div className="text-left">
                                    <span className="text-sm font-bold text-white block">{prod.nombre}</span>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase">Cantidad: {qty}</span>
                                  </div>

                                  {/* Etapa actual a la vista */}
                                  {currentInfo ? (
                                    <div className="text-right">
                                      <span className="text-[10px] text-slate-500 uppercase block font-semibold leading-none mb-1">Etapa Actual</span>
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 capitalize">
                                        {currentInfo.stage.nombre} ({currentInfo.task?.estado || 'pendiente'})
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-500 italic">Sin etapas</span>
                                  )}
                                </div>

                                {/* Botón del acordeón */}
                                {prodStages.length > 0 && (
                                  <div className="border-t border-slate-850 pt-2.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenAccordions(prev => ({
                                          ...prev,
                                          [prod.id]: !isAccordionOpen
                                        }))
                                      }}
                                      className="w-full flex items-center justify-between text-xs text-blue-400 hover:text-blue-300 font-semibold"
                                    >
                                      <span>{isAccordionOpen ? '🔼 Ocultar flujo de etapas' : '🔽 Ver flujo de etapas completo (Grafo)'}</span>
                                      <span className="text-[10px] bg-slate-800 text-slate-350 px-2 py-0.5 rounded-full">{prodStages.length} etapas</span>
                                    </button>

                                    {/* Contenedor del Grafo dentro del Acordeón */}
                                    {isAccordionOpen && (
                                      <div className="mt-3 p-4 bg-slate-950/80 rounded-xl border border-slate-850 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Grafo de Progreso de Fabricación</span>

                                        <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-2 overflow-x-auto py-2">
                                          {prodStages.map((stage, idx) => {
                                            const task = taskAssignments.find(t => t.pedido_id === selectedPedidoForView.id && t.etapa_id === stage.id)
                                            const state = task?.estado || 'pendiente'

                                            let nodeBg = 'bg-slate-900 border-slate-800 text-slate-400'
                                            let stateLabel = 'Pendiente'
                                            if (state === 'completado') {
                                              nodeBg = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                              stateLabel = 'Completado'
                                            } else if (state === 'en_progreso') {
                                              nodeBg = 'bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.15)] animate-pulse'
                                              stateLabel = 'En Progreso'
                                            } else if (state === 'bloqueada') {
                                              nodeBg = 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                              stateLabel = 'Bloqueada'
                                            }

                                            return (
                                              <div key={stage.id} className="flex flex-col md:flex-row md:items-center flex-shrink-0">
                                                <div className={`border p-2.5 rounded-xl text-center min-w-[130px] ${nodeBg}`}>
                                                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">Etapa {stage.orden}</span>
                                                  <span className="text-xs font-bold block truncate max-w-[120px]" title={stage.nombre}>{stage.nombre}</span>
                                                  <span className="text-[9px] font-medium block mt-1 uppercase">{stateLabel}</span>
                                                </div>

                                                {idx < prodStages.length - 1 && (
                                                  <div className="flex items-center justify-center py-1 md:py-0 md:px-2">
                                                    <span className="text-slate-600 font-bold hidden md:inline">➔</span>
                                                    <span className="text-slate-600 font-bold md:hidden">↓</span>
                                                  </div>
                                                )}
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}

                          {pds.length > 2 && (
                            <div className="flex justify-center pt-2">
                              <button
                                type="button"
                                onClick={() => setVerTodosProductos(!verTodosProductos)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 text-xs font-bold rounded-lg transition"
                              >
                                {verTodosProductos ? 'Mostrar menos 🔼' : 'Ver todos los productos 🔽'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Columna Derecha - Comentarios y Actividad */}
                  <div className="md:col-span-4 border-t md:border-t-0 md:border-l border-slate-800 pt-6 md:pt-0 md:pl-6 flex flex-col max-h-[60vh] md:max-h-full">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3 text-left">
                      <span>💬</span> Comentarios y Actividad
                    </h3>

                    <div className="space-y-2 mb-4 text-left">
                      <textarea
                        value={nuevoComentario}
                        onChange={(e) => setNuevoComentario(e.target.value)}
                        placeholder="Escribe un comentario..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-550 focus:outline-none focus:border-blue-500 transition resize-none h-16"
                      />
                      <button
                        type="button"
                        disabled={!nuevoComentario.trim() || isSubmittingComment}
                        onClick={async () => {
                          try {
                            setIsSubmittingComment(true)
                            const comment = await createPedidoComentario(selectedPedidoForView.id, nuevoComentario)
                            const updatedComments = [comment, ...(selectedPedidoForView.comentarios || [])]
                            const updatedPedido = { ...selectedPedidoForView, comentarios: updatedComments }
                            setSelectedPedidoForView(updatedPedido)
                            setPedidos(prev => prev.map(p => p.id === updatedPedido.id ? updatedPedido : p))
                            setNuevoComentario('')
                          } catch (err: any) {
                            console.error("Error al publicar comentario:", err)
                          } finally {
                            setIsSubmittingComment(false)
                          }
                        }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-850 disabled:text-slate-650 text-white rounded text-xs font-semibold transition"
                      >
                        {isSubmittingComment ? 'Publicando...' : 'Comentar'}
                      </button>
                    </div>

                    <div className="space-y-3 overflow-y-auto flex-grow pr-1 max-h-[30vh] md:max-h-[45vh]">
                      {(!selectedPedidoForView.comentarios || selectedPedidoForView.comentarios.length === 0) ? (
                        <p className="text-xs text-slate-500 italic text-center py-4">No hay comentarios en este pedido todavía.</p>
                      ) : (
                        selectedPedidoForView.comentarios.map((c) => (
                          <div key={c.id} className="bg-slate-950/30 border border-slate-850/50 p-2.5 rounded-lg text-left space-y-1.5">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-bold text-slate-350">{c.user?.name || 'Usuario'}</span>
                              <span className="text-slate-500 font-mono">
                                {new Date(c.created_at).toLocaleDateString('es-AR')} {new Date(c.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-200 leading-relaxed break-words">{c.cuerpo}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )
        })()}
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

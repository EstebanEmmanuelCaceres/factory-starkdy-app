'use client'

import { useEffect, useState, useRef } from 'react'
import RoleGuard from '@/components/RoleGuard'
import Modal from '@/components/Modal'
import PedidoDetailModal from '@/components/PedidoDetailModal'
import OrderImageGallery from '@/components/OrderImageGallery'
import { fetchUsers, getStoredUser, type User } from '@/lib/auth'
import { fetchPedidos, updatePedido, createPedidoComentario, type Pedido, type PedidoFilters } from '@/lib/pedidos'

export default function DashboardPage() {
  const [users, setUsers] = useState<User[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingPedidos, setLoadingPedidos] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  // Modal de Detalle Completo del Pedido y Galería de Imágenes
  const [selectedPedidoForCommentModal, setSelectedPedidoForCommentModal] = useState<Pedido | null>(null)
  const [isImagesModalOpen, setIsImagesModalOpen] = useState(false)
  const [selectedPedidoForImages, setSelectedPedidoForImages] = useState<Pedido | null>(null)
  const [nuevoComentario, setNuevoComentario] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)

  // Meses y Años para el filtro de comisiones
  const monthsList = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
  ]

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-12

  const [selectedCommissionMonth, setSelectedCommissionMonth] = useState<number>(currentMonth)
  const [selectedCommissionYear, setSelectedCommissionYear] = useState<number>(currentYear)

  const yearsList = Array.from({ length: 7 }, (_, i) => currentYear - 5 + i)

  // Filtros de búsqueda para Pedidos
  const [filters, setFilters] = useState<PedidoFilters>({
    search: '',
    estado: '',
    fecha_desde: '',
    fecha_hasta: ''
  })

  // Estado para ordenamiento ASC/DESC
  const [sortField, setSortField] = useState<'created_at' | 'cliente' | 'estado'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Paginación para vista Mobile de Pedidos y Completados por Cobrar (Límite de 5 tarjetas por página)
  const [mobilePedidosPage, setMobilePedidosPage] = useState(1)
  const [mobileUnpaidPage, setMobileUnpaidPage] = useState(1)

  const isFirstRender = useRef(true)

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else {
      setLoadingUsers(true)
      setLoadingPedidos(true)
    }
    setError('')

    try {
      const user = getStoredUser()
      setCurrentUser(user)

      if (user?.role !== 'vendedor') {
        const usersData = await fetchUsers()
        setUsers(usersData)
      }
      const pedidosData = await fetchPedidos(filters)
      setPedidos(pedidosData)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar los datos'
      setError(msg)
    } finally {
      setLoadingUsers(false)
      setLoadingPedidos(false)
      setRefreshing(false)
    }
  }

  // Carga inicial de usuarios y pedidos
  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recargar pedidos cuando cambien los filtros
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    const reloadPedidos = async () => {
      setLoadingPedidos(true)
      try {
        const pedidosData = await fetchPedidos(filters)
        setPedidos(pedidosData)
      } catch (err: unknown) {
        console.error('Error al filtrar pedidos:', err)
      } finally {
        setLoadingPedidos(false)
      }
    }
    reloadPedidos()
  }, [filters])

  const handleFilterChange = (key: keyof PedidoFilters, value: string) => {
    setMobilePedidosPage(1)
    setFilters((prev) => ({
      ...prev,
      [key]: value
    }))
  }

  const handleClearFilters = () => {
    setMobilePedidosPage(1)
    setFilters({
      search: '',
      estado: '',
      fecha_desde: '',
      fecha_hasta: ''
    })
  }

  // Restricciones por rol:
  // - Vendedor / Diseñador: solo ven sus pedidos.
  // - Operarios: ven únicamente los pedidos fuera del estado 'pendiente'.
  // - Encargado / Supervisor / Admin: ven todos los pedidos (incluyendo los pendientes de todos los vendedores).
  const isVendedor = currentUser?.role === 'vendedor' || currentUser?.role === 'disenador'
  const isEncargado = currentUser?.role === 'encargado'
  const isOperativo = ['operario', 'operator'].includes(currentUser?.role || '')

  const scopedPedidos = isVendedor && currentUser
    ? pedidos.filter(p => p.user_id === currentUser.id)
    : isOperativo
    ? pedidos.filter(p => p.estado !== 'pendiente')
    : pedidos

  const sortedPedidos = [...scopedPedidos].sort((a, b) => {
    let valA: any = (a as any)[sortField]
    let valB: any = (b as any)[sortField]

    if (sortField === 'cliente') {
      valA = (a.cliente?.nombre_cliente || a.cliente?.nombre_empresa || '').toLowerCase()
      valB = (b.cliente?.nombre_cliente || b.cliente?.nombre_empresa || '').toLowerCase()
    } else if (sortField === 'created_at') {
      valA = new Date(a.created_at).getTime()
      valB = new Date(b.created_at).getTime()
    } else if (sortField === 'estado') {
      valA = (a.estado || '').toLowerCase()
      valB = (b.estado || '').toLowerCase()
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1
    return 0
  })

  // Pedidos completados en fabricación con saldo pendiente de cobro
  const completedUnpaidPedidos = scopedPedidos.filter((p) => {
    if (p.estado !== 'completado') return false
    const precio = Number(p.precio) || 0
    const paidAmount = p.pagos
      ? p.pagos.filter(pay => pay.estado === 'pagado').reduce((s, pay) => s + Number(pay.monto), 0)
      : (p.pago && p.pago.estado === 'pagado' ? Number(p.pago.monto) : 0)
    return (precio - paidAmount) > 0
  })

  // Cálculos de cobros y totales acumulados
  const totalCobrado = scopedPedidos.reduce((sum, p) => {
    const paidAmount = p.pagos
      ? p.pagos.filter(pago => pago.estado === 'pagado').reduce((s, pago) => s + Number(pago.monto), 0)
      : (p.pago && p.pago.estado === 'pagado' ? Number(p.pago.monto) : 0)
    return sum + paidAmount
  }, 0)

  const totalPorCobrar = scopedPedidos.reduce((sum, p) => {
    const precio = Number(p.precio) || 0
    const paidAmount = p.pagos
      ? p.pagos.filter(pago => pago.estado === 'pagado').reduce((s, pago) => s + Number(pago.monto), 0)
      : (p.pago && p.pago.estado === 'pagado' ? Number(p.pago.monto) : 0)
    const pending = Math.max(0, precio - paidAmount)
    return sum + pending
  }, 0)

  // Cálculo de Cobros en el Mes/Año seleccionado y Comisión (2%)
  const selectedMonthKey = `${selectedCommissionYear}-${String(selectedCommissionMonth).padStart(2, '0')}`

  const totalCobradoMes = scopedPedidos.reduce((sum, p) => {
    const payments = p.pagos || (p.pago ? [p.pago] : [])
    const monthPayments = payments.filter((pago) => {
      if (pago.estado !== 'pagado') return false
      const rawDate = pago.fecha_pago || pago.created_at || pago.pagado_at
      if (!rawDate) return false
      const dateStr = rawDate.includes(' ') && !rawDate.includes('T') ? rawDate.replace(' ', 'T') : rawDate
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return false
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return monthKey === selectedMonthKey
    })
    return sum + monthPayments.reduce((s, pago) => s + Number(pago.monto), 0)
  }, 0)

  const comisionMes = totalCobradoMes * 0.02

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(amount)
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completado':
        return 'Completado'
      case 'completado_pd':
        return 'Completado - Pend. Pago (PD)'
      case 'enviado_faltante':
        return 'Enviado con Faltante'
      case 'en_progreso':
        return 'En Progreso'
      case 'cancelado':
        return 'Cancelado'
      case 'pendiente':
      default:
        return 'Pendiente'
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completado':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
      case 'completado_pd':
        return 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
      case 'enviado_faltante':
        return 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
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
    <RoleGuard allowedRoles={['admin', 'supervisor', 'encargado', 'vendedor', 'disenador']} fallbackHref="/dashboard/tareas">
      <main className="page-content p-6 max-w-7xl mx-auto text-white space-y-8">
        {/* Cabecera */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              {isVendedor ? `Dashboard de Vendedor - ${currentUser?.name || ''}` : 'Dashboard General'}
            </h1>
            <p className="text-sm text-slate-400">
              {isVendedor
                ? 'Métricas personales de cobros, comisiones y seguimiento de tus pedidos.'
                : 'Resumen y métricas en tiempo real de fabricación y cobros.'}
            </p>
          </div>
          <button
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium px-4 py-2 rounded-lg shadow transition hover:scale-[1.02] active:scale-[0.98]"
            onClick={() => loadData(true)}
            disabled={loadingUsers || loadingPedidos || refreshing}
          >
            {refreshing ? 'Actualizando...' : '🔄 Actualizar Todo'}
          </button>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-200 px-4 py-3 rounded-lg flex items-center gap-2">
            <span>❌</span>
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Tarjetas de Métricas de Cobros y Comisiones (Solo para roles con métricas financieras) */}
        {!isEncargado && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Plata Cobrada */}
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/20 rounded-2xl p-6 shadow-xl flex items-center gap-5 hover:border-emerald-500/40 transition duration-300">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none"></div>
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-3xl shadow-inner select-none">
                💵
              </div>
              <div>
                <span className="block text-xs font-semibold text-emerald-400 uppercase tracking-widest">Plata Cobrada</span>
                <span className="block text-2xl md:text-3xl font-black text-white mt-1 font-mono">
                  {loadingPedidos ? 'Cargando...' : formatCurrency(totalCobrado)}
                </span>
                <span className="block text-xs text-slate-500 mt-1.5">Pagos exitosos acumulados</span>
              </div>
            </div>

            {/* Plata por Cobrar */}
            <div className="relative overflow-hidden bg-gradient-to-br from-amber-950/30 to-slate-900 border border-amber-500/20 rounded-2xl p-6 shadow-xl flex items-center gap-5 hover:border-amber-500/40 transition duration-300">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none"></div>
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-3xl shadow-inner select-none">
                ⏳
              </div>
              <div>
                <span className="block text-xs font-semibold text-amber-400 uppercase tracking-widest">Plata por Cobrar</span>
                <span className="block text-2xl md:text-3xl font-black text-white mt-1 font-mono">
                  {loadingPedidos ? 'Cargando...' : formatCurrency(totalPorCobrar)}
                </span>
                <span className="block text-xs text-slate-500 mt-1.5">Saldos pendientes de cobro</span>
              </div>
            </div>

            {/* Caja de Comisión (2% del mes) */}
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-950/40 to-slate-900 border border-blue-500/20 rounded-2xl p-6 shadow-xl flex flex-col justify-between hover:border-blue-500/40 transition duration-300">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-blue-500/10 rounded-full blur-xl pointer-events-none"></div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xl shadow-inner select-none">
                    💼
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-blue-400 uppercase tracking-wider">Comisión (2%)</span>
                    <span className="block text-[10px] text-slate-400">Sobre cobrado del mes</span>
                  </div>
                </div>

                {/* Selectores de Mes y Año */}
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedCommissionMonth}
                    onChange={(e) => setSelectedCommissionMonth(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none transition cursor-pointer capitalize"
                  >
                    {monthsList.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedCommissionYear}
                    onChange={(e) => setSelectedCommissionYear(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none transition cursor-pointer"
                  >
                    {yearsList.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <span className="block text-2xl md:text-3xl font-black text-white mt-1 font-mono">
                  {loadingPedidos ? 'Cargando...' : formatCurrency(comisionMes)}
                </span>
                <span className="block text-[11px] text-slate-400 mt-1.5 truncate">
                  2% de {formatCurrency(totalCobradoMes)} cobrados en {monthsList.find(m => m.value === selectedCommissionMonth)?.label} {selectedCommissionYear}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Grid de Tablas: Pedidos Actuales + Completados por Cobrar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Tabla de Pedidos Actuales con Filtros integrados */}
          <div className={`${isEncargado ? 'lg:col-span-12' : 'lg:col-span-7'} bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col justify-between`}>
            {/* Cabecera y Filtros Integrados */}
            <div className="border-b border-slate-800 p-5 space-y-4 bg-slate-950/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <span>📋</span> Pedidos Actuales
                  </h2>
                  <span className="text-xs text-slate-400">
                    {scopedPedidos.length} {scopedPedidos.length === 1 ? 'pedido encontrado' : 'pedidos encontrados'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="text-xs bg-slate-950 hover:bg-slate-800 border border-slate-800 text-blue-400 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                    title="Alternar Orden Ascendente / Descendente"
                  >
                    <span>{sortOrder === 'asc' ? '⬆️ Ascendente' : '⬇️ Descendente'}</span>
                  </button>
                  {(filters.search || filters.estado || filters.fecha_desde || filters.fecha_hasta) && (
                    <button
                      onClick={handleClearFilters}
                      className="text-xs text-rose-400 hover:text-rose-300 font-medium underline transition self-start sm:self-auto"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              </div>

              {/* Barra de Filtros */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {/* Buscador de Cliente / Empresa */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Cliente y/o Empresa
                  </label>
                  <input
                    type="text"
                    placeholder="Buscar por cliente, empresa, email..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                {/* Estado de Fabricación */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Estado de Fabricación
                  </label>
                  <select
                    value={filters.estado}
                    onChange={(e) => handleFilterChange('estado', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                  >
                    <option value="">Todos los estados</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="en_progreso">En Progreso</option>
                    <option value="completado">Completado</option>
                    <option value="completado_pd">Completado - Pend. Pago (PD)</option>
                    <option value="enviado_faltante">Enviado con Faltante</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>

                {/* Fecha Creación Desde */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Creación Desde
                  </label>
                  <input
                    type="date"
                    value={filters.fecha_desde}
                    onChange={(e) => handleFilterChange('fecha_desde', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                {/* Fecha Creación Hasta */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Creación Hasta
                  </label>
                  <input
                    type="date"
                    value={filters.fecha_hasta}
                    onChange={(e) => handleFilterChange('fecha_hasta', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>
            </div>
            <div className="panel-body p-0 flex-grow">
              {loadingPedidos ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                  <span className="text-sm">Cargando pedidos...</span>
                </div>
              ) : sortedPedidos.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
                  <span className="text-4xl">📋</span>
                  <span className="text-sm font-medium">No se encontraron pedidos con los filtros seleccionados</span>
                </div>
              ) : (
                <div>
                  {/* VISTA EN TARJETAS PARA MOBILE (< md) CON LÍMITE DE 5 POR PÁGINA */}
                  <div className="md:hidden space-y-3 p-3">
                    <div className="max-h-[420px] overflow-y-auto space-y-3 pr-1">
                      {sortedPedidos
                        .slice((mobilePedidosPage - 1) * 5, mobilePedidosPage * 5)
                        .map((pedido) => {
                          const coverUrl =
                            pedido.imagen_principal?.url ||
                            pedido.imagenes?.find((img) => img.es_principal)?.url ||
                            pedido.imagenes?.[0]?.url ||
                            pedido.productos?.find((prod) => prod.imagen_principal?.url)?.imagen_principal?.url ||
                            pedido.productos?.[0]?.imagen_principal?.url ||
                            pedido.productos?.[0]?.imagenes?.[0]?.url

                          return (
                            <div key={pedido.id} className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-3.5 space-y-2.5 shadow-md text-left">
                              {/* Header */}
                              <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2">
                                <div className="flex items-center gap-2.5">
                                  {coverUrl ? (
                                    <div
                                      className="w-10 h-10 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 flex-shrink-0 relative shadow"
                                      title="Portada del pedido"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={coverUrl}
                                        alt={`Portada ${pedido.codigo}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  ) : (
                                    <div
                                      className="w-10 h-10 rounded-lg border border-slate-800/80 bg-slate-950/50 flex-shrink-0 flex items-center justify-center text-slate-600 text-xs"
                                      title="Sin imagen"
                                    >
                                      📷
                                    </div>
                                  )}
                                  <div>
                                    <h3 className="font-bold text-white text-sm block leading-tight">
                                      {pedido.cliente?.nombre_empresa || pedido.cliente?.nombre_cliente || 'Sin empresa'}
                                    </h3>
                                  </div>
                                </div>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide shrink-0 ${getStatusBadgeClass(pedido.estado)}`}>
                                  {getStatusLabel(pedido.estado)}
                                </span>
                              </div>

                              {/* Detalles: Fecha y Cobro */}
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-slate-500 text-[10px] block mb-0.5">Fecha Creación</span>
                                  <span className="text-slate-300 font-mono text-xs">
                                    {pedido.created_at ? new Date(pedido.created_at).toLocaleDateString('es-AR') : 'N/A'}
                                  </span>
                                </div>

                                {!isEncargado && (
                                  <div>
                                    <span className="text-slate-500 text-[10px] block mb-0.5">Cobro</span>
                                    {(() => {
                                      const precio = Number(pedido.precio) || 0
                                      const paidAmount = pedido.pagos
                                        ? pedido.pagos.filter((p: any) => p.estado === 'pagado').reduce((sum: number, p: any) => sum + Number(p.monto), 0)
                                        : (pedido.pago && pedido.pago.estado === 'pagado' ? Number(pedido.pago.monto) : 0)
                                      const pct = precio > 0 ? Math.round((paidAmount / precio) * 100) : 0
                                      const isFullyPaid = paidAmount >= precio

                                      if (paidAmount <= 0) {
                                        return <span className="text-slate-500 italic text-xs">Sin Pago</span>
                                      }
                                      return (
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <span className="font-bold text-white font-mono text-xs">{formatCurrency(paidAmount)}</span>
                                          <span className={`px-1.5 py-0.2 text-[9px] font-extrabold rounded ${isFullyPaid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                                            {isFullyPaid ? 'Cobrado' : `${pct}%`}
                                          </span>
                                        </div>
                                      )
                                    })()}
                                  </div>
                                )}
                              </div>

                              {/* Footer: Acciones */}
                              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                                <button
                                  onClick={() => setSelectedPedidoForCommentModal(pedido)}
                                  className="text-xs bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition font-medium"
                                >
                                  💬 Comentarios ({pedido.comentarios?.length || 0})
                                </button>
                              </div>
                            </div>
                          )
                        })}
                    </div>

                    {/* Paginación Mobile */}
                    {Math.ceil(sortedPedidos.length / 5) > 1 && (
                      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800 text-xs text-slate-400">
                        <span>Página {mobilePedidosPage} de {Math.ceil(sortedPedidos.length / 5)}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setMobilePedidosPage(prev => Math.max(prev - 1, 1))}
                            disabled={mobilePedidosPage === 1}
                            className="px-2.5 py-1 bg-slate-800 rounded disabled:opacity-40"
                          >
                            Anterior
                          </button>
                          <button
                            onClick={() => setMobilePedidosPage(prev => Math.min(prev + 1, Math.ceil(sortedPedidos.length / 5)))}
                            disabled={mobilePedidosPage >= Math.ceil(sortedPedidos.length / 5)}
                            className="px-2.5 py-1 bg-slate-800 rounded disabled:opacity-40"
                          >
                            Siguiente
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* VISTA EN TABLA PARA ESCRITORIO (hidden md:block) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                          <th className="px-4 py-3 text-center">Portada</th>
                          <th
                            onClick={() => {
                              if (sortField === 'cliente') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
                              else { setSortField('cliente'); setSortOrder('asc') }
                            }}
                            className="px-4 py-3 cursor-pointer hover:text-white transition"
                          >
                            Cliente / Empresa {sortField === 'cliente' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                          <th
                            onClick={() => {
                              if (sortField === 'created_at') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
                              else { setSortField('created_at'); setSortOrder('asc') }
                            }}
                            className="px-4 py-3 cursor-pointer hover:text-white transition"
                          >
                            Fecha Creación {sortField === 'created_at' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                          <th
                            onClick={() => {
                              if (sortField === 'estado') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
                              else { setSortField('estado'); setSortOrder('asc') }
                            }}
                            className="px-4 py-3 cursor-pointer hover:text-white transition"
                          >
                            Estado {sortField === 'estado' && (sortOrder === 'asc' ? '↑' : '↓')}
                          </th>
                          {!isEncargado && <th className="px-4 py-3">Dinero</th>}
                          <th className="px-4 py-3 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-sm">
                        {sortedPedidos.map((pedido) => {
                          const coverUrl =
                            pedido.imagen_principal?.url ||
                            pedido.imagenes?.find((img) => img.es_principal)?.url ||
                            pedido.imagenes?.[0]?.url ||
                            pedido.productos?.find((prod) => prod.imagen_principal?.url)?.imagen_principal?.url ||
                            pedido.productos?.[0]?.imagen_principal?.url ||
                            pedido.productos?.[0]?.imagenes?.[0]?.url

                          return (
                            <tr key={pedido.id} className="hover:bg-slate-800/40 text-slate-300 transition duration-150">
                              <td className="px-4 py-3">
                                {coverUrl ? (
                                  <div
                                    className="w-9 h-9 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 relative flex items-center justify-center shadow"
                                    title="Portada del pedido"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={coverUrl}
                                      alt={`Portada ${pedido.codigo}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div
                                    className="w-9 h-9 rounded-lg border border-slate-800/80 bg-slate-950/50 flex items-center justify-center text-slate-600 text-xs"
                                    title="Sin imagen"
                                  >
                                    📷
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-semibold text-white text-xs">
                                  {pedido.cliente?.nombre_empresa || pedido.cliente?.nombre_cliente || 'Sin empresa'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-300 font-mono">
                                {pedido.created_at ? new Date(pedido.created_at).toLocaleDateString('es-AR') : 'N/A'}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${getStatusBadgeClass(pedido.estado)}`}>
                                  {getStatusLabel(pedido.estado)}
                                </span>
                              </td>
                              {!isEncargado && (
                                <td className="px-4 py-3">
                                  {(() => {
                                    const precio = Number(pedido.precio) || 0
                                    const paidAmount = pedido.pagos
                                      ? pedido.pagos.filter((p: any) => p.estado === 'pagado').reduce((sum: number, p: any) => sum + Number(p.monto), 0)
                                      : (pedido.pago && pedido.pago.estado === 'pagado' ? Number(pedido.pago.monto) : 0)

                                    const pct = precio > 0 ? Math.round((paidAmount / precio) * 100) : 0

                                    if (paidAmount <= 0) {
                                      return <span className="text-slate-600 italic text-xs">Sin Pago</span>
                                    }

                                    const isFullyPaid = paidAmount >= precio
                                    return (
                                      <div className="flex flex-col">
                                        <span className="font-semibold text-white font-mono text-xs">{formatCurrency(paidAmount)}</span>
                                        <span className={`inline-flex items-center self-start px-1.5 py-0.5 rounded text-[9px] font-bold uppercase mt-0.5 ${isFullyPaid
                                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                          }`}>
                                          {isFullyPaid ? 'Cobrado' : `Parcial (${pct}%)`}
                                        </span>
                                      </div>
                                    )
                                  })()}
                                </td>
                              )}
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => setSelectedPedidoForCommentModal(pedido)}
                                  className="inline-flex items-center gap-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded text-xs font-bold transition shadow-sm"
                                  title="Ver detalle del pedido"
                                >
                                  👁️ Ver Pedido
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tabla Adyacente: Completados por Cobrar (Solo visible para roles con módulo financiero) */}
          {!isEncargado && (
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col">
              <div className="border-b border-slate-800 p-5 bg-slate-950/40">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>⚠️</span> Completados por Cobrar
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Clientes con fabricación terminada y saldo pendiente
                </p>
              </div>

              <div className="p-0 flex-grow">
                {loadingPedidos ? (
                  <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                    <span className="text-sm">Cargando...</span>
                  </div>
                ) : completedUnpaidPedidos.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3 px-4 text-center">
                    <span className="text-4xl">🎉</span>
                    <span className="text-xs font-medium text-slate-400">
                      No hay clientes con pedidos completados pendientes de cobro
                    </span>
                  </div>
                ) : (
                  <div>
                    {/* VISTA EN TARJETAS PARA MOBILE (< md) CON LÍMITE DE 5 POR PÁGINA */}
                    <div className="md:hidden space-y-3 p-3">
                      <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1">
                        {completedUnpaidPedidos
                          .slice((mobileUnpaidPage - 1) * 5, mobileUnpaidPage * 5)
                          .map((pedido) => {
                            const precio = Number(pedido.precio) || 0
                            const paidAmount = pedido.pagos
                              ? pedido.pagos.filter((pay: any) => pay.estado === 'pagado').reduce((s: number, pay: any) => s + Number(pay.monto), 0)
                              : (pedido.pago && pedido.pago.estado === 'pagado' ? Number(pedido.pago.monto) : 0)
                            const pending = Math.max(0, precio - paidAmount)

                            return (
                              <div
                                key={pedido.id}
                                className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-3.5 space-y-2 shadow-md text-left cursor-pointer hover:border-slate-700 transition"
                                onClick={() => setSelectedPedidoForCommentModal(pedido)}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <h3 className="font-bold text-white text-sm leading-tight mt-0.5">
                                      {pedido.cliente?.nombre_cliente || 'Sin cliente'}
                                    </h3>
                                    <span className="text-xs text-slate-400 block">{pedido.cliente?.nombre_empresa || 'Empresa'}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[10px] text-slate-400 block">Saldo Pendiente</span>
                                    <span className="font-bold text-amber-400 font-mono text-sm block">
                                      {formatCurrency(pending)}
                                    </span>
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-slate-800/80 flex justify-end">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedPedidoForCommentModal(pedido)
                                    }}
                                    className="inline-flex items-center gap-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 px-3 py-1 rounded text-xs font-semibold transition w-full justify-center"
                                  >
                                    💬 Ver / Comentar
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                      </div>

                      {/* Controles de Paginación Mobile */}
                      {completedUnpaidPedidos.length > 5 && (
                        <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs">
                          <span className="text-slate-400 font-medium text-[11px]">
                            {((mobileUnpaidPage - 1) * 5) + 1} - {Math.min(mobileUnpaidPage * 5, completedUnpaidPedidos.length)} de {completedUnpaidPedidos.length}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              disabled={mobileUnpaidPage === 1}
                              onClick={() => setMobileUnpaidPage(prev => Math.max(1, prev - 1))}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-slate-200 font-bold transition"
                            >
                              Anterior
                            </button>
                            <span className="text-slate-300 font-bold font-mono text-[11px] px-1">
                              {mobileUnpaidPage} / {Math.ceil(completedUnpaidPedidos.length / 5)}
                            </span>
                            <button
                              disabled={mobileUnpaidPage >= Math.ceil(completedUnpaidPedidos.length / 5)}
                              onClick={() => setMobileUnpaidPage(prev => Math.min(Math.ceil(completedUnpaidPedidos.length / 5), prev + 1))}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded text-slate-200 font-bold transition"
                            >
                              Siguiente
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* VISTA EN TABLA PARA ESCRITORIO (hidden md:block) */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                            <th className="px-4 py-3">Cliente / Empresa</th>
                            <th className="px-4 py-3 text-right">Saldo Pendiente</th>
                            <th className="px-4 py-3 text-center">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-sm">
                          {completedUnpaidPedidos.map((pedido) => {
                            const precio = Number(pedido.precio) || 0
                            const paidAmount = pedido.pagos
                              ? pedido.pagos.filter((pay: any) => pay.estado === 'pagado').reduce((s: number, pay: any) => s + Number(pay.monto), 0)
                              : (pedido.pago && pedido.pago.estado === 'pagado' ? Number(pedido.pago.monto) : 0)
                            const pending = Math.max(0, precio - paidAmount)

                            return (
                              <tr
                                key={pedido.id}
                                className="hover:bg-slate-800/40 text-slate-300 transition duration-150 cursor-pointer"
                                onClick={() => setSelectedPedidoForCommentModal(pedido)}
                              >
                                <td className="px-4 py-3">
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-white text-xs">{pedido.cliente?.nombre_cliente || 'Sin cliente'}</span>
                                    <span className="text-[11px] text-slate-400">{pedido.cliente?.nombre_empresa || 'Empresa'}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="font-bold text-amber-400 font-mono text-xs">
                                    {formatCurrency(pending)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedPedidoForCommentModal(pedido)
                                    }}
                                    className="inline-flex items-center gap-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded text-xs font-semibold transition"
                                    title="Ver pedido y comentar"
                                  >
                                    💬 Ver / Comentar
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal de Detalle Completo del Pedido */}
        <PedidoDetailModal
          pedido={selectedPedidoForCommentModal}
          isOpen={!!selectedPedidoForCommentModal}
          onClose={() => setSelectedPedidoForCommentModal(null)}
          onUpdatePedido={(updated) => {
            setSelectedPedidoForCommentModal(updated)
            setPedidos((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
          }}
          onOpenGallery={(p) => {
            setSelectedPedidoForImages(p)
            setIsImagesModalOpen(true)
          }}
        />

        {/* Modal de Gestión de Imágenes del Pedido */}
        {isImagesModalOpen && selectedPedidoForImages && (
          <Modal
            isOpen={isImagesModalOpen}
            onClose={() => {
              setIsImagesModalOpen(false)
              fetchPedidos().then(setPedidos).catch(console.error)
            }}
            className="max-w-4xl p-6 flex flex-col text-slate-300"
          >
            <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>🖼️</span> Galería de Imágenes y Planos del Pedido
                </h2>
                <p className="text-xs text-slate-400">
                  Administra la portada e imágenes secundarias del pedido: <span className="text-blue-400 font-semibold">{selectedPedidoForImages.cliente?.nombre_empresa || selectedPedidoForImages.cliente?.nombre_cliente || `#${selectedPedidoForImages.id}`}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  setIsImagesModalOpen(false)
                  fetchPedidos().then(setPedidos).catch(console.error)
                }}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
                title="Cerrar modal"
              >
                ✕
              </button>
            </div>

            <OrderImageGallery
              orderId={selectedPedidoForImages.id}
              orderCode={selectedPedidoForImages.codigo}
              onImagesUpdated={() => fetchPedidos().then(setPedidos).catch(console.error)}
            />
          </Modal>
        )}
      </main>
    </RoleGuard>
  )
}

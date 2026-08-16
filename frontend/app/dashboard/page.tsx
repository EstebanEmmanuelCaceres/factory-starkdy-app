'use client'

import { useEffect, useState, useRef } from 'react'
import RoleGuard from '@/components/RoleGuard'
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

  // Modal de Detalle y Comentarios del Pedido (Tabla Adyacente)
  const [selectedPedidoForCommentModal, setSelectedPedidoForCommentModal] = useState<Pedido | null>(null)
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
  const [sortField, setSortField] = useState<'codigo' | 'created_at' | 'cliente' | 'estado'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

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
    setFilters((prev) => ({
      ...prev,
      [key]: value
    }))
  }

  const handleClearFilters = () => {
    setFilters({
      search: '',
      estado: '',
      fecha_desde: '',
      fecha_hasta: ''
    })
  }

  // Restricciones por rol:
  // - Vendedor / Diseñador: solo ven sus pedidos.
  // - Parte operativa (Encargado, Supervisor, Operario): ven únicamente los pedidos fuera del estado 'pendiente'.
  const isVendedor = currentUser?.role === 'vendedor' || currentUser?.role === 'disenador'
  const isEncargado = currentUser?.role === 'encargado'
  const isOperativo = ['encargado', 'supervisor', 'operario', 'operator'].includes(currentUser?.role || '')

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
    } else if (sortField === 'codigo') {
      valA = (a.codigo || '').toLowerCase()
      valB = (b.codigo || '').toLowerCase()
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
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                        <th
                          onClick={() => {
                            if (sortField === 'codigo') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
                            else { setSortField('codigo'); setSortOrder('asc') }
                          }}
                          className="px-4 py-3 cursor-pointer hover:text-white transition"
                        >
                          Código {sortField === 'codigo' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
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
                      {sortedPedidos.map((pedido) => (
                        <tr key={pedido.id} className="hover:bg-slate-800/40 text-slate-300 transition duration-150">
                          <td className="px-4 py-3 font-mono font-bold text-white text-xs">{pedido.codigo}</td>
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
                      ))}
                    </tbody>
                  </table>
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
                  <div className="overflow-x-auto">
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
                                  <span className="text-[10px] text-slate-500 font-mono mt-0.5">{pedido.codigo}</span>
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
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal de Detalle y Comentarios del Pedido */}
        {selectedPedidoForCommentModal && (() => {
          const p = selectedPedidoForCommentModal
          const precio = Number(p.precio) || 0
          const paidAmount = p.pagos
            ? p.pagos.filter((pay) => pay.estado === 'pagado').reduce((s, pay) => s + Number(pay.monto), 0)
            : (p.pago && p.pago.estado === 'pagado' ? Number(p.pago.monto) : 0)
          const pending = Math.max(0, precio - paidAmount)

          return (
            <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-5 text-left relative animate-in fade-in zoom-in-95 duration-200">
                {/* Botón cerrar */}
                <button
                  onClick={() => {
                    setSelectedPedidoForCommentModal(null)
                    setNuevoComentario('')
                  }}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold p-1 rounded-lg hover:bg-slate-800 transition"
                >
                  ✕
                </button>

                {/* Encabezado */}
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-black text-white">{p.codigo}</span>
                    <select
                      value={p.estado}
                      onChange={async (e) => {
                        try {
                          const newEstado = e.target.value
                          const updated = await updatePedido(p.id, { estado: newEstado })
                          setSelectedPedidoForCommentModal(prev => prev ? { ...prev, estado: updated.estado } : null)
                          setPedidos(prev => prev.map(item => item.id === updated.id ? { ...item, estado: updated.estado } : item))
                        } catch (err: unknown) {
                          console.error('Error al cambiar estado:', err)
                        }
                      }}
                      className="bg-slate-950 border border-slate-800 text-xs font-bold text-blue-400 rounded-lg px-2.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="en_progreso">En Progreso</option>
                      <option value="completado">Completado</option>
                      <option value="completado_pd">Completado - Pendiente de pago (PD)</option>
                      <option value="enviado_faltante">Enviado con faltante</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Cliente: <span className="text-white font-semibold">{p.cliente?.nombre_cliente} ({p.cliente?.nombre_empresa})</span>
                    {p.cliente?.telefono && ` • Tel: ${p.cliente.telefono}`}
                  </p>
                </div>

                {/* Resumen Financiero */}
                <div className="grid grid-cols-3 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Pedido</span>
                    <span className="text-xs font-bold text-white font-mono">{formatCurrency(precio)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Cobrado</span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">{formatCurrency(paidAmount)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Saldo Pendiente</span>
                    <span className="text-xs font-bold text-amber-400 font-mono">{formatCurrency(pending)}</span>
                  </div>
                </div>

                {/* Sección de Comentarios */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <span>💬</span> Comentarios del Pedido
                  </h3>

                  {/* Formulario de Nuevo Comentario */}
                  <div className="space-y-2">
                    <textarea
                      value={nuevoComentario}
                      onChange={(e) => setNuevoComentario(e.target.value)}
                      placeholder="Escribe una nota o comentario sobre el cobro / cliente..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none h-20"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={!nuevoComentario.trim() || isSubmittingComment}
                        onClick={async () => {
                          try {
                            setIsSubmittingComment(true)
                            const comment = await createPedidoComentario(p.id, nuevoComentario)
                            const updatedComments = [comment, ...(p.comentarios || [])]
                            const updatedPedido = { ...p, comentarios: updatedComments }
                            setSelectedPedidoForCommentModal(updatedPedido)
                            setPedidos(prev => prev.map(item => item.id === updatedPedido.id ? updatedPedido : item))
                            setNuevoComentario('')
                          } catch (err: any) {
                            console.error("Error al publicar comentario:", err)
                          } finally {
                            setIsSubmittingComment(false)
                          }
                        }}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg text-xs font-semibold transition"
                      >
                        {isSubmittingComment ? 'Publicando...' : '💬 Publicar Comentario'}
                      </button>
                    </div>
                  </div>

                  {/* Lista de Comentarios Existentes */}
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1 pt-1">
                    {(!p.comentarios || p.comentarios.length === 0) ? (
                      <p className="text-xs text-slate-500 italic text-center py-4 bg-slate-950/20 rounded-lg">
                        No hay comentarios en este pedido todavía.
                      </p>
                    ) : (
                      p.comentarios.map((c) => (
                        <div key={c.id} className="bg-slate-950/40 border border-slate-800/80 p-3 rounded-lg text-left space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold text-slate-300">{c.user?.name || 'Usuario'}</span>
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
          )
        })()}
      </main>
    </RoleGuard>
  )
}

'use client'

import { useEffect, useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import { fetchUsers, type User } from '@/lib/auth'
import { fetchPedidos, type Pedido, type PedidoFilters } from '@/lib/pedidos'

export default function DashboardPage() {
  const [users, setUsers] = useState<User[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingPedidos, setLoadingPedidos] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  // Filtros de búsqueda para Pedidos
  const [filters, setFilters] = useState<PedidoFilters>({
    search: '',
    estado: '',
    prioridad: '',
    fecha_desde: '',
    fecha_hasta: '',
    pago_estado: ''
  })

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else {
      setLoadingUsers(true)
      setLoadingPedidos(true)
    }
    setError('')

    try {
      const [usersData, pedidosData] = await Promise.all([
        fetchUsers(),
        fetchPedidos(filters)
      ])
      setUsers(usersData)
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
      prioridad: '',
      fecha_desde: '',
      fecha_hasta: '',
      pago_estado: ''
    })
  }

  // Cálculos de cobros y totales acumulados
  const totalCobrado = pedidos.reduce((sum, p) => {
    const paidAmount = p.pagos
      ? p.pagos.filter(pago => pago.estado === 'pagado').reduce((s, pago) => s + Number(pago.monto), 0)
      : (p.pago && p.pago.estado === 'pagado' ? Number(p.pago.monto) : 0)
    return sum + paidAmount
  }, 0)

  const totalPorCobrar = pedidos.reduce((sum, p) => {
    const precio = Number(p.precio) || 0
    const paidAmount = p.pagos
      ? p.pagos.filter(pago => pago.estado === 'pagado').reduce((s, pago) => s + Number(pago.monto), 0)
      : (p.pago && p.pago.estado === 'pagado' ? Number(p.pago.monto) : 0)
    const pending = Math.max(0, precio - paidAmount)
    return sum + pending
  }, 0)

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
    <RoleGuard allowedRoles={['admin', 'supervisor', 'encargado', 'vendedor', 'disenador']} fallbackHref="/dashboard/tareas">
      <main className="page-content p-6 max-w-7xl mx-auto text-white space-y-8">
        {/* Cabecera */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Dashboard General</h1>
            <p className="text-sm text-slate-400">Resumen y métricas en tiempo real de fabricación y cobros.</p>
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

        {/* Tarjetas de Métricas de Cobros */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <span className="block text-xs text-slate-500 mt-1.5">Pagos exitosos en pedidos filtrados</span>
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
              <span className="block text-xs text-slate-500 mt-1.5">Pagos pendientes en pedidos filtrados</span>
            </div>
          </div>
        </div>

        {/* Panel de Filtros y Búsqueda */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🔍</span> Filtrar Pedidos y Cobros
            </h2>
            {(filters.search || filters.estado || filters.prioridad || filters.pago_estado || filters.fecha_desde || filters.fecha_hasta) && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-slate-400 hover:text-white underline transition"
              >
                Limpiar todos los filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Buscador de Cliente / Empresa */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Cliente y/o Empresa
              </label>
              <input
                type="text"
                placeholder="Buscar por cliente, empresa, email..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* Estado del pedido */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Estado de Fabricación
              </label>
              <select
                value={filters.estado}
                onChange={(e) => handleFilterChange('estado', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              >
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="en_progreso">En Progreso</option>
                <option value="completado">Completado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            {/* Prioridad del pedido */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Prioridad
              </label>
              <select
                value={filters.prioridad}
                onChange={(e) => handleFilterChange('prioridad', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              >
                <option value="">Todas las prioridades</option>
                <option value="baja">Baja</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>

            {/* Estado del pago */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Estado del Pago
              </label>
              <select
                value={filters.pago_estado}
                onChange={(e) => handleFilterChange('pago_estado', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              >
                <option value="">Todos los cobros</option>
                <option value="pagado">Cobrado</option>
                <option value="pendiente">Por Cobrar</option>
                <option value="sin_pago">Sin Pago Registrado</option>
              </select>
            </div>

            {/* Fecha Entrega Desde */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Entrega Desde
              </label>
              <input
                type="date"
                value={filters.fecha_desde}
                onChange={(e) => handleFilterChange('fecha_desde', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* Fecha Entrega Hasta */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Entrega Hasta
              </label>
              <input
                type="date"
                value={filters.fecha_hasta}
                onChange={(e) => handleFilterChange('fecha_hasta', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Tabla de Pedidos Actuales */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="panel-header border-b border-slate-800 px-6 py-4 flex items-center justify-between">
            <span className="panel-title text-base font-bold text-slate-300">Pedidos Actuales</span>
            <span className="text-xs text-slate-500">
              {pedidos.length} {pedidos.length === 1 ? 'pedido encontrado' : 'pedidos encontrados'}
            </span>
          </div>
          <div className="panel-body p-0">
            {loadingPedidos ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                <span className="text-sm">Cargando pedidos...</span>
              </div>
            ) : pedidos.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3">
                <span className="text-4xl">📋</span>
                <span className="text-sm font-medium">No se encontraron pedidos con los filtros seleccionados</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                      <th className="px-6 py-4">Código</th>
                      <th className="px-6 py-4">Cliente / Empresa</th>
                      <th className="px-6 py-4">Prioridad</th>
                      <th className="px-6 py-4">Estado Fabricación</th>
                      <th className="px-6 py-4">Dinero del Pedido</th>
                      <th className="px-6 py-4">Fecha Entrega</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {pedidos.map((pedido) => (
                      <tr key={pedido.id} className="hover:bg-slate-800/40 text-slate-300 transition duration-150">
                        <td className="px-6 py-4 font-mono font-bold text-white text-xs">{pedido.codigo}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-white">
                              {pedido.cliente ? pedido.cliente.nombre_cliente : 'Sin cliente'}
                            </span>
                            <span className="text-xs text-slate-500">
                              {pedido.cliente?.nombre_empresa || 'Sin empresa'}
                            </span>
                          </div>
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
                        <td className="px-6 py-4">
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
                                <span className="font-semibold text-white font-mono">{formatCurrency(paidAmount)}</span>
                                <span className={`inline-flex items-center self-start px-1.5 py-0.5 rounded text-[10px] font-bold uppercase mt-1 ${isFullyPaid
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  }`}>
                                  {isFullyPaid ? 'Cobrado' : `Parcial (${pct}%)`}
                                </span>
                              </div>
                            )
                          })()}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </RoleGuard>
  )
}

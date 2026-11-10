'use client'

import React, { useState, useMemo } from 'react'
import type { Pedido } from '@/lib/pedidos'
import type { User } from '@/lib/auth'

export interface PedidosSinImagenPanelProps {
  pedidos: Pedido[]
  vendedores: User[]
  loading?: boolean
  onOpenImageModal: (pedido: Pedido) => void
  onOpenDetailModal: (pedido: Pedido) => void
  onRefresh?: () => void
}

export const checkPedidoLacksImage = (pedido: Pedido): boolean => {
  // Excluir cancelados de los pedidos pendientes de imagen
  if (pedido.estado === 'cancelado') return false

  // Verificar si tiene imágenes en su galería propia o imagen principal
  const hasImagenes = Array.isArray(pedido.imagenes) && pedido.imagenes.length > 0
  const hasImagenPrincipal = Boolean(pedido.imagen_principal?.url)

  // Si no tiene imágenes propias cargadas al pedido, le falta imagen
  return !hasImagenes && !hasImagenPrincipal
}

export default function PedidosSinImagenPanel({
  pedidos,
  vendedores,
  loading = false,
  onOpenImageModal,
  onOpenDetailModal,
  onRefresh
}: PedidosSinImagenPanelProps) {
  const [selectedVendedorId, setSelectedVendedorId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [estadoFilter, setEstadoFilter] = useState<'activos' | 'todos'>('activos')
  const [page, setPage] = useState<number>(1)
  const pageSize = 6

  // Extraer vendedores únicos a partir de los pedidos en caso de que falten en el array
  const availableVendedores = useMemo(() => {
    const map = new Map<number, string>()
    vendedores.forEach((v) => {
      map.set(v.id, v.name)
    })
    pedidos.forEach((p) => {
      if (p.user_id && p.user?.name && !map.has(p.user_id)) {
        map.set(p.user_id, p.user.name)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [vendedores, pedidos])

  // Filtrar pedidos que no tienen imágenes cargadas
  const pedidosSinImagen = useMemo(() => {
    return pedidos.filter(checkPedidoLacksImage)
  }, [pedidos])

  // Aplicar filtros adicionales (vendedor, texto de búsqueda, estado)
  const filteredPedidos = useMemo(() => {
    return pedidosSinImagen.filter((p) => {
      // Filtro de vendedor
      if (selectedVendedorId) {
        if (Number(p.user_id) !== Number(selectedVendedorId)) {
          return false
        }
      }

      // Filtro de estado (activos: pendiente, en_progreso)
      if (estadoFilter === 'activos') {
        const estado = (p.estado || '').toLowerCase()
        if (estado === 'completado' || estado === 'completado_pd' || estado === 'enviado' || estado === 'enviado_faltante') {
          return false
        }
      }

      // Búsqueda por texto (código, cliente, empresa)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchCode = (p.codigo || '').toLowerCase().includes(q)
        const matchClient = (p.cliente?.nombre_cliente || '').toLowerCase().includes(q)
        const matchEmpresa = (p.cliente?.nombre_empresa || '').toLowerCase().includes(q)
        if (!matchCode && !matchClient && !matchEmpresa) {
          return false
        }
      }

      return true
    })
  }, [pedidosSinImagen, selectedVendedorId, searchQuery, estadoFilter])

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filteredPedidos.length / pageSize))
  const paginatedPedidos = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredPedidos.slice(start, start + pageSize)
  }, [filteredPedidos, page, pageSize])

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
      case 'completado_pd':
        return 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
      case 'enviado':
        return 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completado':
        return 'Completado'
      case 'completado_pd':
        return 'Completado - Pend. Pago'
      case 'enviado':
        return 'Enviado'
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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col mb-8">
      {/* Cabecera del Panel */}
      <div className="border-b border-slate-800 p-5 bg-gradient-to-r from-slate-950/80 via-slate-900 to-slate-950/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-2xl shadow-inner select-none shrink-0">
              🖼️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Pedidos sin Imagen Cargada
                </h2>
                <span className="bg-amber-500/20 text-amber-300 text-xs font-black px-2.5 py-0.5 rounded-full border border-amber-500/30">
                  {pedidosSinImagen.length} {pedidosSinImagen.length === 1 ? 'pedido' : 'pedidos'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Pedidos a los que les falta cargar las imágenes y planos de diseño para fabricación.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                title="Actualizar listado"
              >
                <span>🔄</span>
                <span>Actualizar</span>
              </button>
            )}
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mt-4 pt-3 border-t border-slate-800/80">
          {/* Selector de Vendedor */}
          <div className="sm:col-span-5 lg:col-span-4">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Filtrar por Vendedor
            </label>
            <div className="relative">
              <select
                value={selectedVendedorId}
                onChange={(e) => {
                  setSelectedVendedorId(e.target.value)
                  setPage(1)
                }}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none transition cursor-pointer font-medium"
              >
                <option value="">👤 Todos los vendedores ({availableVendedores.length})</option>
                {availableVendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    👤 {v.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Buscador */}
          <div className="sm:col-span-4 lg:col-span-5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Buscar Código o Cliente
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por #código, cliente o empresa..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1.5 text-xs text-slate-500 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Filtro de Estado (Activos / Todos) */}
          <div className="sm:col-span-3 lg:col-span-3">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Estado
            </label>
            <select
              value={estadoFilter}
              onChange={(e) => {
                setEstadoFilter(e.target.value as 'activos' | 'todos')
                setPage(1)
              }}
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none transition cursor-pointer"
            >
              <option value="activos">⚡ Solo Activos</option>
              <option value="todos">📋 Todos los Estados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contenido / Listado */}
      <div className="p-0 flex-grow">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent"></div>
            <span className="text-xs font-medium">Cargando pedidos sin imagen...</span>
          </div>
        ) : filteredPedidos.length === 0 ? (
          <div className="py-14 px-4 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-3xl flex items-center justify-center mb-3">
              🎉
            </div>
            <h3 className="text-sm font-bold text-white mb-1">
              {pedidosSinImagen.length === 0
                ? '¡Excelente! Todos los pedidos tienen sus imágenes cargadas'
                : 'No se encontraron pedidos sin imagen con los filtros aplicados'}
            </h3>
            <p className="text-xs text-slate-400 max-w-md">
              {pedidosSinImagen.length === 0
                ? 'No hay pedidos pendientes de cargar imagen en este momento.'
                : 'Prueba cambiando el vendedor o el texto de búsqueda para encontrar otros pedidos.'}
            </p>
            {(selectedVendedorId || searchQuery || estadoFilter !== 'activos') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedVendedorId('')
                  setSearchQuery('')
                  setEstadoFilter('activos')
                }}
                className="mt-3 text-xs text-amber-400 hover:text-amber-300 underline font-semibold transition cursor-pointer"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* VISTA DESKTOP / TABLE (hidden en mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="px-4 py-3">Pedido</th>
                    <th className="px-4 py-3">Cliente / Empresa</th>
                    <th className="px-4 py-3">Vendedor</th>
                    <th className="px-4 py-3">Productos</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {paginatedPedidos.map((pedido) => {
                    const vendedorName = pedido.user?.name || availableVendedores.find(v => v.id === pedido.user_id)?.name || 'Vendedor'
                    const prodCount = pedido.productos?.length || 0
                    const prodSummary = pedido.productos?.map(p => p.nombre).filter(Boolean).slice(0, 2).join(', ')
                    const prodExtra = prodCount > 2 ? ` +${prodCount - 2}` : ''

                    return (
                      <tr
                        key={pedido.id}
                        className="hover:bg-slate-800/30 transition duration-150 group"
                      >
                        {/* Código y Prioridad */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1">
                            <span className="font-mono font-bold text-white text-xs group-hover:text-amber-400 transition">
                              #{pedido.codigo}
                            </span>
                            <span className={`inline-flex items-center self-start px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${getPriorityBadgeClass(pedido.prioridad)}`}>
                              {pedido.prioridad}
                            </span>
                          </div>
                        </td>

                        {/* Cliente y Empresa */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col">
                            <span className="font-bold text-white text-xs">
                              {pedido.cliente?.nombre_empresa || pedido.cliente?.nombre_cliente || 'Sin cliente'}
                            </span>
                            {pedido.cliente?.nombre_empresa && pedido.cliente?.nombre_cliente && (
                              <span className="text-[11px] text-slate-400">
                                {pedido.cliente.nombre_cliente}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Vendedor */}
                        <td className="px-4 py-3.5">
                          <div className="inline-flex items-center gap-1.5 bg-slate-950/70 border border-slate-800 rounded-lg px-2 py-1 text-slate-300 font-medium">
                            <span className="text-amber-400 text-xs">👤</span>
                            <span className="truncate max-w-[140px] text-xs" title={vendedorName}>
                              {vendedorName}
                            </span>
                          </div>
                        </td>

                        {/* Productos */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col text-xs text-slate-300 max-w-[180px]">
                            <span className="truncate" title={prodSummary + prodExtra}>
                              {prodSummary ? `${prodSummary}${prodExtra}` : 'Sin productos'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {prodCount} {prodCount === 1 ? 'ítem' : 'ítems'}
                            </span>
                          </div>
                        </td>

                        {/* Estado */}
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${getStatusBadgeClass(pedido.estado)}`}>
                            {getStatusLabel(pedido.estado)}
                          </span>
                        </td>

                        {/* Fecha */}
                        <td className="px-4 py-3.5 font-mono text-slate-400 text-xs">
                          {pedido.created_at ? new Date(pedido.created_at).toLocaleDateString('es-AR') : 'N/A'}
                        </td>

                        {/* Acciones */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onOpenImageModal(pedido)}
                              className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-md transition hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                              title="Cargar imágenes y planos de diseño para este pedido"
                            >
                              <span>📷</span>
                              <span>Cargar Imagen</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenDetailModal(pedido)}
                              className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                              title="Ver detalle completo del pedido"
                            >
                              <span>👁️</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* VISTA MOBILE (tarjetas) */}
            <div className="md:hidden space-y-3 p-3">
              {paginatedPedidos.map((pedido) => {
                const vendedorName = pedido.user?.name || availableVendedores.find(v => v.id === pedido.user_id)?.name || 'Vendedor'
                const prodCount = pedido.productos?.length || 0

                return (
                  <div
                    key={pedido.id}
                    className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5 shadow"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-400 text-xs">
                            #{pedido.codigo}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${getPriorityBadgeClass(pedido.prioridad)}`}>
                            {pedido.prioridad}
                          </span>
                        </div>
                        <h4 className="font-bold text-white text-sm mt-1">
                          {pedido.cliente?.nombre_empresa || pedido.cliente?.nombre_cliente || 'Sin cliente'}
                        </h4>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusBadgeClass(pedido.estado)}`}>
                        {getStatusLabel(pedido.estado)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Vendedor</span>
                        <span className="text-slate-300 font-medium truncate block">
                          👤 {vendedorName}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Fecha Creación</span>
                        <span className="text-slate-400 font-mono text-xs">
                          {pedido.created_at ? new Date(pedido.created_at).toLocaleDateString('es-AR') : 'N/A'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] text-slate-500 block">Productos</span>
                        <span className="text-slate-300 text-xs">
                          {prodCount} {prodCount === 1 ? 'producto' : 'productos'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => onOpenDetailModal(pedido)}
                        className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold"
                      >
                        👁️ Ver
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenImageModal(pedido)}
                        className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow transition flex items-center gap-1.5"
                      >
                        <span>📷</span>
                        <span>Cargar Imagen</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 text-xs text-slate-400 bg-slate-950/40">
                <span>
                  Mostrando {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, filteredPedidos.length)} de {filteredPedidos.length} pedidos
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                    disabled={page === 1}
                    className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 text-white font-medium transition cursor-pointer"
                  >
                    Anterior
                  </button>
                  <span className="font-semibold text-slate-300">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={page === totalPages}
                    className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 text-white font-medium transition cursor-pointer"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

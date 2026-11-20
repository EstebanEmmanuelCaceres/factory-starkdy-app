'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import PedidoDetailModal from '@/components/PedidoDetailModal'
import ClientDetailModal from '@/components/ClientDetailModal'
import PedidoThumbnail from '@/components/PedidoThumbnail'
import { AtributosLineaResumen } from '@/components/PedidoAtributos/AtributosLineaResumen'
import { useModalContext } from '@/components/Modal/context/ModalContext'
import { getStoredUser } from '@/lib/auth'
import { type Cliente } from '@/lib/clientes'
import {
  fetchPedidosDespacho,
  cambiarEstadoPedidos,
  type Pedido,
} from '@/lib/pedidos'
import { downloadDespachoClientesCsv } from '@/lib/despachoCsv'

const DESPACHO_CLIENT_MODAL_ID = 'despacho-cliente-envio'

// Portada del pedido: imagen principal, o la primera del pedido, o la de sus productos
const getPedidoCoverUrl = (pedido: Pedido) =>
  pedido.imagen_principal?.url ||
  pedido.imagenes?.find((img) => img.es_principal)?.url ||
  pedido.imagenes?.[0]?.url ||
  pedido.productos?.find((prod) => prod.imagen_principal?.url)?.imagen_principal?.url ||
  pedido.productos?.[0]?.imagen_principal?.url ||
  pedido.productos?.[0]?.imagenes?.[0]?.url ||
  null

export default function DespachoPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Filtros rápidos (sin paginación: siempre muestra todos los que coincidan)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVendedor, setSelectedVendedor] = useState('')

  // Configuración de exportación masiva Andreani
  const [paqueteGuardado, setPaqueteGuardado] = useState('caja 30')
  const [pesoGramos, setPesoGramos] = useState(1000)
  const [valorDeclarado, setValorDeclarado] = useState(35000)

  // Selección masiva por checkbox
  const [seleccionados, setSeleccionados] = useState<number[]>([])
  const [actualizandoEstado, setActualizandoEstado] = useState(false)

  // Rol del usuario actual
  const [userRole, setUserRole] = useState<string>('')
  const isVendedor = userRole === 'vendedor'
  const canManageDespacho = ['admin', 'encargado', 'supervisor'].includes(userRole)

  // Modal de detalle de pedido
  const [selectedPedidoForView, setSelectedPedidoForView] = useState<Pedido | null>(null)

  // Modal de edición de datos de envío del cliente
  const { open: openModal } = useModalContext()
  const [selectedClientIdForEdit, setSelectedClientIdForEdit] = useState<number | null>(null)

  const headerCheckboxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const u = getStoredUser()
    if (u?.role) {
      setUserRole(typeof u.role === 'string' ? u.role : (u.role as { slug?: string }).slug || '')
    }
  }, [])

  const handleOpenEditCliente = (pedido: Pedido) => {
    const clienteId = pedido.cliente_id ?? pedido.cliente?.id
    if (!clienteId) return
    setSelectedClientIdForEdit(clienteId)
    openModal(DESPACHO_CLIENT_MODAL_ID)
  }

  const handleClientUpdated = (updatedCliente: Cliente) => {
    setPedidos((prev) =>
      prev.map((p) =>
        p.cliente_id === updatedCliente.id || p.cliente?.id === updatedCliente.id
          ? { ...p, cliente: updatedCliente }
          : p
      )
    )
    setSelectedPedidoForView((prev) =>
      prev && (prev.cliente_id === updatedCliente.id || prev.cliente?.id === updatedCliente.id)
        ? { ...prev, cliente: updatedCliente }
        : prev
    )
    showNotification('Datos de envío del cliente actualizados correctamente')
  }

  const showNotification = (msg: string) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(''), 4000)
  }

  const loadDespachoPedidos = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchPedidosDespacho()
      setPedidos(data)
      // Mantener seleccionados solo los que sigan en la lista
      setSeleccionados((prev) => prev.filter((id) => data.some((p) => p.id === id)))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar los pedidos para despacho')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDespachoPedidos()
  }, [])

  // Vendedores únicos presentes en los pedidos listos para despacho
  const vendedoresDisponibles = useMemo(() => {
    const map = new Map<number, string>()
    pedidos.forEach((p) => {
      if (p.user_id && p.user?.name && !map.has(p.user_id)) {
        map.set(p.user_id, p.user.name)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [pedidos])

  // Filtrado en memoria (sin paginación)
  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter((p) => {
      if (selectedVendedor && String(p.user_id) !== selectedVendedor) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchCodigo = (p.codigo || '').toLowerCase().includes(q) || String(p.id).includes(q)
        const matchNombre = (p.cliente?.nombre_cliente || '').toLowerCase().includes(q)
        const matchEmpresa = (p.cliente?.nombre_empresa || '').toLowerCase().includes(q)
        const matchLocalidad = (p.cliente?.localidad || '').toLowerCase().includes(q)
        const matchProvincia = (p.cliente?.provincia || '').toLowerCase().includes(q)
        const matchDni = (p.cliente?.dni || '').toLowerCase().includes(q)
        if (!matchCodigo && !matchNombre && !matchEmpresa && !matchLocalidad && !matchProvincia && !matchDni) {
          return false
        }
      }
      return true
    })
  }, [pedidos, searchQuery, selectedVendedor])

  const idsVisibles = useMemo(() => pedidosFiltrados.map((p) => p.id), [pedidosFiltrados])
  const seleccionadosVisiblesCount = useMemo(
    () => idsVisibles.filter((id) => seleccionados.includes(id)).length,
    [idsVisibles, seleccionados]
  )
  const todosVisiblesSeleccionados =
    idsVisibles.length > 0 && seleccionadosVisiblesCount === idsVisibles.length
  const algunosVisiblesSeleccionados =
    seleccionadosVisiblesCount > 0 && !todosVisiblesSeleccionados

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = algunosVisiblesSeleccionados
    }
  }, [algunosVisiblesSeleccionados])

  const toggleSeleccion = (id: number) => {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleSeleccionarTodosVisibles = () => {
    if (todosVisiblesSeleccionados) {
      setSeleccionados((prev) => prev.filter((id) => !idsVisibles.includes(id)))
    } else {
      setSeleccionados((prev) => Array.from(new Set([...prev, ...idsVisibles])))
    }
  }

  const pedidosSeleccionados = useMemo(
    () => pedidos.filter((p) => seleccionados.includes(p.id)),
    [pedidos, seleccionados]
  )

  const handleExportCsv = (lista: Pedido[]) => {
    if (!canManageDespacho || lista.length === 0) return
    downloadDespachoClientesCsv(lista, {
      paqueteGuardado: paqueteGuardado.trim() || 'caja 30',
      pesoGramos,
      valorDeclarado,
    })
    showNotification(
      `CSV generado correctamente con ${lista.length} ${lista.length === 1 ? 'pedido' : 'pedidos'}`
    )
  }

  const handleMarcarEnviados = async () => {
    if (!canManageDespacho || seleccionados.length === 0) return
    if (
      !confirm(
        `¿Marcar ${seleccionados.length} pedido(s) seleccionado(s) como "Enviado"? Dejarán de aparecer en la lista de pendientes de despacho.`
      )
    ) {
      return
    }

    setActualizandoEstado(true)
    setError('')
    try {
      const res = await cambiarEstadoPedidos(seleccionados, 'enviado')
      setPedidos((prev) => prev.filter((p) => !res.ids.includes(p.id)))
      setSeleccionados([])
      showNotification(`${res.ids.length} pedido(s) marcado(s) como Enviado`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el estado de los pedidos')
    } finally {
      setActualizandoEstado(false)
    }
  }

  return (
    <RoleGuard allowedRoles={['admin', 'encargado', 'vendedor']} fallbackHref="/dashboard">
      <main className="w-full max-w-[1920px] mx-auto text-white space-y-6">
        {/* Cabecera */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                <span>🚚</span>
                <span>Módulo de Despacho</span>
              </h1>
              <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-extrabold px-3 py-1 rounded-full">
                {pedidosFiltrados.length} {pedidosFiltrados.length === 1 ? 'pedido listo' : 'pedidos listos'}
              </span>
              {isVendedor && (
                <span className="bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-bold px-3 py-1 rounded-full">
                  Solo vista · Edición de datos de envío
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-1">
              {isVendedor ? (
                <>
                  Pedidos con fabricación <strong>completada</strong> y <strong>pago completo</strong> listos para despachar. Podés revisar y editar los datos del cliente para el envío.
                </>
              ) : (
                <>
                  Pedidos con fabricación <strong>completada</strong> y <strong>pago completo</strong> listos para despachar y exportar a CSV.
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={loadDespachoPedidos}
              disabled={loading}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold px-3.5 py-2 rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
            >
              <span>🔄</span>
              <span>{loading ? 'Actualizando...' : 'Actualizar'}</span>
            </button>

            {canManageDespacho && (
              <button
                type="button"
                onClick={() =>
                  handleExportCsv(
                    pedidosSeleccionados.length > 0 ? pedidosSeleccionados : pedidosFiltrados
                  )
                }
                disabled={loading || pedidosFiltrados.length === 0}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-lg shadow-emerald-950/40 transition cursor-pointer disabled:cursor-not-allowed"
                title="Descargar archivo CSV con los datos de envío"
              >
                <span>📥</span>
                <span>
                  {pedidosSeleccionados.length > 0
                    ? `Descargar CSV (${pedidosSeleccionados.length} seleccionados)`
                    : `Descargar CSV (Todos: ${pedidosFiltrados.length})`}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Notificaciones */}
        {successMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-medium animate-in fade-in">
            <span>✅</span>
            <span>{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-medium animate-in fade-in">
            <span>❌</span>
            <span>{error}</span>
          </div>
        )}

        {/* Parámetros de plantilla Andreani (solo admin/encargado) */}
        {canManageDespacho && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800/80 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                  <span>🏷️</span>
                  <span>Configuración de Exportación Masiva (Andreani)</span>
                </span>
                <span className="text-[10px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-extrabold px-2 py-0.5 rounded-full">
                  Formato CSV Domicilio
                </span>
              </div>
              <span className="text-xs text-slate-400">
                Formato de 17 columnas con celular y dirección en una sola columna, y provincia, localidad y CP separados.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  📦 Paquete Guardado (Andreani)
                </label>
                <input
                  type="text"
                  value={paqueteGuardado}
                  onChange={(e) => setPaqueteGuardado(e.target.value)}
                  placeholder="Ej: caja 30"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none transition font-medium"
                />
                <span className="block text-[10px] text-slate-500 mt-0.5">
                  Reemplaza alto, ancho y profundidad
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  ⚖️ Peso por bulto (gramos)
                </label>
                <input
                  type="number"
                  value={pesoGramos}
                  onChange={(e) => setPesoGramos(Number(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none transition font-medium"
                />
                <span className="block text-[10px] text-slate-500 mt-0.5">
                  Fijado en 1000 grs para el envío
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  🛡️ Valor declarado ($ C/IVA)
                </label>
                <input
                  type="number"
                  value={valorDeclarado}
                  onChange={(e) => setValorDeclarado(Number(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none transition font-medium"
                />
                <span className="block text-[10px] text-slate-500 mt-0.5">
                  Fijado en $35.000 para el seguro
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Barra de Filtros y Selección Rápida */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Buscador */}
            <div className={canManageDespacho ? 'md:col-span-6 lg:col-span-7 relative' : 'md:col-span-12 relative'}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Buscar por #código, cliente, empresa, DNI, localidad o provincia..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2 text-xs text-slate-400 hover:text-white"
                  aria-label="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filtro por Vendedor (solo admin/encargado) */}
            {canManageDespacho && (
              <div className="md:col-span-3 lg:col-span-3">
                <select
                  value={selectedVendedor}
                  onChange={(e) => setSelectedVendedor(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition cursor-pointer"
                >
                  <option value="">👤 Todos los vendedores</option>
                  {vendedoresDisponibles.map((v) => (
                    <option key={v.id} value={String(v.id)}>
                      👤 {v.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Botón Seleccionar Todos / Deseleccionar Todos (solo admin/encargado) */}
            {canManageDespacho && (
              <div className="md:col-span-3 lg:col-span-2 flex justify-end">
                <button
                  type="button"
                  disabled={pedidosFiltrados.length === 0}
                  onClick={toggleSeleccionarTodosVisibles}
                  className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 disabled:opacity-40 text-slate-200 font-semibold px-3 py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  {todosVisiblesSeleccionados
                    ? '☑ Deseleccionar todos'
                    : `☐ Seleccionar todos (${pedidosFiltrados.length})`}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Barra flotante de Acción Masiva cuando hay seleccionados (solo admin/encargado) */}
        {canManageDespacho && seleccionados.length > 0 && (
          <div className="sticky top-20 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-slate-900/95 px-4 py-3 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 text-xs font-extrabold text-emerald-300">
                {seleccionados.length} seleccionado{seleccionados.length === 1 ? '' : 's'}
              </span>
              <span className="text-xs text-slate-300">
                Listos para exportar datos de cliente a CSV o registrar envío.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleExportCsv(pedidosSeleccionados)}
                className="h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 text-xs font-bold text-white shadow transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>📥</span>
                <span>Generar CSV ({seleccionados.length})</span>
              </button>

              <button
                type="button"
                onClick={handleMarcarEnviados}
                disabled={actualizandoEstado}
                className="h-9 rounded-lg bg-teal-600/20 hover:bg-teal-600/40 border border-teal-500/40 px-3.5 text-xs font-bold text-teal-300 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Cambiar el estado de los pedidos seleccionados a Enviado"
              >
                <span>🚚</span>
                <span>{actualizandoEstado ? 'Marcando...' : 'Marcar como Enviado'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSeleccionados([])}
                className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
              >
                Quitar selección
              </button>
            </div>
          </div>
        )}

        {/* Listado completo SIN paginación */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
              <span className="text-xs font-medium">Cargando pedidos completados y pagos...</span>
            </div>
          ) : pedidosFiltrados.length === 0 ? (
            <div className="py-16 px-4 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 text-3xl flex items-center justify-center mb-3">
                📦
              </div>
              <h3 className="text-sm font-bold text-white mb-1">
                No hay pedidos pendientes de despacho
              </h3>
              <p className="text-xs text-slate-400 max-w-md">
                {pedidos.length === 0
                  ? 'Actualmente no hay pedidos que estén simultáneamente en estado Completado y con el pago 100% saldado.'
                  : 'No se encontraron pedidos con los filtros aplicados.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                    {canManageDespacho && (
                      <th className="pl-4 pr-2 py-3.5 w-10">
                        <input
                          ref={headerCheckboxRef}
                          type="checkbox"
                          checked={todosVisiblesSeleccionados}
                          onChange={toggleSeleccionarTodosVisibles}
                          aria-label="Seleccionar todos los pedidos"
                          className="size-4 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-0 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className={canManageDespacho ? 'px-3 py-3.5' : 'pl-4 pr-3 py-3.5'}>Pedido / Cliente</th>
                    <th className="px-3 py-3.5">Contacto / DNI</th>
                    <th className="px-3 py-3.5">Dirección de Envío</th>
                    <th className="px-3 py-3.5">Productos</th>
                    <th className="px-3 py-3.5 text-center">Estado y Pago</th>
                    <th className="px-3 py-3.5">Vendedor</th>
                    <th className="pl-2 pr-4 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  {pedidosFiltrados.map((pedido) => {
                    const isSelected = canManageDespacho && seleccionados.includes(pedido.id)
                    const coverUrl = getPedidoCoverUrl(pedido)
                    const cli = pedido.cliente
                    const direccionLinea = [cli?.direccion, cli?.localidad, cli?.provincia]
                      .filter(Boolean)
                      .join(', ')

                    return (
                      <tr
                        key={pedido.id}
                        onClick={canManageDespacho ? () => toggleSeleccion(pedido.id) : undefined}
                        className={`transition duration-150 ${canManageDespacho ? 'cursor-pointer' : ''} ${
                          isSelected
                            ? 'bg-emerald-950/25 hover:bg-emerald-950/35'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        {/* Checkbox (solo admin/encargado) */}
                        {canManageDespacho && (
                          <td
                            className="pl-4 pr-2 py-3.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSeleccion(pedido.id)}
                              aria-label={`Seleccionar pedido #${pedido.codigo || pedido.id}`}
                              className="size-4 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-0 cursor-pointer"
                            />
                          </td>
                        )}

                        {/* Pedido y Cliente */}
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-3">
                            <div onClick={(e) => e.stopPropagation()}>
                              <PedidoThumbnail
                                url={coverUrl}
                                alt={`Pedido #${pedido.codigo || pedido.id}`}
                                className="w-16 h-12"
                                compact
                                onClick={() => setSelectedPedidoForView(pedido)}
                              />
                            </div>
                            <div className="min-w-[9rem]">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-blue-400 text-xs">
                                  #{pedido.codigo || pedido.id}
                                </span>
                              </div>
                              <span className="block font-bold text-white text-sm leading-snug mt-0.5">
                                {cli?.nombre_cliente || cli?.nombre_empresa || 'Sin nombre'}
                              </span>
                              {cli?.nombre_empresa && cli?.nombre_cliente && (
                                <span className="block text-[11px] text-slate-400">
                                  🏢 {cli.nombre_empresa}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Contacto / DNI */}
                        <td className="px-3 py-3.5">
                          <div className="space-y-0.5 text-slate-300">
                            {cli?.telefono ? (
                              <span className="block font-medium">📞 {cli.telefono}</span>
                            ) : (
                              <span className="block text-slate-500 italic">Sin teléfono</span>
                            )}
                            {cli?.dni && (
                              <span className="block text-[11px] text-slate-400 font-mono">
                                DNI/CUIT: {cli.dni}
                              </span>
                            )}
                            {cli?.email && (
                              <span className="block text-[11px] text-slate-400 truncate max-w-[180px]" title={cli.email}>
                                ✉️ {cli.email}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Dirección de Envío */}
                        <td className="px-3 py-3.5">
                          <div className="space-y-0.5 max-w-[240px]">
                            {direccionLinea ? (
                              <span className="block text-slate-200 font-medium leading-snug">
                                📍 {direccionLinea}
                              </span>
                            ) : (
                              <span className="block text-amber-400/80 italic text-[11px]">
                                ⚠️ Sin dirección cargada
                              </span>
                            )}
                            {cli?.cp && (
                              <span className="inline-block bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-300">
                                CP: {cli.cp}
                              </span>
                            )}
                            {cli?.observaciones && (
                              <span
                                className="block text-[11px] text-slate-400 italic truncate"
                                title={cli.observaciones}
                              >
                                Obs: {cli.observaciones}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Productos */}
                        <td className="px-3 py-3.5">
                          {pedido.productos && pedido.productos.length > 0 ? (
                            <div className="flex flex-col items-start gap-1">
                              {pedido.productos.slice(0, 2).map((prod, i) => {
                                const qty = prod.pivot?.cantidad ?? 1
                                return (
                                  <span
                                    key={prod.pivot?.id ?? `${prod.id}-${i}`}
                                    className="inline-block max-w-[18rem] rounded-lg border border-slate-700/60 bg-slate-800/40 px-2 py-1 text-xs font-medium text-slate-200"
                                  >
                                    {prod.nombre}{' '}
                                    <span className="text-[11px] font-bold text-slate-400">
                                      x{qty}
                                    </span>
                                    <AtributosLineaResumen
                                      product={prod}
                                      valores={prod.pivot?.atributos}
                                      className="mt-0.5"
                                    />
                                  </span>
                                )
                              })}
                              {pedido.productos.length > 2 && (
                                <span className="text-[11px] font-semibold text-slate-400 pl-1">
                                  + {pedido.productos.length - 2} más
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">Sin productos</span>
                          )}
                        </td>

                        {/* Estado y Pago */}
                        <td className="px-3 py-3.5 text-center">
                          <div className="inline-flex flex-col items-center gap-1.5">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              ✓ Completado
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <span className="size-1.5 rounded-full bg-emerald-400" />
                              Pago completo
                            </span>
                          </div>
                        </td>

                        {/* Vendedor */}
                        <td className="px-3 py-3.5 text-slate-300 font-medium">
                          {pedido.user?.name || 'Sin asignar'}
                        </td>

                        {/* Botones de acción: editar datos de envío y ver detalle */}
                        <td
                          className="pl-2 pr-4 py-3.5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {(pedido.cliente_id || pedido.cliente?.id) && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditCliente(pedido)}
                                className="inline-flex h-8 items-center gap-1 px-2.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 font-semibold text-[11px] transition cursor-pointer whitespace-nowrap"
                                title="Editar datos del cliente para el envío"
                              >
                                <span>✏️</span>
                                <span>Datos envío</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedPedidoForView(pedido)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 transition cursor-pointer"
                              title="Ver ficha completa del pedido y del cliente"
                            >
                              👁️
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal de Detalle del Pedido */}
        <PedidoDetailModal
          pedido={selectedPedidoForView}
          isOpen={!!selectedPedidoForView}
          onClose={() => setSelectedPedidoForView(null)}
          canChangeStatus={canManageDespacho}
          canEditDescription={canManageDespacho}
          clientShippingOnly={isVendedor}
          onUpdatePedido={(updated) => {
            setSelectedPedidoForView(updated)
            loadDespachoPedidos()
          }}
        />

        {/* Modal directo de Edición de Datos de Envío del Cliente */}
        <ClientDetailModal
          clienteId={selectedClientIdForEdit}
          modalId={DESPACHO_CLIENT_MODAL_ID}
          canEdit={true}
          initialEditMode={true}
          shippingOnly={isVendedor}
          onClientUpdated={handleClientUpdated}
        />
      </main>
    </RoleGuard>
  )
}

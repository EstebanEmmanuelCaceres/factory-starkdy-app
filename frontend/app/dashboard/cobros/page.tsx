'use client'

import { useCallback, useEffect, useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import { fetchUsers, type User } from '@/lib/auth'
import { exportCobrosCsv, fetchCobros, getCobro, searchCobros, ESTADOS_COBRO, MEDIOS_PAGO, TIPOS_COBRO, type CobroDetail, type CobroFilters, type CobroListItem, type OrdenFecha, type PaginationMeta } from '@/lib/cobros'
import { CobroEstadoBadge } from '@/components/cobros/CobroEstadoBadge'
import { CobroFormModal } from '@/components/cobros/CobroFormModal'
import { CobroCancelModal } from '@/components/cobros/CobroCancelModal'
import { CobroDetailModal } from '@/components/cobros/CobroDetailModal'
import { COBRO_CANCEL_MODAL_ID, COBRO_DETAIL_MODAL_ID, COBRO_FORM_MODAL_ID } from '@/components/cobros/modalIds'
import { useModal } from '@/components/Modal/context/ModalContext'
import { currentMonthRange, formatClienteLabel, formatFechaCobro, formatMoney, medioPagoLabel, tipoCobroLabel } from '@/components/cobros/format'

const PER_PAGE = 20
const SEARCH_MIN_CHARS = 2
const SEARCH_DELAY_MS = 350
const filterClass =
  'w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition [color-scheme:dark]'

const getInitialFilters = (): CobroFilters => {
  const { desde, hasta } = currentMonthRange()
  return { fecha_desde: desde, fecha_hasta: hasta }
}

const SortIcon = ({ order }: { order: OrdenFecha }) => (
  <svg viewBox="0 0 24 24" className="size-3.5 fill-none stroke-current stroke-[2.5] [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden="true">
    {order === 'desc' ? <path d="M12 5v14M6 13l6 6 6-6" /> : <path d="M12 19V5M6 11l6-6 6 6" />}
  </svg>
)

function CobrosContent() {
  const [filters, setFilters] = useState<CobroFilters>(getInitialFilters)
  const [page, setPage] = useState(1)
  const [cobros, setCobros] = useState<CobroListItem[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [vendedores, setVendedores] = useState<User[]>([])

  // Buscador por pedido / cliente (GET /admin/cobros/buscar): ignora los filtros del listado
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CobroListItem[]>([])
  const [searchMeta, setSearchMeta] = useState<{ total: number; total_cobrado: number } | null>(null)
  const [searching, setSearching] = useState(false)
  const trimmedQuery = searchQuery.trim()
  const isSearchMode = trimmedQuery.length >= SEARCH_MIN_CHARS

  // Modales (pila del ModalContext): editar y cancelar se abren encima del detalle
  const detailModal = useModal(COBRO_DETAIL_MODAL_ID)
  const formModal = useModal(COBRO_FORM_MODAL_ID)
  const cancelModal = useModal(COBRO_CANCEL_MODAL_ID)
  const [detailId, setDetailId] = useState<number | null>(null)
  // Se incrementa al editar/cancelar para que el detalle abierto vuelva a pedir el cobro
  const [detailRefreshKey, setDetailRefreshKey] = useState(0)
  const [editingCobro, setEditingCobro] = useState<CobroDetail | null>(null)
  const [cancellingCobro, setCancellingCobro] = useState<CobroListItem | CobroDetail | null>(null)
  // Id del cobro cuyo detalle se está pidiendo para editar desde la tabla
  const [loadingEditId, setLoadingEditId] = useState<number | null>(null)

  // Orden de la columna Fecha (lo aplica el back, así ordena todas las páginas y no solo la actual)
  const [sortOrder, setSortOrder] = useState<OrdenFecha>('desc')

  // Exportación a CSV con los filtros y el orden actuales (todas las páginas)
  const [exporting, setExporting] = useState(false)
  const handleExport = async () => {
    setExporting(true)
    setError('')
    try {
      await exportCobrosCsv({ ...filters, orden: sortOrder })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al exportar los cobros')
    } finally {
      setExporting(false)
    }
  }

  const toggleSortOrder = () => {
    setPage(1)
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
  }

  const loadCobros = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await fetchCobros({ ...filters, orden: sortOrder, page, per_page: PER_PAGE })
      setCobros(result.data)
      setMeta(result.meta)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar los cobros')
    } finally {
      setLoading(false)
    }
  }, [filters, page, sortOrder])

  useEffect(() => {
    loadCobros()
  }, [loadCobros])

  const runSearch = useCallback(async (q: string) => {
    setSearching(true)
    setError('')
    try {
      const result = await searchCobros(q, sortOrder)
      setSearchResults(result.data)
      setSearchMeta(result.meta)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al buscar cobros')
    } finally {
      setSearching(false)
    }
  }, [sortOrder])

  // Búsqueda con debounce mientras se escribe
  useEffect(() => {
    if (trimmedQuery.length < SEARCH_MIN_CHARS) {
      setSearchResults([])
      setSearchMeta(null)
      return
    }
    setSearching(true)
    const timer = setTimeout(() => runSearch(trimmedQuery), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [trimmedQuery, runSearch])

  const closeDetailModal = detailModal.close
  const closeFormModal = formModal.close
  const closeCancelModal = cancelModal.close
  useEffect(() => () => {
    closeCancelModal()
    closeFormModal()
    closeDetailModal()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchUsers()
      .then((users) => setVendedores(users.filter((u) => u.role === 'vendedor')))
      .catch(console.error)
  }, [])

  const updateFilter = <K extends keyof CobroFilters>(key: K, value: CobroFilters[K] | '') => {
    setPage(1)
    setFilters((prev) => ({ ...prev, [key]: value === '' ? undefined : value }))
  }

  const showSuccess = (message: string) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(''), 3500)
  }

  const openDetail = (id: number) => {
    setDetailId(id)
    detailModal.open()
  }

  const openCreate = () => {
    setEditingCobro(null)
    formModal.open()
  }

  const openEdit = (cobro: CobroDetail) => {
    setEditingCobro(cobro)
    formModal.open()
  }

  // La lista no trae todos los campos que edita el formulario (observaciones, referencia, etc.):
  // se pide el detalle antes de abrirlo para no pisarlos con vacío al guardar
  const openEditFromList = async (id: number) => {
    setLoadingEditId(id)
    setError('')
    try {
      openEdit(await getCobro(id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar el cobro')
    } finally {
      setLoadingEditId(null)
    }
  }

  const openCancel = (cobro: CobroListItem | CobroDetail) => {
    setCancellingCobro(cobro)
    cancelModal.open()
  }

  // Después de guardar o cancelar: se recarga la lista y, si el detalle está abierto, también
  const refreshAfterChange = (message: string) => {
    showSuccess(message)
    setDetailRefreshKey((k) => k + 1)
    loadCobros()
    if (isSearchMode) runSearch(trimmedQuery)
  }

  // Lo que muestra el listado: resultados del buscador o el listado filtrado
  const rows = isSearchMode ? searchResults : cobros
  const listLoading = isSearchMode ? searching : loading
  const viewTotal = isSearchMode ? searchMeta?.total : meta?.total
  const viewTotalCobrado = isSearchMode ? searchMeta?.total_cobrado : meta?.total_cobrado

  const hasActiveFilters = Boolean(filters.vendedor_id || filters.estado || filters.medio_pago || filters.tipo_cobro)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800/80 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Cobros</h1>
            {viewTotal !== undefined && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {viewTotal} {viewTotal === 1 ? 'cobro' : 'cobros'}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">Registro, edición y anulación de cobros de pedidos.</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-blue-600/20 active:scale-95 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo cobro
        </button>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm animate-in fade-in">✓ {successMessage}</div>
      )}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-sm">{error}</div>
      )}

      {/* Buscador por pedido / cliente */}
      <div>
        <div className="relative">
          <svg className="w-5 h-5 absolute left-3.5 top-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar cobros por código de pedido o cliente..."
            className="w-full pl-10 pr-10 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1.5 grid size-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-200 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
        {isSearchMode && (
          <p className="mt-1.5 text-xs text-slate-400">
            Buscando en todos los cobros, sin aplicar los filtros de abajo. Borrá la búsqueda para volver al listado filtrado.
          </p>
        )}
      </div>

      {/* Filtros (no aplican al buscador) */}
      <div
        aria-disabled={isSearchMode}
        className={`grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 transition ${isSearchMode ? 'pointer-events-none opacity-40' : ''}`}
      >
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Desde
          <input type="date" value={filters.fecha_desde ?? ''} onChange={(e) => updateFilter('fecha_desde', e.target.value)} className={filterClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Hasta
          <input type="date" value={filters.fecha_hasta ?? ''} onChange={(e) => updateFilter('fecha_hasta', e.target.value)} className={filterClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Vendedor
          <select value={filters.vendedor_id ?? ''} onChange={(e) => updateFilter('vendedor_id', e.target.value ? Number(e.target.value) : '')} className={filterClass}>
            <option value="">Todos</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Estado
          <select value={filters.estado ?? ''} onChange={(e) => updateFilter('estado', e.target.value as CobroFilters['estado'])} className={filterClass}>
            <option value="">Todos</option>
            {ESTADOS_COBRO.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Medio
          <select value={filters.medio_pago ?? ''} onChange={(e) => updateFilter('medio_pago', e.target.value)} className={filterClass}>
            <option value="">Todos</option>
            {MEDIOS_PAGO.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Tipo
          <select value={filters.tipo_cobro ?? ''} onChange={(e) => updateFilter('tipo_cobro', e.target.value as CobroFilters['tipo_cobro'])} className={filterClass}>
            <option value="">Todos</option>
            {TIPOS_COBRO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
      </div>

      {/* Resumen del período */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Total cobrado</p>
          <p className="text-xs text-slate-400">
            {isSearchMode ? `Solo cobros en estado pagado que coinciden con "${trimmedQuery}"` : 'Solo cobros en estado pagado, con los filtros aplicados'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-2xl font-bold tabular-nums text-white">{viewTotalCobrado !== undefined ? formatMoney(viewTotalCobrado) : '—'}</p>
          {!isSearchMode && (hasActiveFilters || filters.fecha_desde || filters.fecha_hasta) && (
            <button
              type="button"
              onClick={() => { setPage(1); setFilters({}) }}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
            >
              Quitar filtros
            </button>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || isSearchMode || !meta?.total}
            title={isSearchMode ? 'La exportación usa los filtros: borrá la búsqueda para exportar' : 'Descargar los cobros filtrados en CSV'}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 px-3.5 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden="true">
              <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
            </svg>
            {exporting ? 'Exportando...' : 'Exportar CSV'}
          </button>
        </div>
      </div>

      {/* Listado */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {listLoading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
            <p>{isSearchMode ? 'Buscando cobros...' : 'Cargando cobros...'}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            {isSearchMode ? (
              <>
                <p className="text-base font-medium">No hay cobros para &quot;{trimmedQuery}&quot;</p>
                <p className="text-xs text-slate-500 mt-1">Probá con otro código de pedido o nombre de cliente.</p>
              </>
            ) : (
              <>
                <p className="text-base font-medium">No hay cobros para estos filtros</p>
                <p className="text-xs text-slate-500 mt-1">Probá cambiando el rango de fechas o quitando filtros.</p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Tabla (desktop) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                    <th className="py-4 px-5" aria-sort={sortOrder === 'asc' ? 'ascending' : 'descending'}>
                      <button
                        type="button"
                        onClick={toggleSortOrder}
                        title={sortOrder === 'desc' ? 'Más recientes primero. Click para ver los más antiguos' : 'Más antiguos primero. Click para ver los más recientes'}
                        className="inline-flex items-center gap-1.5 uppercase tracking-wider hover:text-slate-200 transition cursor-pointer"
                      >
                        Fecha
                        <SortIcon order={sortOrder} />
                      </button>
                    </th>
                    <th className="py-4 px-5">Pedido / Cliente</th>
                    <th className="py-4 px-5">Vendedor</th>
                    <th className="py-4 px-5">Medio · Tipo</th>
                    <th className="py-4 px-5 text-right">Monto</th>
                    <th className="py-4 px-5">Estado</th>
                    <th className="py-4 px-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {rows.map((c) => (
                    <tr key={c.id} onClick={() => openDetail(c.id)} className="hover:bg-slate-800/40 transition cursor-pointer">
                      <td className="py-3.5 px-5 text-slate-300 whitespace-nowrap">{formatFechaCobro(c.fecha_pago)}</td>
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-slate-100 truncate max-w-[260px]" title={formatClienteLabel(c.cliente)}>
                          {c.cliente?.nombre_empresa || c.cliente?.nombre_cliente || '—'}
                        </div>
                        <div className="text-xs text-slate-500 truncate max-w-[260px]">
                          {c.pedido?.codigo ?? '—'}
                          {c.cliente?.nombre_empresa &&
                            c.cliente?.nombre_cliente &&
                            c.cliente.nombre_cliente.trim().toLowerCase() !== c.cliente.nombre_empresa.trim().toLowerCase() && (
                              <span className="text-slate-400"> · {c.cliente.nombre_cliente}</span>
                            )}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-slate-300">{c.vendedor ?? '—'}</td>
                      <td className="py-3.5 px-5 text-slate-300">
                        {medioPagoLabel(c.medio_pago)}
                        <span className="block text-xs text-slate-500">{tipoCobroLabel(c.tipo_cobro)}</span>
                      </td>
                      <td className={`py-3.5 px-5 text-right font-bold tabular-nums whitespace-nowrap ${c.estado === 'anulado' ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
                        {formatMoney(c.monto)}
                      </td>
                      <td className="py-3.5 px-5"><CobroEstadoBadge estado={c.estado} /></td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {c.estado !== 'anulado' && (
                          <>
                            <button type="button" onClick={() => openEditFromList(c.id)} disabled={loadingEditId === c.id} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-400 hover:bg-slate-800 disabled:opacity-50 cursor-pointer">
                              {loadingEditId === c.id ? 'Cargando...' : 'Editar'}
                            </button>
                            <button type="button" onClick={() => openCancel(c)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 cursor-pointer">Cancelar</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tarjetas (mobile) */}
            <div className="md:hidden flex justify-end border-b border-slate-800 px-4 py-2">
              <button
                type="button"
                onClick={toggleSortOrder}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Fecha: {sortOrder === 'desc' ? 'más recientes' : 'más antiguos'}
                <SortIcon order={sortOrder} />
              </button>
            </div>
            <ul className="md:hidden divide-y divide-slate-800/60">
              {rows.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => openDetail(c.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left cursor-pointer hover:bg-slate-800/40">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-100">{c.cliente?.nombre_empresa || c.cliente?.nombre_cliente || '—'}</p>
                      <p className="text-xs text-slate-400"><span className="text-slate-500">{c.pedido?.codigo ?? '—'}</span> · {formatFechaCobro(c.fecha_pago)} · {medioPagoLabel(c.medio_pago)} · {c.vendedor ?? '—'}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`font-bold tabular-nums ${c.estado === 'anulado' ? 'text-slate-500 line-through' : 'text-slate-100'}`}>{formatMoney(c.monto)}</p>
                      <CobroEstadoBadge estado={c.estado} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            {/* Paginación */}
            {/* El buscador devuelve como máximo 100 resultados */}
            {isSearchMode && searchMeta && searchMeta.total > rows.length && (
              <p className="border-t border-slate-800 px-5 py-3 text-xs text-slate-400">
                Mostrando {rows.length} de {searchMeta.total} cobros. Refiná la búsqueda para ver el resto.
              </p>
            )}

            {!isSearchMode && meta && meta.last_page > 1 && (
              <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3 text-sm text-slate-400">
                <span>Página {meta.current_page} de {meta.last_page}</span>
                <div className="flex gap-2">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-800 px-3 py-1.5 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">Anterior</button>
                  <button type="button" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-800 px-3 py-1.5 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">Siguiente</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <CobroDetailModal cobroId={detailId} refreshKey={detailRefreshKey} onEdit={openEdit} onCancel={openCancel} />

      <CobroFormModal
        cobro={editingCobro}
        vendedores={vendedores}
        onSaved={() => {
          formModal.close()
          refreshAfterChange(editingCobro ? 'Cobro actualizado correctamente.' : 'Cobro registrado correctamente.')
        }}
      />

      <CobroCancelModal
        cobro={cancellingCobro}
        onCancelled={() => {
          cancelModal.close()
          refreshAfterChange('Cobro cancelado correctamente.')
        }}
      />
    </div>
  )
}

export default function CobrosPage() {
  return (
    <RoleGuard allowedRoles={['admin']}>
      <CobrosContent />
    </RoleGuard>
  )
}

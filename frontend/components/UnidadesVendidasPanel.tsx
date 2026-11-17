'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  fetchUnidadesVendidas,
  type ProductoUnidadesVendidas,
  type UnidadesVendidasResponse,
} from '@/lib/metricas'

const MONTHS_LIST = [
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
  { value: 12, label: 'Diciembre' },
]

function renderVariacionBadge(
  variacionPct: number | null,
  actual: number,
  anterior: number
) {
  if (variacionPct === null) {
    if (actual > 0 && anterior === 0) {
      return (
        <span
          className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold text-emerald-300 font-mono"
          title={`De ${anterior} a ${actual} unidades`}
        >
          ▲ Nuevo (+{actual})
        </span>
      )
    }
    return <span className="text-slate-500 font-mono text-xs">-</span>
  }

  if (variacionPct > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold text-emerald-400 font-mono tabular-nums"
        title={`Subió de ${anterior} a ${actual} unidades`}
      >
        ▲ +{variacionPct.toFixed(1)}%
      </span>
    )
  }

  if (variacionPct < 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[11px] font-bold text-rose-400 font-mono tabular-nums"
        title={`Bajó de ${anterior} a ${actual} unidades`}
      >
        ▼ {variacionPct.toFixed(1)}%
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-slate-800/80 border border-slate-700 px-2 py-0.5 text-[11px] font-semibold text-slate-400 font-mono tabular-nums"
      title={`Sin cambios (${actual} vs ${anterior} unidades)`}
    >
      0.0%
    </span>
  )
}

export default function UnidadesVendidasPanel() {
  const now = new Date()
  const currentYear = now.getFullYear()

  // Filtros con el mismo estilo de "Valor Total Pedidos": Año + Rango de Meses (Desde / Hasta)
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [mesDesde, setMesDesde] = useState<number>(1)
  const [mesHasta, setMesHasta] = useState<number>(12)
  const [searchQuery, setSearchQuery] = useState('')

  const [data, setData] = useState<UnidadesVendidasResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Misma escala de años que la tarjeta "Valor Total Pedidos"
  const yearsList = useMemo(
    () => Array.from({ length: 7 }, (_, i) => currentYear - 5 + i),
    [currentYear]
  )

  const handleMesDesdeChange = (nuevoDesde: number) => {
    setMesDesde(nuevoDesde)
    if (nuevoDesde > mesHasta) {
      setMesHasta(nuevoDesde)
    }
  }

  const handleMesHastaChange = (nuevoHasta: number) => {
    setMesHasta(nuevoHasta)
    if (nuevoHasta < mesDesde) {
      setMesDesde(nuevoHasta)
    }
  }

  const cargarUnidades = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchUnidadesVendidas({
        anio: selectedYear,
        mes_desde: mesDesde,
        mes_hasta: mesHasta,
      })
      setData(res)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al consultar las unidades vendidas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarUnidades()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, mesDesde, mesHasta])

  const columnasMeses = data?.meses ?? []
  const filaTotal = data?.fila_total
  const comparacion = data?.periodo?.comparacion

  const productosFiltrados: ProductoUnidadesVendidas[] = useMemo(() => {
    const lista = data?.productos ?? []
    if (!searchQuery.trim()) return lista
    const q = searchQuery.toLowerCase().trim()
    return lista.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        String(p.producto_id).includes(q)
    )
  }, [data?.productos, searchQuery])

  // Si hay búsqueda activa por texto, recalculamos la fila Total sobre los productos filtrados
  const totalesVisibles = useMemo(() => {
    if (!searchQuery.trim() && filaTotal) {
      return filaTotal
    }
    const porMes: Record<string, number> = {}
    columnasMeses.forEach((col) => {
      porMes[col.clave] = 0
    })
    let totalUnidades = 0
    let unidadesActual = 0
    let unidadesAnterior = 0

    productosFiltrados.forEach((prod) => {
      columnasMeses.forEach((col) => {
        porMes[col.clave] += prod.por_mes[col.clave] ?? 0
      })
      totalUnidades += prod.total_unidades
      unidadesActual += prod.unidades_mes_comparado
      unidadesAnterior += prod.unidades_mes_anterior
    })

    const variacionPct =
      unidadesAnterior === 0
        ? unidadesActual === 0
          ? 0
          : null
        : Number((((unidadesActual - unidadesAnterior) / unidadesAnterior) * 100).toFixed(1))

    return {
      por_mes: porMes,
      total_unidades: totalUnidades,
      unidades_mes_comparado: unidadesActual,
      unidades_mes_anterior: unidadesAnterior,
      variacion_pct: variacionPct,
      total_productos: productosFiltrados.length,
    }
  }, [searchQuery, filaTotal, columnasMeses, productosFiltrados])

  const esAnioCompleto = mesDesde === 1 && mesHasta === 12

  return (
    <section className="bg-gradient-to-br from-blue-950/30 to-slate-900 border border-blue-500/20 rounded-2xl shadow-xl overflow-hidden">
      {/* Cabecera con el estilo de "Valor Total Pedidos" */}
      <div className="p-5 sm:p-6 border-b border-slate-800/80 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xl shadow-inner select-none shrink-0">
              📦
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                  Unidades Vendidas por Mes
                </span>
                <span className="bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-bold px-2.5 py-0.5 rounded-full font-mono">
                  {loading
                    ? '...'
                    : `${(totalesVisibles?.total_unidades ?? 0).toLocaleString('es-AR')} unid.`}
                </span>
              </div>
              <span className="block text-[11px] text-slate-400">
                Cantidad de productos vendidos por mes (`pedido_productos`), total del período y variación % vs mes anterior
              </span>
            </div>
          </div>

          {/* Filtros de Rango de Meses y Año (mismo estilo que tarjeta "Valor Total Pedidos") */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Buscador rápido de producto */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Filtrar producto..."
                className="bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition w-40 sm:w-44"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1 text-xs text-slate-400 hover:text-white"
                  aria-label="Limpiar filtro"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Selector Mes Desde */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Desde:</span>
              <select
                value={mesDesde}
                onChange={(e) => handleMesDesdeChange(Number(e.target.value))}
                aria-label="Mes desde"
                className="bg-slate-950 text-xs text-slate-200 focus:outline-none cursor-pointer"
              >
                {MONTHS_LIST.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector Mes Hasta */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Hasta:</span>
              <select
                value={mesHasta}
                onChange={(e) => handleMesHastaChange(Number(e.target.value))}
                aria-label="Mes hasta"
                className="bg-slate-950 text-xs text-slate-200 focus:outline-none cursor-pointer"
              >
                {MONTHS_LIST.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {!esAnioCompleto && (
              <button
                type="button"
                onClick={() => {
                  setMesDesde(1)
                  setMesHasta(12)
                }}
                className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-blue-400 text-xs font-semibold px-2.5 py-1 rounded-lg transition cursor-pointer"
                title="Mostrar los 12 meses del año"
              >
                Todos los meses
              </button>
            )}

            {/* Selector de Año (idéntico a Valor Total Pedidos) */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              aria-label="Seleccionar año"
              className="bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none transition cursor-pointer font-semibold"
            >
              {yearsList.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold px-2.5 py-1 rounded-lg transition cursor-pointer"
            >
              {isCollapsed ? '🔽 Ver tabla' : '🔼 Contraer'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabla con Meses en Columnas + Columna Total + Columna Variación % + Fila Total unidades */}
      {!isCollapsed && (
        <div>
          {error && (
            <div className="m-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-xl text-xs font-medium">
              ❌ {error}
            </div>
          )}

          {loading ? (
            <div className="py-14 flex flex-col items-center justify-center text-slate-400 gap-2.5">
              <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-500 border-t-transparent" />
              <span className="text-xs">Cargando unidades vendidas por mes...</span>
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div className="py-12 px-4 text-center text-slate-400 space-y-1">
              <span className="text-2xl block">📭</span>
              <p className="text-xs font-semibold text-slate-300">
                No se registraron unidades vendidas en los meses seleccionados de {selectedYear}.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="sticky left-0 z-30 bg-slate-950 pl-5 pr-3 py-3.5 min-w-[220px] border-r border-slate-800/80">
                      Producto
                    </th>
                    {columnasMeses.map((col) => {
                      const esMesComparado = comparacion?.mes_actual_clave === col.clave
                      return (
                        <th
                          key={col.clave}
                          className={`px-3 py-3.5 text-right min-w-[68px] ${
                            esMesComparado ? 'text-blue-400 bg-blue-950/20' : ''
                          }`}
                          title={`${col.etiqueta_larga} ${col.anio}`}
                        >
                          {col.etiqueta_corta}
                        </th>
                      )
                    })}
                    <th className="px-4 py-3.5 text-right min-w-[90px] bg-slate-900/90 text-white border-l border-slate-800">
                      Total
                    </th>
                    <th
                      className="pl-3 pr-5 py-3.5 text-right min-w-[140px] bg-slate-950 border-l border-slate-800"
                      title={
                        comparacion
                          ? `Variación porcentual de ${comparacion.mes_actual_etiqueta} contra ${comparacion.mes_anterior_etiqueta}`
                          : 'Variación % contra el mes anterior'
                      }
                    >
                      <span className="block text-slate-300">Var. % Mes Ant.</span>
                      {comparacion?.mes_actual_etiqueta && comparacion?.mes_anterior_etiqueta && (
                        <span className="block text-[9px] font-mono font-normal text-slate-500 normal-case">
                          ({comparacion.mes_actual_etiqueta} vs {comparacion.mes_anterior_etiqueta})
                        </span>
                      )}
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800/60">
                  {productosFiltrados.map((prod) => (
                    <tr key={prod.producto_id} className="hover:bg-slate-800/35 transition group">
                      {/* Nombre del Producto (sticky a la izquierda en scroll horizontal) */}
                      <td className="sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800/90 pl-5 pr-3 py-2.5 border-r border-slate-800/80">
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-xs leading-snug">
                            {prod.nombre}
                          </span>
                          {prod.sku && (
                            <span className="text-[10px] font-mono text-slate-400">
                              SKU: {prod.sku}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Columnas de cada Mes */}
                      {columnasMeses.map((col) => {
                        const cant = prod.por_mes[col.clave] ?? 0
                        const esMesComparado = comparacion?.mes_actual_clave === col.clave
                        return (
                          <td
                            key={col.clave}
                            className={`px-3 py-2.5 text-right font-mono tabular-nums ${
                              esMesComparado ? 'bg-blue-950/10' : ''
                            } ${cant > 0 ? 'text-slate-200 font-semibold' : 'text-slate-600'}`}
                          >
                            {cant > 0 ? cant.toLocaleString('es-AR') : '0'}
                          </td>
                        )
                      })}

                      {/* Columna Total del Producto */}
                      <td className="px-4 py-2.5 text-right font-mono font-extrabold text-blue-300 bg-slate-950/50 border-l border-slate-800/80 tabular-nums">
                        {prod.total_unidades.toLocaleString('es-AR')}
                      </td>

                      {/* Última Columna: Variación % vs Mes Anterior */}
                      <td className="pl-3 pr-5 py-2.5 text-right border-l border-slate-800/80">
                        {renderVariacionBadge(
                          prod.variacion_pct,
                          prod.unidades_mes_comparado,
                          prod.unidades_mes_anterior
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Fila Inferior: Total unidades */}
                {totalesVisibles && (
                  <tfoot className="sticky bottom-0 z-20 bg-slate-950 border-t-2 border-blue-500/40 font-extrabold text-xs shadow-lg">
                    <tr>
                      <td className="sticky left-0 z-30 bg-slate-950 pl-5 pr-3 py-3.5 text-white uppercase tracking-wider border-r border-slate-800">
                        Total unidades
                      </td>
                      {columnasMeses.map((col) => {
                        const totalMes = totalesVisibles.por_mes[col.clave] ?? 0
                        const esMesComparado = comparacion?.mes_actual_clave === col.clave
                        return (
                          <td
                            key={col.clave}
                            className={`px-3 py-3.5 text-right font-mono tabular-nums ${
                              esMesComparado ? 'text-blue-300 bg-blue-950/25' : 'text-white'
                            }`}
                          >
                            {totalMes.toLocaleString('es-AR')}
                          </td>
                        )
                      })}
                      <td className="px-4 py-3.5 text-right font-mono text-sm font-black text-blue-400 bg-blue-950/30 border-l border-slate-800 tabular-nums">
                        {totalesVisibles.total_unidades.toLocaleString('es-AR')}
                      </td>
                      <td className="pl-3 pr-5 py-3.5 text-right bg-slate-950 border-l border-slate-800">
                        {renderVariacionBadge(
                          totalesVisibles.variacion_pct,
                          totalesVisibles.unidades_mes_comparado,
                          totalesVisibles.unidades_mes_anterior
                        )}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

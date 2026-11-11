'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import {
  fetchVendedoresDiario,
  type MetricasVendedoresDiario,
  type VendedorDiarioSeries
} from '@/lib/metricas'

// Paleta de colores atractiva y diferenciada para cada línea de vendedor
const VENDOR_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#a855f7', // purple-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#6366f1', // indigo-500
]

function formatCurrency(val: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(val)
}

function formatCurrencyShort(val: number) {
  if (val >= 1_000_000) {
    return `$${(val / 1_000_000).toFixed(1)}M`
  }
  if (val >= 1_000) {
    return `$${(val / 1_000).toFixed(0)}k`
  }
  return `$${val}`
}

function formatDayLabel(dateStr: string) {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`
  }
  return dateStr
}

export default function VendedoresLineChart() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0')
  const currentDay = String(now.getDate()).padStart(2, '0')

  // Fechas por defecto: del primer día del mes actual al día de hoy
  const defaultDesde = `${currentYear}-${currentMonth}-01`
  const defaultHasta = `${currentYear}-${currentMonth}-${currentDay}`

  const [fechaDesde, setFechaDesde] = useState<string>(defaultDesde)
  const [fechaHasta, setFechaHasta] = useState<string>(defaultHasta)
  const [selectedVendedorId, setSelectedVendedorId] = useState<string>('')
  const [metricType, setMetricType] = useState<'cobros' | 'ventas'>('cobros')

  // Vendedores ocultos manualmente al hacer clic en la leyenda
  const [hiddenVendorIds, setHiddenVendorIds] = useState<number[]>([])

  const [data, setData] = useState<MetricasVendedoresDiario | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')

  // Hover interactivo en el gráfico
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const loadChartData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchVendedoresDiario({
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        vendedor_id: selectedVendedorId ? Number(selectedVendedorId) : undefined
      })
      setData(res)
    } catch (err: unknown) {
      console.error('Error al cargar datos del gráfico:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar los datos del gráfico')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadChartData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaDesde, fechaHasta, selectedVendedorId])

  const handleResetToCurrentMonth = () => {
    setFechaDesde(defaultDesde)
    setFechaHasta(defaultHasta)
    setSelectedVendedorId('')
  }

  const toggleVendorVisibility = (id: number) => {
    setHiddenVendorIds(prev =>
      prev.includes(id) ? prev.filter(vId => vId !== id) : [...prev, id]
    )
  }

  // Filtrado de vendedores visibles para el dibujo del SVG
  const activeVendors = useMemo(() => {
    if (!data?.vendedores) return []
    return data.vendedores.filter(v => !hiddenVendorIds.includes(v.id))
  }, [data?.vendedores, hiddenVendorIds])

  // Cálculo del valor máximo en Y para la escala del gráfico
  const fechas = data?.fechas || []
  const numDays = fechas.length

  const maxY = useMemo(() => {
    if (!activeVendors.length || numDays === 0) return 100000
    let max = 0
    activeVendors.forEach(v => {
      const series = v.series[metricType] || []
      series.forEach(val => {
        if (val > max) max = val
      })
    })
    // Dar un 15% de margen superior para que las líneas no toquen el borde arriba
    if (max === 0) return 100000
    return Math.ceil((max * 1.15) / 10000) * 10000
  }, [activeVendors, metricType, numDays])

  // Coordenadas del gráfico SVG
  const width = 1000
  const height = 360
  const padding = { top: 30, right: 30, bottom: 45, left: 75 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const getX = (index: number) => {
    if (numDays <= 1) return padding.left + chartWidth / 2
    return padding.left + (index / (numDays - 1)) * chartWidth
  }

  const getY = (val: number) => {
    if (maxY === 0) return padding.top + chartHeight
    return padding.top + chartHeight - (val / maxY) * chartHeight
  }

  // Generación de rutas SVG para cada vendedor
  const lines = useMemo(() => {
    return activeVendors.map((v, vIdx) => {
      const series = v.series[metricType] || []
      const points = series.map((val, idx) => ({
        x: getX(idx),
        y: getY(val),
        val,
        fecha: fechas[idx]
      }))

      const color = VENDOR_COLORS[vIdx % VENDOR_COLORS.length]
      const pathD = points.reduce((acc, pt, i) => {
        return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`
      }, '')

      return {
        vendor: v,
        color,
        points,
        pathD
      }
    })
  }, [activeVendors, metricType, fechas, maxY])

  // Total acumulado por vendedor en el período actual
  const currentMetricTotal = useMemo(() => {
    if (!data?.vendedores) return 0
    return data.vendedores.reduce((acc, v) => {
      return acc + (metricType === 'cobros' ? v.total_cobrado : v.total_ventas)
    }, 0)
  }, [data?.vendedores, metricType])

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 space-y-6">
      {/* Cabecera y Selector de Métrica */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xl shadow-inner select-none shrink-0">
              📈
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Rendimiento Diario por Vendedor
                <span className="text-xs bg-slate-800 text-blue-400 border border-slate-700 px-2.5 py-0.5 rounded-full font-mono font-bold">
                  {metricType === 'cobros' ? 'Plata Cobrada' : 'Ventas Generadas'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {metricType === 'cobros'
                  ? '💵 Plata Cobrada: Dinero real que ingresó por pagos confirmados de cada vendedor (señas y cancelaciones de saldos).'
                  : '📦 Ventas (Pedidos): Monto total pactado de los pedidos generados por cada vendedor en el día.'}
              </p>
            </div>
          </div>
        </div>

        {/* Conmutador Cobros vs Ventas */}
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1 self-start lg:self-auto shadow-inner">
          <button
            type="button"
            onClick={() => setMetricType('cobros')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              metricType === 'cobros'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Ver dinero efectivamente cobrado (pagos registrados en el día)"
          >
            <span>💵</span>
            <span>Plata Cobrada</span>
          </button>
          <button
            type="button"
            onClick={() => setMetricType('ventas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              metricType === 'ventas'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
            title="Ver valor nominal de pedidos creados (ventas pactadas en el día)"
          >
            <span>📦</span>
            <span>Ventas (Pedidos)</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros: Fechas y Selector de Vendedor */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 items-end">
        {/* Fecha Desde */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Desde
          </label>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none transition font-medium"
          />
        </div>

        {/* Fecha Hasta */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Hasta
          </label>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none transition font-medium"
          />
        </div>

        {/* Selector de Vendedor */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Vendedor
          </label>
          <select
            value={selectedVendedorId}
            onChange={(e) => setSelectedVendedorId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none transition font-medium cursor-pointer"
          >
            <option value="">Todos los vendedores</option>
            {data?.vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                👤 {v.name}
              </option>
            ))}
          </select>
        </div>

        {/* Botón Reset / Mes Actual */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetToCurrentMonth}
            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold py-1.5 px-3 rounded-lg transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
            title="Restablecer fechas al mes corriente"
          >
            <span>📅</span>
            <span>Mes Actual</span>
          </button>
          <button
            type="button"
            onClick={loadChartData}
            disabled={loading}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg transition cursor-pointer"
            title="Actualizar gráfico"
          >
            🔄
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 px-4 py-2.5 rounded-lg text-xs">
          ⚠️ {error}
        </div>
      )}

      {/* Área del Gráfico SVG */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-2 rounded-xl">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
            <span className="text-xs text-slate-400 font-medium">Cargando métricas...</span>
          </div>
        )}

        {fechas.length === 0 || activeVendors.length === 0 ? (
          <div className="py-24 text-center text-slate-500 text-xs">
            No hay datos para el período seleccionado.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <div className="min-w-[650px]">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-auto select-none"
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <defs>
                  {lines.map((l) => (
                    <linearGradient key={`grad-${l.vendor.id}`} id={`grad-${l.vendor.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={l.color} stopOpacity="0.25" />
                      <stop offset="100%" stopColor={l.color} stopOpacity="0.0" />
                    </linearGradient>
                  ))}
                </defs>

                {/* Líneas de Grilla Horizontales (Eje Y) */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                  const yVal = maxY * pct
                  const yPos = getY(yVal)
                  return (
                    <g key={idx}>
                      <line
                        x1={padding.left}
                        y1={yPos}
                        x2={width - padding.right}
                        y2={yPos}
                        stroke="#334155"
                        strokeDasharray={idx === 0 ? 'none' : '4 4'}
                        strokeWidth="1"
                        strokeOpacity="0.6"
                      />
                      <text
                        x={padding.left - 10}
                        y={yPos + 3}
                        textAnchor="end"
                        fontSize="10"
                        fill="#94a3b8"
                        fontFamily="monospace"
                        fontWeight="600"
                      >
                        {formatCurrencyShort(yVal)}
                      </text>
                    </g>
                  )
                })}

                {/* Etiquetas del Eje X (Días) */}
                {fechas.map((fecha, idx) => {
                  // Si hay muchos días, mostrar etiquetas salteadas para no amontonar
                  const step = numDays > 20 ? 3 : numDays > 12 ? 2 : 1
                  const isVisible = idx % step === 0 || idx === numDays - 1
                  if (!isVisible) return null

                  const xPos = getX(idx)
                  return (
                    <g key={fecha}>
                      <line
                        x1={xPos}
                        y1={padding.top + chartHeight}
                        x2={xPos}
                        y2={padding.top + chartHeight + 6}
                        stroke="#475569"
                        strokeWidth="1"
                      />
                      <text
                        x={xPos}
                        y={padding.top + chartHeight + 20}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#94a3b8"
                        fontFamily="monospace"
                        fontWeight="500"
                      >
                        {formatDayLabel(fecha)}
                      </text>
                    </g>
                  )
                })}

                {/* Línea vertical indicadora del Hover */}
                {hoveredIndex !== null && (
                  <line
                    x1={getX(hoveredIndex)}
                    y1={padding.top}
                    x2={getX(hoveredIndex)}
                    y2={padding.top + chartHeight}
                    stroke="#60a5fa"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    className="transition-all"
                  />
                )}

                {/* Rutas (Líneas) de cada Vendedor */}
                {lines.map((l) => (
                  <g key={`line-group-${l.vendor.id}`}>
                    <path
                      d={l.pathD}
                      fill="none"
                      stroke={l.color}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-all duration-300 drop-shadow-sm"
                    />

                    {/* Puntos de datos */}
                    {l.points.map((pt, pIdx) => {
                      const isHovered = hoveredIndex === pIdx
                      if (pt.val === 0 && !isHovered) return null

                      return (
                        <circle
                          key={pIdx}
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 6 : 3.5}
                          fill={l.color}
                          stroke="#0f172a"
                          strokeWidth={isHovered ? 2.5 : 1.5}
                          className="transition-all duration-150 cursor-pointer"
                        />
                      )
                    })}
                  </g>
                ))}

                {/* Zonas transparentes invisibles para capturar el mouse over por día */}
                {fechas.map((_, idx) => {
                  const xPos = getX(idx)
                  const stepWidth = chartWidth / Math.max(1, numDays - 1)
                  return (
                    <rect
                      key={`overlay-${idx}`}
                      x={Math.max(padding.left, xPos - stepWidth / 2)}
                      y={padding.top}
                      width={stepWidth}
                      height={chartHeight}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIndex(idx)}
                    />
                  )
                })}
              </svg>
            </div>
          </div>
        )}

        {/* Tooltip flotante interactivo */}
        {hoveredIndex !== null && fechas[hoveredIndex] && (
          <div className="mt-3 p-3 bg-slate-950/95 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-4 text-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="text-sm">📅</span>
              <span className="font-bold text-white font-mono">
                {fechas[hoveredIndex]}
              </span>
              <span className="text-slate-400">({formatDayLabel(fechas[hoveredIndex])})</span>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {activeVendors.map((v, vIdx) => {
                const color = VENDOR_COLORS[vIdx % VENDOR_COLORS.length]
                const val = v.series[metricType]?.[hoveredIndex] ?? 0

                return (
                  <div key={v.id} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-slate-300 font-medium">{v.name}:</span>
                    <span className="font-bold text-white font-mono">{formatCurrency(val)}</span>
                  </div>
                )
              })}

              {activeVendors.length > 1 && (
                <div className="border-l border-slate-800 pl-4 flex items-center gap-1.5">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Total Día:</span>
                  <span className="font-black text-amber-400 font-mono">
                    {formatCurrency(
                      activeVendors.reduce((sum, v) => sum + (v.series[metricType]?.[hoveredIndex] ?? 0), 0)
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Leyenda interactiva de Vendedores */}
      <div className="border-t border-slate-800/80 pt-4 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider mr-1">
            Vendedores:
          </span>
          {data?.vendedores.map((v, idx) => {
            const color = VENDOR_COLORS[idx % VENDOR_COLORS.length]
            const isHidden = hiddenVendorIds.includes(v.id)
            const total = metricType === 'cobros' ? v.total_cobrado : v.total_ventas

            return (
              <button
                key={v.id}
                type="button"
                onClick={() => toggleVendorVisibility(v.id)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border transition text-xs font-semibold cursor-pointer ${
                  isHidden
                    ? 'bg-slate-950/40 border-slate-800 text-slate-500 opacity-50 line-through'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-200 shadow-sm'
                }`}
                title={isHidden ? `Mostrar a ${v.name}` : `Ocultar a ${v.name}`}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: isHidden ? '#64748b' : color }} />
                <span>{v.name}</span>
                <span className="font-mono text-slate-400 font-bold text-[11px] ml-1">
                  ({formatCurrency(total)})
                </span>
              </button>
            )
          })}
        </div>

        {/* Total acumulado global del período */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800/90 rounded-xl px-3.5 py-1.5">
          <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Período:</span>
          <span className="font-mono font-black text-white text-sm">
            {formatCurrency(currentMetricTotal)}
          </span>
        </div>
      </div>
    </div>
  )
}

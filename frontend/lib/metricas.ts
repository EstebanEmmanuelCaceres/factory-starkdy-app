import api from './api'

export interface MetricasCobrosFilters {
  // 1-12; 0 = todo el año. Si no se envía, el back usa el mes actual.
  mes?: number
  anio?: number
  vendedor_id?: number
}

export interface MetricasCobros {
  periodo: { mes: number; anio: number; desde: string; hasta: string }
  vendedor_id: number | null
  // Suma de precios de los pedidos creados en el período (sin cancelados)
  total_pedidos: number
  cantidad_pedidos: number
  // Pagos con estado 'pagado' recibidos en el período (por fecha de pago)
  cobrado: number
  cantidad_pagos: number
  // Saldo pendiente de los pedidos creados en el período
  por_cobrar: number
}

export async function fetchMetricasCobros(filters?: MetricasCobrosFilters): Promise<MetricasCobros> {
  const { data } = await api.get<{ status: string; data: MetricasCobros }>('/metricas/cobros', { params: filters })
  return data.data
}

export interface VendedorDiarioSeries {
  id: number
  name: string
  total_cobrado: number
  total_ventas: number
  series: {
    cobros: number[]
    ventas: number[]
  }
}

export interface MetricasVendedoresDiario {
  periodo: { desde: string; hasta: string }
  fechas: string[]
  vendedores: VendedorDiarioSeries[]
  totales_por_dia: {
    cobros: number[]
    ventas: number[]
  }
}

export interface VendedoresDiarioFilters {
  fecha_desde?: string
  fecha_hasta?: string
  vendedor_id?: number | string
}

export async function fetchVendedoresDiario(filters?: VendedoresDiarioFilters): Promise<MetricasVendedoresDiario> {
  const { data } = await api.get<{ status: string; data: MetricasVendedoresDiario }>('/metricas/vendedores-diario', { params: filters })
  return data.data
}

// ── Matriz Mensual de Unidades Vendidas por Producto ─────────────

export interface UnidadesVendidasFilters {
  anio?: number
  mes_desde?: number
  mes_hasta?: number
  vendedor_id?: number
}

export interface ColumnaMesUnidades {
  mes: number
  anio: number
  clave: string
  etiqueta_corta: string
  etiqueta_larga: string
}

export interface ProductoUnidadesVendidas {
  producto_id: number
  nombre: string
  sku: string | null
  por_mes: Record<string, number>
  total_unidades: number
  unidades_mes_comparado: number
  unidades_mes_anterior: number
  variacion_pct: number | null
}

export interface FilaTotalUnidadesVendidas {
  por_mes: Record<string, number>
  total_unidades: number
  unidades_mes_comparado: number
  unidades_mes_anterior: number
  variacion_pct: number | null
  total_productos: number
}

export interface UnidadesVendidasResponse {
  periodo: {
    anio: number
    mes_desde: number
    mes_hasta: number
    desde: string
    hasta: string
    comparacion: {
      mes_actual_clave: string
      mes_actual_etiqueta: string
      mes_anterior_clave: string
      mes_anterior_etiqueta: string
    }
  }
  meses: ColumnaMesUnidades[]
  productos: ProductoUnidadesVendidas[]
  fila_total: FilaTotalUnidadesVendidas
}

export async function fetchUnidadesVendidas(filters?: UnidadesVendidasFilters): Promise<UnidadesVendidasResponse> {
  const { data } = await api.get<{ status: string; data: UnidadesVendidasResponse }>('/metricas/unidades-vendidas', {
    params: filters,
  })
  return data.data
}

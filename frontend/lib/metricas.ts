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

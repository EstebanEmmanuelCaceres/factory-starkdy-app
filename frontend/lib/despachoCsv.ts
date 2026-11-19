import type { Pedido } from './pedidos'
import { parseNombreApellido } from './andreaniNormalizer'

/**
 * Escapa un valor para formato CSV estándar (RFC 4180).
 */
function escapeCsvField(value: string | number | null | undefined, separator = ','): string {
  const str = value === null || value === undefined ? '' : String(value).trim()
  if (
    str.includes(separator) ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Encabezados de importación masiva (Domicilio destino).
 * Fila 1: Grupos de columnas (Características 7 cols, Destinatario 5 cols, Domicilio destino 5 cols).
 * Fila 2: Títulos exactos con sus ejemplos y saltos de línea.
 */
export const ANDREANI_ROW_1 = 'Características,,,,,,,Destinatario,,,,,Domicilio destino,,,,'

export const ANDREANI_HEADERS = [
  'Paquete Guardado \nEj: caja 30',
  'Peso (grs)\nEj: ',
  'Alto (cm)\nEj: ',
  'Ancho (cm)\nEj: ',
  'Profundidad (cm)\nEj: ',
  'Valor declarado ($ C/IVA) *\nEj: ',
  'Numero Interno\nEj: ',
  'Nombre *\nEj: ',
  'Apellido *\nEj: ',
  'DNI *\nEj: ',
  'Email *\nEj: ',
  'Celular *\nEj: ',
  'Dirección *\nEj: ',
  'Provincia *\nEj: ',
  'Localidad *\nEj: ',
  'Código Postal *\nEj: ',
  'Observaciones\nEj: ',
]

export interface DespachoCsvOptions {
  paqueteGuardado?: string
  pesoGramos?: number
  valorDeclarado?: number
}

interface RowData {
  paqueteGuardado: string
  pesoGramos: number
  alto: string
  ancho: string
  profundidad: string
  valorDeclarado: number
  numeroInterno: string
  nombre: string
  apellido: string
  dniLimpio: string
  email: string
  celular: string
  direccion: string
  provincia: string
  localidad: string
  cp: string
  observacionesFinal: string
}

function mapPedidoToRowData(pedido: Pedido, options: DespachoCsvOptions = {}): RowData {
  const paqueteGuardado = options.paqueteGuardado || 'caja 30'
  const pesoGramos = options.pesoGramos ?? 1000
  const valorDeclarado = options.valorDeclarado ?? 35000
  const cli = pedido.cliente

  // 1. Nombre y Apellido (última palabra como apellido)
  const { nombre, apellido } = parseNombreApellido(cli?.nombre_cliente, cli?.nombre_empresa)

  // 2. DNI limpio
  const dniLimpio = (cli?.dni ?? '').replace(/\D/g, '')

  // 3. Celular completo en una sola columna
  const celular = cli?.telefono?.trim() ?? ''

  // 4. Dirección completa en una sola columna
  const direccion = cli?.direccion?.trim() ?? ''

  // 5. Provincia, Localidad y CP en columnas separadas
  const provincia = cli?.provincia?.trim() ?? ''
  const localidad = cli?.localidad?.trim() ?? ''
  const cp = cli?.cp?.trim() ?? ''

  // 6. Resumen de productos + observaciones
  const productosResumen = (pedido.productos ?? [])
    .map((prod) => {
      const qty = prod.pivot?.cantidad ?? 1
      return `${prod.nombre} x${qty}`
    })
    .join(' | ')

  const observacionesFinal = [productosResumen, cli?.observaciones?.trim()]
    .filter(Boolean)
    .join(' - ')

  return {
    paqueteGuardado,
    pesoGramos,
    alto: '',
    ancho: '',
    profundidad: '',
    valorDeclarado,
    numeroInterno: cli?.nombre_empresa?.trim() ?? '',
    nombre,
    apellido,
    dniLimpio,
    email: cli?.email ?? '',
    celular,
    direccion,
    provincia,
    localidad,
    cp,
    observacionesFinal,
  }
}

/**
 * Genera el archivo CSV con la plantilla oficial para envíos a domicilio.
 */
export function buildDespachoClientesCsv(
  pedidos: Pedido[],
  options: DespachoCsvOptions = {},
  separator = ','
): string {
  const row1 = separator === ',' ? ANDREANI_ROW_1 : ANDREANI_ROW_1.split(',').join(separator)
  const row2 = ANDREANI_HEADERS.map((h) => escapeCsvField(h, separator)).join(separator)

  const rows = pedidos.map((pedido) => {
    const data = mapPedidoToRowData(pedido, options)
    const fields = [
      data.paqueteGuardado,
      data.pesoGramos,
      data.alto,
      data.ancho,
      data.profundidad,
      data.valorDeclarado,
      data.numeroInterno,
      data.nombre,
      data.apellido,
      data.dniLimpio,
      data.email,
      data.celular,
      data.direccion,
      data.provincia,
      data.localidad,
      data.cp,
      data.observacionesFinal,
    ]
    return fields.map((f) => escapeCsvField(f, separator)).join(separator)
  })

  // Incluye BOM UTF-8 (\uFEFF) para que Excel en Windows reconozca tildes y eñes automáticamente
  return '\uFEFF' + [row1, row2, ...rows].join('\r\n')
}

/**
 * Descarga en el navegador el archivo CSV de despacho para los pedidos indicados.
 */
export function downloadDespachoClientesCsv(
  pedidos: Pedido[],
  options: DespachoCsvOptions = {},
  filenamePrefix = 'despacho_andreani'
): void {
  if (pedidos.length === 0) return

  const csvContent = buildDespachoClientesCsv(pedidos, options)
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const dateStr = new Date().toISOString().split('T')[0]
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `${filenamePrefix}_${dateStr}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

import * as XLSX from 'xlsx'
import type { Pedido } from './pedidos'
import {
  findAndreaniLocation,
  parseNombreApellido,
  parseCelular,
  parseDireccion,
} from './andreaniNormalizer'

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
 * Encabezados oficiales de importación masiva de Andreani (Domicilio destino).
 * Fila 1: Grupos de columnas.
 * Fila 2: Títulos exactos con sus ejemplos y saltos de línea oficiales.
 */
export const ANDREANI_ROW_1 = 'Características,,,,,,,Destinatario,,,,,,Domicilio destino,,,,,'

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
  'Celular código *\nEj: ',
  'Celular número *\nEj: ',
  'Calle *\nEj: ',
  'Número *\nEj: ',
  'Piso\nEj: ',
  'Departamento\nEj: ',
  'Provincia / Localidad / CP * \nEj: BUENOS AIRES / 11 DE SEPTIEMBRE / 1657',
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
  celCodigo: string
  celNumero: string
  calle: string
  numero: string
  piso: string
  depto: string
  provLocCp: string
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

  // 3. Celular separado en código y número sin 0 ni 15
  const { codigo: celCodigo, numero: celNumero } = parseCelular(cli?.telefono)

  // 4. Dirección separada en calle, número, piso y departamento
  const { calle, numero, piso, depto } = parseDireccion(cli?.direccion)

  // 5. Provincia / Localidad / CP canónico de Andreani
  const provLocCp = findAndreaniLocation(cli?.provincia, cli?.localidad, cli?.cp)

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
    numeroInterno: pedido.codigo ? `#${pedido.codigo}` : `#${pedido.id}`,
    nombre,
    apellido,
    dniLimpio,
    email: cli?.email ?? '',
    celCodigo,
    celNumero,
    calle,
    numero,
    piso,
    depto,
    provLocCp,
    observacionesFinal,
  }
}

/**
 * Genera el archivo Excel (.xlsx) oficial de Andreani inyectando los datos
 * directamente en la plantilla original oficial (`/templates/plantilla_andreani.xlsx`).
 * Esto conserva intactas las hojas ("A domicilio", "A sucursal", "Configuracion"),
 * los estilos, validaciones y metadatos requeridos por la plataforma de Andreani.
 */
export async function buildDespachoAndreaniXlsx(
  pedidos: Pedido[],
  options: DespachoCsvOptions = {}
): Promise<Blob> {
  const response = await fetch('/templates/plantilla_andreani.xlsx')
  if (!response.ok) {
    throw new Error('No se pudo cargar la plantilla oficial de Andreani desde /templates/plantilla_andreani.xlsx')
  }
  const arrayBuffer = await response.arrayBuffer()

  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const ws = wb.Sheets['A domicilio'] || wb.Sheets[wb.SheetNames[0]]

  const dataRows: (string | number)[][] = pedidos.map((pedido) => {
    const data = mapPedidoToRowData(pedido, options)
    return [
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
      data.celCodigo,
      data.celNumero,
      data.calle,
      data.numero,
      data.piso,
      data.depto,
      data.provLocCp,
      data.observacionesFinal,
    ]
  })

  // origin: -1 agrega las filas al final de la hoja (después de las 2 filas de encabezados originales)
  XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: -1 })

  const outBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return new Blob([outBuf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/**
 * Descarga el archivo Excel oficial (.xlsx) de Andreani con los pedidos listos para despacho.
 */
export async function downloadDespachoAndreaniXlsx(
  pedidos: Pedido[],
  options: DespachoCsvOptions = {},
  filenamePrefix = 'despacho_andreani'
): Promise<void> {
  if (pedidos.length === 0) return

  const blob = await buildDespachoAndreaniXlsx(pedidos, options)
  const url = URL.createObjectURL(blob)

  const dateStr = new Date().toISOString().split('T')[0]
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `${filenamePrefix}_${dateStr}.xlsx`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Genera el archivo CSV con la plantilla oficial de Andreani para envíos a domicilio (alternativa texto).
 */
export function buildDespachoClientesCsv(
  pedidos: Pedido[],
  options: DespachoCsvOptions = {},
  separator = ','
): string {
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
      data.celCodigo,
      data.celNumero,
      data.calle,
      data.numero,
      data.piso,
      data.depto,
      data.provLocCp,
      data.observacionesFinal,
    ]
    return fields.map((f) => escapeCsvField(f, separator)).join(separator)
  })

  return '\uFEFF' + [ANDREANI_ROW_1, row2, ...rows].join('\r\n')
}

/**
 * Descarga en el navegador el archivo CSV de despacho formateado para Andreani.
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

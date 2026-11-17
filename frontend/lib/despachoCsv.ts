import type { Pedido } from './pedidos'

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
 * Genera el contenido CSV con los datos del cliente y del pedido para despacho.
 * Estructura modular lista para adaptarse a la plantilla específica de Andreani.
 */
export function buildDespachoClientesCsv(pedidos: Pedido[], separator = ','): string {
  const headers = [
    'Pedido',
    'Nombre y Apellido',
    'Empresa',
    'DNI / CUIT',
    'Telefono',
    'Email',
    'Direccion',
    'Localidad',
    'Provincia',
    'Codigo Postal',
    'Productos',
    'Observaciones Cliente',
  ]

  const rows = pedidos.map((pedido) => {
    const cli = pedido.cliente
    const productosResumen = (pedido.productos ?? [])
      .map((prod) => {
        const qty = prod.pivot?.cantidad ?? 1
        return `${prod.nombre} x${qty}`
      })
      .join(' | ')

    const fields = [
      pedido.codigo ? `#${pedido.codigo}` : `#${pedido.id}`,
      cli?.nombre_cliente ?? '',
      cli?.nombre_empresa ?? '',
      cli?.dni ?? '',
      cli?.telefono ?? '',
      cli?.email ?? '',
      cli?.direccion ?? '',
      cli?.localidad ?? '',
      cli?.provincia ?? '',
      cli?.cp ?? '',
      productosResumen,
      cli?.observaciones ?? '',
    ]

    return fields.map((f) => escapeCsvField(f, separator)).join(separator)
  })

  // Incluye BOM UTF-8 (\uFEFF) para que Excel en Windows reconozca tildes y eñes automáticamente
  return '\uFEFF' + [headers.map((h) => escapeCsvField(h, separator)).join(separator), ...rows].join('\r\n')
}

/**
 * Descarga en el navegador el archivo CSV de despacho para los pedidos indicados.
 */
export function downloadDespachoClientesCsv(pedidos: Pedido[], filenamePrefix = 'despacho_clientes'): void {
  if (pedidos.length === 0) return

  const csvContent = buildDespachoClientesCsv(pedidos)
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

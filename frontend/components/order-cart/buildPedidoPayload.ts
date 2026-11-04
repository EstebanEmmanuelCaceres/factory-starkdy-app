import type { CreatePedidoInput, LineaPedidoInput } from '@/lib/pedidos'
import { claveLinea } from '@/components/PedidoAtributos/helpers'
import { OrderFormValues, OrderLine, getOrderTotal } from './Types'

export const generatePedidoCodigo = () => `PD-${Date.now().toString().slice(-6)}`

/**
 * Una entrada por línea del pedido (producto + atributos). Un mismo producto puede ir varias veces
 * si los atributos son distintos; las líneas iguales se unen sumando la cantidad (el back hace lo mismo).
 */
export function groupLines(lines: OrderLine[]): LineaPedidoInput[] {
    const grouped = new Map<string, LineaPedidoInput>()
    for (const line of lines) {
        const key = claveLinea(line.productId, line.attributes)
        const existing = grouped.get(key)
        if (existing) {
            existing.cantidad += line.quantity
        } else {
            grouped.set(key, { id: line.productId, cantidad: line.quantity, atributos: line.attributes })
        }
    }
    return Array.from(grouped.values())
}

interface BuildPedidoPayloadOptions {
    codigo: string
    // Datos del cliente registrado en el wizard (cuando no existe todavía en la base)
    newClient?: CreatePedidoInput['cliente'] | null
}

/**
 * Traduce los valores del form (RHF) al body que espera POST /api/pedidos.
 * No se envían `etapas`: si la clave viene, el back borra del catálogo del producto
 * las etapas que no estén en el request. Sin ella, genera las tareas con las etapas existentes.
 */
export function buildCreatePedidoPayload(
    values: OrderFormValues,
    { codigo, newClient }: BuildPedidoPayloadOptions,
): CreatePedidoInput {
    const total = getOrderTotal(values.lines, values.discount)
    const paid = values.payment.amount || 0
    const clientId = values.client?.id ?? null

    return {
        cliente_id: clientId,
        cliente: clientId ? null : newClient ?? null,
        codigo,
        prioridad: values.priority,
        fecha_entrega: values.deliveryDate,
        precio: total,
        comentario: values.comment.trim() || null,
        // tipo_pago se omite: el back lo calcula (unico si el pago cubre el total, si no parcial)
        monto_pago_inicial: paid > 0 ? paid : null,
        medio_pago_inicial: paid > 0 ? values.payment.method : null,
        productos: groupLines(values.lines),
    }
}

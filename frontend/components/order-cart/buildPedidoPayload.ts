import type { CreatePedidoInput } from '@/lib/pedidos'
import { OrderFormValues, OrderLine, getOrderTotal } from './Types'

export const generatePedidoCodigo = () => `PD-${Date.now().toString().slice(-6)}`

/**
 * El back guarda los productos con `sync()` sobre la tabla pivote (producto_id => cantidad),
 * así que un mismo producto agregado en varias líneas se tiene que mandar una sola vez
 * con la cantidad sumada; si no, la última línea pisa a las anteriores.
 */
export function groupLinesByProduct(lines: OrderLine[]): { id: number; cantidad: number }[] {
    const quantities = new Map<number, number>()
    for (const line of lines) {
        quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity)
    }
    return Array.from(quantities, ([id, cantidad]) => ({ id, cantidad }))
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
        productos: groupLinesByProduct(values.lines),
    }
}

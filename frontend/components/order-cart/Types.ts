import type { ValoresAtributos } from '@/lib/entities/atributos'

export type Prioridad = 'baja' | 'normal' | 'alta' | 'critica'

export type MedioPago = 'transferencia' | 'efectivo' | 'mercadopago' | 'tarjeta'

export interface ClienteResumen {
    id: number | null
    nombre_cliente: string
    nombre_empresa: string
}

export interface OrderLine {
    productId: number
    // Valores de los atributos del producto {clave: valor}; ver components/PedidoAtributos
    attributes: ValoresAtributos
    quantity: number
    unitPriceOverride: number | null
    notes: string
    fileName: string
}

export interface DiscountValue {
    mode: 'monto' | 'porcentaje'
    value: number
}

export interface PaymentValue {
    amount: number
    method: MedioPago
}

function toLocalISODate(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

function addDays(d: Date, days: number): Date {
    const copy = new Date(d)
    copy.setDate(copy.getDate() + days)
    return copy
}

export const getInitials = (name = '') =>
    name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

export interface OrderFormValues {
    client: ClienteResumen | null
    deliveryDate: string
    priority: Prioridad
    comment: string
    lines: OrderLine[]
    discount: DiscountValue
    payment: PaymentValue
}

export function getDefaultOrderValues(): OrderFormValues {
    return {
        client: null,
        deliveryDate: toLocalISODate(addDays(new Date(), 15)),
        priority: 'normal',
        comment: '',
        lines: [],
        discount: { mode: 'monto', value: 0 },
        payment: { amount: 0, method: 'transferencia' },
    }
}

export const getDefaultLine = (productId: number, precio: number | null): OrderLine => ({
    productId,
    attributes: {},
    quantity: 10,
    unitPriceOverride: precio,
    notes: '',
    fileName: '',
})

export const getLineSubtotal = (line: OrderLine) =>
    (line.unitPriceOverride ?? 0) * (line.quantity || 0)

export function getOrderTotal(lines: OrderLine[], discount: DiscountValue): number {
    const subtotal = lines.reduce((acc, line) => acc + getLineSubtotal(line), 0)
    const discountAmount = discount.mode === 'porcentaje'
        ? subtotal * (discount.value || 0) / 100
        : discount.value || 0
    return Math.max(subtotal - discountAmount, 0)
}

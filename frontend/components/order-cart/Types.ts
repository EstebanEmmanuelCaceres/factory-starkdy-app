export type Prioridad = 'baja' | 'normal' | 'alta' | 'critica'

export type MedioPago = 'transferencia' | 'efectivo' | 'mercadopago' | 'tarjeta'

export interface ClienteResumen {
    id: number | null
    nombre_cliente: string
    nombre_empresa: string
}

export interface OrderLine {
    productId: number
    attributes: Record<string, string | boolean>
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
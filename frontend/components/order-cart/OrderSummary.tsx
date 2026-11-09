'use client'

import { useFormContext, useWatch } from 'react-hook-form'
import type { Product } from '@/lib/products'
import { AtributosLineaResumen } from '@/components/PedidoAtributos/AtributosLineaResumen'
import { OrderFormValues, getInitials, getLineSubtotal, getOrderPrice, getOrderTotal } from './Types'
import { PRIORIDADES } from './PriorityField'
import { MEDIOS_PAGO } from './PaymentMethodField'

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })
const label = 'text-[11px] font-bold uppercase tracking-[.08em] text-[#8390ab]'

const formatDate = (iso: string) => {
    if (!iso) return '—'
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
}

interface OrderSummaryProps {
    products: Product[]
}

export const OrderSummary = ({ products }: OrderSummaryProps) => {
    const { control } = useFormContext<OrderFormValues>()
    const [client, deliveryDate, priority, comment, lines, discount, priceOverride, payment] = useWatch({
        control,
        name: ['client', 'deliveryDate', 'priority', 'comment', 'lines', 'discount', 'priceOverride', 'payment'],
    })

    const subtotal = lines.reduce((acc, line) => acc + getLineSubtotal(line), 0)
    const calculated = getOrderTotal(lines, discount)
    const total = getOrderPrice(lines, discount, priceOverride)
    const discountAmount = subtotal - calculated
    const paid = payment.amount || 0
    const pending = Math.max(total - paid, 0)

    const getProduct = (id: number) => products.find((p) => p.id === id)
    const priorityLabel = PRIORIDADES.find((p) => p.value === priority)?.label ?? priority
    const methodLabel = MEDIOS_PAGO.find((m) => m.value === payment.method)?.label ?? payment.method

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pt-5 text-[#e7ecf5]">
            {/* Datos del pedido */}
            <section className="grid grid-cols-1 gap-3 rounded-[14px] border border-[#1b263d] bg-[#0f192b] p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-6">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[#193a81] text-[14px] font-bold text-white">
                        {getInitials(client?.nombre_cliente)}
                    </div>
                    <div className="min-w-0">
                        <p className={label}>Cliente</p>
                        <p className="truncate text-[14px] font-bold">{client?.nombre_cliente}</p>
                        <p className="truncate text-[12px] text-[#a8b3c8]">{client?.nombre_empresa}</p>
                    </div>
                </div>
                <div>
                    <p className={label}>Entrega estimada</p>
                    <p className="text-[14px] font-semibold">{formatDate(deliveryDate)}</p>
                </div>
                <div>
                    <p className={label}>Prioridad</p>
                    <p className="text-[14px] font-semibold">{priorityLabel}</p>
                </div>
                {comment.trim() && (
                    <div className="sm:col-span-3">
                        <p className={label}>Descripción / Observaciones</p>
                        <p className="whitespace-pre-line text-[13px] text-[#a8b3c8]">{comment}</p>
                    </div>
                )}
            </section>

            {/* Productos */}
            <section className="overflow-hidden rounded-[14px] border border-[#1b263d] bg-[#0f192b]">
                <header className="flex items-baseline justify-between border-b border-[#1b263d] px-4 py-3">
                    <p className={label}>Productos</p>
                    <span className="text-[12px] text-[#8390ab]">{lines.length} {lines.length === 1 ? 'línea' : 'líneas'}</span>
                </header>
                <ul className="divide-y divide-[#1b263d]">
                    {lines.map((line, index) => (
                        <li key={index} className="flex items-center gap-3 px-4 py-3">
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-[14px] font-semibold">
                                    {getProduct(line.productId)?.nombre ?? `Producto #${line.productId}`}
                                </p>
                                <p className="text-[12px] text-[#a8b3c8] tabular-nums">
                                    {line.quantity} u × {money.format(line.unitPriceOverride ?? 0)}
                                </p>
                                <AtributosLineaResumen product={getProduct(line.productId)} valores={line.attributes} className="mt-1" />
                                {line.notes.trim() && <p className="mt-0.5 text-[12px] text-[#8390ab]">{line.notes}</p>}
                            </div>
                            <p className="shrink-0 text-[14px] font-bold tabular-nums">{money.format(getLineSubtotal(line))}</p>
                        </li>
                    ))}
                </ul>
            </section>

            {/* Totales y pago */}
            <section className="flex flex-col gap-2 rounded-[14px] border border-[#1b263d] bg-[#0f192b] p-4 text-[14px]">
                <div className="flex justify-between text-[#a8b3c8]">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{money.format(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                    <div className="flex justify-between text-[#a8b3c8]">
                        <span>Descuento{discount.mode === 'porcentaje' ? ` (${discount.value}%)` : ''}</span>
                        <span className="tabular-nums">− {money.format(discountAmount)}</span>
                    </div>
                )}
                {priceOverride !== null && priceOverride !== calculated && (
                    <div className="flex justify-between text-[#a8b3c8]">
                        <span>Según productos (referencia)</span>
                        <span className="tabular-nums line-through">{money.format(calculated)}</span>
                    </div>
                )}
                <div className="flex items-baseline justify-between border-t border-[#1b263d] pt-2">
                    <span className="font-semibold">Total{priceOverride !== null && ' (precio acordado)'}</span>
                    <span className="text-xl font-bold tabular-nums">{money.format(total)}</span>
                </div>
                {paid > 0 && (
                    <>
                        <div className="flex justify-between text-[#34d399]">
                            <span>Pago inicial · {methodLabel}</span>
                            <span className="tabular-nums">− {money.format(paid)}</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                            <span className="text-[#a8b3c8]">Saldo pendiente</span>
                            <span className="text-lg font-bold tabular-nums text-amber-400">{money.format(pending)}</span>
                        </div>
                    </>
                )}
            </section>
        </div>
    )
}

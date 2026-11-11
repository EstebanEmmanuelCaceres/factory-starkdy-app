'use client'

import React, { useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import type { Product } from '@/lib/products'
import { AtributosLineaResumen } from '@/components/PedidoAtributos/AtributosLineaResumen'
import { OrderFormValues, getInitials, getLineSubtotal, getOrderTotal } from './Types'
import { PRIORIDADES } from './PriorityField'
import { MEDIOS_PAGO } from './PaymentMethodField'
import { downloadRemitoProformaPdf } from '@/lib/remitoProformaPdf'

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })
const label = 'text-[11px] font-bold uppercase tracking-[.08em] text-[#8390ab]'

const formatDate = (iso: string) => {
    if (!iso) return '—'
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
}

interface OrderSummaryProps {
    products: Product[]
    onEditLine?: (index: number) => void
    codigo?: string
}

export const OrderSummary = ({ products, onEditLine, codigo }: OrderSummaryProps) => {
    const { control } = useFormContext<OrderFormValues>()
    const [client, deliveryDate, priority, comment, lines, discount, payment, customTotal] = useWatch({
        control,
        name: ['client', 'deliveryDate', 'priority', 'comment', 'lines', 'discount', 'payment', 'customTotal'],
    })

    const [isDownloading, setIsDownloading] = useState(false)

    const subtotal = lines.reduce((acc, line) => acc + getLineSubtotal(line), 0)
    const total = getOrderTotal(lines, discount, customTotal)
    const discountAmount = Math.max(0, subtotal - total)
    const paid = payment.amount || 0
    const pending = Math.max(total - paid, 0)

    const getProduct = (id: number) => products.find((p) => p.id === id)
    const priorityLabel = PRIORIDADES.find((p) => p.value === priority)?.label ?? priority
    const methodLabel = MEDIOS_PAGO.find((m) => m.value === payment.method)?.label ?? payment.method

    const handleDownloadProforma = () => {
        try {
            setIsDownloading(true)
            const items = lines.map((line) => {
                const prod = getProduct(line.productId)
                const nombre = prod?.nombre ?? `Producto #${line.productId}`
                const attrEntries = Object.entries(line.attributes || {}).filter(([_, v]) => v != null && v !== '')
                const atributosTexto = attrEntries.length > 0
                    ? attrEntries.map(([k, v]) => `${k}: ${v}`).join(', ')
                    : undefined
                const lineSubtotal = getLineSubtotal(line)
                const precioUnitario = line.unitPriceOverride ?? (line.quantity ? lineSubtotal / line.quantity : 0)
                return {
                    nombre,
                    atributosTexto,
                    cantidad: line.quantity,
                    precioUnitario,
                    total: lineSubtotal,
                }
            })

            downloadRemitoProformaPdf({
                codigo,
                fecha: formatDate(new Date().toISOString().split('T')[0]),
                clienteNombre: client?.nombre_cliente,
                clienteEmpresa: client?.nombre_empresa,
                items,
                total,
            })
        } finally {
            setIsDownloading(false)
        }
    }

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pt-5 text-[#e7ecf5]">
            {/* Tarjeta de descarga de Remito Proforma */}
            <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[14px] border border-blue-500/20 bg-gradient-to-r from-blue-950/40 to-slate-900/60 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20">
                        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div>
                        <h4 className="text-[14px] font-bold text-white">Remito Proforma</h4>
                        <p className="text-[12px] text-[#8390ab]">Descargá el remito proforma en PDF con la lista de productos y datos bancarios.</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleDownloadProforma}
                    disabled={isDownloading || lines.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white shadow-md hover:bg-blue-500 active:scale-[0.98] transition-all cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>{isDownloading ? 'Generando…' : 'Descargar Proforma'}</span>
                </button>
            </section>

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
                                <div className="flex items-center gap-2">
                                    <p className="truncate text-[14px] font-semibold">
                                        {getProduct(line.productId)?.nombre ?? `Producto #${line.productId}`}
                                    </p>
                                    {onEditLine && (
                                        <button
                                            type="button"
                                            onClick={() => onEditLine(index)}
                                            className="text-[11px] font-medium text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                                            title="Editar producto"
                                        >
                                            ✏️ Editar
                                        </button>
                                    )}
                                </div>
                                <p className="text-[12px] text-[#a8b3c8] tabular-nums">
                                    {line.quantity} u. · Total: {money.format(getLineSubtotal(line))}
                                    {line.unitPriceOverride != null && ` (${money.format(line.unitPriceOverride)} c/u)`}
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
                    <span>Subtotal productos</span>
                    <span className="tabular-nums">{money.format(subtotal)}</span>
                </div>
                {customTotal != null ? (
                    <div className="flex justify-between text-amber-300">
                        <span>Total acordado / personalizado</span>
                        <span className="tabular-nums font-semibold">{money.format(total)}</span>
                    </div>
                ) : discountAmount > 0 ? (
                    <div className="flex justify-between text-[#a8b3c8]">
                        <span>Descuento{discount.mode === 'porcentaje' ? ` (${discount.value}%)` : ''}</span>
                        <span className="tabular-nums">− {money.format(discountAmount)}</span>
                    </div>
                ) : null}
                <div className="flex items-baseline justify-between border-t border-[#1b263d] pt-2">
                    <span className="font-semibold">Total{customTotal != null && ' (precio acordado)'}</span>
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

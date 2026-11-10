'use client'

import React, { useState } from 'react'
import type { Pedido } from '@/lib/pedidos'
import type { Product } from '@/lib/products'
import type { OrderLine } from './Types'
import { getLineSubtotal } from './Types'
import { downloadRemitoProformaPdf } from '@/lib/remitoProformaPdf'

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })

const formatDate = (iso?: string) => {
    if (!iso) {
        const d = new Date()
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
    }
    const [y, m, d] = iso.split('T')[0].split('-')
    return `${d}/${m}/${y}`
}

export const OrderCreated = ({
    pedido,
    formLines,
    products,
}: {
    pedido: Pedido
    formLines?: OrderLine[]
    products?: Product[]
}) => {
    const [isDownloading, setIsDownloading] = useState(false)

    const handleDownloadProforma = () => {
        try {
            setIsDownloading(true)
            let items: any[] = []

            if (formLines && formLines.length > 0 && products) {
                items = formLines.map((line) => {
                    const prod = products.find((p) => p.id === line.productId)
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
            } else if (pedido.productos && pedido.productos.length > 0) {
                items = pedido.productos.map((prod) => {
                    const qty = prod.pivot?.cantidad || 1
                    const unitPrice = prod.precio != null ? Number(prod.precio) : 0
                    const attrEntries = Object.entries(prod.pivot?.atributos || {}).filter(([_, v]) => v != null && v !== '')
                    const atributosTexto = attrEntries.length > 0
                        ? attrEntries.map(([k, v]) => `${k}: ${v}`).join(', ')
                        : undefined
                    return {
                        nombre: prod.nombre,
                        atributosTexto,
                        cantidad: qty,
                        precioUnitario: unitPrice,
                        total: unitPrice * qty,
                    }
                })
            }

            const total = pedido.precio != null ? Number(pedido.precio) : items.reduce((acc, it) => acc + it.total, 0)

            downloadRemitoProformaPdf({
                codigo: pedido.codigo,
                fecha: formatDate(pedido.created_at),
                clienteNombre: pedido.cliente?.nombre_cliente,
                clienteEmpresa: pedido.cliente?.nombre_empresa,
                items,
                total,
            })
        } finally {
            setIsDownloading(false)
        }
    }

    return (
        <div className="flex flex-col items-center gap-4 py-8 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="grid size-16 place-items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <svg viewBox="0 0 24 24" className="size-8 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
            </div>
            <div>
                <h3 className="text-xl font-bold text-white">¡Pedido creado con éxito!</h3>
                <p className="mt-1 text-[14px] text-[#a8b3c8]">
                    Se registró el pedido <span className="font-semibold text-[#e7ecf5]">{pedido.codigo}</span>
                    {pedido.cliente && (
                        <> para <span className="font-semibold text-[#e7ecf5]">{pedido.cliente.nombre_cliente}</span></>
                    )}
                    {pedido.precio != null && (
                        <> por <span className="font-semibold text-[#e7ecf5]">{money.format(Number(pedido.precio))}</span></>
                    )}
                    .
                </p>
            </div>

            <button
                type="button"
                onClick={handleDownloadProforma}
                disabled={isDownloading}
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow hover:bg-blue-500 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>{isDownloading ? 'Generando remito…' : 'Descargar Remito Proforma (PDF)'}</span>
            </button>
        </div>
    )
}

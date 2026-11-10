'use client'

import React from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { OrderFormValues, getOrderTotal } from './Types'

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

export const OrderFooterSummary = () => {
    const { control } = useFormContext<OrderFormValues>()
    const lines = useWatch({ control, name: 'lines' })
    const discount = useWatch({ control, name: 'discount' })
    const paid = useWatch({ control, name: 'payment.amount' })
    const customTotal = useWatch({ control, name: 'customTotal' })

    const total = getOrderTotal(lines, discount, customTotal)
    const units = lines.reduce((acc, line) => acc + (line.quantity || 0), 0)
    const pending = Math.max(total - (paid || 0), 0)

    return (
        <>
            <span className="hidden text-[13px] text-[#8390ab] md:inline">
                {lines.length} {lines.length === 1 ? 'producto' : 'productos'} · {units} u
            </span>
            {paid > 0 && (
                <span className="hidden text-[13px] font-semibold text-amber-400 md:inline">
                    Saldo {money.format(pending)}
                </span>
            )}
            <span className="flex items-baseline gap-2 whitespace-nowrap">
                <span className="text-[12px] text-[#a8b3c8]">Total</span>
                <span className="text-lg font-bold tabular-nums text-[#e7ecf5]">{money.format(total)}</span>
            </span>
        </>
    )
}

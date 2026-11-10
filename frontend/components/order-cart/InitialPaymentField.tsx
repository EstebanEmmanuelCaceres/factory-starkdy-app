'use client'

import React from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { OrderFormValues, getOrderTotal, getOrderLinesSubtotal } from './Types'
import { PaymentMethodField } from './PaymentMethodField'

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })
const round2 = (n: number) => Math.round(n * 100) / 100

export const InitialPaymentField = () => {
    const { register, setValue, control, formState: { errors } } = useFormContext<OrderFormValues>()
    const lines = useWatch({ control, name: 'lines' })
    const discount = useWatch({ control, name: 'discount' })
    const amount = useWatch({ control, name: 'payment.amount' })
    const customTotal = useWatch({ control, name: 'customTotal' })

    const linesSubtotal = getOrderLinesSubtotal(lines)
    const isCustomTotal = customTotal != null && !isNaN(customTotal)
    const total = getOrderTotal(lines, discount, customTotal)
    const pending = Math.max(total - (amount || 0), 0)

    const setAmount = (value: number) =>
        setValue('payment.amount', round2(Math.min(total, Math.max(0, value))), { shouldDirty: true, shouldValidate: true })

    const handleCustomTotalChange = (valStr: string) => {
        if (valStr.trim() === '') {
            setValue('customTotal', null, { shouldDirty: true })
        } else {
            const num = Number(valStr)
            setValue('customTotal', isNaN(num) ? null : Math.max(0, num), { shouldDirty: true })
        }
    }

    return (
        <div className="flex flex-col gap-3">
            {/* 1. Valor Total del Pedido (Editable) */}
            <div className="flex flex-col gap-2 p-3.5 border border-[#2a3a59] rounded-[12px] bg-[#0f192b]">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs">💰</span>
                        <label className="text-[11px] font-bold uppercase tracking-[.08em] text-[#e7ecf5]">
                            Valor total del pedido
                        </label>
                    </div>
                    {isCustomTotal && (
                        <button
                            type="button"
                            onClick={() => setValue('customTotal', null, { shouldDirty: true })}
                            className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                            title="Volver a la suma automática de los productos"
                        >
                            Restablecer suma
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2 h-[44px] px-[14px] rounded-[10px] border border-[#2a3a59] bg-[#08101d] text-[#e7ecf5] focus-within:border-blue-500 transition-colors">
                    <span className="text-[#a8b3c8] font-bold">$</span>
                    <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="w-full h-full bg-transparent outline-none text-[#e7ecf5] font-bold text-[16px] placeholder-[#8390ab]"
                        placeholder="0.00"
                        value={isCustomTotal ? (customTotal ?? '') : (linesSubtotal > 0 ? linesSubtotal : '')}
                        onChange={(e) => handleCustomTotalChange(e.target.value)}
                    />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#8390ab]">
                    <span>Suma productos: ${linesSubtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    {isCustomTotal && (
                        <span className="text-amber-400 font-medium">✏️ Total editado</span>
                    )}
                </div>
            </div>

            {/* 2. Pago Inicial / Adelanto y Saldo que queda */}
            <div className="flex flex-col gap-2.5 p-3.5 border border-[#34d39947] rounded-[12px] bg-[#0a1918]">
                <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.08em] text-[#34d399]">
                    <svg className="stroke-current stroke-2 fill-none w-[16px] h-[16px]" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2"></rect><circle cx="12" cy="12" r="2.6"></circle><path d="M6 9.5v5M18 9.5v5"></path></svg>
                    <p>Pago inicial / adelanto</p>
                    <p className="ml-auto text-[11px] font-semibold tracking-normal text-[#8390ab] normal-case">Opcional</p>
                </div>
                <div className="flex gap-2">
                    <div className="flex items-center gap-2 w-full h-[44px] px-[14px] rounded-[10px] border border-[#2a3a59] bg-[#08101d] text-[#e7ecf5] font-[inherit] text-[14px] outline-none transition-[border-color,box-shadow] duration-150 [color-scheme:dark]">
                        <p className="text-[#a8b3c8]">$</p>
                        <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="w-full h-full bg-transparent outline-none text-[#e7ecf5] placeholder-[#8390ab] text-[14px]"
                            placeholder="0,00"
                            {...register('payment.amount', {
                                setValueAs: (v) => (v === '' || v == null ? 0 : Number(v)),
                                min: { value: 0, message: 'El pago no puede ser negativo' },
                                validate: (v) => v <= total || 'El pago no puede superar el total del pedido',
                            })}
                        />
                    </div>
                    <button type="button" onClick={() => setAmount(total / 2)} disabled={total === 0} className="px-3 text-[13px] border border-[#2a3a59] text-[#a8b3c8] hover:bg-[#152139] hover:text-[#e7ecf5] cursor-pointer rounded-[10px] disabled:opacity-40 disabled:cursor-not-allowed">50%</button>
                    <button type="button" onClick={() => setAmount(total)} disabled={total === 0} className="px-3 text-[13px] border border-[#2a3a59] text-[#a8b3c8] hover:bg-[#152139] hover:text-[#e7ecf5] cursor-pointer rounded-[10px] disabled:opacity-40 disabled:cursor-not-allowed">Total</button>
                </div>
                {errors.payment?.amount && (
                    <p className="text-[12px] text-rose-400">{errors.payment.amount.message}</p>
                )}
                <PaymentMethodField />
                <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-[#34d39947] text-[#a8b3c8]">
                    <div className="flex flex-col">
                        <p className="text-[12px] font-semibold text-[#a8b3c8]">Saldo que queda</p>
                        <span className="text-[10px] text-[#8390ab]">Total − Adelanto</span>
                    </div>
                    <p className="text-[18px] font-bold text-[#34d399]">{money.format(pending)}</p>
                </div>
            </div>
        </div>
    )
}

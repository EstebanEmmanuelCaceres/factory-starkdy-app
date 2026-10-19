'use client'

import React from 'react'
import { Controller, useFormContext } from 'react-hook-form'
import { MedioPago } from './Types'

interface PaymentMethodOption {
    value: MedioPago
    label: string
    icon: (props: { className?: string }) => React.JSX.Element
}

export const MEDIOS_PAGO: readonly PaymentMethodOption[] = [
    {
        value: 'transferencia',
        label: 'Transferencia',
        icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 10l9-6 9 6" />
                <path d="M5 10v8M9.7 10v8M14.3 10v8M19 10v8M3 20.5h18" />
            </svg>
        ),
    },
    {
        value: 'efectivo',
        label: 'Efectivo',
        icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
                <rect x="2.5" y="6" width="19" height="12" rx="2" />
                <circle cx="12" cy="12" r="2.6" />
                <path d="M6 9.5v5M18 9.5v5" />
            </svg>
        ),
    },
    {
        value: 'mercadopago',
        label: 'Mercado Pago',
        icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4H6a2 2 0 0 0-2 2" />
                <rect x="4" y="7" width="17" height="13" rx="2" />
                <path d="M16 13.5h.01" />
            </svg>
        ),
    },
    {
        value: 'tarjeta',
        label: 'Tarjeta',
        icon: ({ className }) => (
            <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 10h18M7 15h4" />
            </svg>
        ),
    },
] as const

interface PaymentMethodFieldProps {
    name?: string
    showLabel?: boolean
}

export const PaymentMethodField = ({
    showLabel = true,
}: PaymentMethodFieldProps) => {
    const { control } = useFormContext()

    return (
        <div className="flex flex-col gap-2">
            {showLabel && (
                <span id="l-medio" className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8390ab]">
                    Medio de pago
                </span>
            )}
            <Controller
                control={control}
                name={'payment.method'}
                render={({ field }) => (
                    <div
                        role="group"
                        aria-labelledby="l-medio"
                        className="grid grid-cols-2 gap-2"
                    >
                        {MEDIOS_PAGO.map((m) => {
                            const selected = field.value === m.value
                            const IconComponent = m.icon

                            return (
                                <button
                                    key={m.value}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => field.onChange(m.value)}
                                    onBlur={field.onBlur}
                                    className={`flex h-11 cursor-pointer items-center justify-start gap-2 rounded-[10px] border px-3 text-[13px] font-semibold transition ${selected
                                        ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.5)]'
                                        : 'border-[#2a3a59] bg-[#08101d] text-[#8390ab] hover:border-[#3d517a] hover:bg-[#111c30] hover:text-[#e7ecf5]'
                                        }`}
                                >
                                    <IconComponent className="h-4 w-4 shrink-0 stroke-current stroke-2 fill-none" />
                                    {m.label}
                                </button>
                            )
                        })}
                    </div>
                )}
            />
        </div>
    )
}

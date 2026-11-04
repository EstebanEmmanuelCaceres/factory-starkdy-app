'use client'

import React from 'react'

export interface WizardFooterAction {
    label: string
    // Texto corto para mobile (si no se pasa, se usa `label`)
    shortLabel?: string
    onClick?: () => void
    disabled?: boolean
    // Para enviar un <form> externo: type="submit" + form="<id del form>"
    type?: 'button' | 'submit'
    form?: string
}

interface WizardFooterProps {
    back?: WizardFooterAction
    next?: WizardFooterAction
    // Contenido del medio (ej. total del pedido); cambia según la etapa
    children?: React.ReactNode
}

// Espacio que el contenido del modal deja abajo para que el footer no lo tape
export const WIZARD_FOOTER_SPACE = 'pb-28'

const ArrowIcon = ({ direction }: { direction: 'left' | 'right' }) => (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden="true">
        <path d={direction === 'left' ? 'M19 12H5M11 6l-6 6 6 6' : 'M5 12h14M13 6l6 6-6 6'} />
    </svg>
)

export const WizardFooter = ({ back, next, children }: WizardFooterProps) => (
    <footer className="absolute inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-[#1b263d] bg-[#0b1322] px-4 py-3.5 sm:px-6">
        {back && (
            <button
                type={back.type ?? 'button'}
                form={back.form}
                onClick={back.onClick}
                disabled={back.disabled}
                aria-label={back.label}
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[10px] border border-[#2a3a59] px-3.5 text-sm font-semibold text-[#a8b3c8] transition-colors hover:bg-[#152139] hover:text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
            >
                <ArrowIcon direction="left" />
                <span className="hidden sm:inline">{back.label}</span>
            </button>
        )}
        <div className="ml-auto flex min-w-0 items-center justify-end gap-4">{children}</div>
        {next && (
            <button
                type={next.type ?? 'button'}
                form={next.form}
                onClick={next.onClick}
                disabled={next.disabled}
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[10px] bg-[#2563eb] px-[18px] text-sm font-semibold text-white transition-all hover:brightness-110 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
            >
                <span className="sm:hidden">{next.shortLabel ?? next.label}</span>
                <span className="hidden sm:inline">{next.label}</span>
                <ArrowIcon direction="right" />
            </button>
        )}
    </footer>
)

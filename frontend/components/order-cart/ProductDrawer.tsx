'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import type { Product } from '@/lib/products'
import { AtributosLineaFields } from '@/components/PedidoAtributos/AtributosLineaFields'
import { atributosDelPedido, normalizarValores, valoresPorDefecto } from '@/components/PedidoAtributos/helpers'
import { OrderLine, getDefaultLine } from './Types'

interface ProductDrawerProps {
    product: Product
    initialLine?: OrderLine | null
    onAdd: (line: OrderLine) => void
    onClose: () => void
}

const label = 'text-[11px] font-bold uppercase tracking-[.08em] text-[#a8b3c8]'

export const ProductDrawer = ({ product, initialLine, onAdd, onClose }: ProductDrawerProps) => {
    const [isVisible, setIsVisible] = useState(false)
    const isClosingRef = useRef(false)
    const isEditing = Boolean(initialLine)

    // Borrador local de la línea: recién se suma o actualiza al confirmar
    const { register, handleSubmit, setValue, watch } = useForm<OrderLine>({
        defaultValues: initialLine
            ? {
                ...initialLine,
                totalPrice: initialLine.totalPrice ?? (initialLine.unitPriceOverride != null ? initialLine.unitPriceOverride * initialLine.quantity : null)
            }
            : {
                ...getDefaultLine(product.id, product.precio),
                attributes: valoresPorDefecto(product)
            },
    })
    const quantity = watch('quantity')
    const attributes = watch('attributes')
    const totalPrice = watch('totalPrice')
    const tieneAtributos = atributosDelPedido(product).length > 0
    const setQuantity = (n: number) => {
        const nextQty = Math.max(1, n)
        setValue('quantity', nextQty, { shouldDirty: true })
        if (product.precio != null && totalPrice == null) {
            setValue('totalPrice', product.precio * nextQty, { shouldDirty: true })
        }
    }

    // Animación de entrada fluida al montar
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(true)
        }, 15)
        return () => clearTimeout(timer)
    }, [])

    // Cierre suave con transición de salida
    const handleClose = useCallback(() => {
        if (isClosingRef.current) return
        isClosingRef.current = true
        setIsVisible(false)
        setTimeout(() => {
            onClose()
        }, 300)
    }, [onClose])

    // Cerrar con Escape (en fase capture para evitar cerrar el modal padre)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                handleClose()
            }
        }
        document.addEventListener('keydown', onKey, true)
        return () => document.removeEventListener('keydown', onKey, true)
    }, [handleClose])

    // Asegurar que el modal no quede con scroll previo al abrir el drawer para mostrar el encabezado completo
    useEffect(() => {
        const modalEl = document.querySelector('.modal')
        if (modalEl && modalEl.scrollTop > 0) {
            modalEl.scrollTop = 0
        }
        const containerEl = modalEl?.parentElement
        if (containerEl && containerEl.scrollTop > 0) {
            containerEl.scrollTop = 0
        }
    }, [])

    const submitLine = handleSubmit((line) => {
        const qty = line.quantity || 1
        const lineTotal = line.totalPrice != null ? line.totalPrice : (line.unitPriceOverride != null ? line.unitPriceOverride * qty : null)
        const unitPrice = lineTotal != null && qty > 0 ? lineTotal / qty : null
        onAdd({
            ...line,
            totalPrice: lineTotal,
            unitPriceOverride: unitPrice,
            attributes: normalizarValores(product, line.attributes)
        })
        handleClose()
    })

    return (
        <>
            {/* Fondo oscuro con fade in / fade out */}
            <div
                aria-hidden="true"
                onClick={handleClose}
                onWheel={(e) => e.preventDefault()}
                className={`absolute inset-0 z-40 bg-[rgba(2,5,12,0.65)] backdrop-blur-[2px] transition-opacity duration-300 ease-out cursor-pointer overscroll-contain ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
            />

            {/* Panel lateral desplegable desde la derecha hacia la izquierda */}
            <aside
                data-product-drawer="true"
                role="dialog"
                aria-modal="true"
                aria-labelledby="dr-title"
                className={`absolute inset-y-0 right-0 z-50 flex w-full flex-col overflow-hidden border-l border-[#2a3a59] bg-[#0d1627] shadow-[-24px_0_80px_rgba(0,0,0,0.65)] sm:w-[min(500px,100%)] transition-transform duration-300 ease-out will-change-transform overscroll-contain ${isVisible ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                {/* Encabezado */}
                <header className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-[#1b263d] py-4 pl-4 pr-3 sm:grid-cols-[96px_minmax(0,1fr)_auto]">
                    <span className="block aspect-[4/3] overflow-hidden rounded-[10px] bg-[#152139]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {product.imagen_principal?.url && <img src={product.imagen_principal.url} alt="" className="size-full object-cover" />}
                    </span>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 id="dr-title" className="mt-0.5 text-lg font-bold leading-tight text-[#e7ecf5] truncate">{product.nombre}</h3>
                            {isEditing && (
                                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-md">
                                    Editando
                                </span>
                            )}
                        </div>
                        {product.descripcion && <span className="text-[13px] text-[#a8b3c8] line-clamp-2">{product.descripcion}</span>}
                    </div>
                    <button
                        type="button"
                        aria-label="Cerrar panel de producto"
                        onClick={handleClose}
                        className="grid size-10 place-items-center rounded-[10px] text-[#a8b3c8] transition-colors hover:bg-[#152139] hover:text-white cursor-pointer"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </header>

                {/* Cuerpo con scroll */}
                <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-[18px]">
                    {/* Cantidad */}
                    <section className="border-b border-[#1b263d] py-4">
                        <div className="mb-2.5 flex items-baseline justify-between">
                            <span className={label}>Cantidad</span>
                            <span className="text-[13px] text-[#a8b3c8]">{quantity ?? '0'} unidades</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5">
                            <div className="inline-flex items-center overflow-hidden rounded-[10px] border border-[#2a3a59] bg-[#08101d]">
                                <button type="button" onClick={() => setQuantity(quantity - 1)} className="grid size-[42px] place-items-center text-[#a8b3c8] hover:bg-[#152139]">−</button>
                                <input
                                    type="number"
                                    min={1}
                                    className="h-[42px] w-16 bg-transparent text-center text-base font-bold text-[#e7ecf5] outline-none [appearance:textfield]"
                                    {...register('quantity', { valueAsNumber: true, min: 1, required: true })}
                                />
                                <button type="button" onClick={() => setQuantity(quantity + 1)} className="grid size-[42px] place-items-center text-[#a8b3c8] hover:bg-[#152139]">+</button>
                            </div>
                            {[10, 25, 50, 100].map((n) => (
                                <button key={n} type="button" onClick={() => setQuantity(n)} className="h-11 min-w-12 rounded-[10px] border border-[#2a3a59] text-[13px] font-semibold text-[#a8b3c8] hover:text-[#e7ecf5]">
                                    {n}
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Atributos del producto (texto, opciones) */}
                    {tieneAtributos && (
                        <section className="border-b border-[#1b263d] py-4">
                            <span className={`${label} mb-3 block`}>Personalización</span>
                            <AtributosLineaFields
                                product={product}
                                value={attributes}
                                onChange={(valores) => setValue('attributes', valores, { shouldDirty: true })}
                            />
                        </section>
                    )}
                    {/* Notas / Observaciones opcionales del producto */}
                    <section className="py-4">
                        <div className="mb-2 flex items-baseline justify-between">
                            <span className={label}>Notas del producto</span>
                            <span className="text-xs text-[#8390ab]">Opcional</span>
                        </div>
                        <textarea
                            rows={2}
                            placeholder="Aclaraciones específicas para este producto..."
                            className="w-full rounded-[10px] border border-[#2a3a59] bg-[#08101d] px-3.5 py-2 text-xs text-[#e7ecf5] outline-none focus:border-[#2563eb] resize-y placeholder:text-slate-600"
                            {...register('notes')}
                        />
                    </section>
                </div>

                {/* Pie */}
                <footer className="flex flex-col gap-2.5 border-t border-[#1b263d] bg-[#0b1322] px-4 pb-4 pt-3.5 sm:px-[18px]">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col">
                            <span className={label}>Valor total del producto</span>
                            <span className="text-[12px] text-[#8390ab]">Para las {quantity || 1} unidades</span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <div className="relative flex w-44 items-center">
                                <span className="pointer-events-none absolute left-3.5 font-semibold text-[#8390ab]">$</span>
                                <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    placeholder="0.00"
                                    {...register('totalPrice', { setValueAs: (v) => (v === '' || v == null ? null : Number(v)) })}
                                    className="h-11 w-full rounded-[10px] border border-[#2a3a59] bg-[#08101d] pl-[30px] pr-3.5 text-base font-bold text-[#e7ecf5] outline-none focus:border-[#2563eb] [appearance:textfield]"
                                />
                            </div>
                            {totalPrice != null && quantity > 0 ? (
                                <span className="text-[11px] text-[#8390ab] tabular-nums">
                                    ≈ ${(totalPrice / quantity).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} c/u
                                </span>
                            ) : null}
                        </div>
                    </div>
                    <div className="flex gap-2.5">
                        <button type="button" onClick={handleClose} className="h-11 rounded-[10px] border border-[#2a3a59] px-[18px] text-sm font-semibold text-[#a8b3c8] hover:bg-[#152139] hover:text-white cursor-pointer transition-colors">
                            Cancelar
                        </button>
                        <button type="button" onClick={submitLine} className="h-11 flex-1 rounded-[10px] bg-[#2563eb] px-[18px] text-sm font-semibold text-white hover:brightness-110 cursor-pointer transition-all">
                            {isEditing ? 'Guardar cambios' : 'Agregar al pedido'}
                        </button>
                    </div>
                </footer>
            </aside>
        </>
    )
}
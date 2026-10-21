'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface LightboxImage {
    url: string
    alt?: string
}

interface ImageLightboxProps {
    images: LightboxImage[]
    initialIndex?: number
    onClose: () => void
    // Para mantener sincronizado el índice con quien abrió el visor (ej. la portada)
    onIndexChange?: (index: number) => void
}

const SWIPE_THRESHOLD = 50

const navButton =
    'absolute top-1/2 -translate-y-1/2 z-10 grid size-11 place-items-center rounded-full border border-white/10 bg-slate-900/70 text-white backdrop-blur-md transition hover:bg-slate-800 cursor-pointer sm:size-12'

/**
 * Visor de imágenes a pantalla completa con navegación (flechas, teclado y swipe).
 * Se renderiza en un portal sobre cualquier modal abierto.
 */
export const ImageLightbox = ({ images, initialIndex = 0, onClose, onIndexChange }: ImageLightboxProps) => {
    const [index, setIndex] = useState(() => Math.min(Math.max(initialIndex, 0), images.length - 1))
    const touchStartX = useRef<number | null>(null)
    const total = images.length
    const hasMany = total > 1

    const goTo = useCallback((next: number) => {
        const wrapped = (next + total) % total
        setIndex(wrapped)
        onIndexChange?.(wrapped)
    }, [total, onIndexChange])

    const prev = useCallback(() => goTo(index - 1), [goTo, index])
    const next = useCallback(() => goTo(index + 1), [goTo, index])

    // Teclado en fase capture: Escape cierra solo el visor y no el modal de abajo
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
            else if (e.key === 'ArrowLeft' && hasMany) prev()
            else if (e.key === 'ArrowRight' && hasMany) next()
            else return
            e.preventDefault()
            e.stopPropagation()
        }
        document.addEventListener('keydown', onKey, true)
        return () => document.removeEventListener('keydown', onKey, true)
    }, [onClose, prev, next, hasMany])

    if (total === 0) return null
    const current = images[index]

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Visor de imágenes"
            className="fixed inset-0 z-[1000] flex flex-col bg-slate-950/95 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={(e) => {
                e.stopPropagation()
                onClose()
            }}
        >
            {/* Barra superior */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-slate-300" onClick={(e) => e.stopPropagation()}>
                <span className="font-semibold tabular-nums">{hasMany ? `${index + 1} / ${total}` : ''}</span>
                <div className="flex items-center gap-2">
                    <a
                        href={current.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                        Abrir original
                    </a>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Cerrar visor"
                        className="grid size-10 place-items-center rounded-xl text-slate-300 transition hover:bg-slate-800 hover:text-white cursor-pointer"
                    >
                        <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Imagen */}
            <div
                className="relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-20"
                onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX }}
                onTouchEnd={(e) => {
                    if (touchStartX.current === null || !hasMany) return
                    const delta = e.changedTouches[0].clientX - touchStartX.current
                    if (Math.abs(delta) > SWIPE_THRESHOLD) (delta > 0 ? prev : next)()
                    touchStartX.current = null
                }}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    key={current.url}
                    src={current.url}
                    alt={current.alt ?? `Imagen ${index + 1}`}
                    onClick={(e) => e.stopPropagation()}
                    className="max-h-full max-w-full select-none object-contain shadow-2xl animate-in fade-in duration-150"
                    draggable={false}
                />

                {hasMany && (
                    <>
                        <button type="button" aria-label="Imagen anterior" onClick={(e) => { e.stopPropagation(); prev() }} className={`${navButton} left-2 sm:left-5`}>
                            <svg viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"><path d="M15 6l-6 6 6 6" /></svg>
                        </button>
                        <button type="button" aria-label="Imagen siguiente" onClick={(e) => { e.stopPropagation(); next() }} className={`${navButton} right-2 sm:right-5`}>
                            <svg viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"><path d="M9 6l6 6-6 6" /></svg>
                        </button>
                    </>
                )}
            </div>

            {/* Miniaturas */}
            {hasMany && (
                <div className="flex justify-center gap-2 overflow-x-auto px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {images.map((img, i) => (
                        <button
                            key={`${img.url}-${i}`}
                            type="button"
                            onClick={() => goTo(i)}
                            aria-label={`Ver imagen ${i + 1}`}
                            aria-current={i === index}
                            className={`size-14 shrink-0 overflow-hidden rounded-lg border-2 transition cursor-pointer ${i === index ? 'border-blue-500' : 'border-transparent opacity-50 hover:opacity-100'}`}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.url} alt="" className="size-full object-cover" draggable={false} />
                        </button>
                    ))}
                </div>
            )}
        </div>,
        document.body
    )
}

export default ImageLightbox

'use client'

import { useState } from 'react'
import { ImageOff } from 'lucide-react'

interface PedidoThumbnailProps {
  url?: string | null
  alt: string
  /** Tamaño y extras, por ejemplo "w-24 h-14" */
  className?: string
  /** Placeholder solo con ícono, para miniaturas chicas */
  compact?: boolean
  /** Si se pasa, la miniatura se puede clickear y no dispara el click de la fila */
  onClick?: () => void
  title?: string
}

// Miniatura de un pedido (tablas de Tareas y Pedidos, tarjetas mobile).
// La imagen se muestra completa (object-contain) sobre una copia desenfocada de sí misma:
// las hojas de diseño apaisadas o las fotos cuadradas no quedan recortadas ni con bandas vacías.
// Si no hay imagen, o la URL no carga, se muestra un recuadro "Sin imagen" del mismo tamaño.
export default function PedidoThumbnail({
  url,
  alt,
  className = '',
  compact = false,
  onClick,
  title,
}: PedidoThumbnailProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClick?.()
  }
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      onClick?.()
    }
  }
  // Props para cuando la miniatura es clickeable (data-prevent-row-click evita abrir la fila)
  const clickable = onClick
    ? {
        role: 'button',
        tabIndex: 0,
        onClick: handleClick,
        onKeyDown: handleKeyDown,
        'data-prevent-row-click': 'true',
      }
    : {}
  const clickableClass = onClick
    ? 'cursor-pointer hover:border-blue-400/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
    : ''

  if (!url || failedUrl === url) {
    return (
      <div
        {...clickable}
        title={title ?? 'Sin imagen'}
        className={`flex flex-shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-700 bg-slate-950/40 text-slate-600 transition ${clickableClass} ${className}`}
      >
        <ImageOff className={compact ? 'h-4 w-4' : 'h-5 w-5'} aria-hidden="true" />
        {!compact && <span className="text-[10px] font-semibold uppercase tracking-wide">Sin imagen</span>}
      </div>
    )
  }

  return (
    <div
      {...clickable}
      title={title}
      className={`relative flex-shrink-0 overflow-hidden rounded-lg border border-slate-700/80 bg-slate-950 transition group-hover:border-blue-500/50 ${clickableClass} ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-md"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        loading="lazy"
        onError={() => setFailedUrl(url)}
        className="relative h-full w-full object-contain"
      />
    </div>
  )
}

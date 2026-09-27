import React from 'react'

const sizes = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
    full: 'w-full h-full',
    auto: 'w-full h-auto'
}

interface ImagePedidoProps {
    url?: string | null
    alt: string
    size?: keyof typeof sizes
    onClick?: () => void
    title?: string
    className?: string
    imgClassName?: string
}

export default function ImagePedido({
    url,
    size = 'md',
    alt,
    onClick,
    title,
    className = '',
    imgClassName = ''
}: ImagePedidoProps) {
    const sizeClass = sizes[size] || sizes.md
    const base = `rounded-xl flex-shrink-0 cursor-pointer transition ${sizeClass} ${className}`
    
    return (
        <div
            data-prevent-row-click="true"
            onClick={onClick}
            title={title}
            className={
                url
                    ? `${base} relative overflow-hidden border border-slate-700/80 bg-slate-950 group shadow-md flex items-center justify-center`
                    : `${base} flex flex-col items-center justify-center border border-slate-800/80 bg-slate-950/60 text-slate-500 hover:border-slate-700 hover:text-slate-400`
            }
        >
            {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={url}
                    alt={alt}
                    className={`w-full h-full object-cover group-hover:scale-105 transition duration-200 ${imgClassName}`}
                />
            ) : (
                <div className="flex flex-col items-center justify-center p-2 text-center gap-1 select-none">
                    <span className="text-xl">📷</span>
                    <span className="text-[10px] font-medium text-slate-500">Sin Imagen</span>
                </div>
            )}
        </div>
    )
}
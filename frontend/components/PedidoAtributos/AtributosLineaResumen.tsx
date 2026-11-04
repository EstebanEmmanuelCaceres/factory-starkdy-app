'use client'

import type { ValoresAtributos } from '@/lib/entities/atributos'
import type { Product } from '@/lib/products'
import { resumenAtributos } from './helpers'

interface AtributosLineaResumenProps {
  product?: Pick<Product, 'atributos'> | null
  valores?: ValoresAtributos
  className?: string
}

// Muestra los atributos elegidos en una línea como "Etiqueta: valor".
// Usa elementos en línea para poder ir dentro de un <span> (ej. la tabla de pedidos)
export const AtributosLineaResumen = ({ product, valores, className = '' }: AtributosLineaResumenProps) => {
  const items = resumenAtributos(product, valores)
  if (items.length === 0) return null

  return (
    <span role="list" className={`flex flex-wrap gap-1 ${className}`}>
      {items.map(({ clave, etiqueta, valor }) => (
        <span
          role="listitem"
          key={clave}
          className="max-w-full truncate rounded-md border border-slate-700/60 bg-slate-800/50 px-1.5 py-0.5 text-[11px] text-slate-300"
          title={`${etiqueta}: ${valor}`}
        >
          <span className="text-slate-500">{etiqueta}:</span> {valor}
        </span>
      ))}
    </span>
  )
}

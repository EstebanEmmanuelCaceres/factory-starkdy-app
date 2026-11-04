'use client'

import type { ValoresAtributos } from '@/lib/entities/atributos'
import type { Product } from '@/lib/products'
import { atributosDelPedido } from './helpers'

interface AtributosLineaFieldsProps {
  product: Pick<Product, 'id' | 'atributos'>
  value: ValoresAtributos
  onChange: (value: ValoresAtributos) => void
  // Compacto: para listas de líneas (edición del pedido); normal: para el panel del producto
  compact?: boolean
}

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

/**
 * Campos para cargar los atributos de una línea del pedido según lo que define el producto:
 * texto → input libre; opciones → botones de elección única.
 */
export const AtributosLineaFields = ({ product, value, onChange, compact = false }: AtributosLineaFieldsProps) => {
  const atributos = atributosDelPedido(product)
  if (atributos.length === 0) return null

  const setValor = (clave: string, valor: string) => onChange({ ...value, [clave]: valor })

  const labelClass = compact
    ? 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1'
    : 'block text-[11px] font-bold uppercase tracking-[.08em] text-[#a8b3c8] mb-2'
  const inputClass = compact
    ? 'w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-white placeholder-slate-600 outline-none focus:border-blue-500 transition'
    : 'h-11 w-full rounded-[10px] border border-[#2a3a59] bg-[#08101d] px-3.5 text-sm text-[#e7ecf5] placeholder-[#5b6883] outline-none focus:border-[#2563eb] transition'

  return (
    <div className={compact ? 'space-y-2' : 'space-y-4'}>
      {atributos.map((atributo) => {
        const id = `atr-${product.id}-${atributo.clave}`

        if (atributo.tipo === 'texto') {
          return (
            <div key={atributo.clave}>
              <label htmlFor={id} className={labelClass}>{atributo.etiqueta}</label>
              <input
                id={id}
                type="text"
                value={value[atributo.clave] ?? ''}
                onChange={(e) => setValor(atributo.clave, e.target.value)}
                placeholder={atributo.placeholder || 'Opcional'}
                className={inputClass}
              />
            </div>
          )
        }

        return (
          <div key={atributo.clave} role="radiogroup" aria-label={atributo.etiqueta}>
            <span className={labelClass}>{atributo.etiqueta}</span>
            <div className="flex flex-wrap gap-1.5">
              {atributo.opciones.map((opcion) => {
                const elegida = value[atributo.clave] === opcion.valor
                return (
                  <button
                    key={opcion.valor}
                    type="button"
                    role="radio"
                    aria-checked={elegida}
                    onClick={() => setValor(atributo.clave, opcion.valor)}
                    className={`rounded-lg border font-semibold transition cursor-pointer ${compact ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm'} ${
                      elegida
                        ? 'border-blue-500 bg-blue-500/15 text-white'
                        : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                    }`}
                  >
                    {opcion.valor}
                    {opcion.recargo > 0 && <span className="ml-1 text-[11px] font-normal text-slate-500">+{money.format(opcion.recargo)}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

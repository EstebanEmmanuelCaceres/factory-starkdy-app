'use client'

import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import type { Pedido } from '@/lib/pedidos'
import { AtributosLineaResumen } from '@/components/PedidoAtributos/AtributosLineaResumen'
import type { ReposicionFormValues } from './types'

interface LineasReposicionFieldProps {
  // Pedido que se repone: de acá salen los atributos de cada línea para mostrarlos
  pedido: Pedido
}

const label = 'text-[11px] font-bold uppercase tracking-[.08em] text-[#8390ab]'

/**
 * Líneas del pedido a reponer. Son fijas (no se agregan productos): solo se marca cuáles
 * se reponen y cuántas unidades, sin pasar de las que tenía el pedido.
 */
export const LineasReposicionField = ({ pedido }: LineasReposicionFieldProps) => {
  const { control, register, setValue, formState: { errors } } = useFormContext<ReposicionFormValues>()
  const { fields } = useFieldArray({
    control,
    name: 'lineas',
    rules: { validate: (lineas) => lineas.some((l) => l.reponer) || 'Elegí al menos un producto para reponer.' },
  })
  const lineas = useWatch({ control, name: 'lineas' })

  const lineaDelPedido = (lineaId: number) => pedido.productos?.find((p) => p.pivot?.id === lineaId)

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <span className={label}>Productos a reponer</span>
        <span className="text-[12px] text-[#8390ab]">
          {lineas.filter((l) => l.reponer).length} de {fields.length}
        </span>
      </div>

      {/* En pantallas muy anchas las líneas van en 2 columnas para aprovechar el ancho */}
      <ul className="grid grid-cols-1 gap-2 2xl:grid-cols-2">
        {fields.map((field, index) => {
          const linea = lineas[index]
          const prod = lineaDelPedido(field.lineaId)
          const error = errors.lineas?.[index]?.cantidad?.message

          return (
            <li
              key={field.id}
              className={`flex flex-col gap-3 rounded-[12px] border px-3.5 py-3 transition sm:flex-row sm:items-center ${linea?.reponer ? 'border-[#2a3a59] bg-[#0f192b]' : 'border-[#1b263d] bg-[#0b1322] opacity-60'}`}
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-blue-600" {...register(`lineas.${index}.reponer`)} />
                <span className="min-w-0">
                  <span className="block break-words text-[14px] font-semibold text-[#e7ecf5] sm:truncate">{field.producto}</span>
                  <span className="text-[12px] text-[#8390ab]">Pedido original: {field.maximo} u</span>
                  <AtributosLineaResumen product={prod} valores={prod?.pivot?.atributos} className="mt-1" />
                </span>
              </label>

              {/* Cantidad a reponer: 1 a lo que tenía el pedido. En mobile va en su propia fila, abajo del producto */}
              <div className="flex flex-col gap-1 border-t border-[#1b263d] pt-3 sm:items-end sm:border-0 sm:pt-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] font-semibold text-[#8390ab] sm:hidden">Cantidad a reponer</span>
                  <div className="flex items-center overflow-hidden rounded-[10px] border border-[#2a3a59]">
                    <input
                      type="number"
                      min={1}
                      max={field.maximo}
                      aria-label={`Cantidad a reponer de ${field.producto}`}
                      className="h-10 w-20 bg-[#08101d] px-2 text-center text-[15px] font-bold tabular-nums text-[#e7ecf5] outline-none [appearance:textfield]"
                      {...register(`lineas.${index}.cantidad`, {
                        valueAsNumber: true,
                        validate: (v, values) =>
                          !values.lineas[index]?.reponer ||
                          (Number.isInteger(v) && v >= 1 && v <= field.maximo) ||
                          `Entre 1 y ${field.maximo}`,
                        // Escribir una cantidad marca la línea para reponer
                        onChange: () => setValue(`lineas.${index}.reponer`, true),
                      })}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setValue(`lineas.${index}.cantidad`, field.maximo, { shouldValidate: true })
                        setValue(`lineas.${index}.reponer`, true)
                      }}
                      className="h-10 border-l border-[#2a3a59] px-2.5 text-[12px] font-semibold text-[#a8b3c8] hover:bg-[#152139] hover:text-white"
                      title="Reponer todas las unidades"
                    >
                      Todo
                    </button>
                  </div>
                </div>
                {error && <span className="text-[11px] text-rose-400">{error}</span>}
              </div>
            </li>
          )
        })}
      </ul>

      {errors.lineas?.root?.message && <p className="text-[12px] text-rose-400">{errors.lineas.root.message}</p>}
    </section>
  )
}

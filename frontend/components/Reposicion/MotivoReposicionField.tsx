'use client'

import { Controller, useFormContext } from 'react-hook-form'
import { MOTIVOS_REPOSICION } from '@/lib/entities/reposiciones'
import type { ReposicionFormValues } from './types'

const label = 'text-[11px] font-bold uppercase tracking-[.08em] text-[#8390ab]'

// Motivo (obligatorio) y detalle libre de por qué se repone el pedido
export const MotivoReposicionField = () => {
  const { control, register, formState: { errors } } = useFormContext<ReposicionFormValues>()

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <span id="motivo-reposicion-label" className={label}>
          Motivo <span className="text-rose-400" aria-hidden="true">*</span>
        </span>
        <Controller
          control={control}
          name="motivo"
          rules={{ required: 'Elegí el motivo de la reposición.' }}
          render={({ field }) => (
            <div role="radiogroup" aria-labelledby="motivo-reposicion-label" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 2xl:grid-cols-3">
              {MOTIVOS_REPOSICION.map((m) => {
                const elegido = field.value === m.value
                return (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={elegido}
                    onClick={() => field.onChange(m.value)}
                    className={`flex min-h-11 items-center gap-2 rounded-[10px] border px-3 py-2 text-left text-[13px] font-semibold leading-tight transition cursor-pointer ${elegido ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-[#2a3a59] bg-[#08101d] text-[#a8b3c8] hover:border-[#3b4f7a]'}`}
                  >
                    <span aria-hidden="true">{m.icon}</span>
                    {m.label}
                  </button>
                )
              })}
            </div>
          )}
        />
        {errors.motivo && <p className="text-[12px] text-rose-400">{errors.motivo.message}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <label htmlFor="detalle-reposicion" className={label}>Detalle</label>
          <span className="text-xs text-[#8390ab]">Opcional</span>
        </div>
        <textarea
          id="detalle-reposicion"
          rows={2}
          maxLength={1000}
          placeholder="Qué pasó con el pedido, qué hay que corregir…"
          className="w-full rounded-[10px] border border-[#2a3a59] bg-[#08101d] px-[14px] py-[11px] text-[14px] leading-[1.45] text-[#e7ecf5] outline-none resize-y focus:border-[#2563eb]"
          {...register('detalle')}
        />
      </div>
    </section>
  )
}

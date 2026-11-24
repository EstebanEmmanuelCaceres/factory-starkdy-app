'use client'

import { useFormContext, useWatch } from 'react-hook-form'
import { lineasAReponer, type ReposicionFormValues } from './types'

// Lo que se ve en el medio del footer del wizard: cuántos productos y unidades se reponen
export const ReposicionFooterSummary = () => {
  const { control } = useFormContext<ReposicionFormValues>()
  const elegidas = lineasAReponer(useWatch({ control, name: 'lineas' }))
  const unidades = elegidas.reduce((acc, l) => acc + (l.cantidad || 0), 0)

  return (
    <span className="whitespace-nowrap text-[13px] text-[#a8b3c8]">
      <span className="hidden md:inline">{elegidas.length} {elegidas.length === 1 ? 'producto' : 'productos'} · </span>
      <span className="font-bold text-[#e7ecf5] tabular-nums">{unidades} u</span> a reponer
    </span>
  )
}

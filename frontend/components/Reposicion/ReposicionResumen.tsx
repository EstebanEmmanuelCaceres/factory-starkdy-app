'use client'

import { useFormContext, useWatch } from 'react-hook-form'
import type { Pedido } from '@/lib/pedidos'
import { MOTIVOS_REPOSICION } from '@/lib/entities/reposiciones'
import { AtributosLineaResumen } from '@/components/PedidoAtributos/AtributosLineaResumen'
import { PRIORIDADES } from '@/components/order-cart/PriorityField'
import { lineasAReponer, type ReposicionFormValues } from './types'

const label = 'text-[11px] font-bold uppercase tracking-[.08em] text-[#8390ab]'

const formatFecha = (iso: string) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Revisión antes de crear la reposición: qué se repone, por qué y para cuándo
export const ReposicionResumen = ({ pedido }: { pedido: Pedido }) => {
  const { control } = useFormContext<ReposicionFormValues>()
  const [lineas, motivo, detalle, priority, deliveryDate] = useWatch({
    control,
    name: ['lineas', 'motivo', 'detalle', 'priority', 'deliveryDate'],
  })
  const elegidas = lineasAReponer(lineas)
  const lineaDelPedido = (lineaId: number) => pedido.productos?.find((p) => p.pivot?.id === lineaId)

  return (
    // Mobile/tablet: datos arriba y productos abajo. Desktop: datos a la izquierda y productos a la derecha.
    <div className="grid w-full grid-cols-1 items-start gap-5 pt-5 text-[#e7ecf5] lg:grid-cols-[minmax(300px,34%)_minmax(0,1fr)]">
      <section className="grid grid-cols-1 gap-4 rounded-[14px] border border-[#1b263d] bg-[#0f192b] p-4 sm:grid-cols-3 lg:grid-cols-1">
        <div>
          <p className={label}>Repone</p>
          <p className="text-[14px] font-bold">{pedido.codigo}</p>
          <p className="truncate text-[12px] text-[#a8b3c8]">{pedido.cliente?.nombre_empresa || pedido.cliente?.nombre_cliente}</p>
        </div>
        <div>
          <p className={label}>Entrega estimada</p>
          <p className="text-[14px] font-semibold">{formatFecha(deliveryDate)}</p>
        </div>
        <div>
          <p className={label}>Prioridad</p>
          <p className="text-[14px] font-semibold">{PRIORIDADES.find((p) => p.value === priority)?.label ?? priority}</p>
        </div>
        <div className="sm:col-span-3 lg:col-span-1">
          <p className={label}>Motivo</p>
          <p className="text-[14px] font-semibold">{MOTIVOS_REPOSICION.find((m) => m.value === motivo)?.label}</p>
          {detalle.trim() && <p className="mt-0.5 whitespace-pre-line text-[13px] text-[#a8b3c8]">{detalle}</p>}
        </div>
      </section>

      <section className="overflow-hidden rounded-[14px] border border-[#1b263d] bg-[#0f192b]">
        <header className="flex items-baseline justify-between border-b border-[#1b263d] px-4 py-3">
          <p className={label}>Productos a reponer</p>
          <span className="text-[12px] text-[#8390ab]">{elegidas.reduce((acc, l) => acc + l.cantidad, 0)} u en total</span>
        </header>
        <ul className="divide-y divide-[#1b263d]">
          {elegidas.map((l) => {
            const prod = lineaDelPedido(l.lineaId)
            return (
              <li key={l.lineaId} className="flex items-start gap-3 px-4 py-3 sm:items-center">
                <span className="rounded bg-[#193a81] px-2 py-0.5 text-[14px] font-bold tabular-nums text-white">{l.cantidad} u</span>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-[14px] font-semibold sm:truncate">{l.producto}</p>
                  <AtributosLineaResumen product={prod} valores={prod?.pivot?.atributos} className="mt-1" />
                </div>
                {l.cantidad < l.maximo && <span className="shrink-0 text-[12px] text-[#8390ab]">de {l.maximo}</span>}
              </li>
            )
          })}
        </ul>
      </section>

      <p className="text-[12px] text-[#8390ab] lg:col-span-2">
        La reposición se crea sin cargo (no es una venta) y arranca en estado <strong className="text-[#a8b3c8]">pendiente</strong>, como un pedido nuevo.
      </p>
    </div>
  )
}

'use client'

import type { Pedido } from '@/lib/pedidos'

// Marca en la tabla los pedidos que son reposiciones, con el código de la venta que reponen
export default function ReposicionBadge({ pedido }: { pedido: Pick<Pedido, 'tipo' | 'pedido_origen'> }) {
  if (pedido.tipo !== 'reposicion') return null

  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-violet-300"
      title="Pedido que se vuelve a hacer sin cargo"
    >
      🔁 Reposición{pedido.pedido_origen ? ` de ${pedido.pedido_origen.codigo}` : ''}
    </span>
  )
}

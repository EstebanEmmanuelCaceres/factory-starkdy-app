'use client'

import { getStoredUser } from '@/lib/auth'
import { puedeReponerPedido } from '@/lib/entities/reposiciones'
import type { Pedido } from '@/lib/pedidos'

interface BotonReponerProps {
  pedido: Pedido
  onClick: (pedido: Pedido) => void
  variante?: 'icono' | 'boton' | 'detalle'
}

/**
 * Abre la reposición de un pedido. Solo admin y encargado/a, y solo si el pedido está enviado y tiene productos.
 * El modal lo monta la página (ReposicionModal) y se abre desde `onClick`.
 */
export default function BotonReponer({ pedido, onClick, variante = 'boton' }: BotonReponerProps) {
  if (!puedeReponerPedido(getStoredUser()?.role, pedido)) return null

  // Mismo estilo que "Editar Pedido" del modal de detalle
  if (variante === 'detalle') {
    return (
      <button
        type="button"
        onClick={() => onClick(pedido)}
        className="bg-slate-900 hover:bg-slate-850 border border-slate-750 hover:border-violet-500/50 text-violet-300 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow-md hover:scale-[1.02] active:scale-[0.98]"
        title="Crear una reposición de este pedido (se vuelve a hacer sin cargo)"
      >
        <span>🔁</span>
        <span>Crear reposición</span>
      </button>
    )
  }

  if (variante === 'icono') {
    return (
      <button
        type="button"
        onClick={() => onClick(pedido)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-violet-400 transition hover:bg-violet-500/10 hover:text-violet-300"
        title="Reponer pedido (volver a hacerlo sin cargo)"
        aria-label="Reponer pedido"
      >
        🔁
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onClick(pedido)}
      className="text-violet-300 hover:text-white px-3 py-1.5 bg-slate-950 border border-slate-800 hover:bg-violet-500/10 rounded-xl transition text-xs flex items-center gap-1.5 font-semibold"
      title="Reponer pedido (volver a hacerlo sin cargo)"
    >
      🔁 <span className="text-xs">Reponer</span>
    </button>
  )
}

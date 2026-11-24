'use client'

import { getStoredUser } from '@/lib/auth'
import { puedeCrearReposicion } from '@/lib/entities/reposiciones'
import type { Pedido } from '@/lib/pedidos'

interface BotonReponerProps {
  pedido: Pedido
  onClick: (pedido: Pedido) => void
  variante?: 'icono' | 'boton'
}

/**
 * Abre la reposición de un pedido. Solo admin y encargado/a, y solo si el pedido tiene productos.
 * El modal lo monta la página (ReposicionModal) y se abre desde `onClick`.
 */
export default function BotonReponer({ pedido, onClick, variante = 'boton' }: BotonReponerProps) {
  if (!puedeCrearReposicion(getStoredUser()?.role) || !pedido.productos?.length) return null

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

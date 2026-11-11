'use client'

import { useState } from 'react'
import { PEDIDO_STATE_OPTIONS } from '@/lib/order-status'
import { cambiarEstadoPedidos } from '@/lib/pedidos'

interface PedidosAccionMasivaProps {
  ids: number[]
  onAplicado: (estado: string, ids: number[]) => void
  onLimpiar: () => void
}

const ESTADOS = PEDIDO_STATE_OPTIONS.filter((o) => o.value !== 'todos')

// Barra que aparece al seleccionar pedidos en la tabla (solo admin): cambia el estado de todos juntos
export default function PedidosAccionMasiva({ ids, onAplicado, onLimpiar }: PedidosAccionMasivaProps) {
  const [estado, setEstado] = useState('')
  const [aplicando, setAplicando] = useState(false)
  const [error, setError] = useState('')

  if (ids.length === 0) return null

  const aplicar = async () => {
    const label = ESTADOS.find((o) => o.value === estado)?.label
    if (!estado || !confirm(`¿Pasar ${ids.length} pedido(s) a "${label}"?`)) return
    setAplicando(true)
    setError('')
    try {
      const res = await cambiarEstadoPedidos(ids, estado)
      onAplicado(res.estado, res.ids)
      setEstado('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cambiar el estado')
    } finally {
      setAplicando(false)
    }
  }

  return (
    <div className="sticky top-2 z-30 mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-blue-500/40 bg-slate-900/95 px-4 py-3 shadow-lg backdrop-blur">
      <span className="text-sm font-semibold text-white">
        {ids.length} pedido{ids.length === 1 ? '' : 's'} seleccionado{ids.length === 1 ? '' : 's'}
      </span>
      <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="h-9 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white focus:border-blue-500 focus:outline-none"
          aria-label="Nuevo estado"
        >
          <option value="">Cambiar estado a…</option>
          {ESTADOS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={aplicar}
          disabled={!estado || aplicando}
          className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {aplicando ? 'Aplicando…' : 'Aplicar'}
        </button>
        <button type="button" onClick={onLimpiar} className="h-9 rounded-lg px-3 text-sm text-slate-400 hover:bg-slate-800 hover:text-white">
          Quitar selección
        </button>
      </div>
      {error && <p className="w-full text-xs text-rose-400">{error}</p>}
    </div>
  )
}

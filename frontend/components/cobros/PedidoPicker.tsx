'use client'

import { useEffect, useState } from 'react'
import { fetchPedidos, type Pedido } from '@/lib/pedidos'
import { formatClienteLabel, formatMoney, inputClass } from './format'

interface PedidoPickerProps {
  value: Pedido | null
  onChange: (pedido: Pedido | null) => void
}

const SEARCH_DELAY_MS = 300

/**
 * Buscador de pedidos por código o cliente. Busca en todos los estados
 * (con `search`, el back no aplica el filtro por defecto que oculta completados).
 */
export const PedidoPicker = ({ value, onChange }: PedidoPickerProps) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    const timer = setTimeout(() => {
      fetchPedidos({ search: q, estado: 'todos' })
        .then((data) => setResults(data.slice(0, 8)))
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [query])

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-500/40 bg-blue-500/5 px-3.5 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100">
            {value.codigo} · {formatClienteLabel(value.cliente, 'Sin cliente')}
          </p>
          <p className="text-xs text-slate-400">
            Total {formatMoney(Number(value.precio) || 0)} · Saldo{' '}
            <span className="font-semibold text-amber-400">{formatMoney(Number(value.saldo_pendiente) || 0)}</span>
          </p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-blue-400 hover:bg-slate-800 cursor-pointer">
          Cambiar
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar pedido por código o cliente..."
        className={inputClass}
        autoFocus
      />
      {query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 shadow-xl divide-y divide-slate-900">
          {loading ? (
            <p className="px-3.5 py-3 text-sm text-slate-500">Buscando...</p>
          ) : results.length === 0 ? (
            <p className="px-3.5 py-3 text-sm text-slate-500">No se encontraron pedidos</p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p)
                  setQuery('')
                }}
                className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm transition hover:bg-slate-900 cursor-pointer"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-200">{p.codigo}</span>
                  <span className="block truncate text-xs text-slate-500">{formatClienteLabel(p.cliente, '')}</span>
                </span>
                <span className="shrink-0 text-right text-xs">
                  <span className="block text-slate-500">Saldo</span>
                  <span className="font-semibold text-amber-400">{formatMoney(Number(p.saldo_pendiente) || 0)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

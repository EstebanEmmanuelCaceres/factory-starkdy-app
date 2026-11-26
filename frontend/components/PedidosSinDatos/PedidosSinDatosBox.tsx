'use client'

import { useState } from 'react'
import type { PedidoSinDatos } from '@/lib/pedidos'

interface PedidosSinDatosBoxProps {
  pedidos: PedidoSinDatos[]
  loading: boolean
  onRefresh: () => void
  // Abre el detalle del pedido, donde se editan los datos del cliente
  onSelect: (pedido: PedidoSinDatos) => void
}

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-AR') : '-')

/**
 * Caja del dashboard del vendedor: pedidos completados cuyo cliente no tiene los datos de envío.
 * Misma estructura que "Completados por Cobrar": arranca contraída con el resumen y se despliega
 * para ver todos los pedidos, sin paginación (igual que Despacho).
 */
export default function PedidosSinDatosBox({ pedidos, loading, onRefresh, onSelect }: PedidosSinDatosBoxProps) {
  const [contraida, setContraida] = useState(true)

  const resumen =
    pedidos.length === 0
      ? 'No hay pedidos completados sin datos de envío'
      : pedidos.length === 1
        ? '1 pedido completado sin datos de envío'
        : `${pedidos.length} pedidos completados sin datos de envío`

  const accion = (pedido: PedidoSinDatos) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onSelect(pedido)
      }}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 transition hover:bg-amber-500/20 cursor-pointer"
      title="Abrir el pedido para completar los datos del cliente"
    >
      ✏️ Completar datos
    </button>
  )

  const faltantes = (pedido: PedidoSinDatos) => (
    <div className="flex flex-wrap gap-1">
      {pedido.datos_faltantes.map((d) => (
        <span key={d.clave} className="rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
          {d.etiqueta}
        </span>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
      <div
        className="flex cursor-pointer select-none flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/40 p-5 transition hover:bg-slate-950/70"
        onClick={() => setContraida((prev) => !prev)}
      >
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-white">
            <span>📋</span> Completados sin Datos de Envío
            {pedidos.length > 0 && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-xs font-extrabold text-amber-300">
                {pedidos.length}
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">Fabricación terminada, pero al cliente le faltan datos para despachar</p>
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="cursor-pointer rounded-xl border border-slate-800 bg-slate-950 p-2 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-white"
            title="Actualizar pedidos sin datos de envío"
          >
            🔄
          </button>
          <button
            type="button"
            onClick={() => setContraida((prev) => !prev)}
            className="flex cursor-pointer select-none items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-bold text-amber-300 shadow-sm transition hover:border-amber-500/40 hover:bg-slate-800"
            title={contraida ? 'Desplegar panel' : 'Contraer panel'}
          >
            <span>{contraida ? 'Desplegar' : 'Contraer'}</span>
            <span className={`inline-block transform transition-transform duration-200 ${contraida ? 'rotate-0' : 'rotate-180'}`}>▼</span>
          </button>
        </div>
      </div>

      {contraida ? (
        <div
          onClick={() => setContraida(false)}
          className="flex cursor-pointer flex-col items-start justify-between gap-3 bg-slate-950/30 p-4 text-xs transition hover:bg-slate-950/60 sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-xl text-amber-400">
              📦
            </div>
            <div>
              <span className="block text-sm font-semibold text-slate-200">{loading ? 'Cargando…' : resumen}</span>
              <span className="mt-0.5 block text-xs text-slate-400">Completá los datos del cliente para que el pedido se pueda despachar</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300">Desplegar listado completo →</span>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <span className="text-sm">Cargando pedidos…</span>
        </div>
      ) : pedidos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center text-slate-500">
          <span className="text-4xl">🎉</span>
          <span className="text-xs font-medium text-slate-400">Todos tus pedidos completados tienen los datos de envío cargados</span>
        </div>
      ) : (
        <div>
          {/* Mobile: tarjetas */}
          <div className="max-h-[480px] space-y-2.5 overflow-y-auto p-3 md:hidden">
            {pedidos.map((pedido) => (
              <div
                key={pedido.id}
                onClick={() => onSelect(pedido)}
                className="cursor-pointer space-y-2 rounded-xl border border-slate-800/90 bg-slate-950/60 p-3.5 text-left shadow-md transition hover:border-slate-700"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-blue-400">#{pedido.codigo}</span>
                  <span className="text-[11px] text-slate-400">{fecha(pedido.created_at)}</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-tight text-white">{pedido.cliente?.nombre_cliente || 'Sin cliente'}</h3>
                  <span className="block text-xs text-slate-400">{pedido.cliente?.nombre_empresa || 'Empresa'}</span>
                </div>
                {faltantes(pedido)}
                <div className="flex justify-end border-t border-slate-800/80 pt-2">{accion(pedido)}</div>
              </div>
            ))}
          </div>

          {/* Escritorio: tabla */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Cliente / Empresa</th>
                  <th className="px-4 py-3">Datos que faltan</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {pedidos.map((pedido) => (
                  <tr key={pedido.id} onClick={() => onSelect(pedido)} className="cursor-pointer text-slate-300 transition duration-150 hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-mono text-[10px] text-blue-400">#{pedido.codigo}</span>
                        <span className="text-[11px] text-slate-400">{pedido.cliente?.nombre_cliente || 'Sin cliente'}</span>
                        <span className="text-xs font-semibold text-white">{pedido.cliente?.nombre_empresa || 'Empresa'}</span>
                        <span className="text-[11px] text-slate-400">{fecha(pedido.created_at)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{faltantes(pedido)}</td>
                    <td className="px-4 py-3 text-center">{accion(pedido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

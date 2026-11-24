'use client'

import type { Reposicion } from '@/lib/entities/reposiciones'

// Confirmación con lo que devolvió el backend (ReposicionResource)
export const ReposicionCreada = ({ reposicion }: { reposicion: Reposicion }) => (
  <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 py-6 sm:py-8 text-center animate-in fade-in zoom-in-95 duration-200">
    <div className="grid size-16 place-items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
      <svg viewBox="0 0 24 24" className="size-8 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </div>
    <div>
      <h3 className="text-xl font-bold text-white">Reposición {reposicion.codigo} creada</h3>
      <p className="text-[14px] text-[#a8b3c8]">
        Repone <span className="font-semibold text-[#e7ecf5]">{reposicion.pedido_origen.codigo}</span> de{' '}
        <span className="font-semibold text-[#e7ecf5]">{reposicion.cliente.nombre_empresa || reposicion.cliente.nombre_cliente}</span>
        {' · '}
        {reposicion.motivo.etiqueta}
      </p>
    </div>

    <ul className="w-full divide-y divide-[#1b263d] overflow-hidden rounded-[14px] border border-[#1b263d] bg-[#0f192b] text-left">
      {reposicion.lineas.map((l) => (
        <li key={l.id} className="flex items-center gap-3 px-4 py-3">
          <span className="rounded bg-[#193a81] px-2 py-0.5 text-[14px] font-bold tabular-nums text-white">{l.cantidad} u</span>
          <div className="min-w-0">
            <p className="break-words text-[14px] font-semibold text-[#e7ecf5] sm:truncate">{l.producto}</p>
            {l.atributos.length > 0 && (
              <p className="text-[12px] text-[#a8b3c8]">{l.atributos.map((a) => `${a.etiqueta}: ${a.valor}`).join(' · ')}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
    <p className="text-[13px] text-[#8390ab]">{reposicion.unidades} unidades · queda en estado pendiente para diseño y producción.</p>
  </div>
)

'use client'

import type { Pedido } from '@/lib/pedidos'

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })

export const OrderCreated = ({ pedido }: { pedido: Pedido }) => (
    <div className="flex flex-col items-center gap-3 py-10 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="grid size-16 place-items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <svg viewBox="0 0 24 24" className="size-8 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
        </div>
        <h3 className="text-xl font-bold text-white">Pedido creado</h3>
        <p className="text-[14px] text-[#a8b3c8]">
            Se registró el pedido <span className="font-semibold text-[#e7ecf5]">{pedido.codigo}</span>
            {pedido.cliente && (
                <> para <span className="font-semibold text-[#e7ecf5]">{pedido.cliente.nombre_cliente}</span></>
            )}
            {pedido.precio != null && (
                <> por <span className="font-semibold text-[#e7ecf5]">{money.format(Number(pedido.precio))}</span></>
            )}
            .
        </p>
    </div>
)

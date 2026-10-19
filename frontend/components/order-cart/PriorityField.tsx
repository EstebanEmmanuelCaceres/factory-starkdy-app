'use client'

import { Controller, useFormContext } from "react-hook-form";

export const PRIORIDADES = [
    { value: 'baja', label: 'Baja', dot: 'bg-slate-400', active: 'bg-slate-400/15 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.5)]' },
    { value: 'normal', label: 'Normal', dot: 'bg-blue-400', active: 'bg-blue-400/15 shadow-[inset_0_0_0_1px_rgba(96,165,250,0.55)]' },
    { value: 'alta', label: 'Alta', dot: 'bg-amber-400', active: 'bg-amber-400/15 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.55)]' },
    { value: 'critica', label: 'Urgente', dot: 'bg-rose-400', active: 'bg-rose-400/15 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.6)]' },
] as const

export const PriorityField = () => {
    const { control } = useFormContext();

    return (
        <div className="flex flex-col gap-2">
            <span id="prioridad-label" className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8390ab]">
                Prioridad <span className="text-rose-400" aria-hidden="true">*</span>
            </span>
            <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                    <div
                        role="group"
                        aria-labelledby="prioridad-label"
                        className="grid h-11 grid-cols-4 gap-1 rounded-xl border border-slate-700 bg-slate-950 p-1"
                    >
                        {PRIORIDADES.map((p) => {
                            const selected = field.value === p.value
                            return (
                                <button
                                    key={p.value}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => field.onChange(p.value)}
                                    onBlur={field.onBlur}
                                    className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold transition ${selected ? `text-slate-100 ${p.active}` : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                                        }`}
                                >
                                    <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${p.dot}`} />
                                    {p.label}
                                </button>
                            )
                        })}
                    </div>
                )}
            />
        </div>
    )
}
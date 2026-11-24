'use client'

// Se muestra mientras el backend crea la reposición; el modal no se puede cerrar en este paso
export const ReposicionCreando = ({ codigo }: { codigo: string }) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center" role="status" aria-live="polite">
    <div className="size-12 animate-spin rounded-full border-4 border-slate-700 border-t-violet-400" />
    <div>
      <p className="text-lg font-bold text-white">Creando reposición…</p>
      <p className="text-[14px] text-[#a8b3c8]">
        Generando el pedido de reposición de <span className="font-semibold text-[#e7ecf5]">{codigo}</span> y sus tareas.
      </p>
    </div>
  </div>
)

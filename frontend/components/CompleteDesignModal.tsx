'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/Modal'
import type { Pedido } from '@/lib/pedidos'
import type { ResponsableEtapa } from '@/lib/responsable_etapas'

export interface CompleteDesignModalProps {
  isOpen: boolean
  onClose: () => void
  pedido: Pedido | null
  designTasks: ResponsableEtapa[]
  onConfirm: (completedTaskIds: number[]) => Promise<void>
}

export default function CompleteDesignModal({
  isOpen,
  onClose,
  pedido,
  designTasks,
  onConfirm
}: CompleteDesignModalProps) {
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Al abrir el modal, tildar por defecto todos los IDs de las tareas de diseño pendientes de este pedido
  useEffect(() => {
    if (isOpen && designTasks.length > 0) {
      setSelectedTaskIds(designTasks.map((t) => t.id))
      setError('')
    }
  }, [isOpen, designTasks])

  if (!isOpen || !pedido) return null

  const handleToggleTask = (taskId: number) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    )
  }

  const handleToggleAll = () => {
    if (selectedTaskIds.length === designTasks.length) {
      setSelectedTaskIds([])
    } else {
      setSelectedTaskIds(designTasks.map((t) => t.id))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    try {
      await onConfirm(selectedTaskIds)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al actualizar los diseños del pedido.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const allSelected = selectedTaskIds.length === designTasks.length

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-xl p-6 text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🎨</span> Finalizar Diseños de Pedido
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Pedido <span className="font-mono text-blue-400 font-bold">#{pedido.codigo}</span> —{' '}
            <span className="text-slate-300 font-semibold">
              {pedido.cliente?.nombre_empresa || pedido.cliente?.nombre_cliente || 'Cliente sin empresa'}
            </span>
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
          <span>❌</span>
          <span>{error}</span>
        </div>
      )}

      {/* Pregunta Principal */}
      <div className="bg-blue-950/40 border border-blue-500/20 rounded-xl p-4 mb-4">
        <h3 className="text-sm font-bold text-blue-200 mb-1">
          ¿Se terminó el diseño de todos los productos del pedido?
        </h3>
        <p className="text-xs text-slate-400">
          Por defecto están todos seleccionados. Puedes destildar si te quedó el diseño de alguno sin terminar:
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Toggle General Marcar/Desmarcar Todo */}
        {designTasks.length > 1 && (
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="text-slate-400">
              {selectedTaskIds.length} de {designTasks.length} productos tildados
            </span>
            <button
              type="button"
              onClick={handleToggleAll}
              className="text-blue-400 hover:text-blue-300 font-medium underline transition cursor-pointer"
            >
              {allSelected ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
          </div>
        )}

        {/* Lista de Productos del Pedido con Etapa de Diseño */}
        <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
          {designTasks.map((task) => {
            const isChecked = selectedTaskIds.includes(task.id)
            const prod = (task.etapa as any)?.producto || task.etapaProducto?.producto
            const prodName = prod?.nombre || `Producto (Etapa #${task.etapa_id})`
            const imgUrl = prod?.imagen_principal?.url || prod?.imagenes?.[0]?.url

            return (
              <div
                key={task.id}
                onClick={() => handleToggleTask(task.id)}
                className={`flex items-center justify-between p-3.5 rounded-xl border transition cursor-pointer select-none ${
                  isChecked
                    ? 'bg-blue-600/10 border-blue-500/40 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}} // Manejado en div onClick
                    className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer"
                  />
                  {imgUrl ? (
                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imgUrl} alt={prodName} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg border border-slate-800 bg-slate-900 shrink-0 flex items-center justify-center text-slate-600 text-xs">
                      📦
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-sm leading-tight text-white">{prodName}</h4>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Etapa: <span className="text-slate-300">{(task.etapa as any)?.nombre || 'Diseño'}</span>
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      task.estado === 'en_progreso'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {task.estado === 'en_progreso' ? 'En Progreso' : 'Pendiente'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 transition disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <span>✅</span>
                <span>Confirmar Diseños Completados</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}

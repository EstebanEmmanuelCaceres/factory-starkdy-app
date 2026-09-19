'use client'

import { useState, useEffect } from 'react'
import {
  fetchDisenosPendientes,
  completarDisenosPedido,
  type ResponsableEtapa
} from '@/lib/responsable_etapas'
import CompleteDesignModal from '@/components/CompleteDesignModal'
import type { Pedido } from '@/lib/pedidos'
import { getStoredUser } from '@/lib/auth'

export interface PendingDesignsCardProps {
  currentUserId?: number
  onDesignCompleted?: () => void
}

interface GroupedDesignPedido {
  pedido: Pedido
  tasks: ResponsableEtapa[]
}

export default function PendingDesignsCard({
  onDesignCompleted
}: PendingDesignsCardProps) {
  const currentUser = getStoredUser()
  const isDesignRole = ['vendedor', 'disenador', 'disenadora'].includes(currentUser?.role || '')

  const [tasks, setTasks] = useState<ResponsableEtapa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedPedidoGroup, setSelectedPedidoGroup] = useState<GroupedDesignPedido | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const loadDisenos = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchDisenosPendientes()
      setTasks(data)
    } catch (err: unknown) {
      console.error('Error al cargar diseños pendientes:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar los diseños pendientes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isDesignRole) {
      loadDisenos()
    }
  }, [isDesignRole])

  if (!isDesignRole) {
    return null
  }

  // Agrupar las tareas de diseño por pedido
  const groupedMap = new Map<number, GroupedDesignPedido>()
  tasks.forEach((task) => {
    if (!task.pedido) return
    const pid = task.pedido.id
    if (!groupedMap.has(pid)) {
      groupedMap.set(pid, {
        pedido: task.pedido,
        tasks: []
      })
    }
    groupedMap.get(pid)!.tasks.push(task)
  })

  const groupedList = Array.from(groupedMap.values()).filter(
    (group) => group.pedido && group.pedido.estado !== 'pendiente' && group.pedido.estado !== 'cancelado'
  )

  const handleOpenModal = (group: GroupedDesignPedido) => {
    setSelectedPedidoGroup(group)
    setIsModalOpen(true)
  }

  const handleConfirmCompletion = async (completedTaskIds: number[]) => {
    if (!selectedPedidoGroup) return
    await completarDisenosPedido(selectedPedidoGroup.pedido.id, completedTaskIds)
    await loadDisenos()
    if (onDesignCompleted) {
      onDesignCompleted()
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col mb-6">
      {/* Cabecera de la Tarjeta */}
      <div className="border-b border-slate-800 p-5 bg-slate-950/40 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>🎨</span> Diseños Pendientes
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Trabajos de diseño asignados habilitados para producción
          </p>
        </div>
        <button
          onClick={loadDisenos}
          disabled={loading}
          className="text-xs text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
          title="Actualizar diseños pendientes"
        >
          🔄
        </button>
      </div>

      {/* Contenido */}
      <div className="p-4 flex-grow">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
            <span className="text-xs">Cargando diseños pendientes...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-500/10 text-rose-300 rounded-xl text-xs flex items-center gap-2">
            <span>❌</span>
            <span>{error}</span>
          </div>
        ) : groupedList.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-slate-500 gap-2 text-center">
            <span className="text-3xl">🎉</span>
            <span className="text-xs font-semibold text-slate-400">
              No tienes diseños pendientes en este momento
            </span>
          </div>
        ) : (
          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {groupedList.map((group) => {
              const { pedido, tasks: groupTasks } = group
              const isEnabledForProd = pedido.estado !== 'pendiente'

              return (
                <div
                  key={pedido.id}
                  className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 space-y-2.5 transition shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-blue-400">#{pedido.codigo}</span>
                        <span
                          className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        >
                          En Producción
                        </span>
                      </div>
                      <h3 className="font-bold text-white text-sm leading-tight mt-1">
                        {pedido.cliente?.nombre_empresa || pedido.cliente?.nombre_cliente || 'Sin cliente'}
                      </h3>
                    </div>

                    <button
                      onClick={() => handleOpenModal(group)}
                      className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md transition duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shrink-0"
                    >
                      <span>🎨</span> Terminar Diseño
                    </button>
                  </div>

                  {/* Resumen de Diseños Pendientes */}
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-850">
                    <span className="text-slate-400 text-[11px]">
                      <span className="font-bold text-white">{groupTasks.length}</span> {groupTasks.length === 1 ? 'diseño pendiente' : 'diseños pendientes'}
                    </span>
                    <span className="text-slate-500 text-[10px]">
                      Vendedor: <span className="text-slate-300 font-medium">{pedido.user?.name || 'Vendedor'}</span>
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de Confirmación de Diseños */}
      {selectedPedidoGroup && (
        <CompleteDesignModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedPedidoGroup(null)
          }}
          pedido={selectedPedidoGroup.pedido}
          designTasks={selectedPedidoGroup.tasks}
          onConfirm={handleConfirmCompletion}
        />
      )}
    </div>
  )
}

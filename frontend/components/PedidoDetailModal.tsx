'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/Modal'
import {
  type Pedido,
  type ComentarioPedido,
  getPedido,
  updatePedido,
  createPedidoComentario
} from '@/lib/pedidos'
import { fetchEtapas, type Etapa } from '@/lib/entities/etapas'
import { fetchResponsablesEtapas, assignTask, type ResponsableEtapa } from '@/lib/responsable_etapas'
import { completeOperarioTask } from '@/lib/operario_tasks'
import { getStoredUser } from '@/lib/auth'

export interface PedidoDetailModalProps {
  pedido: Pedido | null
  isOpen: boolean
  onClose: () => void
  onUpdatePedido?: (updatedPedido: Pedido) => void
  allStages?: Etapa[]
  taskAssignments?: ResponsableEtapa[]
  onOpenGallery?: (pedido: Pedido) => void
  onOpenPayments?: (pedido: Pedido) => void
  onOpenEdit?: (pedido: Pedido) => void
}

export default function PedidoDetailModal({
  pedido,
  isOpen,
  onClose,
  onUpdatePedido,
  allStages: propAllStages,
  taskAssignments: propTaskAssignments,
  onOpenGallery,
  onOpenPayments,
  onOpenEdit
}: PedidoDetailModalProps) {
  const [currentPedido, setCurrentPedido] = useState<Pedido | null>(pedido)
  const [stages, setStages] = useState<Etapa[]>(propAllStages || [])
  const [assignments, setAssignments] = useState<ResponsableEtapa[]>(propTaskAssignments || [])

  // Estados locales de la UI
  const [isEditCommentActive, setIsEditCommentActive] = useState(false)
  const [tempComentario, setTempComentario] = useState('')
  const [nuevoComentario, setNuevoComentario] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [verTodosProductos, setVerTodosProductos] = useState(false)
  const [openAccordions, setOpenAccordions] = useState<Record<number, boolean>>({})
  const [notification, setNotification] = useState('')
  const [error, setError] = useState('')
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null)

  // Sincronizar estado cuando cambia la prop 'pedido' u 'open'
  useEffect(() => {
    setCurrentPedido(pedido)
    if (pedido) {
      setTempComentario(pedido.comentario || '')
    }
  }, [pedido, isOpen])

  // Cargar pedido completo, etapas y asignaciones si no vinieron por props
  useEffect(() => {
    if (!isOpen || !pedido) return

    let isMounted = true

    const loadMissingData = async () => {
      try {
        // 1. Obtener detalle actualizado del pedido
        const fullPedido = await getPedido(pedido.id).catch(() => pedido)
        if (isMounted && fullPedido) {
          setCurrentPedido(fullPedido)
          setTempComentario(fullPedido.comentario || '')
        }

        const prods = fullPedido?.productos || pedido.productos || []

        // 2. Obtener etapas configuradas para cada producto
        let loadedStages: Etapa[] = []
        if (propAllStages && propAllStages.length > 0) {
          loadedStages = propAllStages
        } else if (prods.length > 0) {
          const stagesByProduct = await Promise.all(
            prods.map((prod) => fetchEtapas({ producto_id: prod.id }).catch(() => []))
          )
          loadedStages = stagesByProduct.flat()
        } else {
          loadedStages = await fetchEtapas().catch(() => [])
        }

        // 3. Obtener asignaciones/responsables del pedido
        let loadedAssignments: ResponsableEtapa[] = []
        if (propTaskAssignments && propTaskAssignments.length > 0) {
          loadedAssignments = propTaskAssignments
        } else {
          loadedAssignments = await fetchResponsablesEtapas({ pedido_id: pedido.id }).catch(() => [])
        }

        if (isMounted) {
          setStages(loadedStages)
          setAssignments(loadedAssignments)
        }
      } catch (err) {
        console.error('Error al cargar información del pedido o etapas:', err)
      }
    }

    loadMissingData()

    return () => {
      isMounted = false
    }
  }, [isOpen, pedido, propAllStages, propTaskAssignments])

  // Si se envían props actualizadas de etapas/asignaciones
  useEffect(() => {
    if (propAllStages && propAllStages.length > 0) {
      setStages(propAllStages)
    }
  }, [propAllStages])

  useEffect(() => {
    if (propTaskAssignments && propTaskAssignments.length > 0) {
      setAssignments(propTaskAssignments)
    }
  }, [propTaskAssignments])

  const userRole = (() => {
    const u = getStoredUser()
    if (!u || !u.role) return ''
    if (typeof u.role === 'string') return u.role
    return (u.role as any).slug || ''
  })()
  const isAuthorizedRole = !userRole || ['admin', 'encargado', 'vendedor'].includes(userRole)

  if (!isOpen || !currentPedido) return null

  const showNotification = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(''), 3000)
  }

  const handleStatusChange = async (newEstado: string) => {
    try {
      setError('')
      const updated = await updatePedido(currentPedido.id, { estado: newEstado })
      setCurrentPedido(updated)
      if (onUpdatePedido) onUpdatePedido(updated)
      showNotification('Estado del pedido actualizado correctamente')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el estado')
    }
  }

  const handleSaveDescription = async () => {
    try {
      setError('')
      const updated = await updatePedido(currentPedido.id, { comentario: tempComentario })
      setCurrentPedido(updated)
      if (onUpdatePedido) onUpdatePedido(updated)
      setIsEditCommentActive(false)
      showNotification('Descripción actualizada')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar la descripción')
    }
  }

  const handleAddComment = async () => {
    if (!nuevoComentario.trim() || isSubmittingComment) return
    try {
      setIsSubmittingComment(true)
      setError('')
      const comment = await createPedidoComentario(currentPedido.id, nuevoComentario)
      const updatedComments: ComentarioPedido[] = [comment, ...(currentPedido.comentarios || [])]
      const updatedPedido: Pedido = { ...currentPedido, comentarios: updatedComments }
      setCurrentPedido(updatedPedido)
      if (onUpdatePedido) onUpdatePedido(updatedPedido)
      setNuevoComentario('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al publicar comentario')
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handleCompleteTask = async (task: ResponsableEtapa | null, stage: Etapa) => {
    if (!currentPedido) return
    const targetKey = task?.id || stage.id
    try {
      setError('')
      setCompletingTaskId(targetKey)

      if (task) {
        await completeOperarioTask(task.id)
      } else {
        const storedUser = getStoredUser()
        const newTask = await assignTask({
          pedido_id: currentPedido.id,
          etapa_id: stage.id,
          user_id: storedUser?.id || null,
          estado: 'completado'
        })
        if (newTask && newTask.estado !== 'completado') {
          await completeOperarioTask(newTask.id)
        }
      }

      showNotification(`✓ Etapa "${stage.nombre}" completada`)

      // Actualizar asignaciones
      const updatedAssignments = await fetchResponsablesEtapas({ pedido_id: currentPedido.id }).catch(() => [])
      setAssignments(updatedAssignments)

      // Actualizar pedido por si cambió su estado global
      const updatedPedido = await getPedido(currentPedido.id).catch(() => currentPedido)
      if (updatedPedido) {
        setCurrentPedido(updatedPedido)
        if (onUpdatePedido) onUpdatePedido(updatedPedido)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al completar la etapa')
    } finally {
      setCompletingTaskId(null)
    }
  }

  // Cover image
  const coverUrl =
    currentPedido.imagenes?.find((img) => img.es_principal)?.url ||
    currentPedido.imagenes?.[0]?.url ||
    currentPedido.productos?.find((prod) => (prod as any).imagen_principal?.url)?.imagen_principal?.url ||
    currentPedido.productos?.[0]?.imagen_principal?.url ||
    currentPedido.productos?.[0]?.imagenes?.[0]?.url

  // Productos
  const pds = currentPedido.productos || []
  const displayedProducts = verTodosProductos ? pds : pds.slice(0, 2)

  // Función helper para la etapa actual de un producto
  const getProductCurrentStage = (
    productoStages: Etapa[],
    taskAssignmentsList: ResponsableEtapa[]
  ) => {
    if (productoStages.length === 0) return null

    for (const stage of productoStages) {
      const task = taskAssignmentsList.find(
        (t) =>
          t.pedido_id === currentPedido.id &&
          ((t as any).etapa_producto_id === stage.id || t.etapa_id === stage.id || t.etapa?.id === stage.id)
      )
      if (!task || task.estado !== 'completado') {
        return { stage, task }
      }
    }
    const lastStage = productoStages[productoStages.length - 1]
    const lastTask = taskAssignmentsList.find(
      (t) =>
        t.pedido_id === currentPedido.id &&
        ((t as any).etapa_producto_id === lastStage.id || t.etapa_id === lastStage.id || t.etapa?.id === lastStage.id)
    )
    return { stage: lastStage, task: lastTask }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-4xl p-6 flex flex-col"
    >
      {/* Notificación rápida */}
      {notification && (
        <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-4 py-2 rounded-xl text-xs font-semibold text-center animate-in fade-in">
          ✓ {notification}
        </div>
      )}

      {error && (
        <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 px-4 py-2 rounded-xl text-xs font-semibold text-center animate-in fade-in">
          ⚠️ {error}
        </div>
      )}

      {/* Header de Imagen / Portada */}
      {coverUrl && (
        <div className="-mx-6 -mt-6 mb-5 relative h-64 sm:h-80 md:h-[420px] min-h-[280px] sm:min-h-[350px] md:min-h-[420px] bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-center overflow-hidden rounded-t-2xl group">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-25 blur-2xl scale-110 pointer-events-none"
            style={{ backgroundImage: `url(${coverUrl})` }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt={`Portada Pedido #${currentPedido.id}`}
            className="relative z-10 max-h-full max-w-full object-contain p-4 transition duration-200"
            onError={(e) => {
              ;(e.target as HTMLImageElement).src =
                "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><rect width='200' height='200' fill='%230f172a'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2364748b' font-family='sans-serif' font-size='13'>Imagen no disponible</text></svg>"
            }}
          />

          {onOpenGallery && (
            <div className="absolute bottom-3 right-3 z-20">
              <button
                type="button"
                onClick={() => onOpenGallery(currentPedido)}
                className="bg-slate-900/90 hover:bg-slate-950 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700 backdrop-blur-md flex items-center gap-1.5 shadow-xl transition"
              >
                🖼️ Cambiar Portada / Ver Galería ({currentPedido.imagenes?.length || 1})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Header del Modal */}
      <div className="border-b border-slate-800 pb-4 mb-4 space-y-4">
        {/* Fila Superior: Título + Estado a la izquierda, Acciones a la derecha */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pr-8">
          <div className="text-left space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                📋 Pedido #{currentPedido.id}
              </h2>
              {/* Estado del Pedido Selector */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1 shadow-inner">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Estado:
                </span>
                <select
                  value={currentPedido.estado}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="bg-transparent text-xs font-bold text-blue-400 focus:outline-none cursor-pointer pr-1"
                >
                  <option value="pendiente" className="bg-slate-900 text-white">
                    Pendiente
                  </option>
                  <option value="listo_para_produccion" className="bg-slate-900 text-white">
                    Listo para producción
                  </option>
                  <option value="en_progreso" className="bg-slate-900 text-white">
                    En Progreso
                  </option>
                  <option value="completado" className="bg-slate-900 text-white">
                    Completado
                  </option>
                  <option value="completado_pd" className="bg-slate-900 text-white">
                    Completado - pendiente de pago (PD)
                  </option>
                  <option value="enviado" className="bg-slate-900 text-white">
                    Enviado
                  </option>
                  <option value="enviado_faltante" className="bg-slate-900 text-white">
                    Enviado con faltante
                  </option>
                  <option value="cancelado" className="bg-slate-900 text-white">
                    Cancelado
                  </option>
                </select>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Cliente:{' '}
              <span className="text-slate-200 font-bold">
                {currentPedido.cliente?.nombre_cliente}
              </span>{' '}
              {currentPedido.cliente?.nombre_empresa
                ? `(${currentPedido.cliente.nombre_empresa})`
                : ''}
            </p>
          </div>

          {/* Botones de acción derecha: Editar Pedido, Galería */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-end sm:self-start">
            {onOpenEdit && isAuthorizedRole && (
              <button
                type="button"
                onClick={() => onOpenEdit(currentPedido)}
                className="bg-slate-900 hover:bg-slate-850 border border-slate-750 hover:border-blue-500/50 text-blue-300 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition shadow-md hover:scale-[1.02] active:scale-[0.98]"
                title="Editar datos y asignaciones del pedido"
              >
                <span>✏️</span>
                <span>Editar Pedido</span>
              </button>
            )}
            {onOpenGallery && isAuthorizedRole && (
              <button
                type="button"
                onClick={() => onOpenGallery(currentPedido)}
                className="bg-slate-900 hover:bg-slate-850 border border-slate-750 hover:border-amber-500/50 text-amber-300 text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-2 transition shadow-md hover:scale-[1.02] active:scale-[0.98]"
                title="Gestionar Galería de Imágenes / Planos"
              >
                <span>🖼️</span>
                <span>Galería / Planos</span>
                {currentPedido.imagenes && currentPedido.imagenes.length > 0 && (
                  <span className="bg-amber-500/20 text-amber-300 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border border-amber-500/30">
                    {currentPedido.imagenes.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Resumen Financiero y Botón de Cobro */}
        {currentPedido.precio !== null && currentPedido.precio !== undefined && (
          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-inner">
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Precio Total</span>
                <span className="font-extrabold text-white text-sm">
                  $ {parseFloat(currentPedido.precio.toString()).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Monto Pagado</span>
                <span className="font-extrabold text-emerald-400 text-sm">
                  $ {(currentPedido.monto_pagado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Saldo Pendiente</span>
                <span className="font-extrabold text-amber-400 text-sm">
                  $ {(currentPedido.saldo_pendiente ?? Math.max(0, (currentPedido.precio || 0) - (currentPedido.monto_pagado || 0))).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {onOpenPayments && isAuthorizedRole && (
              <button
                type="button"
                onClick={() => onOpenPayments(currentPedido)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>💵</span>
                <span>Cargar Cobro</span>
              </button>
            )}
          </div>
        )}

        {/* Fila Banner: Alerta de Pedido Pendiente (en su propia fila dedicada) */}
        {currentPedido.estado === 'pendiente' && (
          <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/5 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div className="text-xs space-y-0.5 text-left">
              <span className="font-bold flex items-center gap-1.5 text-sm text-amber-400">
                <span>⚠️</span> Pedido en Estado Pendiente
              </span>
              <p className="text-slate-300 text-xs">
                Este pedido no es visible para los operarios hasta que lo pases a{' '}
                <strong>&quot;Listo para producción&quot;</strong>.
              </p>
            </div>
            <button
              onClick={() => handleStatusChange('listo_para_produccion')}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition shadow-lg shadow-cyan-600/20 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5"
            >
              <span>🚀</span>
              <span>Pasar a Listo para Producción</span>
            </button>
          </div>
        )}
      </div>

      {/* Cuerpo Principal: Dos Columnas */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-grow overflow-y-auto">
        {/* Columna Izquierda (8 cols) */}
        <div className="md:col-span-8 space-y-6 text-left">
          {/* Sección: Descripción */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📝</span> Descripción
              </h3>
              <button
                type="button"
                onClick={() => setIsEditCommentActive(!isEditCommentActive)}
                className="text-xs bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 px-2 py-1 rounded transition font-semibold"
              >
                {isEditCommentActive ? 'Cancelar' : 'Editar'}
              </button>
            </div>

            {isEditCommentActive ? (
              <div className="space-y-2">
                <textarea
                  value={tempComentario}
                  onChange={(e) => setTempComentario(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500 transition h-24"
                  placeholder="Agregar una descripción más detallada..."
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveDescription}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl">
                {currentPedido.comentario ? (
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">
                    {currentPedido.comentario}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500 italic">
                    No hay descripción añadida. Haz clic en Editar para agregar una.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Sección: Productos y sus Etapas */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>📦</span> Productos y Etapas de Fabricación
            </h3>

            {pds.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                No hay productos asociados a este pedido.
              </p>
            ) : (
              <div className="space-y-3">
                {displayedProducts.map((prod) => {
                  const prodStages = stages
                    .filter((s) => s.producto_id === prod.id)
                    .sort((a, b) => a.orden - b.orden)
                  const qty = prod.pivot?.cantidad || 1
                  const currentInfo = getProductCurrentStage(prodStages, assignments)
                  const isAccordionOpen = openAccordions[prod.id] || false

                  return (
                    <div
                      key={prod.id}
                      className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-3 transition hover:border-slate-750"
                    >
                      {/* Cabecera del producto */}
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <span className="text-sm font-bold text-white block">
                            {prod.nombre}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold uppercase">
                            Cantidad: {qty}
                          </span>
                        </div>

                        {/* Etapa actual a la vista */}
                        {currentInfo ? (
                          <div className="text-right flex flex-col items-end gap-1">
                            <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block">
                              Etapa Actual
                            </span>
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              <span className="text-base sm:text-lg font-black text-blue-400 capitalize tracking-tight">
                                {currentInfo.stage.nombre}
                              </span>
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                {currentInfo.task?.estado || 'pendiente'}
                              </span>
                            </div>
                            {currentInfo.task?.estado !== 'completado' && currentPedido.estado !== 'pendiente' && (
                              <button
                                type="button"
                                disabled={completingTaskId === (currentInfo.task?.id || currentInfo.stage.id)}
                                onClick={() => handleCompleteTask(currentInfo.task || null, currentInfo.stage)}
                                className="mt-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white text-xs font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow cursor-pointer"
                                title="Marcar etapa como completada"
                              >
                                <span>✓</span>
                                <span>{completingTaskId === (currentInfo.task?.id || currentInfo.stage.id) ? 'Guardando...' : 'Completar Etapa'}</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 italic">Sin etapas</span>
                        )}
                      </div>

                      {/* Botón del acordeón */}
                      {prodStages.length > 0 && (
                        <div className="border-t border-slate-850 pt-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              setOpenAccordions((prev) => ({
                                ...prev,
                                [prod.id]: !isAccordionOpen
                              }))
                            }}
                            className="w-full flex items-center justify-between text-xs text-blue-400 hover:text-blue-300 font-semibold"
                          >
                            <span>
                              {isAccordionOpen
                                ? '🔼 Ocultar flujo de etapas'
                                : '🔽 Ver flujo de etapas completo (Grafo)'}
                            </span>
                            <span className="text-[10px] bg-slate-800 text-slate-350 px-2 py-0.5 rounded-full">
                              {prodStages.length} etapas
                            </span>
                          </button>

                          {/* Contenedor del Grafo dentro del Acordeón */}
                          {isAccordionOpen && (
                            <div className="mt-3 p-4 bg-slate-950/80 rounded-xl border border-slate-850 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                                Grafo de Progreso de Fabricación
                              </span>

                              <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-2 overflow-x-auto py-2">
                                {prodStages.map((stage, idx) => {
                                  const task = assignments.find(
                                    (t) =>
                                      t.pedido_id === currentPedido.id &&
                                      ((t as any).etapa_producto_id === stage.id ||
                                        t.etapa_id === stage.id ||
                                        t.etapa?.id === stage.id)
                                  )
                                  const state = task?.estado || 'pendiente'

                                  let nodeBg = 'bg-slate-900 border-slate-800 text-slate-400'
                                  let stateLabel = 'Pendiente'
                                  if (state === 'completado') {
                                    nodeBg =
                                      'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                    stateLabel = 'Completado'
                                  } else if (state === 'en_progreso') {
                                    nodeBg =
                                      'bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.15)] animate-pulse'
                                    stateLabel = 'En Progreso'
                                  } else if (state === 'bloqueada') {
                                    nodeBg = 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                    stateLabel = 'Bloqueada'
                                  }

                                  const completionDate =
                                    state === 'completado' && (task?.fecha_fin || task?.updated_at)
                                      ? new Date(
                                          task.fecha_fin || task.updated_at
                                        ).toLocaleDateString('es-ES', {
                                          day: 'numeric',
                                          month: 'short',
                                          year: 'numeric'
                                        })
                                      : null

                                  return (
                                    <div
                                      key={stage.id}
                                      className="flex flex-col md:flex-row md:items-center flex-shrink-0"
                                    >
                                      <div
                                        className={`border p-2.5 rounded-xl text-center min-w-[130px] ${nodeBg}`}
                                      >
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                                          Etapa {stage.orden}
                                        </span>
                                        <span
                                          className="text-xs font-bold block truncate max-w-[120px]"
                                          title={stage.nombre}
                                        >
                                          {stage.nombre}
                                        </span>
                                        <span className="text-[9px] font-medium block mt-1 uppercase">
                                          {stateLabel}
                                        </span>
                                        {completionDate && (
                                          <span
                                            className="text-[9px] font-medium block mt-1 text-emerald-300/90 font-mono"
                                            title={`Fecha de terminación: ${completionDate}`}
                                          >
                                            {completionDate}
                                          </span>
                                        )}
                                        {state !== 'completado' && currentPedido.estado !== 'pendiente' && (
                                          <button
                                            type="button"
                                            disabled={completingTaskId === (task?.id || stage.id)}
                                            onClick={() => handleCompleteTask(task || null, stage)}
                                            className="mt-2 w-full text-[10px] font-extrabold px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white transition shadow flex items-center justify-center gap-1 cursor-pointer"
                                            title="Completar esta etapa"
                                          >
                                            <span>✓</span>
                                            <span>{completingTaskId === (task?.id || stage.id) ? 'Completo...' : 'Completar'}</span>
                                          </button>
                                        )}
                                      </div>

                                      {idx < prodStages.length - 1 && (
                                        <div className="flex items-center justify-center py-1 md:py-0 md:px-2">
                                          <span className="text-slate-600 font-bold hidden md:inline">
                                            ➔
                                          </span>
                                          <span className="text-slate-600 font-bold md:hidden">
                                            ↓
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {pds.length > 2 && (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => setVerTodosProductos(!verTodosProductos)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 text-xs font-bold rounded-lg transition"
                    >
                      {verTodosProductos ? 'Mostrar menos 🔼' : 'Ver todos los productos 🔽'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha - Comentarios y Actividad */}
        <div className="md:col-span-4 border-t md:border-t-0 md:border-l border-slate-800 pt-6 md:pt-0 md:pl-6 flex flex-col max-h-[60vh] md:max-h-full">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3 text-left">
            <span>💬</span> Comentarios y Actividad
          </h3>

          <div className="space-y-2 mb-4 text-left">
            <textarea
              value={nuevoComentario}
              onChange={(e) => setNuevoComentario(e.target.value)}
              placeholder="Escribe un comentario..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-550 focus:outline-none focus:border-blue-500 transition resize-none h-16"
            />
            <button
              type="button"
              disabled={!nuevoComentario.trim() || isSubmittingComment}
              onClick={handleAddComment}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-850 disabled:text-slate-650 text-white rounded text-xs font-semibold transition"
            >
              {isSubmittingComment ? 'Publicando...' : 'Comentar'}
            </button>
          </div>

          <div className="space-y-3 overflow-y-auto flex-grow pr-1 max-h-[30vh] md:max-h-[45vh]">
            {!currentPedido.comentarios || currentPedido.comentarios.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-4">
                No hay comentarios en este pedido todavía.
              </p>
            ) : (
              currentPedido.comentarios.map((c) => (
                <div
                  key={c.id}
                  className="bg-slate-950/30 border border-slate-850/50 p-2.5 rounded-lg text-left space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-slate-350">{c.user?.name || 'Usuario'}</span>
                    <span className="text-slate-500 font-mono">
                      {new Date(c.created_at).toLocaleDateString('es-AR')}{' '}
                      {new Date(c.created_at).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed break-words">{c.cuerpo}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

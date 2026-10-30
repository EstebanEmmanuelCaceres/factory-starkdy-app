'use client'

import { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/Modal/Modal'
import {
  type Pedido,
  type ComentarioPedido,
  getPedido,
  updatePedido,
  createPedidoComentario
} from '@/lib/pedidos'
import { topologicalSortEtapas, type Etapa } from '@/lib/entities/etapas'
import { fetchResponsablesEtapas, assignTask, etapasDesdeTareas, type ResponsableEtapa } from '@/lib/responsable_etapas'
import { completeOperarioTask, uncompleteOperarioTask, startOperarioTask, cancelOperarioTask } from '@/lib/operario_tasks'
import { getStoredUser } from '@/lib/auth'
import SubtitleH2 from './Titles/SubtitleH2'
import SelectStatus from './SelectFilter/SelectStatus'
import { PEDIDO_STATE_OPTIONS } from '@/lib/order-status'
import { useModalContext } from '@/components/Modal/context/ModalContext'
import ClientDetailModal, { CLIENT_DETAIL_MODAL_ID } from '@/components/ClientDetailModal'
import ImageLightbox, { type LightboxImage } from '@/components/ImageLightbox'

const PEDIDO_DETAIL_MODAL_ID = 'pedido-detail'

export interface PedidoDetailModalProps {
  pedido: Pedido | null
  isOpen: boolean
  onClose: () => void
  onUpdatePedido?: (updatedPedido: Pedido) => void
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
  taskAssignments: propTaskAssignments,
  onOpenGallery,
  onOpenPayments,
  onOpenEdit
}: PedidoDetailModalProps) {
  const [currentPedido, setCurrentPedido] = useState<Pedido | null>(pedido)
  const [assignments, setAssignments] = useState<ResponsableEtapa[]>(propTaskAssignments || [])

  // Las etapas de cada producto salen de las tareas del pedido (no de la configuración actual del producto):
  // si al producto se le agregan o quitan etapas, este pedido sigue con las que tenía.
  const stages = useMemo(
    () => etapasDesdeTareas(assignments.filter((t) => t.pedido_id === currentPedido?.id)),
    [assignments, currentPedido?.id]
  )

  // Estados locales de la UI
  const [isEditCommentActive, setIsEditCommentActive] = useState(false)
  const [tempComentario, setTempComentario] = useState('')
  const [nuevoComentario, setNuevoComentario] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [openAccordions, setOpenAccordions] = useState<Record<number, boolean>>({})
  const [notification, setNotification] = useState('')
  const [error, setError] = useState('')
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null)
  const [coverIndex, setCoverIndex] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  // Pila de modales: el detalle del pedido y, encima, el del cliente
  const { open: openModal, close: closeModal } = useModalContext()
  const [clientIdForModal, setClientIdForModal] = useState<number | null>(null)

  // El padre controla isOpen; lo reflejamos en la pila del context.
  // Al cerrar el pedido también se cierra el modal de cliente que tenga encima.
  useEffect(() => {
    if (!isOpen) return
    openModal(PEDIDO_DETAIL_MODAL_ID)
    return () => closeModal(PEDIDO_DETAIL_MODAL_ID)
  }, [isOpen, openModal, closeModal])

  const handleOpenClientModal = () => {
    const clienteId = currentPedido?.cliente_id ?? currentPedido?.cliente?.id
    if (clienteId) {
      setClientIdForModal(clienteId)
      openModal(CLIENT_DETAIL_MODAL_ID)
    }
  }

  // Sincronizar estado cuando cambia la prop 'pedido' u 'open'
  useEffect(() => {
    setCurrentPedido(pedido)
    if (pedido) {
      setTempComentario(pedido.comentario || '')
    }
  }, [pedido, isOpen])

  useEffect(() => {
    setCoverIndex(0)
    setIsLightboxOpen(false)
  }, [pedido?.id, isOpen])

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

        // 2. Obtener las tareas del pedido (de ahí salen sus etapas, responsables y estados)
        const loadedAssignments = await fetchResponsablesEtapas({ pedido_id: pedido.id }).catch(() => [])

        if (isMounted) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pedido?.id])

  const userRole = (() => {
    const u = getStoredUser()
    if (!u || !u.role) return ''
    if (typeof u.role === 'string') return u.role
    return (u.role as any).slug || ''
  })()
  const isOperario = userRole === 'operario' || userRole === 'operator'
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

  const handleUncompleteTask = async (task: ResponsableEtapa | null, stage: Etapa) => {
    if (!currentPedido) return
    const targetKey = task?.id || stage.id
    try {
      setError('')
      setCompletingTaskId(targetKey)

      if (task) {
        await uncompleteOperarioTask(task.id)
      } else {
        const storedUser = getStoredUser()
        await assignTask({
          pedido_id: currentPedido.id,
          etapa_id: stage.id,
          user_id: storedUser?.id || null,
          estado: 'pendiente'
        })
      }

      showNotification(`↩ Etapa "${stage.nombre}" marcada como sin completar`)

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
      setError(err instanceof Error ? err.message : 'Error al desmarcar la etapa')
    } finally {
      setCompletingTaskId(null)
    }
  }

  const handleStartTask = async (task: ResponsableEtapa | null, stage: Etapa) => {
    if (!currentPedido) return
    const targetKey = task?.id || stage.id
    try {
      setError('')
      setCompletingTaskId(targetKey)

      if (task) {
        await startOperarioTask(task.id)
      } else {
        const storedUser = getStoredUser()
        const newTask = await assignTask({
          pedido_id: currentPedido.id,
          etapa_id: stage.id,
          user_id: storedUser?.id || null,
          estado: 'en_progreso'
        })
        if (newTask && newTask.estado !== 'en_progreso') {
          await startOperarioTask(newTask.id)
        }
      }

      showNotification(`▶ Etapa "${stage.nombre}" puesta en progreso`)

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
      setError(err instanceof Error ? err.message : 'Error al iniciar la etapa')
    } finally {
      setCompletingTaskId(null)
    }
  }

  const handleCancelTask = async (task: ResponsableEtapa | null, stage: Etapa) => {
    if (!currentPedido) return
    const targetKey = task?.id || stage.id
    try {
      setError('')
      setCompletingTaskId(targetKey)

      if (task) {
        await cancelOperarioTask(task.id)
      } else {
        const storedUser = getStoredUser()
        await assignTask({
          pedido_id: currentPedido.id,
          etapa_id: stage.id,
          user_id: storedUser?.id || null,
          estado: 'pendiente'
        })
      }

      showNotification(`⏸ Etapa "${stage.nombre}" pausada (a pendiente)`)

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
      setError(err instanceof Error ? err.message : 'Error al pausar la etapa')
    } finally {
      setCompletingTaskId(null)
    }
  }

  // Imágenes de la portada: las del pedido (la principal primero, luego por orden).
  // Si el pedido no tiene, se usa la imagen del producto como antes.
  const productCoverUrl =
    currentPedido.productos?.find((prod) => (prod as any).imagen_principal?.url)?.imagen_principal?.url ||
    currentPedido.productos?.[0]?.imagen_principal?.url ||
    currentPedido.productos?.[0]?.imagenes?.[0]?.url
  const coverImages: LightboxImage[] = currentPedido.imagenes?.length
    ? [...currentPedido.imagenes]
      .sort((a, b) => Number(b.es_principal) - Number(a.es_principal) || a.orden - b.orden)
      .map((img, i) => ({ url: img.url, alt: `Pedido #${currentPedido.id} - imagen ${i + 1}` }))
    : productCoverUrl
      ? [{ url: productCoverUrl, alt: `Portada Pedido #${currentPedido.id}` }]
      : []
  const safeCoverIndex = Math.min(coverIndex, Math.max(coverImages.length - 1, 0))
  const coverUrl = coverImages[safeCoverIndex]?.url
  const hasManyCovers = coverImages.length > 1
  const moveCover = (step: number) =>
    setCoverIndex((safeCoverIndex + step + coverImages.length) % coverImages.length)

  // Productos (se muestran todos directamente)
  const pds = currentPedido.productos || []
  const displayedProducts = pds

  // Tarea de este pedido para una etapa del producto
  const findStageTask = (stageId: number) =>
    assignments.find(
      (t) =>
        t.pedido_id === currentPedido.id &&
        ((t as any).etapa_producto_id === stageId || t.etapa_id === stageId || t.etapa?.id === stageId)
    )

  // Una etapa se habilita solo cuando están completadas todas las etapas de las que depende
  // (etapa_producto_dependencias). El orden no bloquea: las etapas paralelas se habilitan juntas.
  const hasIncompleteDependencies = (stage: Etapa) =>
    (stage.dependencias || []).some((dep) => (findStageTask(dep.id)?.estado || 'pendiente') !== 'completado')

  // Etapas actuales de un producto: todas las no completadas cuyas dependencias ya están completas.
  // Si todo está completo, devuelve la última (para poder revertirla).
  const getProductCurrentStages = (sortedStages: Etapa[]) => {
    const withTask = sortedStages.map((stage) => ({ stage, task: findStageTask(stage.id) }))
    if (withTask.length === 0) return []

    const pending = withTask.filter(({ task }) => task?.estado !== 'completado')
    if (pending.length === 0) return [withTask[withTask.length - 1]]

    const available = pending.filter(({ stage }) => !hasIncompleteDependencies(stage))
    return available.length > 0 ? available : [pending[0]]
  }

  return (
    <Modal
      id={PEDIDO_DETAIL_MODAL_ID}
      onClose={onClose}
      className="max-w-[90%] !p-0 flex flex-col max-h-[90vh] overflow-hidden"
    >
      {/* Header de Imagen / Portada */}
      {coverUrl && (
        <div className="relative h-64 sm:h-56 min-h-[280px] bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-center overflow-hidden rounded-t-2xl group flex-shrink-0">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-25 blur-2xl scale-110 pointer-events-none"
            style={{ backgroundImage: `url(${coverUrl})` }}
          />
          <button
            type="button"
            onClick={() => setIsLightboxOpen(true)}
            title="Ver en tamaño completo"
            className="relative z-10 flex h-full max-w-full items-center justify-center p-4 cursor-pointer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={coverUrl}
              src={coverUrl}
              alt={coverImages[safeCoverIndex]?.alt ?? `Portada Pedido #${currentPedido.id}`}
              className="max-h-full max-w-full object-contain transition duration-200 animate-in fade-in"
            />
          </button>

          {/* Aviso de varias imágenes + ampliar */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
            {hasManyCovers && (
              <span className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/90 px-2.5 py-1 text-xs font-bold text-white shadow-xl backdrop-blur-md">
                🖼️ {safeCoverIndex + 1} / {coverImages.length} imágenes
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsLightboxOpen(true)}
              className="rounded-lg border border-slate-700 bg-slate-900/90 px-2.5 py-1 text-xs font-bold text-white shadow-xl backdrop-blur-md transition hover:bg-slate-950 cursor-pointer"
            >
              🔍 Ampliar
            </button>
          </div>

          {hasManyCovers && (
            <>
              <button
                type="button"
                aria-label="Imagen anterior"
                onClick={() => moveCover(-1)}
                className="absolute left-3 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-slate-700 bg-slate-900/80 text-white shadow-xl backdrop-blur-md transition hover:bg-slate-950 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"><path d="M15 6l-6 6 6 6" /></svg>
              </button>
              <button
                type="button"
                aria-label="Imagen siguiente"
                onClick={() => moveCover(1)}
                className="absolute right-3 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-slate-700 bg-slate-900/80 text-white shadow-xl backdrop-blur-md transition hover:bg-slate-950 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"><path d="M9 6l6 6-6 6" /></svg>
              </button>
              <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
                {coverImages.map((img, i) => (
                  <button
                    key={`${img.url}-${i}`}
                    type="button"
                    aria-label={`Ver imagen ${i + 1}`}
                    onClick={() => setCoverIndex(i)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${i === safeCoverIndex ? 'w-5 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'}`}
                  />
                ))}
              </div>
            </>
          )}

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

      {/* Contenedor con Scroll de toda la Segunda Parte */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:p-6 space-y-6 min-h-0 text-slate-300">
        {/* Notificación rápida */}
        {notification && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-4 py-2 rounded-xl text-xs font-semibold text-center animate-in fade-in">
            ✓ {notification}
          </div>
        )}

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 px-4 py-2 rounded-xl text-xs font-semibold text-center animate-in fade-in">
            ⚠️ {error}
          </div>
        )}

        {/* Header del Modal */}
        <div className="border-b border-slate-800 pb-4 space-y-4">
          {/* Fila Superior: Título + Estado a la izquierda, Acciones a la derecha */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pr-8">
            <div className="text-left space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <div className='flex flex-row items-center gap-2'>
                  <button
                    type="button"
                    onClick={handleOpenClientModal}
                    className="group text-left flex items-center gap-2 hover:opacity-80 transition cursor-pointer"
                    title="Ver ficha completa del cliente"
                  >
                    <SubtitleH2 title={`📋 ${currentPedido.cliente?.nombre_empresa || currentPedido.cliente?.nombre_cliente}`} />
                  </button>
                  <span className="text-xs font-mono font-normal text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md">
                    #{currentPedido.id}
                  </span>
                </div>
                {/* Estado del Pedido Selector */}
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1 shadow-inner">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Estado:
                  </span>
                  <SelectStatus
                    value={currentPedido.estado}
                    onChange={handleStatusChange}
                    options={PEDIDO_STATE_OPTIONS}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-0.5">
                <p className="text-xs text-slate-400">
                  Cliente:{' '}
                  <button
                    type="button"
                    onClick={handleOpenClientModal}
                    className="text-blue-400 font-bold hover:underline cursor-pointer transition inline-flex items-center gap-1"
                  >
                    {currentPedido.cliente?.nombre_cliente || currentPedido.cliente?.nombre_empresa || 'N/A'}
                    {currentPedido.cliente?.nombre_empresa && currentPedido.cliente?.nombre_cliente
                      ? ` (${currentPedido.cliente.nombre_empresa})`
                      : ''}
                  </button>
                </p>

                <p className="text-xs text-slate-400">
                  Vendedor:{' '}
                  <span className="text-slate-200 font-bold">
                    {currentPedido.user?.name || 'Sin asignar'}
                  </span>
                </p>

                <p className="text-xs text-slate-400">
                  Fecha de creación:{' '}
                  <span className="text-slate-200 font-bold">
                    {currentPedido.created_at
                      ? new Date(currentPedido.created_at).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: 'short'
                      })
                      : 'N/A'}
                  </span>
                </p>

                {currentPedido.fecha_entrega && (
                  <p className="text-xs text-slate-400">
                    Fecha de entrega:{' '}
                    <span className="text-slate-200 font-bold">
                      {new Date(currentPedido.fecha_entrega + 'T00:00:00').toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: 'short'
                      })}
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* Botones de acción: Editar Pedido, Galería */}
            <div className="flex flex-wrap items-center gap-2.5 justify-self-end sm:col-start-2 sm:row-start-1 lg:col-start-3">
              {onOpenEdit && isAuthorizedRole && !isOperario && (
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
              {onOpenGallery && (
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
          {!isOperario && currentPedido.precio !== null && currentPedido.precio !== undefined && (
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
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Columna Izquierda (8 cols) */}
          <div className="md:col-span-8 space-y-6 text-left">
            {/* Sección: Descripción */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>📝</span> Descripción
                </h3>
                {!isEditCommentActive && (
                  <button
                    type="button"
                    onClick={() => setIsEditCommentActive(true)}
                    className="text-xs bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 px-2 py-1 rounded transition font-semibold"
                  >
                    Editar
                  </button>
                )}
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
                    <button
                      type="button"
                      onClick={() => {
                        // Descartar lo escrito y volver a la descripción guardada
                        setTempComentario(currentPedido.comentario || '')
                        setIsEditCommentActive(false)
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded text-xs font-semibold transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setIsEditCommentActive(true)}
                  className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl cursor-pointer hover:border-blue-500/50 hover:bg-slate-900/60 transition group"
                  title="Haz clic para editar la descripción"
                >
                  {currentPedido.comentario ? (
                    <p className="text-sm text-slate-300 whitespace-pre-wrap group-hover:text-white transition">
                      {currentPedido.comentario}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500 italic group-hover:text-slate-400 transition flex items-center justify-between">
                      <span>No hay descripción añadida. Haz clic para agregar una.</span>
                      <span className="text-xs text-blue-400 font-normal not-italic opacity-0 group-hover:opacity-100 transition">✏️ Clic para editar</span>
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
                    const prodStages = topologicalSortEtapas(
                      stages.filter((s) => s.producto_id === prod.id)
                    )
                    const qty = prod.pivot?.cantidad || 1
                    const currentStages = getProductCurrentStages(prodStages)
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

                          {/* Etapas actuales a la vista (varias si hay etapas paralelas habilitadas) */}
                          {currentStages.length > 0 ? (
                            <div className="text-right flex flex-col items-end gap-2">
                              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block">
                                {currentStages.length > 1 ? 'Etapas Actuales' : 'Etapa Actual'}
                              </span>
                              {currentStages.map((currentInfo) => (
                                <div key={currentInfo.stage.id} className="flex flex-col items-end gap-1">
                                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                                    <span className="text-base sm:text-lg font-black text-blue-400 capitalize tracking-tight">
                                      {currentInfo.stage.nombre}
                                    </span>
                                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                      {currentInfo.task?.estado || 'pendiente'}
                                    </span>
                                  </div>
                                  {currentInfo.task?.estado !== 'completado' && currentPedido.estado !== 'pendiente' && (
                                    (() => {
                                      const isCurrentBlocked = hasIncompleteDependencies(currentInfo.stage)

                                      if (isCurrentBlocked) {
                                        return (
                                          <span className="mt-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                                            🔒 Requiere etapa previa
                                          </span>
                                        )
                                      }

                                      const isCurrentInProgress = currentInfo.task?.estado === 'en_progreso'

                                      return (
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                          {isCurrentInProgress ? (
                                            <>
                                              <button
                                                type="button"
                                                disabled={completingTaskId === (currentInfo.task?.id || currentInfo.stage.id)}
                                                onClick={() => handleCompleteTask(currentInfo.task || null, currentInfo.stage)}
                                                className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white text-xs font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow cursor-pointer"
                                                title="Marcar etapa como completada"
                                              >
                                                <span>✓</span>
                                                <span>{completingTaskId === (currentInfo.task?.id || currentInfo.stage.id) ? 'Guardando...' : 'Completar Etapa'}</span>
                                              </button>
                                              <button
                                                type="button"
                                                disabled={completingTaskId === (currentInfo.task?.id || currentInfo.stage.id)}
                                                onClick={() => handleCancelTask(currentInfo.task || null, currentInfo.stage)}
                                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 active:scale-95 disabled:opacity-50 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow cursor-pointer"
                                                title="Pausar o devolver esta etapa a pendiente"
                                              >
                                                <span>⏸</span>
                                                <span>{completingTaskId === (currentInfo.task?.id || currentInfo.stage.id) ? 'Pausando...' : 'Pausar'}</span>
                                              </button>
                                            </>
                                          ) : (
                                            <>
                                              <button
                                                type="button"
                                                disabled={completingTaskId === (currentInfo.task?.id || currentInfo.stage.id)}
                                                onClick={() => handleStartTask(currentInfo.task || null, currentInfo.stage)}
                                                className="bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow cursor-pointer"
                                                title="Iniciar esta etapa (en progreso)"
                                              >
                                                <span>▶</span>
                                                <span>{completingTaskId === (currentInfo.task?.id || currentInfo.stage.id) ? 'Iniciando...' : 'Iniciar Etapa'}</span>
                                              </button>
                                              <button
                                                type="button"
                                                disabled={completingTaskId === (currentInfo.task?.id || currentInfo.stage.id)}
                                                onClick={() => handleCompleteTask(currentInfo.task || null, currentInfo.stage)}
                                                className="bg-emerald-600/90 hover:bg-emerald-600 active:scale-95 disabled:opacity-50 text-white text-xs font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow cursor-pointer"
                                                title="Marcar etapa como completada directamente"
                                              >
                                                <span>✓</span>
                                                <span>{completingTaskId === (currentInfo.task?.id || currentInfo.stage.id) ? 'Guardando...' : 'Completar'}</span>
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      )
                                    })()
                                  )}
                                  {currentInfo.task?.estado === 'completado' && (
                                    <button
                                      type="button"
                                      disabled={completingTaskId === (currentInfo.task?.id || currentInfo.stage.id)}
                                      onClick={() => handleUncompleteTask(currentInfo.task || null, currentInfo.stage)}
                                      className="mt-1 bg-slate-800 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 active:scale-95 disabled:opacity-50 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow cursor-pointer"
                                      title="Revertir esta etapa a sin completar"
                                    >
                                      <span>↩️</span>
                                      <span>{completingTaskId === (currentInfo.task?.id || currentInfo.stage.id) ? 'Guardando...' : 'Pasar a Sin Completar'}</span>
                                    </button>
                                  )}
                                </div>
                              ))}
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

                                    // Si la etapa ya está completada, no debe bloquearse
                                    const isBlockedNode = state !== 'completado' && hasIncompleteDependencies(stage)

                                    let nodeBg = 'bg-slate-900 border-slate-800 text-slate-400'
                                    let stateLabel = 'Pendiente'
                                    if (state === 'completado') {
                                      nodeBg =
                                        'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                      stateLabel = 'Completado'
                                    } else if (isBlockedNode) {
                                      nodeBg = 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                      stateLabel = 'Bloqueada'
                                    } else if (state === 'en_progreso') {
                                      nodeBg =
                                        'bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.15)] animate-pulse'
                                      stateLabel = 'En Progreso'
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

                                    const startDate =
                                      state === 'en_progreso' && (task?.fecha_inicio || task?.updated_at)
                                        ? new Date(
                                          task.fecha_inicio || task.updated_at
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
                                          {startDate && (
                                            <span
                                              className="text-[9px] font-medium block mt-1 text-blue-300/90 font-mono"
                                              title={`Iniciada: ${startDate}`}
                                            >
                                              Desde: {startDate}
                                            </span>
                                          )}
                                          {state === 'completado' && (
                                            <button
                                              type="button"
                                              disabled={completingTaskId === (task?.id || stage.id)}
                                              onClick={() => handleUncompleteTask(task || null, stage)}
                                              className="mt-2 w-full text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-800 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 active:scale-95 disabled:opacity-50 transition shadow flex items-center justify-center gap-1 cursor-pointer"
                                              title="Pasar esta etapa a sin completar"
                                            >
                                              <span>↩️</span>
                                              <span>{completingTaskId === (task?.id || stage.id) ? 'Guardando...' : 'Anular etapa'}</span>
                                            </button>
                                          )}
                                          {state !== 'completado' && currentPedido.estado !== 'pendiente' && (
                                            !isBlockedNode ? (
                                              <div className="mt-2 flex flex-col gap-1.5">
                                                {state === 'en_progreso' ? (
                                                  <>
                                                    <button
                                                      type="button"
                                                      disabled={completingTaskId === (task?.id || stage.id)}
                                                      onClick={() => handleCompleteTask(task || null, stage)}
                                                      className="w-full text-[10px] font-extrabold px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white transition shadow flex items-center justify-center gap-1 cursor-pointer"
                                                      title="Completar esta etapa"
                                                    >
                                                      <span>✓</span>
                                                      <span>{completingTaskId === (task?.id || stage.id) ? 'Completo...' : 'Completar'}</span>
                                                    </button>
                                                    <button
                                                      type="button"
                                                      disabled={completingTaskId === (task?.id || stage.id)}
                                                      onClick={() => handleCancelTask(task || null, stage)}
                                                      className="w-full text-[10px] font-semibold px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 active:scale-95 disabled:opacity-50 transition flex items-center justify-center gap-1 cursor-pointer"
                                                      title="Pausar o devolver esta etapa a pendiente"
                                                    >
                                                      <span>⏸</span>
                                                      <span>{completingTaskId === (task?.id || stage.id) ? 'Pausando...' : 'A pendiente'}</span>
                                                    </button>
                                                  </>
                                                ) : (
                                                  <>
                                                    <button
                                                      type="button"
                                                      disabled={completingTaskId === (task?.id || stage.id)}
                                                      onClick={() => handleStartTask(task || null, stage)}
                                                      className="w-full text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 text-white transition shadow flex items-center justify-center gap-1 cursor-pointer"
                                                      title="Poner esta etapa en progreso"
                                                    >
                                                      <span>▶</span>
                                                      <span>{completingTaskId === (task?.id || stage.id) ? 'Iniciando...' : 'En progreso'}</span>
                                                    </button>
                                                    <button
                                                      type="button"
                                                      disabled={completingTaskId === (task?.id || stage.id)}
                                                      onClick={() => handleCompleteTask(task || null, stage)}
                                                      className="w-full text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-600/90 hover:bg-emerald-600 active:scale-95 disabled:opacity-50 text-white transition shadow flex items-center justify-center gap-1 cursor-pointer"
                                                      title="Completar esta etapa directamente"
                                                    >
                                                      <span>✓</span>
                                                      <span>{completingTaskId === (task?.id || stage.id) ? 'Completo...' : 'Completar'}</span>
                                                    </button>
                                                  </>
                                                )}
                                              </div>
                                            ) : (
                                              <div
                                                className="mt-2 w-full text-[10px] font-semibold px-2 py-1 rounded-lg bg-slate-900/90 text-rose-400/80 border border-rose-500/20 flex items-center justify-center gap-1 opacity-80"
                                                title="Esta etapa requiere que se completen las etapas de las que depende"
                                              >
                                                <span>🔒</span>
                                                <span>Bloqueada</span>
                                              </div>
                                            )
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
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha - Comentarios y Actividad */}
          <div className="md:col-span-4 border-t md:border-t-0 md:border-l border-slate-800 pt-6 md:pt-0 md:pl-6 flex flex-col">
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

            <div className="space-y-3 flex-grow">
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
      </div>

      {/* Modal de Cliente, se apila encima del pedido */}
      <ClientDetailModal clienteId={clientIdForModal} />
      {isLightboxOpen && coverImages.length > 0 && (
        <ImageLightbox
          images={coverImages}
          initialIndex={safeCoverIndex}
          onIndexChange={setCoverIndex}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}
    </Modal>
  )
}

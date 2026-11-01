'use client'

import { useEffect, useState, useRef } from 'react'
import { useModalContext } from '@/components/Modal/context/ModalContext'
import { Modal } from '@/components/Modal/Modal'
import RoleGuard from '@/components/RoleGuard'
import TasksByCategoryBox from '@/components/TasksByCategoryBox'
import Pagination from '@/components/Pagination'
import {
  fetchOperarioTasks,
  startOperarioTask,
  cancelOperarioTask,
  completeOperarioTask
} from '@/lib/operario_tasks'
import { assignTask, type ResponsableEtapa } from '@/lib/responsable_etapas'
import { getStoredUser, fetchUsers, type User } from '@/lib/auth'
import { type Pedido } from '@/lib/pedidos'
import PedidoDetailModal from '@/components/PedidoDetailModal'
import PedidoThumbnail from '@/components/PedidoThumbnail'

const COMPLETE_TASK_MODAL_ID = 'tarea-completar'

// Fecha de creación que se muestra en la tabla: la del pedido, o la de la tarea si no la tiene
const getTaskCreatedAt = (t: ResponsableEtapa) => new Date(t.pedido?.created_at || t.created_at).getTime() || 0

// Fecha con formato "D/M" (por ejemplo: 1/9, sin el año)
const formatTaskDate = (dateVal?: string | null) => {
  if (!dateVal) return '-'
  const d = new Date(dateVal)
  if (isNaN(d.getTime())) return '-'
  return `${d.getDate()}/${d.getMonth() + 1}`
}

// Obtener la URL de miniatura del pedido o producto
const getTaskCoverUrl = (task: ResponsableEtapa) => {
  const pedido = task.pedido
  return (
    pedido?.imagen_principal?.url ||
    pedido?.imagenes?.find((img) => img.es_principal)?.url ||
    pedido?.imagenes?.[0]?.url ||
    pedido?.productos?.find((prod) => prod.imagen_principal?.url)?.imagen_principal?.url ||
    pedido?.productos?.[0]?.imagen_principal?.url ||
    pedido?.productos?.[0]?.imagenes?.[0]?.url ||
    (task.etapa as any)?.producto?.imagen_principal?.url ||
    (task.etapa as any)?.producto?.imagenes?.[0]?.url ||
    null
  )
}

// Padding de las celdas de las tablas de escritorio (un poco más de aire en pantallas grandes)
const CELL_FIRST = 'pl-4 pr-3 2xl:pl-5 2xl:pr-4 py-3'
const CELL_MID = 'px-3 2xl:px-4 py-3'
const CELL_LAST = 'pl-3 pr-4 2xl:pl-4 2xl:pr-5 py-3'

// Minúsculas y sin tildes, para que "diseno" encuentre "Diseño"
const normalizeText = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

// Busca en empresa, cliente, N° / código de pedido, producto y etapa
const taskMatchesSearch = (t: ResponsableEtapa, query: string) => {
  const q = normalizeText(query.trim().replace(/^#/, ''))
  if (!q) return true

  const campos = [
    t.pedido?.cliente?.nombre_empresa,
    t.pedido?.cliente?.nombre_cliente,
    t.pedido?.id?.toString(),
    t.pedido?.codigo,
    t.etapa?.producto?.nombre,
    t.etapa?.nombre,
  ]
  return campos.some((campo) => campo && normalizeText(campo).includes(q))
}

export default function TareasPage() {
  const [tasks, setTasks] = useState<ResponsableEtapa[]>([])
  const [operarios, setOperarios] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const { open: openModal, close: closeModal } = useModalContext()

  const [loading, setLoading] = useState(true)
  const [pendingTaskIds, setPendingTaskIds] = useState<Record<number, boolean>>({})
  const [error, setError] = useState('')
  const [errorToast, setErrorToast] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Paginadores para Pendientes Activas y Pendientes Bloqueadas (10 tareas por página)
  const [activePage, setActivePage] = useState<number>(1)
  const [blockedPage, setBlockedPage] = useState<number>(1)
  const PAGE_SIZE = 10

  // Modales
  const [completingTask, setCompletingTask] = useState<ResponsableEtapa | null>(null)
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)
  const orderChangedRef = useRef(false)

  // Buscador de tareas (filtra en el navegador, sin pedir nada al backend)
  const [searchQuery, setSearchQuery] = useState('')

  const setTaskPending = (id: number, isPending: boolean) => {
    setPendingTaskIds((prev) => {
      if (isPending) return { ...prev, [id]: true }
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setActivePage(1)
  }

  const loadData = async (
    overrideUserId?: number | null,
    options?: { silent?: boolean; resetPagination?: boolean }
  ) => {
    const { silent = false, resetPagination = true } = options || {}

    if (!silent) setLoading(true)
    setError('')
    if (resetPagination) {
      setActivePage(1)
      setBlockedPage(1)
    }
    try {
      const user = getStoredUser()
      setCurrentUser(user)

      const usersData = await fetchUsers()
      setOperarios(usersData)

      let targetUserId = overrideUserId !== undefined ? overrideUserId : selectedUserId
      if (targetUserId === null && user) {
        targetUserId = user.id
        setSelectedUserId(user.id)
      }

      const isPendingOrderTask = (t: ResponsableEtapa) => {
        const pState = t.pedido?.estado || (t.pedido as any)?.ultimo_estado?.estado
        return pState === 'pendiente'
      }

      const tasksData = await fetchOperarioTasks(targetUserId ? { user_id: targetUserId } : undefined)
      setTasks(
        tasksData
          .filter(t => t.estado !== 'completado' && !isPendingOrderTask(t))
          // De la más vieja a la más nueva según la fecha de creación
          .sort((a, b) => getTaskCreatedAt(a) - getTaskCreatedAt(b) || a.id - b.id)
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar las tareas')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleUserSelectChange = (userIdStr: string) => {
    const newId = userIdStr ? parseInt(userIdStr) : null
    setSelectedUserId(newId)
    setActivePage(1)
    setBlockedPage(1)
    loadData(newId)
  }

  const showNotification = (message: string) => {
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current)
    setSuccessMessage(message)
    successTimeoutRef.current = setTimeout(() => setSuccessMessage(''), 3000)
  }

  const showError = (message: string) => {
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current)
    setError(message)
    setErrorToast(message)
    errorTimeoutRef.current = setTimeout(() => setErrorToast(''), 5000)
  }

  const isManager = Boolean(currentUser && ['admin', 'supervisor', 'encargado'].includes(currentUser.role))

  const handleStartTask = async (id: number) => {
    const targetTask = tasks.find((t) => t.id === id)
    if (!targetTask || pendingTaskIds[id]) return

    const prevTask: ResponsableEtapa = { ...targetTask }
    const shouldAssignCurrentUser = Boolean(currentUser && (!targetTask.user_id || !isManager))
    const optimisticUserId = shouldAssignCurrentUser && currentUser ? currentUser.id : targetTask.user_id
    const optimisticUser = shouldAssignCurrentUser && currentUser ? currentUser : targetTask.user

    setError('')
    setErrorToast('')
    setTaskPending(id, true)

    // Actualización optimista inmediata en la vista sin recargar la tabla
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              estado: 'en_progreso',
              fecha_inicio: t.fecha_inicio || new Date().toISOString(),
              user_id: optimisticUserId,
              user: optimisticUser
            }
          : t
      )
    )

    try {
      const updated = await startOperarioTask(id)
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t
          const resolvedUser =
            updated.user_id != null
              ? operarios.find((op) => op.id === updated.user_id) ||
                (currentUser?.id === updated.user_id ? currentUser : t.user)
              : undefined
          return {
            ...t,
            estado: updated.estado || 'en_progreso',
            fecha_inicio: updated.fecha_inicio ?? t.fecha_inicio,
            user_id: updated.user_id ?? t.user_id,
            user: resolvedUser ?? t.user
          }
        })
      )
      showNotification('Tarea iniciada correctamente.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar la tarea'
      const isBlockedError = normalizeText(msg).includes('bloqueada')

      // Revertir o actualizar únicamente el campo/tarea en cuestión si falla la consulta
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...prevTask,
                estado: isBlockedError ? 'bloqueada' : prevTask.estado
              }
            : t
        )
      )
      showError(msg)
    } finally {
      setTaskPending(id, false)
    }
  }

  const handleCancelTask = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas cancelar esta tarea iniciada y restablecerla a pendiente?')) return
    const targetTask = tasks.find((t) => t.id === id)
    if (!targetTask || pendingTaskIds[id]) return

    const prevTask: ResponsableEtapa = { ...targetTask }
    setError('')
    setErrorToast('')
    setTaskPending(id, true)

    // Actualización optimista inmediata a pendiente
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              estado: 'pendiente',
              fecha_inicio: null
            }
          : t
      )
    )

    try {
      const updated = await cancelOperarioTask(id)
      setTasks((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                estado: updated.estado || 'pendiente',
                fecha_inicio: updated.fecha_inicio ?? null
              }
            : t
        )
      )
      showNotification('Tarea en progreso cancelada y restablecida a pendiente.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cancelar la tarea'
      setTasks((prev) => prev.map((t) => (t.id === id ? prevTask : t)))
      showError(msg)
    } finally {
      setTaskPending(id, false)
    }
  }

  const handleReassignUser = async (task: ResponsableEtapa, newUserIdStr: string) => {
    const newUserId = newUserIdStr ? parseInt(newUserIdStr) : null
    if (newUserIdStr && isNaN(newUserId!)) return
    if (pendingTaskIds[task.id]) return

    const prevUserId = task.user_id
    const prevUser = task.user
    const newUser = newUserId ? operarios.find((op) => op.id === newUserId) : undefined

    setError('')
    setErrorToast('')
    setTaskPending(task.id, true)

    // Actualización optimista del operario asignado
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              user_id: newUserId,
              user: newUser
            }
          : t
      )
    )

    try {
      const etapaId = task.etapa_id || (task.etapa as any)?.id || (task as any).etapa_producto_id
      await assignTask({
        pedido_id: task.pedido_id,
        etapa_id: etapaId,
        user_id: newUserId
      })
      showNotification(newUserId ? 'Operario reasignado correctamente a la etapa.' : 'Tarea desasignada correctamente.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al reasignar el operario'
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                user_id: prevUserId,
                user: prevUser
              }
            : t
        )
      )
      showError(msg)
    } finally {
      setTaskPending(task.id, false)
    }
  }

  // Al hacer clic en la fila/tarjeta se abre el panel del pedido de esa tarea
  const handleOpenPedido = (task: ResponsableEtapa) => {
    orderChangedRef.current = false
    if (task.pedido) setSelectedPedido(task.pedido)
  }

  const handleClosePedido = () => {
    setSelectedPedido(null)
    // Solo si se modificó algo dentro del modal (ej. completó etapa) se refrescan las tareas,
    // de forma silenciosa en segundo plano y manteniendo la página actual.
    if (orderChangedRef.current) {
      loadData(undefined, { silent: true, resetPagination: false })
      orderChangedRef.current = false
    }
  }

  const handleOpenCompleteModal = (task: ResponsableEtapa) => {
    setCompletingTask(task)
    openModal(COMPLETE_TASK_MODAL_ID)
  }

  const handleCloseCompleteModal = () => {
    setCompletingTask(null)
    closeModal(COMPLETE_TASK_MODAL_ID)
  }

  const confirmCompleteTask = async () => {
    if (!completingTask || pendingTaskIds[completingTask.id]) return

    const taskToComplete: ResponsableEtapa = { ...completingTask }
    const completedStageId =
      (taskToComplete as any).etapa_producto_id ||
      taskToComplete.etapa?.id ||
      taskToComplete.etapa_id

    // Guardar estado previo de las tareas del mismo pedido por si hay que revertir desbloqueos
    const prevSiblingSnapshots = new Map<
      number,
      { estado: string; dependencias_info?: { id: number; nombre: string; estado: string }[] }
    >()
    tasks.forEach((t) => {
      if (t.pedido_id === taskToComplete.pedido_id && t.id !== taskToComplete.id) {
        prevSiblingSnapshots.set(t.id, {
          estado: t.estado,
          dependencias_info: t.dependencias_info ? t.dependencias_info.map((d) => ({ ...d })) : undefined
        })
      }
    })

    setError('')
    setErrorToast('')
    setTaskPending(taskToComplete.id, true)
    handleCloseCompleteModal()

    // Actualización optimista inmediata: quitar la tarea completada y desbloquear etapas dependientes satisfechas
    setTasks((prev) => {
      const next = prev
        .filter((t) => t.id !== taskToComplete.id)
        .map((t) => {
          if (t.pedido_id === taskToComplete.pedido_id && t.estado === 'bloqueada' && t.dependencias_info?.length) {
            const updatedDeps = t.dependencias_info.map((dep) =>
              dep.id === completedStageId ? { ...dep, estado: 'completado' } : dep
            )
            const allSatisfied = updatedDeps.every((dep) => dep.estado === 'completado')
            return {
              ...t,
              dependencias_info: updatedDeps,
              estado: allSatisfied ? 'pendiente' : t.estado
            }
          }
          return t
        })

      const nextActiveCount = next.filter(
        (t) => (t.estado === 'pendiente' || t.estado === 'en_progreso') && taskMatchesSearch(t, searchQuery)
      ).length
      const maxActivePage = Math.max(1, Math.ceil(nextActiveCount / PAGE_SIZE))
      setActivePage((currPage) => Math.min(currPage, maxActivePage))

      const nextBlockedCount = next.filter((t) => t.estado === 'bloqueada').length
      const maxBlockedPage = Math.max(1, Math.ceil(nextBlockedCount / PAGE_SIZE))
      setBlockedPage((currPage) => Math.min(currPage, maxBlockedPage))

      return next
    })

    try {
      await completeOperarioTask(taskToComplete.id)
      showNotification('Tarea completada con éxito.')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al completar la tarea'
      const isBlockedError = normalizeText(msg).includes('etapas previas') || normalizeText(msg).includes('bloqueada')

      // Revertir el cambio en la tarea y las etapas dependientes si falla la petición
      setTasks((prev) => {
        const restoredTask: ResponsableEtapa = {
          ...taskToComplete,
          estado: isBlockedError ? 'bloqueada' : taskToComplete.estado
        }
        const exists = prev.some((t) => t.id === taskToComplete.id)
        const baseList = exists
          ? prev.map((t) => (t.id === taskToComplete.id ? restoredTask : t))
          : [...prev, restoredTask]

        return baseList
          .map((t) => {
            const snap = prevSiblingSnapshots.get(t.id)
            if (!snap) return t
            return {
              ...t,
              estado: snap.estado,
              dependencias_info: snap.dependencias_info
            }
          })
          .sort((a, b) => getTaskCreatedAt(a) - getTaskCreatedAt(b) || a.id - b.id)
      })
      showError(msg)
    } finally {
      setTaskPending(taskToComplete.id, false)
    }
  }

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await confirmCompleteTask()
  }

  const confirmCompleteRef = useRef(confirmCompleteTask)
  confirmCompleteRef.current = confirmCompleteTask

  useEffect(() => {
    if (!completingTask) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat) return
      const target = e.target as HTMLElement | null
      // Si el foco está explícitamente sobre un botón que no es submit (ej. Cancelar o Cerrar), respetar ese botón
      if (target && target.tagName === 'BUTTON' && (target as HTMLButtonElement).type !== 'submit') {
        return
      }
      e.preventDefault()
      confirmCompleteRef.current()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [completingTask])

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'bloqueada':
        return '🔒 Bloqueada'
      case 'en_progreso':
        return '🔥 En Progreso'
      case 'pendiente':
        return '⏳ Pendiente'
      case 'completado':
        return '✅ Completado'
      default:
        return status
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'bloqueada':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
      case 'completado':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
      case 'en_progreso':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
      case 'pendiente':
      default:
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
    }
  }

  // Filtrado de tareas
  // El buscador solo filtra las Pendientes activas; las Bloqueadas se muestran todas
  const activeTasks = tasks.filter(
    t => (t.estado === 'pendiente' || t.estado === 'en_progreso') && taskMatchesSearch(t, searchQuery)
  )
  const blockedTasks = tasks.filter(t => t.estado === 'bloqueada')

  const visibleActiveTasks = activeTasks.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE)
  const visibleBlockedTasks = blockedTasks.slice((blockedPage - 1) * PAGE_SIZE, blockedPage * PAGE_SIZE)

  // Buscador de tareas: filtra solo las Pendientes activas.
  // Se dibuja en dos lugares (uno visible por tamaño de pantalla); ambos comparten el mismo estado.
  const renderSearchInput = (visibilityClass: string) => (
    <div className={`relative ${visibilityClass}`}>
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">🔍</span>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder="Buscar por empresa, cliente, N° de pedido, producto o etapa..."
        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => handleSearchChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white hover:bg-slate-800 w-7 h-7 rounded-lg flex items-center justify-center transition"
          title="Limpiar búsqueda"
          aria-label="Limpiar búsqueda"
        >
          ✕
        </button>
      )}
    </div>
  )

  const searchText = searchQuery.trim()

  // ── Tablas de escritorio (Activas y Bloqueadas) ──────────────────────────
  // Las dos tablas comparten encabezado y celdas para verse iguales.
  // Operario, Estado y Acciones se ajustan a su contenido (w-px); el espacio que sobra
  // se reparte entre Pedido y Tarea / Etapa, que son las columnas con texto largo.
  const renderDesktopHead = () => (
    <thead>
      <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold text-xs uppercase tracking-wider whitespace-nowrap">
        <th className={CELL_FIRST}>Pedido</th>
        <th className={CELL_MID}>Tarea / Etapa</th>
        <th className={`${CELL_MID} w-px`}>Operario</th>
        <th className={`${CELL_MID} w-px`}>Estado</th>
        <th className={`${CELL_LAST} w-px text-right`}>Acciones</th>
      </tr>
    </thead>
  )

  // Miniatura + empresa + fecha de creación en una sola celda
  const renderPedidoCell = (task: ResponsableEtapa) => {
    const fecha = formatTaskDate(task.pedido?.created_at || task.created_at)
    return (
      <div className="flex items-center gap-3 2xl:gap-4">
        <PedidoThumbnail
          url={getTaskCoverUrl(task)}
          alt={`Pedido ${task.pedido?.codigo || task.pedido_id}`}
          className="w-24 h-14 2xl:w-28 2xl:h-16"
        />
        <div className="min-w-[7.5rem] 2xl:min-w-[8.5rem]">
          <span className="block font-bold text-white text-base leading-snug">
            {task.pedido?.cliente?.nombre_empresa || task.pedido?.cliente?.nombre_cliente || 'N/A'}
          </span>
          {fecha !== '-' && (
            <span className="block mt-1 text-xs font-semibold text-slate-400 whitespace-nowrap">
              Creado el {fecha}
            </span>
          )}
        </div>
      </div>
    )
  }

  const renderEtapaCell = (task: ResponsableEtapa) => (
    <div className="min-w-[9rem]">
      <span className="block font-bold text-white text-base leading-snug">{task.etapa?.nombre}</span>
      <span className="block mt-0.5 text-sm text-slate-400 leading-snug">
        {task.etapa?.producto?.nombre || 'Producto'}
      </span>
    </div>
  )

  const renderOperarioCell = (task: ResponsableEtapa) =>
    isManager ? (
      <select
        value={task.user_id || ''}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => handleReassignUser(task, e.target.value)}
        disabled={Boolean(pendingTaskIds[task.id])}
        title="Reasignar operario"
        className="w-40 2xl:w-44 bg-slate-950 border border-slate-700/80 hover:border-slate-600 focus:border-blue-500 text-sm font-semibold text-blue-400 rounded-lg px-3 py-2 focus:outline-none cursor-pointer transition disabled:opacity-50"
      >
        <option value="" className="bg-slate-900 text-slate-400">Sin Asignar</option>
        {operarios.map((op) => (
          <option key={op.id} value={op.id} className="bg-slate-900 text-white">
            {op.name}
          </option>
        ))}
      </select>
    ) : (
      <span className="text-sm text-slate-300 font-semibold whitespace-nowrap">{task.user?.name || 'Sin Asignar'}</span>
    )

  // Ancho mínimo fijo: la columna no cambia de ancho entre "Pendiente" y "En progreso"
  const renderStatusBadge = (estado: string) => (
    <div className="min-w-[8.75rem]">
      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide ${getStatusBadgeClass(estado)}`}>
        {getStatusLabel(estado)}
      </span>
    </div>
  )

  // Botones de acción: mismo ancho y alto, sin cortes de línea.
  // En pantallas grandes van uno al lado del otro; en notebooks se apilan para no forzar scroll horizontal.
  const actionButtonClass =
    'inline-flex items-center justify-center gap-1.5 min-w-[7.5rem] whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed'
  const actionsLayoutClass =
    'flex flex-col items-stretch gap-2 min-w-[7.5rem] 2xl:min-w-[15.5rem] 2xl:flex-row 2xl:items-center 2xl:justify-end'

  const renderActiveSection = () => (
    <div className="space-y-4">
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2">
          <span>⚡</span> Pendientes Activas ({activeTasks.length})
        </h2>
        {/* Mobile y tablet: buscador debajo del título */}
        {renderSearchInput('lg:hidden')}
      </div>

      {activeTasks.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl overflow-hidden">
          {/* Desktop: el buscador sigue visible aunque no haya resultados */}
          <div className="hidden lg:block p-4 border-b border-slate-800/80">
            {renderSearchInput('')}
          </div>
          <div className="p-6 text-sm text-slate-500 italic text-center">
            {searchText ? `No hay tareas activas que coincidan con "${searchText}".` : 'No hay tareas activas pendientes.'}
          </div>
        </div>
      ) : (
        <>
          {/* MOBILE CARDS */}
          <div className="md:hidden space-y-3">
            {visibleActiveTasks.map((task) => {
              const coverUrl = getTaskCoverUrl(task)
              const isTaskPending = Boolean(pendingTaskIds[task.id])
              return (
                <div
                  key={task.id}
                  onClick={() => handleOpenPedido(task)}
                  title="Ver el pedido de esta tarea"
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl text-left cursor-pointer hover:border-blue-500/40 transition"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <PedidoThumbnail url={coverUrl} alt="Miniatura" className="w-14 h-11" compact />
                      <div className="min-w-0">
                        <span className="font-bold text-white text-base block truncate">
                          {task.pedido?.cliente?.nombre_empresa || task.pedido?.cliente?.nombre_cliente || 'N/A'}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">
                          {formatTaskDate(task.pedido?.created_at || task.created_at)}
                        </span>
                      </div>
                    </div>
                    <span className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide flex-shrink-0 ${getStatusBadgeClass(task.estado)}`}>
                      {getStatusLabel(task.estado)}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="font-bold text-white text-base block">{task.etapa?.nombre}</span>
                    <span className="text-xs text-slate-400 font-normal block">
                      {task.etapa?.producto?.nombre || 'Producto'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-bold text-slate-400 uppercase">Operario:</span>
                    {isManager ? (
                      <select
                        value={task.user_id || ''}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleReassignUser(task, e.target.value)}
                        disabled={isTaskPending}
                        className="bg-slate-950 border border-slate-800 text-xs font-bold text-blue-400 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer disabled:opacity-50"
                      >
                        <option value="" className="bg-slate-900 text-slate-400">Sin Asignar</option>
                        {operarios.map((op) => (
                          <option key={op.id} value={op.id} className="bg-slate-900 text-white">
                            {op.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-slate-300 font-semibold">{task.user?.name || 'Sin Asignar'}</span>
                    )}
                  </div>

                  {/* Acciones: no abren el panel del pedido */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800 cursor-default"
                  >
                    {task.estado === 'en_progreso' ? (
                      <>
                        <button
                          onClick={() => handleCancelTask(task.id)}
                          disabled={isTaskPending}
                          className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold px-3 py-2 rounded-xl transition disabled:opacity-50"
                        >
                          ⏹️ Cancelar
                        </button>
                        <button
                          onClick={() => handleOpenCompleteModal(task)}
                          disabled={isTaskPending}
                          className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold px-3.5 py-2 rounded-xl shadow-lg transition disabled:opacity-50"
                        >
                          Completar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleOpenCompleteModal(task)}
                          disabled={isTaskPending}
                          className="bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 text-xs font-bold px-3 py-2 rounded-xl transition disabled:opacity-50"
                        >
                          ✓ Completar
                        </button>
                        <button
                          onClick={() => handleStartTask(task.id)}
                          disabled={isTaskPending}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold px-3.5 py-2 rounded-xl shadow-lg transition disabled:opacity-50"
                        >
                          🚀 Iniciar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {/* Desktop: buscador como barra superior de la tabla */}
            <div className="hidden lg:block p-4 border-b border-slate-800">
              {renderSearchInput('')}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                {renderDesktopHead()}
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {visibleActiveTasks.map((task) => {
                    const isTaskPending = Boolean(pendingTaskIds[task.id])
                    return (
                      <tr
                        key={task.id}
                        onClick={() => handleOpenPedido(task)}
                        title="Ver el pedido de esta tarea"
                        className="group hover:bg-slate-800/50 transition cursor-pointer"
                      >
                        <td className={CELL_FIRST}>{renderPedidoCell(task)}</td>
                        <td className={CELL_MID}>{renderEtapaCell(task)}</td>
                        <td className={CELL_MID}>{renderOperarioCell(task)}</td>
                        <td className={CELL_MID}>{renderStatusBadge(task.estado)}</td>
                        <td className={`${CELL_LAST} cursor-default`} onClick={(e) => e.stopPropagation()}>
                          <div className={actionsLayoutClass}>
                            {task.estado === 'en_progreso' ? (
                              <>
                                <button
                                  onClick={() => handleCancelTask(task.id)}
                                  disabled={isTaskPending}
                                  className={`${actionButtonClass} bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border-rose-500/30`}
                                >
                                  ⏹️ Cancelar
                                </button>
                                <button
                                  onClick={() => handleOpenCompleteModal(task)}
                                  disabled={isTaskPending}
                                  className={`${actionButtonClass} bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-500 hover:border-amber-400`}
                                >
                                  ✓ Completar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleOpenCompleteModal(task)}
                                  disabled={isTaskPending}
                                  className={`${actionButtonClass} bg-slate-800 hover:bg-slate-700 text-emerald-400 border-emerald-500/30`}
                                >
                                  ✓ Completar
                                </button>
                                <button
                                  onClick={() => handleStartTask(task.id)}
                                  disabled={isTaskPending}
                                  className={`${actionButtonClass} bg-blue-600 hover:bg-blue-500 text-white border-blue-600 hover:border-blue-500`}
                                >
                                  🚀 Iniciar
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* PAGINADOR TAREAS PENDIENTES ACTIVAS */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl mt-4">
            <Pagination
              currentPage={activePage}
              totalItems={activeTasks.length}
              pageSize={PAGE_SIZE}
              onPageChange={(page) => setActivePage(page)}
            />
          </div>
        </>
      )}
    </div>
  )

  const renderBlockedSection = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-rose-400 flex items-center gap-2">
          <span>🔒</span> Pendientes Bloqueadas ({blockedTasks.length})
        </h2>
      </div>

      {blockedTasks.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-6 text-sm text-slate-500 italic text-center">
          No hay tareas pendientes bloqueadas.
        </div>
      ) : (
        <>
          {/* MOBILE CARDS */}
          <div className="md:hidden space-y-3">
            {visibleBlockedTasks.map((task) => {
              const coverUrl = getTaskCoverUrl(task)
              const isTaskPending = Boolean(pendingTaskIds[task.id])
              return (
                <div
                  key={task.id}
                  onClick={() => handleOpenPedido(task)}
                  title="Ver el pedido de esta tarea"
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl text-left opacity-90 cursor-pointer hover:border-rose-500/40 transition"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <PedidoThumbnail url={coverUrl} alt="Miniatura" className="w-14 h-11" compact />
                      <div className="min-w-0">
                        <span className="font-bold text-white text-base block truncate">
                          {task.pedido?.cliente?.nombre_empresa || task.pedido?.cliente?.nombre_cliente || 'N/A'}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">
                          {formatTaskDate(task.pedido?.created_at || task.created_at)}
                        </span>
                      </div>
                    </div>
                    <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-rose-500/10 text-rose-400 border border-rose-500/20 flex-shrink-0">
                      🔒 Bloqueada
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="font-bold text-white text-base block">{task.etapa?.nombre}</span>
                    <span className="text-xs text-slate-400 font-normal block">
                      {task.etapa?.producto?.nombre || 'Producto'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-bold text-slate-400 uppercase">Operario:</span>
                    {isManager ? (
                      <select
                        value={task.user_id || ''}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleReassignUser(task, e.target.value)}
                        disabled={isTaskPending}
                        className="bg-slate-950 border border-slate-800 text-xs font-bold text-blue-400 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer disabled:opacity-50"
                      >
                        <option value="" className="bg-slate-900 text-slate-400">Sin Asignar</option>
                        {operarios.map((op) => (
                          <option key={op.id} value={op.id} className="bg-slate-900 text-white">
                            {op.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-slate-300 font-semibold">{task.user?.name || 'Sin Asignar'}</span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-[11px] text-rose-300/80 italic">Requiere etapas previas</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                {renderDesktopHead()}
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {visibleBlockedTasks.map((task) => (
                    <tr
                      key={task.id}
                      onClick={() => handleOpenPedido(task)}
                      title="Ver el pedido de esta tarea"
                      className="group hover:bg-slate-800/50 transition cursor-pointer"
                    >
                      <td className={CELL_FIRST}>{renderPedidoCell(task)}</td>
                      <td className={CELL_MID}>{renderEtapaCell(task)}</td>
                      <td className={CELL_MID}>{renderOperarioCell(task)}</td>
                      <td className={CELL_MID}>{renderStatusBadge('bloqueada')}</td>
                      <td className={CELL_LAST}>
                        {/* Mismo ancho que la columna Acciones de la tabla de activas */}
                        <div className="min-w-[7.5rem] 2xl:min-w-[15.5rem] text-right text-xs italic text-rose-300/80">
                          Requiere etapas previas
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* PAGINADOR TAREAS PENDIENTES BLOQUEADAS */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl mt-4">
            <Pagination
              currentPage={blockedPage}
              totalItems={blockedTasks.length}
              pageSize={PAGE_SIZE}
              onPageChange={(page) => setBlockedPage(page)}
            />
          </div>
        </>
      )}
    </div>
  )

  return (
    <RoleGuard allowedRoles={['admin', 'supervisor', 'encargado', 'operario', 'operator', 'disenador', 'disenadora']}>
      <main className="page-content p-6 max-w-7xl mx-auto text-white">
        {/* Notificaciones flotantes */}
        {successMessage && (
          <div className="fixed top-4 right-4 z-50 bg-emerald-500 text-white px-5 py-3.5 rounded-xl shadow-2xl border border-emerald-400 flex items-center gap-3 text-base font-bold animate-bounce">
            <span>✅</span>
            <span>{successMessage}</span>
          </div>
        )}

        {errorToast && (
          <div className="fixed top-4 right-4 z-50 bg-rose-600 text-white px-5 py-3.5 rounded-xl shadow-2xl border border-rose-400 flex items-center gap-3 text-sm font-bold max-w-md">
            <span>⚠️</span>
            <span className="flex-1">{errorToast}</span>
            <button
              type="button"
              onClick={() => setErrorToast('')}
              className="text-white/80 hover:text-white px-1.5 py-0.5 rounded-lg hover:bg-rose-700 transition"
              aria-label="Cerrar alerta"
            >
              ✕
            </button>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-200 px-5 py-4 rounded-xl flex items-center justify-between gap-3 text-base font-semibold">
            <div className="flex items-center gap-3">
              <span>❌</span>
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError('')}
              className="text-rose-300 hover:text-white px-2 py-1 rounded-lg hover:bg-rose-500/20 transition text-sm"
              aria-label="Cerrar error"
            >
              ✕
            </button>
          </div>
        )}

        {/* Encabezado Principal */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <span>🏭</span> {isManager ? 'Panel Global de Tareas de Fábrica' : 'Panel de Tareas de Producción'}
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            {/* Desplegable para filtrar por usuario */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 shadow-inner min-w-0 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">
                👤 {isManager ? 'Filtrar por Operario:' : 'Ver tareas de:'}
              </span>
              <select
                value={selectedUserId || ''}
                onChange={(e) => handleUserSelectChange(e.target.value)}
                className="bg-transparent text-sm font-extrabold text-blue-400 focus:outline-none cursor-pointer w-full"
              >
                {isManager && <option value="" className="bg-slate-900 text-slate-300">👥 Todos los operarios</option>}
                {operarios.map((op) => (
                  <option key={op.id} value={op.id} className="bg-slate-900 text-white">
                    {op.name} {currentUser?.id === op.id ? '(Tú)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedUserId !== null && (
              <button
                onClick={() => {
                  setSelectedUserId(null)
                  loadData(null)
                }}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-1 shrink-0"
              >
                <span>🔄</span> Limpiar filtro
              </button>
            )}
          </div>
        </div>

        {/* TAREAS DE PRODUCCIÓN */}
        <div className="space-y-10">
          {loading ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
              <span className="text-base font-semibold">Cargando tareas de producción...</span>
            </div>
          ) : tasks.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
              <span className="text-5xl">🎉</span>
              <span className="text-lg font-bold text-white">¡No hay tareas asignadas pendientes!</span>
              <p className="text-sm text-slate-500">No se registran tareas pendientes para el operario seleccionado.</p>
            </div>
          ) : (
            <div className="space-y-10">
              {renderActiveSection()}
              {renderBlockedSection()}
            </div>
          )}
        </div>

        {/* MÓDULO: ÚLTIMAS 10 TAREAS POR CATEGORÍA (DISPONIBLE PARA TODOS LOS ROLES) */}
        <div className="mt-10">
          <TasksByCategoryBox />
        </div>

        {/* Panel del pedido de la tarea (se abre al hacer clic en la fila o tarjeta) */}
        <PedidoDetailModal
          pedido={selectedPedido}
          isOpen={!!selectedPedido}
          onClose={handleClosePedido}
          onUpdatePedido={(updated) => {
            orderChangedRef.current = true
            setSelectedPedido(updated)
          }}
        />

        {/* Modal de Confirmación para Completar */}
        {completingTask && (
          <Modal id={COMPLETE_TASK_MODAL_ID} onClose={handleCloseCompleteModal} className="max-w-md">
            <h2 className="text-xl font-bold text-white mb-2">Completar Tarea</h2>
            <p className="text-sm text-slate-300 mb-6">
              Estás a punto de completar la etapa <span className="text-white font-bold">{completingTask.etapa?.nombre}</span> para el pedido <span className="text-white font-bold">{completingTask.pedido?.cliente?.nombre_empresa || completingTask.pedido?.cliente?.nombre_cliente || `#${completingTask.pedido?.id}`}</span>. ¿Deseas confirmar la finalización?
            </p>
            <form onSubmit={handleCompleteSubmit}>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseCompleteModal}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  autoFocus
                  className="px-6 py-2.5 rounded-xl text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold shadow-lg shadow-amber-500/20 transition hover:scale-[1.02] active:scale-[0.98]"
                >
                  Confirmar y Finalizar
                </button>
              </div>
            </form>
          </Modal>
        )}
      </main>
    </RoleGuard>
  )
}

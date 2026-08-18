'use client'

import { useEffect, useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import Modal from '@/components/Modal'
import {
  fetchOperarioTasks,
  startOperarioTask,
  cancelOperarioTask,
  completeOperarioTask
} from '@/lib/operario_tasks'
import { fetchResponsablesEtapas, assignTask, type ResponsableEtapa } from '@/lib/responsable_etapas'
import { getStoredUser, fetchUsers, type User } from '@/lib/auth'

export default function TareasPage() {
  const [tasks, setTasks] = useState<ResponsableEtapa[]>([])
  const [operarios, setOperarios] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Modal para Completar y Modal para Ver detalle
  const [completingTask, setCompletingTask] = useState<ResponsableEtapa | null>(null)
  const [viewingTask, setViewingTask] = useState<ResponsableEtapa | null>(null)

  const loadData = async (overrideUserId?: number | null) => {
    setLoading(true)
    setError('')
    try {
      const user = getStoredUser()
      setCurrentUser(user)

      // Cargar ÚNICAMENTE usuarios con rol de operario
      const usersData = await fetchUsers()
      const operariosOnly = usersData.filter(u => u.role === 'operario' || u.role === 'operator')
      setOperarios(operariosOnly)

      const targetUserId = overrideUserId !== undefined ? overrideUserId : selectedUserId

      if (user && ['admin', 'supervisor', 'encargado'].includes(user.role)) {
        const filters: { user_id?: number } = {}
        if (targetUserId) {
          filters.user_id = targetUserId
        }
        const allTasks = await fetchResponsablesEtapas(filters)
        setTasks(allTasks.filter(t => t.estado !== 'completado'))
      } else {
        if (targetUserId && targetUserId !== user?.id) {
          const tasksData = await fetchResponsablesEtapas({ user_id: targetUserId })
          setTasks(tasksData.filter(t => t.estado !== 'completado'))
        } else {
          const tasksData = await fetchOperarioTasks()
          setTasks(tasksData.filter(t => t.estado !== 'completado'))
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar las tareas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleUserSelectChange = (userIdStr: string) => {
    const newId = userIdStr ? parseInt(userIdStr) : null
    setSelectedUserId(newId)
    loadData(newId)
  }

  const showNotification = (message: string) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  const handleStartTask = async (id: number) => {
    setActionLoading(id)
    setError('')
    try {
      await startOperarioTask(id)
      showNotification('Tarea iniciada correctamente.')
      await loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar la tarea')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancelTask = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas cancelar esta tarea iniciada y restablecerla a pendiente?')) return
    setActionLoading(id)
    setError('')
    try {
      await cancelOperarioTask(id)
      showNotification('Tarea en progreso cancelada y restablecida a pendiente.')
      await loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cancelar la tarea')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReassignUser = async (task: ResponsableEtapa, newUserIdStr: string) => {
    const newUserId = parseInt(newUserIdStr)
    if (!newUserId || isNaN(newUserId)) return
    setActionLoading(task.id)
    setError('')
    try {
      const etapaId = task.etapa_id || (task.etapa as any)?.id
      await assignTask({
        pedido_id: task.pedido_id,
        etapa_id: etapaId,
        user_id: newUserId
      })
      showNotification('Operario reasignado correctamente a la etapa.')
      await loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al reasignar el operario')
    } finally {
      setActionLoading(null)
    }
  }

  const handleOpenCompleteModal = (task: ResponsableEtapa) => {
    setCompletingTask(task)
  }

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!completingTask) return
    setActionLoading(completingTask.id)
    setError('')
    try {
      await completeOperarioTask(completingTask.id)
      setCompletingTask(null)
      showNotification('Tarea completada con éxito.')
      await loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al completar la tarea')
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'bloqueada':
        return '🔒 Bloqueada'
      case 'en_progreso':
        return 'En Progreso'
      case 'pendiente':
        return 'Pendiente'
      case 'completado':
        return 'Completado'
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

  // Clasificación de tareas activas en 3 grupos
  const inProgressTasks = tasks.filter(t => t.estado === 'en_progreso')
  const pendingTasks = tasks.filter(t => t.estado === 'pendiente')
  const blockedTasks = tasks.filter(t => t.estado === 'bloqueada')

  const isManager = currentUser && ['admin', 'supervisor', 'encargado'].includes(currentUser.role)

  return (
    <RoleGuard allowedRoles={['admin', 'supervisor', 'encargado', 'operario']}>
      <main className="page-content p-6 max-w-7xl mx-auto text-white">
        {/* Notificaciones */}
        {successMessage && (
          <div className="fixed top-4 right-4 z-50 bg-emerald-500 text-white px-5 py-3.5 rounded-xl shadow-2xl border border-emerald-400 flex items-center gap-3 text-base font-bold animate-bounce">
            <span>✅</span>
            <span>{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-200 px-5 py-4 rounded-xl flex items-center gap-3 text-base font-semibold">
            <span>❌</span>
            <span>{error}</span>
          </div>
        )}

        {/* Encabezado Principal y Selección Únicamente de Operarios */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <span>🏭</span> {isManager ? 'Panel Global de Tareas de Fábrica' : 'Panel de Tareas de Producción'}
            </h1>
            <p className="text-base text-slate-400 mt-1">
              Visualiza tus asignaciones, controla las tareas en proceso y registra el progreso diario.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            {/* Desplegable que contiene SOLAMENTE usuarios con rol de operario */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 shadow-inner">
              <span className="text-sm font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">👤 Operario:</span>
              <select
                value={selectedUserId || ''}
                onChange={(e) => handleUserSelectChange(e.target.value)}
                className="bg-transparent text-base font-bold text-blue-400 focus:outline-none cursor-pointer"
              >
                <option value="" className="bg-slate-900 text-white">
                  {currentUser && (currentUser.role === 'operario' || currentUser.role === 'operator')
                    ? `${currentUser.name} (Mi Perfil)`
                    : 'Todos los Operarios'}
                </option>
                {operarios
                  .filter(op => op.id !== currentUser?.id)
                  .map((op) => (
                    <option key={op.id} value={op.id} className="bg-slate-900 text-white">
                      {op.name}
                    </option>
                  ))}
              </select>
            </div>

            <button
              onClick={() => loadData()}
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold px-5 py-3 rounded-xl border border-slate-700 transition shadow hover:scale-[1.02] active:scale-[0.98]"
            >
              🔄 Sincronizar
            </button>
          </div>
        </div>

        {/* TAREAS DE PRODUCCIÓN EN 3 TABLAS SEPARADAS */}
        <div className="space-y-10">
          {loading ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
              <span className="text-base font-semibold">Cargando tareas de producción...</span>
            </div>
          ) : tasks.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
              <span className="text-5xl">🎉</span>
              <span className="text-lg font-bold text-white">¡No hay tareas activas pendientes!</span>
              <p className="text-sm text-slate-500">No se registran tareas pendientes para el operario seleccionado.</p>
            </div>
          ) : (
            <>
              {/* 1. TABLA: TAREAS EN PROGRESO */}
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-amber-400 flex items-center gap-2">
                  <span>🔥</span> Tareas En Progreso ({inProgressTasks.length})
                </h2>

                {inProgressTasks.length === 0 ? (
                  <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-6 text-sm text-slate-500 italic text-center">
                    No hay tareas actualmente en progreso.
                  </div>
                ) : (
                  <>
                    {/* VISTA EN TARJETAS PARA MOBILE (< md) */}
                    <div className="md:hidden space-y-3">
                      {inProgressTasks.map((task) => (
                        <div key={task.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl text-left">
                          <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
                            <div>
                              <span className="font-bold text-white text-base block">
                                {task.pedido?.cliente?.nombre_empresa || task.pedido?.cliente?.nombre_cliente || 'N/A'}
                              </span>
                              <span className="text-xs text-slate-400 font-semibold">
                                {task.created_at ? new Date(task.created_at).toLocaleDateString('es-ES') : '-'}
                              </span>
                            </div>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-amber-500/10 text-amber-400 border border-amber-500/30">
                              🔥 En Progreso
                            </span>
                          </div>

                          <div className="space-y-0.5">
                            <span className="font-bold text-white text-base block">{task.etapa?.nombre}</span>
                            <span className="text-xs text-slate-400 font-normal block">
                              {task.pedido?.codigo ? `${task.pedido.codigo} • ` : ''}{task.etapa?.producto?.nombre || 'Producto'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-xs font-bold text-slate-400 uppercase">Operario:</span>
                            {isManager ? (
                              <select
                                value={task.user_id || ''}
                                onChange={(e) => handleReassignUser(task, e.target.value)}
                                disabled={actionLoading === task.id}
                                className="bg-slate-950 border border-slate-800 text-xs font-bold text-blue-400 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
                              >
                                {operarios.map((op) => (
                                  <option key={op.id} value={op.id} className="bg-slate-900 text-white">
                                    {op.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-slate-300 font-semibold">{task.user?.name || 'Operario'}</span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800">
                            <button
                              onClick={() => setViewingTask(task)}
                              className="bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-bold px-3 py-2 rounded-xl border border-slate-700 transition"
                            >
                              👁️ Ver
                            </button>
                            <button
                              onClick={() => handleCancelTask(task.id)}
                              disabled={actionLoading === task.id}
                              className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold px-3 py-2 rounded-xl transition"
                              title="Cancelar tarea iniciada y devolver a pendiente"
                            >
                              {actionLoading === task.id ? 'Cancelando...' : '⏹️ Cancelar'}
                            </button>
                            <button
                              onClick={() => handleOpenCompleteModal(task)}
                              disabled={actionLoading === task.id}
                              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-extrabold px-3.5 py-2 rounded-xl shadow-lg shadow-amber-500/20 transition hover:scale-[1.02] active:scale-[0.98]"
                            >
                              {actionLoading === task.id ? 'Cargando...' : 'Completar Tarea'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* VISTA EN TABLA PARA ESCRITORIO (hidden md:block) */}
                    <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold text-sm uppercase tracking-wider">
                              <th className="px-6 py-4">Empresa</th>
                              <th className="px-6 py-4">Fecha Creación</th>
                              <th className="px-6 py-4">Tarea / Etapa</th>
                              <th className="px-6 py-4">Operario Asignado</th>
                              <th className="px-6 py-4">Estado</th>
                              <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 text-base font-medium text-slate-200">
                            {inProgressTasks.map((task) => (
                              <tr key={task.id} className="hover:bg-slate-800/50 transition">
                                <td className="px-6 py-4 font-bold text-white text-base">
                                  {task.pedido?.cliente?.nombre_empresa || task.pedido?.cliente?.nombre_cliente || 'N/A'}
                                </td>
                                <td className="px-6 py-4 text-sm font-semibold text-slate-300">
                                  {task.created_at ? new Date(task.created_at).toLocaleDateString('es-ES') : '-'}
                                </td>
                                <td className="px-6 py-4">
                                  <span className="font-bold text-white text-base block">{task.etapa?.nombre}</span>
                                  <span className="text-sm text-slate-400 font-normal">
                                    {task.pedido?.codigo ? `${task.pedido.codigo} • ` : ''}{task.etapa?.producto?.nombre || 'Producto'}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  {isManager ? (
                                    <select
                                      value={task.user_id || ''}
                                      onChange={(e) => handleReassignUser(task, e.target.value)}
                                      disabled={actionLoading === task.id}
                                      className="bg-slate-950 border border-slate-800 text-xs font-bold text-blue-400 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
                                    >
                                      {operarios.map((op) => (
                                        <option key={op.id} value={op.id} className="bg-slate-900 text-white">
                                          {op.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="text-sm text-slate-300 font-semibold">{task.user?.name || 'Operario'}</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                    🔥 En Progreso
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-3">
                                    <button
                                      onClick={() => setViewingTask(task)}
                                      className="bg-slate-800 hover:bg-slate-700 text-blue-400 text-sm font-bold px-4 py-2.5 rounded-xl border border-slate-700 transition"
                                    >
                                      👁️ Ver
                                    </button>
                                    <button
                                      onClick={() => handleCancelTask(task.id)}
                                      disabled={actionLoading === task.id}
                                      className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-sm font-bold px-4 py-2.5 rounded-xl transition"
                                      title="Cancelar tarea iniciada y devolver a pendiente"
                                    >
                                      {actionLoading === task.id ? 'Cancelando...' : '⏹️ Cancelar Tarea'}
                                    </button>
                                    <button
                                      onClick={() => handleOpenCompleteModal(task)}
                                      disabled={actionLoading === task.id}
                                      className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-sm font-extrabold px-5 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 transition hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                      {actionLoading === task.id ? 'Cargando...' : 'Completar Tarea'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 2. TABLA: TAREAS PENDIENTES */}
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2">
                  <span>⏳</span> Tareas Pendientes ({pendingTasks.length})
                </h2>

                {pendingTasks.length === 0 ? (
                  <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-6 text-sm text-slate-500 italic text-center">
                    No hay tareas pendientes en espera.
                  </div>
                ) : (
                  <>
                    {/* VISTA EN TARJETAS PARA MOBILE (< md) */}
                    <div className="md:hidden space-y-3">
                      {pendingTasks.map((task) => (
                        <div key={task.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl text-left">
                          <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
                            <div>
                              <span className="font-bold text-white text-base block">
                                {task.pedido?.cliente?.nombre_empresa || task.pedido?.cliente?.nombre_cliente || 'N/A'}
                              </span>
                              <span className="text-xs text-slate-400 font-semibold">
                                {task.created_at ? new Date(task.created_at).toLocaleDateString('es-ES') : '-'}
                              </span>
                            </div>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-blue-500/10 text-blue-400 border border-blue-500/30">
                              ⏳ Pendiente
                            </span>
                          </div>

                          <div className="space-y-0.5">
                            <span className="font-bold text-white text-base block">{task.etapa?.nombre}</span>
                            <span className="text-xs text-slate-400 font-normal block">
                              {task.pedido?.codigo ? `${task.pedido.codigo} • ` : ''}{task.etapa?.producto?.nombre || 'Producto'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-xs font-bold text-slate-400 uppercase">Operario:</span>
                            {isManager ? (
                              <select
                                value={task.user_id || ''}
                                onChange={(e) => handleReassignUser(task, e.target.value)}
                                disabled={actionLoading === task.id}
                                className="bg-slate-950 border border-slate-800 text-xs font-bold text-blue-400 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
                              >
                                {operarios.map((op) => (
                                  <option key={op.id} value={op.id} className="bg-slate-900 text-white">
                                    {op.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-slate-300 font-semibold">{task.user?.name || 'Operario'}</span>
                            )}
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                            <button
                              onClick={() => setViewingTask(task)}
                              className="bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-bold px-3 py-2 rounded-xl border border-slate-700 transition"
                            >
                              👁️ Ver
                            </button>
                            <button
                              onClick={() => handleStartTask(task.id)}
                              disabled={actionLoading === task.id}
                              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl transition hover:scale-[1.02] active:scale-[0.98]"
                            >
                              {actionLoading === task.id ? 'Iniciando...' : '🚀 Iniciar Tarea'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* VISTA EN TABLA PARA ESCRITORIO (hidden md:block) */}
                    <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold text-sm uppercase tracking-wider">
                              <th className="px-6 py-4">Empresa</th>
                              <th className="px-6 py-4">Fecha Creación</th>
                              <th className="px-6 py-4">Tarea / Etapa</th>
                              <th className="px-6 py-4">Operario Asignado</th>
                              <th className="px-6 py-4">Estado</th>
                              <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 text-base font-medium text-slate-200">
                            {pendingTasks.map((task) => (
                              <tr key={task.id} className="hover:bg-slate-800/50 transition">
                                <td className="px-6 py-4 font-bold text-white text-base">
                                  {task.pedido?.cliente?.nombre_empresa || task.pedido?.cliente?.nombre_cliente || 'N/A'}
                                </td>
                                <td className="px-6 py-4 text-sm font-semibold text-slate-300">
                                  {task.created_at ? new Date(task.created_at).toLocaleDateString('es-ES') : '-'}
                                </td>
                                <td className="px-6 py-4">
                                  <span className="font-bold text-white text-base block">{task.etapa?.nombre}</span>
                                  <span className="text-sm text-slate-400 font-normal">
                                    {task.pedido?.codigo ? `${task.pedido.codigo} • ` : ''}{task.etapa?.producto?.nombre || 'Producto'}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  {isManager ? (
                                    <select
                                      value={task.user_id || ''}
                                      onChange={(e) => handleReassignUser(task, e.target.value)}
                                      disabled={actionLoading === task.id}
                                      className="bg-slate-950 border border-slate-800 text-xs font-bold text-blue-400 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
                                    >
                                      {operarios.map((op) => (
                                        <option key={op.id} value={op.id} className="bg-slate-900 text-white">
                                          {op.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="text-sm text-slate-300 font-semibold">{task.user?.name || 'Operario'}</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide bg-blue-500/10 text-blue-400 border border-blue-500/30">
                                    ⏳ Pendiente
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-3">
                                    <button
                                      onClick={() => setViewingTask(task)}
                                      className="bg-slate-800 hover:bg-slate-700 text-blue-400 text-sm font-bold px-4 py-2.5 rounded-xl border border-slate-700 transition"
                                    >
                                      👁️ Ver
                                    </button>
                                    <button
                                      onClick={() => handleStartTask(task.id)}
                                      disabled={actionLoading === task.id}
                                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                      {actionLoading === task.id ? 'Iniciando...' : '🚀 Iniciar Tarea'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 3. TABLA: TAREAS BLOQUEADAS */}
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-rose-400 flex items-center gap-2">
                  <span>🔒</span> Tareas Bloqueadas por Dependencias ({blockedTasks.length})
                </h2>

                {blockedTasks.length === 0 ? (
                  <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-6 text-sm text-slate-500 italic text-center">
                    No hay tareas bloqueadas.
                  </div>
                ) : (
                  <>
                    {/* VISTA EN TARJETAS PARA MOBILE (< md) */}
                    <div className="md:hidden space-y-3">
                      {blockedTasks.map((task) => (
                        <div key={task.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl opacity-90 text-left">
                          <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
                            <div>
                              <span className="font-bold text-white text-base block">
                                {task.pedido?.cliente?.nombre_empresa || task.pedido?.cliente?.nombre_cliente || 'N/A'}
                              </span>
                              <span className="text-xs text-slate-400 font-semibold">
                                {task.created_at ? new Date(task.created_at).toLocaleDateString('es-ES') : '-'}
                              </span>
                            </div>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-rose-500/10 text-rose-400 border border-rose-500/30">
                              🔒 Bloqueada
                            </span>
                          </div>

                          <div className="space-y-0.5">
                            <span className="font-bold text-white text-base block">{task.etapa?.nombre}</span>
                            <span className="text-xs text-slate-400 font-normal block">
                              {task.pedido?.codigo ? `${task.pedido.codigo} • ` : ''}{task.etapa?.producto?.nombre || 'Producto'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-xs font-bold text-slate-400 uppercase">Operario:</span>
                            {isManager ? (
                              <select
                                value={task.user_id || ''}
                                onChange={(e) => handleReassignUser(task, e.target.value)}
                                disabled={actionLoading === task.id}
                                className="bg-slate-950 border border-slate-800 text-xs font-bold text-blue-400 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
                              >
                                {operarios.map((op) => (
                                  <option key={op.id} value={op.id} className="bg-slate-900 text-white">
                                    {op.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-slate-300 font-semibold">{task.user?.name || 'Operario'}</span>
                            )}
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                            <button
                              onClick={() => setViewingTask(task)}
                              className="bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-bold px-3 py-2 rounded-xl border border-slate-700 transition"
                            >
                              👁️ Ver
                            </button>
                            <button
                              disabled
                              className="bg-rose-600/20 text-rose-400 border border-rose-500/30 text-xs font-bold px-3 py-2 rounded-xl cursor-not-allowed opacity-80"
                              title="No se puede iniciar hasta que se completen las etapas anteriores"
                            >
                              🔒 Bloqueada
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* VISTA EN TABLA PARA ESCRITORIO (hidden md:block) */}
                    <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl opacity-90">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold text-sm uppercase tracking-wider">
                              <th className="px-6 py-4">Empresa</th>
                              <th className="px-6 py-4">Fecha Creación</th>
                              <th className="px-6 py-4">Tarea / Etapa</th>
                              <th className="px-6 py-4">Operario Asignado</th>
                              <th className="px-6 py-4">Estado</th>
                              <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 text-base font-medium text-slate-200">
                            {blockedTasks.map((task) => (
                              <tr key={task.id} className="hover:bg-slate-800/50 transition">
                                <td className="px-6 py-4 font-bold text-white text-base">
                                  {task.pedido?.cliente?.nombre_empresa || task.pedido?.cliente?.nombre_cliente || 'N/A'}
                                </td>
                                <td className="px-6 py-4 text-sm font-semibold text-slate-300">
                                  {task.created_at ? new Date(task.created_at).toLocaleDateString('es-ES') : '-'}
                                </td>
                                <td className="px-6 py-4">
                                  <span className="font-bold text-white text-base block">{task.etapa?.nombre}</span>
                                  <span className="text-sm text-slate-400 font-normal">
                                    {task.pedido?.codigo ? `${task.pedido.codigo} • ` : ''}{task.etapa?.producto?.nombre || 'Producto'}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  {isManager ? (
                                    <select
                                      value={task.user_id || ''}
                                      onChange={(e) => handleReassignUser(task, e.target.value)}
                                      disabled={actionLoading === task.id}
                                      className="bg-slate-950 border border-slate-800 text-xs font-bold text-blue-400 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
                                    >
                                      {operarios.map((op) => (
                                        <option key={op.id} value={op.id} className="bg-slate-900 text-white">
                                          {op.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="text-sm text-slate-300 font-semibold">{task.user?.name || 'Operario'}</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                    🔒 Bloqueada
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-3">
                                    <button
                                      onClick={() => setViewingTask(task)}
                                      className="bg-slate-800 hover:bg-slate-700 text-blue-400 text-sm font-bold px-4 py-2.5 rounded-xl border border-slate-700 transition"
                                    >
                                      👁️ Ver
                                    </button>
                                    <button
                                      disabled
                                      className="bg-rose-600/20 text-rose-400 border border-rose-500/30 text-sm font-bold px-4 py-2.5 rounded-xl cursor-not-allowed opacity-80"
                                      title="No se puede iniciar hasta que se completen las etapas anteriores"
                                    >
                                      🔒 Bloqueada
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal de Vista Detallada de Tarea (Tarjeta) */}
        {viewingTask && (() => {
          const isBlocked = viewingTask.estado === 'bloqueada'

          return (
            <Modal isOpen={!!viewingTask} onClose={() => setViewingTask(null)} className="max-w-xl p-6">
              {/* Header del Modal */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono font-extrabold text-white bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
                    {viewingTask.pedido?.codigo || 'PED-????'}
                  </span>
                  <span
                    className={`text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full ${getStatusBadgeClass(viewingTask.estado)}`}
                  >
                    {getStatusLabel(viewingTask.estado)}
                  </span>
                </div>
                <button
                  onClick={() => setViewingTask(null)}
                  className="text-slate-400 hover:text-white text-xl font-bold w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-800 transition"
                >
                  ✕
                </button>
              </div>

              {/* Contenido de la Tarjeta */}
              <div className="space-y-4 text-left">
                <div>
                  <h3 className="text-2xl font-extrabold text-white tracking-tight">{viewingTask.etapa?.nombre}</h3>
                  <p className="text-sm text-slate-300 mt-1 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    Producto: <span className="text-white font-bold">{viewingTask.etapa?.producto?.nombre || 'Producto final'}</span>
                  </p>
                  <p className="text-sm text-slate-300 mt-1">
                    Empresa: <span className="text-white font-bold">{viewingTask.pedido?.cliente?.nombre_empresa || viewingTask.pedido?.cliente?.nombre_cliente || 'N/A'}</span>
                  </p>
                  {viewingTask.created_at && (
                    <p className="text-sm text-slate-400 mt-1">
                      Fecha de Creación: <span className="text-slate-200 font-semibold">{new Date(viewingTask.created_at).toLocaleDateString('es-ES')}</span>
                    </p>
                  )}
                </div>

                {viewingTask.fecha_inicio && (
                  <p className="text-xs text-amber-400 font-semibold italic">
                    Iniciada el: {new Date(viewingTask.fecha_inicio).toLocaleString('es-ES')}
                  </p>
                )}
              </div>

              {/* Acciones del Modal */}
              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setViewingTask(null)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold rounded-xl transition"
                >
                  Cerrar
                </button>

                {viewingTask.estado === 'bloqueada' ? (
                  <button
                    disabled
                    className="bg-rose-600/30 text-rose-300 border border-rose-500/40 text-sm font-bold px-5 py-2.5 rounded-xl cursor-not-allowed opacity-80 flex items-center gap-1"
                  >
                    🔒 Tarea Bloqueada
                  </button>
                ) : viewingTask.estado === 'pendiente' ? (
                  <button
                    onClick={async () => {
                      const taskId = viewingTask.id
                      setViewingTask(null)
                      await handleStartTask(taskId)
                    }}
                    disabled={actionLoading !== null}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-extrabold px-5 py-2.5 rounded-xl transition hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {actionLoading === viewingTask.id ? 'Iniciando...' : '🚀 Iniciar Tarea'}
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        const taskId = viewingTask.id
                        setViewingTask(null)
                        await handleCancelTask(taskId)
                      }}
                      disabled={actionLoading !== null}
                      className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-sm font-bold px-4 py-2.5 rounded-xl transition"
                    >
                      ⏹️ Cancelar
                    </button>
                    <button
                      onClick={() => {
                        const t = viewingTask
                        setViewingTask(null)
                        handleOpenCompleteModal(t)
                      }}
                      disabled={actionLoading !== null}
                      className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-sm font-extrabold px-5 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 transition hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {actionLoading === viewingTask.id ? 'Cargando...' : '✅ Completar Tarea'}
                    </button>
                  </div>
                )}
              </div>
            </Modal>
          )
        })()}

        {/* Modal de Confirmación para Completar */}
        {completingTask && (
          <Modal isOpen={!!completingTask} onClose={() => setCompletingTask(null)} className="max-w-md p-6 text-left">
            <h2 className="text-xl font-bold text-white mb-2">Completar Tarea</h2>
            <p className="text-sm text-slate-300 mb-6">
              Estás a punto de completar la etapa <span className="text-white font-bold">{completingTask.etapa?.nombre}</span> para el pedido <span className="text-white font-bold">{completingTask.pedido?.codigo}</span>. ¿Deseas confirmar la finalización?
            </p>
            <form onSubmit={handleCompleteSubmit}>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCompletingTask(null)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
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

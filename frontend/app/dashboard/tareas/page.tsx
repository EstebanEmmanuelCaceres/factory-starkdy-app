'use client'

import { useEffect, useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import {
  fetchOperarioTasks,
  startOperarioTask,
  completeOperarioTask,
  fetchOperarioHistorial
} from '@/lib/operario_tasks'
import { fetchResponsablesEtapas, type ResponsableEtapa } from '@/lib/responsable_etapas'
import { getStoredUser, type User } from '@/lib/auth'

export default function TareasPage() {
  const [tasks, setTasks] = useState<ResponsableEtapa[]>([])
  const [historial, setHistorial] = useState<ResponsableEtapa[]>([])
  const [allPendingTasks, setAllPendingTasks] = useState<ResponsableEtapa[]>([])
  const [allTasksForManager, setAllTasksForManager] = useState<ResponsableEtapa[]>([])
  
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Filtros del Manager
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [taskSearchQuery, setTaskSearchQuery] = useState<string>('')

  // Modal para Completar
  const [completingTask, setCompletingTask] = useState<ResponsableEtapa | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const user = getStoredUser()
      setCurrentUser(user)
      
      if (user && ['admin', 'supervisor', 'encargado'].includes(user.role)) {
        const allTasks = await fetchResponsablesEtapas()
        setAllTasksForManager(allTasks)
      } else {
        const [tasksData, historialData, pendingData] = await Promise.all([
          fetchOperarioTasks(),
          fetchOperarioHistorial(),
          fetchResponsablesEtapas({ estado: 'pendiente' })
        ])
        setTasks(tasksData)
        setHistorial(historialData)
        setAllPendingTasks(pendingData)
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

  const showNotification = (message: string) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  const handleStartTask = async (id: number) => {
    setActionLoading(id)
    setError('')
    try {
      await startOperarioTask(id)
      showNotification('Tarea iniciada. ¡Buen trabajo!')
      await loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar la tarea')
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
      showNotification('Tarea completada con éxito. Registrado en el historial.')
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
        return 'bg-slate-800/80 text-slate-500 border border-slate-700/60'
      case 'completado':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
      case 'en_progreso':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
      case 'pendiente':
      default:
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
    }
  }

  // Filtrado de tareas del Manager en memoria
  const filteredTasksForManager = allTasksForManager.filter((t) => {
    const matchStatus = statusFilter === 'todos' || t.estado === statusFilter
    const matchSearch =
      !taskSearchQuery ||
      t.etapa?.nombre.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
      t.etapa?.producto?.nombre.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
      t.pedido?.codigo.toLowerCase().includes(taskSearchQuery.toLowerCase())
    return matchStatus && matchSearch
  })

  const isManager = currentUser && ['admin', 'supervisor', 'encargado'].includes(currentUser.role)

  return (
    <RoleGuard allowedRoles={['admin', 'supervisor', 'encargado', 'operario']}>
      <main className="page-content p-6 max-w-7xl mx-auto text-white">
        {/* Notificaciones */}
        {successMessage && (
          <div className="fixed top-4 right-4 z-50 bg-emerald-500 text-white px-4 py-3 rounded-lg shadow-xl border border-emerald-400 flex items-center gap-2 animate-bounce">
            <span>✅</span>
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-200 px-4 py-3 rounded-lg flex items-center gap-2">
            <span>❌</span>
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Encabezado */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {isManager ? 'Panel Global de Tareas de Fábrica' : 'Panel de Tareas del Operario'}
            </h1>
            <p className="text-sm text-slate-400">
              {isManager 
                ? 'Monitorea, filtra y gestiona todas las etapas de fabricación y operarios asignados en tiempo real.' 
                : 'Visualiza tus asignaciones pendientes, comprueba la cola de espera de tus etapas y registra tu avance diario.'}
            </p>
          </div>
          <button
            onClick={loadData}
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg border border-slate-700 transition"
          >
            🔄 Sincronizar
          </button>
        </div>

        {/* VISTA DEL MANAGER (Admin, Supervisor, Encargado) */}
        {isManager ? (
          <div className="space-y-6">
            {/* Filtros */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-md">
              <div className="relative w-full md:w-80">
                <input
                  type="text"
                  placeholder="Buscar por pedido, producto o etapa..."
                  value={taskSearchQuery}
                  onChange={(e) => setTaskSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3.5 py-2 pl-9 text-sm text-white placeholder-slate-500 focus:outline-none transition duration-150"
                />
                <span className="absolute left-3.5 top-2.5 text-slate-500 text-sm">🔍</span>
                {taskSearchQuery && (
                  <button
                    onClick={() => setTaskSearchQuery('')}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 text-sm"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filtros de estado */}
              <div className="flex flex-wrap gap-2 self-start md:self-auto">
                {['todos', 'pendiente', 'en_progreso', 'completado', 'bloqueada'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition ${
                      statusFilter === status
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    {status === 'todos' ? 'Todos' : status.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Listado Global de Tareas */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                  <span className="text-sm">Cargando tareas globales...</span>
                </div>
              ) : filteredTasksForManager.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <span className="text-4xl">📋</span>
                  <span className="text-sm font-medium">No se encontraron tareas con los filtros aplicados</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                        <th className="px-6 py-4">Tarea / Etapa</th>
                        <th className="px-6 py-4">Producto</th>
                        <th className="px-6 py-4">Código Pedido</th>
                        <th className="px-6 py-4">Asignado a</th>
                        <th className="px-6 py-4">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-sm text-slate-300">
                      {filteredTasksForManager.map((task) => (
                        <tr key={task.id} className="hover:bg-slate-800/40 transition duration-100">
                          <td className="px-6 py-4">
                            <span className="font-semibold text-white block">{task.etapa?.nombre}</span>
                            <span className="text-[10px] text-slate-500">Orden: {task.etapa?.orden}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs text-slate-300">{task.etapa?.producto?.nombre || 'N/A'}</span>
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-xs text-white">{task.pedido?.codigo || 'PED-????'}</td>
                          <td className="px-6 py-4">
                            {task.user ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                👤 {task.user.name}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500 italic">Sin Asignar</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${getStatusBadgeClass(task.estado)}`}>
                              {getStatusLabel(task.estado)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* VISTA DEL OPERARIO (Original con cola de espera) */
          <div className="space-y-10">
            {/* Lista de Tareas Activas */}
            <div>
              <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                <span>🛠️</span> Tareas Asignadas Activas
              </h2>

              {loading ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent"></div>
                  <span className="text-sm">Cargando tareas activas...</span>
                </div>
              ) : tasks.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
                  <span className="text-4xl">😴</span>
                  <span className="text-sm font-medium">¡Estás al día! No tienes tareas activas pendientes.</span>
                  <p className="text-xs text-slate-500">Espera a que un supervisor te asigne nuevas etapas.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tasks.map((task) => {
                    // Filtrar otras tareas pendientes asociadas a esta misma etapa
                    const pendingSameStage = allPendingTasks.filter(
                      t => t.etapa?.nombre === task.etapa?.nombre && t.id !== task.id
                    )

                    return (
                      <div
                        key={task.id}
                        className={`bg-slate-900 border ${
                          task.estado === 'en_progreso' ? 'border-amber-500/40 bg-amber-500/[0.02]' : 'border-slate-800'
                        } rounded-xl p-5 shadow-lg flex flex-col justify-between hover:scale-[1.01] transition-transform duration-150`}
                      >
                        <div className="space-y-3">
                          {/* Badge de Estado */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-slate-500">{task.pedido?.codigo || 'PED-????'}</span>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                task.estado === 'en_progreso'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-slate-500/10 text-slate-400 border border-slate-800'
                              }`}
                            >
                              {getStatusLabel(task.estado)}
                            </span>
                          </div>

                          {/* Información Etapa y Producto */}
                          <div>
                            <h3 className="text-base font-bold text-white tracking-tight">{task.etapa?.nombre}</h3>
                            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                              Producto: {task.etapa?.producto?.nombre || 'Producto final'}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              Cliente: <span className="text-slate-300 font-semibold">{task.pedido?.cliente ? `${task.pedido.cliente.nombre_cliente} (${task.pedido.cliente.nombre_empresa})` : 'N/A'}</span>
                            </p>
                          </div>

                          {/* Fechas de inicio/fin */}
                          {task.fecha_inicio && (
                            <p className="text-[11px] text-slate-500 italic mt-2">
                              Iniciada el: {new Date(task.fecha_inicio).toLocaleString('es-ES')}
                            </p>
                          )}

                          {/* Otras tareas pendientes en esta etapa (Control Operario) */}
                          <div className="border-t border-slate-800/80 pt-3 mt-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block mb-1.5">
                              👀 Cola de Espera para "{task.etapa?.nombre}":
                            </span>
                            {pendingSameStage.length === 0 ? (
                              <span className="text-[10px] text-slate-500 italic block">No hay otras tareas pendientes de esta etapa en cola.</span>
                            ) : (
                              <div className="space-y-1 max-h-24 overflow-y-auto bg-slate-950/60 p-2 rounded border border-slate-850">
                                {pendingSameStage.map((pTask) => (
                                  <div key={pTask.id} className="flex justify-between items-center text-[10px] border-b border-slate-900 pb-1 last:border-0 last:pb-0">
                                    <span className="font-mono text-slate-300">{pTask.pedido?.codigo || 'PED-????'}</span>
                                    <span className="text-slate-550 truncate max-w-[120px]">
                                      {pTask.user ? `👤 ${pTask.user.name}` : '❌ Sin Asignar'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Acciones */}
                        <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-end">
                          {task.estado === 'pendiente' ? (
                            <button
                              onClick={() => handleStartTask(task.id)}
                              disabled={actionLoading !== null}
                              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg transition hover:scale-[1.01] active:scale-[0.99]"
                            >
                              {actionLoading === task.id ? 'Iniciando...' : '🚀 Iniciar Tarea'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenCompleteModal(task)}
                              disabled={actionLoading !== null}
                              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg transition hover:scale-[1.01] active:scale-[0.99]"
                            >
                              {actionLoading === task.id ? 'Cargando...' : '✅ Completar Tarea'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Historial de Producción */}
            <div>
              <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                <span>📜</span> Mi Historial de Producción
              </h2>

              {loading ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl py-10 flex flex-col items-center justify-center text-slate-400">
                  <span className="text-sm">Cargando historial...</span>
                </div>
              ) : historial.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl py-10 flex flex-col items-center justify-center text-slate-550 text-sm italic">
                  Aún no has registrado ningún completado de producción en el historial.
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                          <th className="px-6 py-4">Código Pedido</th>
                          <th className="px-6 py-4">Etapa</th>
                          <th className="px-6 py-4">Producto</th>
                          <th className="px-6 py-4">Fecha Finalización</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-sm text-slate-300">
                        {historial.map((reg) => (
                          <tr key={reg.id} className="hover:bg-slate-800/40 transition duration-100">
                            <td className="px-6 py-4 font-mono font-bold text-xs">{reg.pedido?.codigo}</td>
                            <td className="px-6 py-4 font-semibold text-white">{reg.etapa?.nombre}</td>
                            <td className="px-6 py-4 text-xs text-slate-400">{reg.etapa?.producto?.nombre}</td>
                            <td className="px-6 py-4 text-xs">
                              {reg.fecha_fin ? new Date(reg.fecha_fin).toLocaleString('es-ES') : reg.updated_at ? new Date(reg.updated_at).toLocaleString('es-ES') : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal de Confirmación para Completar */}
            {completingTask && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
                  <h2 className="text-lg font-bold text-white mb-2">Completar Tarea</h2>
                  <p className="text-xs text-slate-400 mb-6">
                    Estás a punto de completar la etapa <span className="text-white font-semibold">{completingTask.etapa?.nombre}</span> para el pedido <span className="text-white font-semibold">{completingTask.pedido?.codigo}</span>. ¿Deseas confirmar la finalización?
                  </p>
                  <form onSubmit={handleCompleteSubmit}>
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setCompletingTask(null)}
                        className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow transition hover:scale-[1.02] active:scale-[0.98]"
                      >
                        Confirmar y Finalizar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </RoleGuard>
  )
}

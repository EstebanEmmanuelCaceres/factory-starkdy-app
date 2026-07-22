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

  // Modal para Completar y Modal para Ver detalle
  const [completingTask, setCompletingTask] = useState<ResponsableEtapa | null>(null)
  const [viewingTask, setViewingTask] = useState<ResponsableEtapa | null>(null)

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
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                          <th className="px-6 py-4">Empresa</th>
                          <th className="px-6 py-4">Fecha de Vencimiento</th>
                          <th className="px-6 py-4">Tarea</th>
                          <th className="px-6 py-4">Estado</th>
                          <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-sm text-slate-300">
                        {tasks.map((task) => (
                          <tr key={task.id} className="hover:bg-slate-800/40 transition duration-100">
                            <td className="px-6 py-4 font-semibold text-white">
                              {task.pedido?.cliente?.nombre_empresa || task.pedido?.cliente?.nombre_cliente || 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-xs font-medium text-slate-300">
                              {task.pedido?.fecha_entrega ? (
                                new Date(task.pedido.fecha_entrega).toLocaleDateString('es-ES')
                              ) : (
                                <span className="text-slate-500 italic">Sin fecha</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-semibold text-white block">{task.etapa?.nombre}</span>
                              <span className="text-xs text-slate-400">
                                {task.pedido?.codigo ? `${task.pedido.codigo} • ` : ''}{task.etapa?.producto?.nombre || 'Producto final'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${getStatusBadgeClass(task.estado)}`}>
                                {getStatusLabel(task.estado)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setViewingTask(task)}
                                  className="bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition flex items-center gap-1"
                                >
                                  👁️ Ver
                                </button>
                                {task.estado === 'bloqueada' ? (
                                  <button
                                    disabled
                                    className="bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-not-allowed opacity-80 flex items-center gap-1"
                                    title="No se puede iniciar hasta que se completen las etapas anteriores"
                                  >
                                    🔒 Bloqueada
                                  </button>
                                ) : task.estado === 'pendiente' ? (
                                  <button
                                    onClick={() => handleStartTask(task.id)}
                                    disabled={actionLoading !== null}
                                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition hover:scale-[1.01] active:scale-[0.99]"
                                  >
                                    {actionLoading === task.id ? 'Iniciando...' : '🚀 Iniciar'}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleOpenCompleteModal(task)}
                                    disabled={actionLoading !== null}
                                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition hover:scale-[1.01] active:scale-[0.99]"
                                  >
                                    {actionLoading === task.id ? 'Cargando...' : '✅ Completar'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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

            {/* Modal de Vista Detallada de Tarea (Tarjeta) */}
            {viewingTask && (() => {
              const depsInfo = viewingTask.dependencias_info || []
              const isBlocked = viewingTask.estado === 'bloqueada'

              return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
                    {/* Header del Modal */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-slate-300 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">
                          {viewingTask.pedido?.codigo || 'PED-????'}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${getStatusBadgeClass(viewingTask.estado)}`}
                        >
                          {getStatusLabel(viewingTask.estado)}
                        </span>
                      </div>
                      <button
                        onClick={() => setViewingTask(null)}
                        className="text-slate-400 hover:text-white text-lg font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-800 transition"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Contenido de la Tarjeta */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">{viewingTask.etapa?.nombre}</h3>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                          Producto: <span className="text-slate-200 font-medium">{viewingTask.etapa?.producto?.nombre || 'Producto final'}</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Cliente: <span className="text-slate-200 font-semibold">{viewingTask.pedido?.cliente ? `${viewingTask.pedido.cliente.nombre_cliente} (${viewingTask.pedido.cliente.nombre_empresa})` : 'N/A'}</span>
                        </p>
                        {viewingTask.pedido?.fecha_entrega && (
                          <p className="text-xs text-slate-400 mt-1">
                            Fecha de Vencimiento: <span className="text-amber-400 font-semibold">{new Date(viewingTask.pedido.fecha_entrega).toLocaleDateString('es-ES')}</span>
                          </p>
                        )}
                      </div>

                      {viewingTask.fecha_inicio && (
                        <p className="text-[11px] text-slate-500 italic">
                          Iniciada el: {new Date(viewingTask.fecha_inicio).toLocaleString('es-ES')}
                        </p>
                      )}

                      {/* Información de Dependencias Directas */}
                      <div className="border-t border-slate-800/80 pt-4 mt-2">
                        {isBlocked ? (
                          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-xs text-rose-200 space-y-2">
                            <div className="font-bold text-rose-400 flex items-center gap-1.5 text-sm">
                              <span>🔒</span> Tarea Bloqueada por Dependencias
                            </div>
                            <p className="text-slate-300">
                              Esta tarea se encuentra bloqueada porque depende de la(s) siguiente(s) etapa(s):
                            </p>
                            <ul className="space-y-1.5 mt-2">
                              {depsInfo.length > 0 ? (
                                depsInfo.map((dep: any) => (
                                  <li key={dep.id} className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                                    <span className="font-semibold text-white">Etapa: {dep.nombre}</span>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getStatusBadgeClass(dep.estado)}`}>
                                      {getStatusLabel(dep.estado)}
                                    </span>
                                  </li>
                                ))
                              ) : (
                                <li className="italic text-slate-400">Etapa previa requerida no completada</li>
                              )}
                            </ul>
                          </div>
                        ) : depsInfo.length > 0 ? (
                          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 text-xs space-y-2">
                            <span className="font-semibold text-slate-300 block">Dependencias previas:</span>
                            <div className="space-y-1.5">
                              {depsInfo.map((dep: any) => (
                                <div key={dep.id} className="flex items-center justify-between text-slate-300 bg-slate-900/60 p-2 rounded border border-slate-800/60">
                                  <span>Etapa &quot;{dep.nombre}&quot;</span>
                                  <span className="text-emerald-400 font-semibold text-[11px] flex items-center gap-1">
                                    ✅ Completada
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3 text-xs text-slate-400 italic">
                            Esta tarea no depende de ninguna otra etapa.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setViewingTask(null)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition"
                      >
                        Cerrar
                      </button>

                      {viewingTask.estado === 'bloqueada' ? (
                        <button
                          disabled
                          className="bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-semibold px-4 py-2 rounded-lg cursor-not-allowed opacity-80 flex items-center gap-1"
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
                          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition hover:scale-[1.01] active:scale-[0.98]"
                        >
                          {actionLoading === viewingTask.id ? 'Iniciando...' : '🚀 Iniciar Tarea'}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const t = viewingTask
                            setViewingTask(null)
                            handleOpenCompleteModal(t)
                          }}
                          disabled={actionLoading !== null}
                          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition hover:scale-[1.01] active:scale-[0.98]"
                        >
                          {actionLoading === viewingTask.id ? 'Cargando...' : '✅ Completar Tarea'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}

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

'use client'

import { useEffect, useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import { fetchOperarioHistorial } from '@/lib/operario_tasks'
import { fetchResponsablesEtapas, type ResponsableEtapa } from '@/lib/responsable_etapas'
import { getStoredUser, fetchUsers, type User } from '@/lib/auth'

export default function HistorialPage() {
  const [historial, setHistorial] = useState<ResponsableEtapa[]>([])
  const [operarios, setOperarios] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = async (overrideUserId?: number | null, overrideDesde?: string, overrideHasta?: string) => {
    setLoading(true)
    setError('')
    try {
      const user = getStoredUser()
      setCurrentUser(user)

      // Cargar únicamente usuarios con rol de operario
      const usersData = await fetchUsers()
      const operariosOnly = usersData.filter(u => u.role === 'operario' || u.role === 'operator')
      setOperarios(operariosOnly)

      const targetUserId = overrideUserId !== undefined ? overrideUserId : selectedUserId
      const targetDesde = overrideDesde !== undefined ? overrideDesde : fechaDesde
      const targetHasta = overrideHasta !== undefined ? overrideHasta : fechaHasta

      const filters: { user_id?: number; fecha_desde?: string; fecha_hasta?: string } = {}
      if (targetUserId) filters.user_id = targetUserId
      if (targetDesde) filters.fecha_desde = targetDesde
      if (targetHasta) filters.fecha_hasta = targetHasta

      if (user && ['admin', 'supervisor', 'encargado'].includes(user.role)) {
        const allTasks = await fetchResponsablesEtapas(filters)
        setHistorial(allTasks.filter(t => t.estado === 'completado'))
      } else {
        if (targetUserId && targetUserId !== user?.id) {
          const tasksData = await fetchResponsablesEtapas(filters)
          setHistorial(tasksData.filter(t => t.estado === 'completado'))
        } else {
          const historialData = await fetchOperarioHistorial()
          let filtered = historialData
          if (targetDesde) {
            filtered = filtered.filter(t => {
              const d = t.fecha_fin || t.updated_at
              return Boolean(d && d.slice(0, 10) >= targetDesde)
            })
          }
          if (targetHasta) {
            filtered = filtered.filter(t => {
              const d = t.fecha_fin || t.updated_at
              return Boolean(d && d.slice(0, 10) <= targetHasta)
            })
          }
          setHistorial(filtered)
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar el historial de producción')
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

  return (
    <RoleGuard allowedRoles={['admin', 'supervisor', 'encargado', 'operario']}>
      <main className="page-content p-6 max-w-7xl mx-auto text-white">
        {error && (
          <div className="mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-200 px-5 py-4 rounded-xl flex items-center gap-3 text-base font-semibold">
            <span>❌</span>
            <span>{error}</span>
          </div>
        )}

        {/* Encabezado Principal y Filtros */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <span>📜</span> Historial de Producción
            </h1>
            <p className="text-base text-slate-400 mt-1">
              Registro completo de todas las tareas y etapas de fabricación finalizadas con éxito.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Filtro Fecha Desde */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
              <span className="text-xs font-bold text-slate-400 uppercase">Desde:</span>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => {
                  setFechaDesde(e.target.value)
                  loadData(undefined, e.target.value, undefined)
                }}
                className="bg-transparent text-sm text-white focus:outline-none cursor-pointer"
              />
            </div>

            {/* Filtro Fecha Hasta */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
              <span className="text-xs font-bold text-slate-400 uppercase">Hasta:</span>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => {
                  setFechaHasta(e.target.value)
                  loadData(undefined, undefined, e.target.value)
                }}
                className="bg-transparent text-sm text-white focus:outline-none cursor-pointer"
              />
            </div>

            {/* Desplegable únicamente para operarios */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 shadow-inner">
              <span className="text-sm font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">👤 Operario:</span>
              <select
                value={selectedUserId || ''}
                onChange={(e) => handleUserSelectChange(e.target.value)}
                className="bg-transparent text-sm font-bold text-blue-400 focus:outline-none cursor-pointer"
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
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl border border-slate-700 transition shadow hover:scale-[1.02] active:scale-[0.98]"
            >
              🔄 Sincronizar
            </button>
          </div>
        </div>

        {/* Tabla del Historial */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
              <span className="text-base font-semibold">Cargando historial de producción...</span>
            </div>
          ) : historial.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl py-16 flex flex-col items-center justify-center text-slate-500 text-base italic">
              No hay tareas completadas registradas en el historial de producción para este filtro.
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold text-sm uppercase tracking-wider">
                      <th className="px-6 py-4">Código Pedido</th>
                      <th className="px-6 py-4">Empresa</th>
                      <th className="px-6 py-4">Etapa</th>
                      <th className="px-6 py-4">Producto</th>
                      <th className="px-6 py-4">Operario</th>
                      <th className="px-6 py-4">Fecha Finalización</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-base font-medium text-slate-200">
                    {historial.map((reg) => (
                      <tr key={reg.id} className="hover:bg-slate-800/50 transition">
                        <td className="px-6 py-4 font-mono font-bold text-base text-blue-400">{reg.pedido?.codigo || '-'}</td>
                        <td className="px-6 py-4 font-bold text-white text-base">
                          {reg.pedido?.cliente?.nombre_empresa || reg.pedido?.cliente?.nombre_cliente || 'N/A'}
                        </td>
                        <td className="px-6 py-4 font-bold text-white text-base">{reg.etapa?.nombre}</td>
                        <td className="px-6 py-4 text-base text-slate-300">{reg.etapa?.producto?.nombre || 'Producto'}</td>
                        <td className="px-6 py-4 text-base font-semibold text-slate-300">
                          {reg.user?.name || 'Operario'}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-slate-300">
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
      </main>
    </RoleGuard>
  )
}

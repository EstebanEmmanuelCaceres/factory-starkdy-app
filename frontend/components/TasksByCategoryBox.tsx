'use client'

import { useEffect, useState } from 'react'
import { fetchCategorias, type Categoria } from '@/lib/entities/categorias'
import { fetchTasksPorCategoria, type TaskPorCategoria } from '@/lib/operario_tasks'

export default function TasksByCategoryBox() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null)
  const [tasks, setTasks] = useState<TaskPorCategoria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        const cats = await fetchCategorias()
        setCategorias(cats)
        if (cats.length > 0) {
          const defaultCatId = cats[0].id
          setSelectedCatId(defaultCatId)
          const data = await fetchTasksPorCategoria(defaultCatId)
          setTasks(data)
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error al cargar categorías')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const handleCatChange = async (catId: number) => {
    setSelectedCatId(catId)
    setLoading(true)
    setError('')
    try {
      const data = await fetchTasksPorCategoria(catId)
      setTasks(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar las tareas')
    } finally {
      setLoading(false)
    }
  }

  const formatFecha = (dateStr: string | null) => {
    if (!dateStr) return null
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return d.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Encabezado del Bloque */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2.5">
            <span className="text-2xl">📋</span> Últimas 10 Tareas por Categoría
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Consulta general de etapas activas por categoría asignada (disponible para todos los usuarios)
          </p>
        </div>

        {/* Desplegable de Categorías */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 shadow-inner shrink-0">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0">
            🏷️ Categoría:
          </span>
          <select
            value={selectedCatId || ''}
            onChange={(e) => handleCatChange(Number(e.target.value))}
            className="bg-transparent text-sm font-extrabold text-blue-400 focus:outline-none cursor-pointer"
          >
            {categorias.map((cat) => (
              <option key={cat.id} value={cat.id} className="bg-slate-900 text-white">
                {cat.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs px-4 py-3 rounded-xl">
          ❌ {error}
        </div>
      )}

      {/* Contenido de la Tabla */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-500 border-t-transparent"></div>
          <span className="text-xs font-semibold">Cargando tareas de la categoría...</span>
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-8 text-center text-slate-500 italic text-sm">
          No se registran tareas recientes para esta categoría.
        </div>
      ) : (
        <>
          {/* VISTA MOBILE (< md) */}
          <div className="md:hidden space-y-3">
            {tasks.map((t) => (
              <div key={t.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 text-left">
                <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2">
                  <div>
                    <span className="font-bold text-white text-sm block">{t.nombre_pedido}</span>
                    <span className="text-xs text-blue-400 font-semibold">{t.nombre_etapa}</span>
                  </div>
                  <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {t.estado}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold block mb-1">Operario Asignado:</span>
                    <span className="bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded-md font-bold">
                      👤 {t.user_asignado}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-bold block my-1">Usuarios Habilitados:</span>
                    <div className="flex flex-wrap gap-1">
                      {t.usuarios_habilitados.length > 0 ? (
                        t.usuarios_habilitados.map((uName, idx) => (
                          <span key={idx} className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px]">
                            {uName}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 italic">Ninguno</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                    <span className="text-slate-400 font-bold">Fin Etapa Anterior:</span>
                    <span className="text-slate-200 font-semibold">
                      {formatFecha(t.fecha_fin_etapa_anterior) || 'Sin fecha previa'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* VISTA ESCRITORIO (hidden md:block) */}
          <div className="hidden md:block bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-bold text-xs uppercase tracking-wider">
                    <th className="px-5 py-3.5">Pedido / Cliente</th>
                    <th className="px-5 py-3.5">Etapa</th>
                    <th className="px-5 py-3.5">Usuarios Habilitados / Asignado</th>
                    <th className="px-5 py-3.5 text-right">Fin Etapa Anterior</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs font-medium text-slate-200">
                  {tasks.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-5 py-3.5 font-bold text-white">
                        {t.nombre_pedido}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-blue-300">
                        {t.nombre_etapa}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2.5 py-0.5 rounded-md font-bold text-[11px]">
                            <span>👤</span> {t.user_asignado}
                          </span>
                          <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-[10px] uppercase font-bold text-slate-500">Habilitados:</span>
                            {t.usuarios_habilitados.length > 0 ? (
                              t.usuarios_habilitados.map((uName, idx) => (
                                <span key={idx} className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px]">
                                  {uName}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">Ninguno</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold">
                        {t.fecha_fin_etapa_anterior ? (
                          <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2.5 py-1 rounded-lg text-xs">
                            🕒 {formatFecha(t.fecha_fin_etapa_anterior)}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Sin etapa previa</span>
                        )}
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
  )
}

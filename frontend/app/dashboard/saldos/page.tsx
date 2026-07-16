'use client'

import { useEffect, useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import { fetchClientes, type Cliente } from '@/lib/clientes'

function SaldosContent() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedClienteId, setExpandedClienteId] = useState<number | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchClientes({ with_pedidos: true })
      setClientes(data)
    } catch (err: any) {
      setError(err.message || 'Error al cargar los saldos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredClientes = clientes.filter(c => {
    const search = searchQuery.toLowerCase()
    return (
      c.nombre_cliente.toLowerCase().includes(search) ||
      c.nombre_empresa.toLowerCase().includes(search) ||
      (c.email && c.email.toLowerCase().includes(search))
    )
  })

  const formatCurrency = (amount: number) => {
    return `$ ${amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <div className="dashboard-container">
      {/* Buscador */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 shadow-md flex items-center justify-between">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Buscar por cliente o empresa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3.5 py-2 pl-9 text-sm text-white placeholder-slate-500 focus:outline-none transition duration-150"
          />
          <span className="absolute left-3.5 top-2.5 text-slate-500 text-sm">🔍</span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 text-sm"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Listado de Clientes y Saldos */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
          <span className="text-sm">Cargando saldos...</span>
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-455 p-4 rounded-xl text-center mb-6">
          {error}
        </div>
      ) : filteredClientes.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
          <span className="text-4xl">💵</span>
          <span className="text-sm font-medium text-slate-550">No se encontraron saldos para mostrar</span>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredClientes.map((c) => {
            const pds = c.pedidos || []
            const montoTotal = pds.reduce((sum, p) => sum + (p.precio ? parseFloat(p.precio.toString()) : 0), 0)
            const montoPagado = c.ingreso || 0
            const saldoPendiente = montoTotal - montoPagado
            const isExpanded = expandedClienteId === c.id

            return (
              <div
                key={c.id}
                className={`bg-slate-900 border transition-all duration-200 rounded-xl overflow-hidden shadow-md ${isExpanded ? 'border-blue-500/50 ring-1 ring-blue-500/30' : 'border-slate-800 hover:border-slate-700'
                  }`}
              >
                {/* Cabecera / Ficha Resumen */}
                <div
                  onClick={() => setExpandedClienteId(isExpanded ? null : c.id)}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex-grow">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400 block mb-0.5">
                      {c.nombre_empresa || 'Empresa no especificada'}
                    </span>
                    <h3 className="text-base font-bold text-white leading-tight">
                      {c.nombre_cliente}
                    </h3>
                    {c.email && (
                      <span className="text-xs text-slate-550 block mt-1">
                        ✉️ {c.email}
                      </span>
                    )}
                  </div>

                  {/* Fichas de saldos */}
                  <div className="grid grid-cols-3 gap-4 md:gap-8 bg-slate-950/40 p-3 rounded-lg border border-slate-850/50">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-0.5">Total Pedidos</span>
                      <span className="text-xs md:text-sm font-bold text-white">{formatCurrency(montoTotal)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-0.5">Total Pagado</span>
                      <span className="text-xs md:text-sm font-bold text-emerald-400">{formatCurrency(montoPagado)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-0.5">Saldo Pendiente</span>
                      <span className={`text-xs md:text-sm font-bold ${saldoPendiente > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                        {formatCurrency(saldoPendiente)}
                      </span>
                    </div>
                  </div>

                  {/* Indicador de Despliegue */}
                  <div className="flex items-center justify-end md:justify-center w-6">
                    <span className={`text-slate-500 text-xs transition-transform duration-200 transform ${isExpanded ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </div>
                </div>

                {/* Listado Desplegable de Pedidos */}
                {isExpanded && (
                  <div className="border-t border-slate-800 bg-slate-950/30 p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                        Historial de Pedidos ({pds.length})
                      </h4>
                    </div>

                    {pds.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">Este cliente no registra pedidos asociados.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-slate-850 bg-slate-950/50">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider">
                              <th className="px-4 py-3">Código</th>
                              <th className="px-4 py-3">Estado</th>
                              <th className="px-4 py-3">Prioridad</th>
                              <th className="px-4 py-3">Fecha Entrega</th>
                              <th className="px-4 py-3 text-right">Monto Pedido</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850 text-slate-300">
                            {pds.map((p) => {
                              const priceVal = p.precio ? parseFloat(p.precio.toString()) : 0
                              return (
                                <tr key={p.id} className="hover:bg-slate-900/30">
                                  <td className="px-4 py-2.5 font-mono font-bold text-white">{p.codigo}</td>
                                  <td className="px-4 py-2.5 capitalize">{p.estado.replace('_', ' ')}</td>
                                  <td className="px-4 py-2.5 capitalize">{p.prioridad}</td>
                                  <td className="px-4 py-2.5">{p.fecha_entrega || 'No planificada'}</td>
                                  <td className="px-4 py-2.5 text-right font-semibold text-white">
                                    {formatCurrency(priceVal)}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
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
  )
}

export default function SaldosPage() {
  return (
    <RoleGuard allowedRoles={['vendedor']}>
      <SaldosContent />
    </RoleGuard>
  )
}

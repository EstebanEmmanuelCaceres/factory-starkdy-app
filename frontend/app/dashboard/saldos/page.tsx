'use client'

import { useEffect, useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import { fetchClientes, type Cliente } from '@/lib/clientes'

interface TransactionItem {
  key: string
  date: string
  type: 'pedido' | 'pago'
  refCode: string
  description: string
  amount: number
  paymentMethod?: string
  sellerName?: string
  notes?: string
}

function SaldosContent() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedClienteId, setExpandedClienteId] = useState<number | null>(null)

  // Modal de Historial Completo / Pagos Anteriores
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [selectedClienteForHistory, setSelectedClienteForHistory] = useState<Cliente | null>(null)

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

  const formatTransactionDate = (dateStr: string) => {
    if (!dateStr) return ''
    const isoStr = dateStr.includes(' ') && !dateStr.includes('T') ? dateStr.replace(' ', 'T') : dateStr
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('es-AR')
  }

  const getClientHistory = (cliente: Cliente): TransactionItem[] => {
    const items: TransactionItem[] = []
    
    const pds = cliente.pedidos || []
    pds.forEach(p => {
      // Abonos de los pagos
      const payments = p.pagos || []
      payments.forEach(pay => {
        if (pay.estado === 'pagado') {
          let rawDate = pay.fecha_pago || pay.created_at
          if (rawDate && rawDate.includes(' ') && !rawDate.includes('T')) {
            rawDate = rawDate.replace(' ', 'T')
          }
          items.push({
            key: `pago-${pay.id}`,
            date: rawDate || new Date().toISOString(),
            type: 'pago',
            refCode: p.codigo,
            description: `Cobro Registrado (${pay.tipo_cobro})`,
            amount: -Number(pay.monto),
            paymentMethod: pay.medio_pago || pay.medio,
            sellerName: pay.vendedor?.name || 'Sistema',
            notes: pay.observaciones || undefined
          })
        }
      })
    })

    // Ordenar por fecha descendente (más recientes primero)
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

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
            
            // Suma de cobros registrados
            const totalPagos = pds.reduce((sum, p) => {
              const payments = p.pagos || []
              const paidAmount = payments
                .filter(pay => pay.estado === 'pagado')
                .reduce((paySum, pay) => paySum + Number(pay.monto), 0)
              return sum + paidAmount
            }, 0)

            const montoPagado = Number(c.ingreso || 0) + totalPagos
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
                      <span className="text-xs text-slate-555 block mt-1">
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

                {/* Historial Desplegable de Saldos */}
                {isExpanded && (() => {
                  const history = getClientHistory(c)
                  const displayedHistory = history.slice(0, 5)
                  
                  return (
                    <div className="border-t border-slate-800 bg-slate-950/30 p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 text-left">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                          Últimos Movimientos del Saldo ({displayedHistory.length} de {history.length})
                        </h4>
                      </div>

                      {history.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">Este cliente no registra movimientos de pedidos o cobros.</p>
                      ) : (
                        <>
                          <div className="overflow-x-auto rounded-lg border border-slate-850 bg-slate-950/50">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider">
                                  <th className="px-4 py-3">Fecha</th>
                                  <th className="px-4 py-3">Tipo / Ref</th>
                                  <th className="px-4 py-3">Detalle</th>
                                  <th className="px-4 py-3">Medio / Registrador</th>
                                  <th className="px-4 py-3 text-right">Importe</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-850 text-slate-300">
                                {displayedHistory.map((item) => {
                                  const isCharge = item.type === 'pedido'
                                  return (
                                    <tr key={item.key} className="hover:bg-slate-900/30">
                                      <td className="px-4 py-2.5 font-mono text-slate-400">
                                        {formatTransactionDate(item.date)}
                                      </td>
                                      <td className="px-4 py-2.5">
                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                          isCharge 
                                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        }`}>
                                          {isCharge ? 'Cargo' : 'Cobro'}
                                        </span>
                                        <span className="ml-2 font-semibold text-slate-200">{item.refCode}</span>
                                      </td>
                                      <td className="px-4 py-2.5">
                                        <div className="font-medium text-slate-350">{item.description}</div>
                                        {item.notes && <div className="text-[10px] text-slate-500 italic mt-0.5">{item.notes}</div>}
                                      </td>
                                      <td className="px-4 py-2.5 text-slate-400">
                                        {!isCharge ? (
                                          <div>
                                            <span className="capitalize">{item.paymentMethod}</span>
                                            <span className="text-[10px] block text-slate-550">Por: {item.sellerName}</span>
                                          </div>
                                        ) : (
                                          <span className="text-slate-600">-</span>
                                        )}
                                      </td>
                                      <td className={`px-4 py-2.5 text-right font-bold font-mono ${isCharge ? 'text-slate-300' : 'text-emerald-400'}`}>
                                        {isCharge ? '+' : '-'} {formatCurrency(Math.abs(item.amount))}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                          
                          {history.length > 5 && (
                            <div className="flex justify-center pt-2">
                              <button
                                onClick={() => {
                                  setSelectedClienteForHistory(c)
                                  setIsHistoryModalOpen(true)
                                }}
                                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 font-semibold text-xs rounded-lg transition"
                              >
                                Ver historial completo / Pagos anteriores ➔
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Historial Completo / Pagos Anteriores */}
      {isHistoryModalOpen && selectedClienteForHistory && (() => {
        const history = getClientHistory(selectedClienteForHistory)
        const pds = selectedClienteForHistory.pedidos || []
        const totalPedidos = pds.reduce((sum, p) => sum + (p.precio ? parseFloat(p.precio.toString()) : 0), 0)
        
        // Suma de cobros registrados
        const totalPagos = pds.reduce((sum, p) => {
          const payments = p.pagos || []
          const paidAmount = payments
            .filter(pay => pay.estado === 'pagado')
            .reduce((paySum, pay) => paySum + Number(pay.monto), 0)
          return sum + paidAmount
        }, 0)

        const totalPagado = Number(selectedClienteForHistory.ingreso || 0) + totalPagos
        const saldoPendiente = totalPedidos - totalPagado
        
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition text-lg"
                title="Cerrar"
              >
                ✕
              </button>

              <span className="text-xs font-bold uppercase tracking-wider text-blue-400 block mb-0.5 text-left">
                {selectedClienteForHistory.nombre_empresa || 'Empresa no especificada'}
              </span>
              <h2 className="text-xl font-bold text-white mb-1 text-left">
                Historial de Saldos: {selectedClienteForHistory.nombre_cliente}
              </h2>
              <p className="text-xs text-slate-400 mb-5 text-left">
                Registro de cargos por pedidos y cobros históricos registrados.
              </p>

              {/* Fichas de saldos en el modal */}
              <div className="grid grid-cols-3 gap-4 p-4 rounded-xl border border-slate-800/80 bg-slate-950/40 mb-6 text-left">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Total Pedidos (Cargos)</span>
                  <span className="text-sm md:text-base font-bold text-white font-mono">{formatCurrency(totalPedidos)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-550 uppercase font-bold block mb-1">Total Cobrado (Abonos)</span>
                  <span className="text-sm md:text-base font-bold text-emerald-400 font-mono">{formatCurrency(totalPagado)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-550 uppercase font-bold block mb-1">Saldo Pendiente</span>
                  <span className={`text-sm md:text-base font-bold font-mono ${saldoPendiente > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                    {formatCurrency(saldoPendiente)}
                  </span>
                </div>
              </div>

              {/* Listado de Pagos Anteriores (Historial completo) */}
              <div className="space-y-3 text-left">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Historial de Transacciones</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/20 max-h-[40vh] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider font-bold">
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Tipo / Ref</th>
                        <th className="px-4 py-3">Detalle</th>
                        <th className="px-4 py-3">Medio de Pago / Registrador</th>
                        <th className="px-4 py-3 text-right">Importe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-slate-300">
                      {history.map((item) => {
                        const isCharge = item.type === 'pedido'
                        return (
                          <tr key={item.key} className="hover:bg-slate-900/30">
                            <td className="px-4 py-3 font-mono text-slate-400">
                              {formatTransactionDate(item.date)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                isCharge 
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {isCharge ? 'Cargo' : 'Cobro'}
                              </span>
                              <span className="ml-2 font-semibold text-slate-200">{item.refCode}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-350">{item.description}</div>
                              {item.notes && <div className="text-[10px] text-slate-500 italic mt-0.5">{item.notes}</div>}
                            </td>
                            <td className="px-4 py-3 text-slate-400">
                              {!isCharge ? (
                                <div>
                                  <span className="capitalize">{item.paymentMethod}</span>
                                  <span className="text-[10px] block text-slate-555">Por: {item.sellerName}</span>
                                </div>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                            <td className={`px-4 py-3 text-right font-bold font-mono ${isCharge ? 'text-slate-300' : 'text-emerald-400'}`}>
                              {isCharge ? '+' : '-'} {formatCurrency(Math.abs(item.amount))}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-end pt-4 border-t border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default function SaldosPage() {
  return (
    <RoleGuard allowedRoles={['vendedor', 'admin', 'encargado', 'supervisor']}>
      <SaldosContent />
    </RoleGuard>
  )
}

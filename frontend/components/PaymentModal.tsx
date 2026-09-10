'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/Modal'
import { getStoredUser, type User } from '@/lib/auth'
import {
  fetchPedidoPagos,
  createPedidoPago,
  deletePedidoPago,
  type Pedido,
  type Pago
} from '@/lib/pedidos'

interface PaymentModalProps {
  isOpen: boolean
  pedido: Pedido | null
  currentUser?: User | null
  onClose: () => void
  onPaymentUpdated?: (updatedPedido?: Pedido) => void
}

export default function PaymentModal({
  isOpen,
  pedido,
  currentUser: initialUser,
  onClose,
  onPaymentUpdated
}: PaymentModalProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(initialUser || null)
  const [currentPedido, setCurrentPedido] = useState<Pedido | null>(pedido)
  const [pedidoPayments, setPedidoPayments] = useState<Pago[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)

  const [paymentError, setPaymentError] = useState('')
  const [paymentSuccess, setPaymentSuccess] = useState('')
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)

  const [paymentFormData, setPaymentFormData] = useState({
    monto: '',
    medio_pago: 'efectivo',
    tipo_cobro: 'parcial' as 'seña' | 'parcial' | 'saldo' | 'unico',
    observaciones: '',
    fecha_pago: ''
  })

  useEffect(() => {
    if (!currentUser) {
      const user = getStoredUser()
      if (user) setCurrentUser(user)
    }
  }, [currentUser, initialUser])

  useEffect(() => {
    setCurrentPedido(pedido)
  }, [pedido])

  useEffect(() => {
    if (isOpen && currentPedido) {
      setPaymentError('')
      setPaymentSuccess('')

      const precio = Number(currentPedido.precio) || 0
      const currentPaid = currentPedido.pagos
        ? currentPedido.pagos.filter(p => p.estado === 'pagado').reduce((sum, p) => sum + Number(p.monto), 0)
        : (currentPedido.pago && currentPedido.pago.estado === 'pagado' ? Number(currentPedido.pago.monto) : 0)
      const saldo = Math.max(0, precio - currentPaid)

      setPaymentFormData({
        monto: saldo > 0 ? saldo.toString() : '',
        medio_pago: 'efectivo',
        tipo_cobro: 'parcial',
        observaciones: '',
        fecha_pago: new Date().toISOString().split('T')[0]
      })

      setLoadingPayments(true)
      fetchPedidoPagos(currentPedido.id)
        .then(pagos => {
          setPedidoPayments(pagos)
        })
        .catch(err => {
          console.error('Error fetching payments:', err)
          setPedidoPayments(currentPedido.pagos || (currentPedido.pago ? [currentPedido.pago] : []))
        })
        .finally(() => {
          setLoadingPayments(false)
        })
    }
  }, [isOpen, currentPedido?.id])

  if (!isOpen || !currentPedido) return null

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPedido) return
    setPaymentError('')
    setPaymentSuccess('')
    setIsSubmittingPayment(true)

    const monto = parseFloat(paymentFormData.monto)
    if (isNaN(monto) || monto <= 0) {
      setPaymentError('Por favor ingrese un monto válido mayor a 0.')
      setIsSubmittingPayment(false)
      return
    }

    try {
      const res = await createPedidoPago(currentPedido.id, {
        monto,
        medio_pago: paymentFormData.medio_pago,
        tipo_cobro: paymentFormData.tipo_cobro,
        observaciones: paymentFormData.observaciones || undefined,
        fecha_pago: paymentFormData.fecha_pago || undefined
      })

      setPaymentSuccess(res.message || 'Pago registrado con éxito.')

      const updatedPagos = await fetchPedidoPagos(currentPedido.id)
      setPedidoPayments(updatedPagos)

      const updatedPedido = res.pedido
      setCurrentPedido(updatedPedido)

      const precio = Number(updatedPedido.precio) || 0
      const currentPaid = updatedPedido.pagos
        ? updatedPedido.pagos.filter(p => p.estado === 'pagado').reduce((sum, p) => sum + Number(p.monto), 0)
        : (updatedPedido.pago && updatedPedido.pago.estado === 'pagado' ? Number(updatedPedido.pago.monto) : 0)
      const newSaldo = Math.max(0, precio - currentPaid)

      setPaymentFormData({
        monto: newSaldo > 0 ? newSaldo.toString() : '',
        medio_pago: 'efectivo',
        tipo_cobro: 'parcial',
        observaciones: '',
        fecha_pago: new Date().toISOString().split('T')[0]
      })

      if (onPaymentUpdated) {
        onPaymentUpdated(updatedPedido)
      }
    } catch (err: any) {
      setPaymentError(err instanceof Error ? err.message : 'Error al registrar el pago.')
    } finally {
      setIsSubmittingPayment(false)
    }
  }

  const handleAnnulPayment = async (pagoId: number) => {
    if (!confirm('¿Estás seguro de que deseas anular este pago? Esta acción no se puede deshacer.')) return
    setPaymentError('')
    setPaymentSuccess('')

    try {
      const res = await deletePedidoPago(pagoId)
      setPaymentSuccess('Pago anulado con éxito.')

      if (currentPedido) {
        const updatedPagos = await fetchPedidoPagos(currentPedido.id)
        setPedidoPayments(updatedPagos)

        const updatedPedido = res.pedido
        setCurrentPedido(updatedPedido)
        const precio = Number(updatedPedido.precio) || 0
        const currentPaid = updatedPedido.pagos
          ? updatedPedido.pagos.filter(p => p.estado === 'pagado').reduce((sum, p) => sum + Number(p.monto), 0)
          : (updatedPedido.pago && updatedPedido.pago.estado === 'pagado' ? Number(updatedPedido.pago.monto) : 0)
        const newSaldo = Math.max(0, precio - currentPaid)

        setPaymentFormData(prev => ({
          ...prev,
          monto: newSaldo > 0 ? newSaldo.toString() : ''
        }))

        if (onPaymentUpdated) {
          onPaymentUpdated(updatedPedido)
        }
      }
    } catch (err: any) {
      setPaymentError(err instanceof Error ? err.message : 'Error al anular el pago.')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-4xl p-6"
    >
      <h2 className="text-xl font-bold text-white mb-1">
        Gestión de Pagos: Pedido #{currentPedido.id}
      </h2>
      <p className="text-xs text-slate-400 mb-5">
        Cliente: <span className="font-semibold text-slate-200">{currentPedido.cliente?.nombre_cliente} ({currentPedido.cliente?.nombre_empresa})</span>
      </p>

      {paymentError && (
        <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 p-3 rounded-lg text-xs font-semibold">
          ⚠️ {paymentError}
        </div>
      )}
      {paymentSuccess && (
        <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-3 rounded-lg text-xs font-semibold">
          ✓ {paymentSuccess}
        </div>
      )}

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Lado Izquierdo: Resumen y Listado de Pagos */}
        <div className="lg:col-span-7 space-y-5 text-left">

          {/* Resumen Financiero */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/60 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Resumen de Cobros</h3>
            <div className="grid grid-cols-3 gap-2 text-center sm:text-left">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Pedido</span>
                <span className="text-sm font-bold text-white font-mono">
                  $ {Number(currentPedido.precio || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Cobrado</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  $ {Number(currentPedido.monto_pagado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Saldo Pendiente</span>
                <span className="text-sm font-bold text-amber-500 font-mono">
                  $ {Number(currentPedido.saldo_pendiente || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                <span>Progreso de cobro</span>
                <span>{currentPedido.porcentaje_pagado || 0}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-350 ${(currentPedido.porcentaje_pagado || 0) <= 10
                    ? 'bg-rose-500'
                    : (currentPedido.porcentaje_pagado || 0) <= 50
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                    }`}
                  style={{ width: `${Math.min(100, currentPedido.porcentaje_pagado || 0)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Listado / Historial de Pagos */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Historial de Transacciones</h3>
            {loadingPayments ? (
              <div className="py-6 text-center text-xs text-slate-400">Cargando transacciones...</div>
            ) : pedidoPayments.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4 text-center bg-slate-950/20 rounded-lg border border-slate-850">
                No hay cobros registrados para este pedido.
              </p>
            ) : (
              <div className="max-h-[220px] overflow-y-auto border border-slate-800/80 rounded-lg divide-y divide-slate-850">
                {pedidoPayments.map((pago) => (
                  <div
                    key={pago.id}
                    className={`p-3 text-xs flex justify-between items-center transition ${pago.estado === 'anulado' ? 'bg-slate-950/20 opacity-50' : 'bg-slate-900/40 hover:bg-slate-950/20'
                      }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white">
                          $ {Number(pago.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[9px] px-1 rounded bg-slate-850 border border-slate-800 text-slate-300 font-semibold uppercase">
                          {pago.medio_pago || pago.medio}
                        </span>
                        {pago.estado === 'anulado' ? (
                          <span className="text-[8px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1 rounded">ANULADO</span>
                        ) : (
                          <span className="text-[8px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 rounded">{pago.tipo_cobro}</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-2">
                        <span>Fecha: {pago.fecha_pago ? new Date(pago.fecha_pago + 'T00:00:00').toLocaleDateString('es-AR') : new Date(pago.created_at).toLocaleDateString('es-AR')}</span>
                        <span>•</span>
                        <span>Por: {pago.vendedor?.name || 'Sistema'}</span>
                      </div>
                      {pago.observaciones && (
                        <p className="text-[10px] text-slate-400 italic mt-0.5">Nota: &quot;{pago.observaciones}&quot;</p>
                      )}
                    </div>

                    {/* Botón para anular pago */}
                    {pago.estado !== 'anulado' && currentUser && ['admin', 'encargado', 'vendedor', 'disenadora'].includes(currentUser.role) && (
                      <button
                        onClick={() => handleAnnulPayment(pago.id)}
                        className="text-[10px] text-rose-400 hover:text-rose-300 font-bold hover:bg-rose-500/10 px-2 py-1 rounded transition"
                        title="Anular Cobro"
                      >
                        Anular
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Lado Derecho: Registrar Nuevo Pago */}
        <div className="lg:col-span-5 bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-left">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">Registrar Nuevo Cobro</h3>

          {(currentPedido.saldo_pendiente ?? 0) <= 0 ? (
            <div className="text-xs text-slate-500 italic py-8 text-center">
              🎉 Este pedido se encuentra **completamente cobrado**. Saldo pendiente: $0.00.
            </div>
          ) : (
            <form onSubmit={handleCreatePayment} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Monto a Cobrar ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  max={currentPedido.saldo_pendiente ?? 0}
                  value={paymentFormData.monto}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, monto: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                  placeholder="Ej. 500"
                />
                <span className="text-[9px] text-slate-500 block mt-0.5">Máximo disponible: ${currentPedido.saldo_pendiente ?? 0}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Medio de Pago *
                  </label>
                  <select
                    value={paymentFormData.medio_pago}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, medio_pago: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                  >
                    <option value="efectivo">💵 Efectivo</option>
                    <option value="transferencia">🏦 Transferencia</option>
                    <option value="tarjeta">💳 Tarjeta</option>
                    <option value="mercado_pago">📱 Mercado Pago</option>
                    <option value="otro">⚙️ Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Tipo de Cobro *
                  </label>
                  <select
                    value={paymentFormData.tipo_cobro}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, tipo_cobro: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                  >
                    <option value="parcial">Abono Parcial</option>
                    <option value="seña">Seña / Adelanto</option>
                    <option value="saldo">Saldo Final</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Fecha de Pago
                </label>
                <input
                  type="date"
                  value={paymentFormData.fecha_pago}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, fecha_pago: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Observaciones / Notas <span className="text-slate-500 font-normal lowercase">(opcional)</span>
                </label>
                <textarea
                  rows={2}
                  value={paymentFormData.observaciones}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, observaciones: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition resize-none"
                  placeholder="Detalles de la transferencia, banco, etc. (opcional)"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingPayment}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmittingPayment ? 'Registrando...' : 'Registrar Cobro'}
              </button>
            </form>
          )}
        </div>

      </div>

      <div className="flex items-center justify-end pt-4 border-t border-slate-800 mt-5">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          Cerrar
        </button>
      </div>
    </Modal>
  )
}

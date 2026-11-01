'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/Modal/Modal'
import { useModal } from '@/components/Modal/context/ModalContext'
import { cancelCobro, type CobroDetail, type CobroListItem } from '@/lib/cobros'
import { COBRO_CANCEL_MODAL_ID } from './modalIds'
import { formatMoney, inputClass, labelClass } from './format'

interface CobroCancelModalProps {
  // Se puede abrir desde la lista o desde el detalle: solo usa id, monto y código del pedido
  cobro: Pick<CobroListItem, 'id' | 'monto' | 'pedido'> | null
  onCancelled: (cobro: CobroDetail) => void
}

export const CobroCancelModal = ({ cobro, onCancelled }: CobroCancelModalProps) => {
  const { isOpen, close } = useModal(COBRO_CANCEL_MODAL_ID)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Cada vez que se abre, arranca limpio
  useEffect(() => {
    if (!isOpen) return
    setMotivo('')
    setError('')
  }, [isOpen])

  const handleConfirm = async () => {
    if (!cobro) return
    setSubmitting(true)
    setError('')
    try {
      onCancelled(await cancelCobro(cobro.id, motivo.trim()))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cancelar el cobro')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal id={COBRO_CANCEL_MODAL_ID} className="!max-w-md !overflow-y-auto">
      {cobro && (
        <div className="space-y-4">
          <div className="pr-10">
            <h2 className="text-xl font-bold text-white">Cancelar cobro #{cobro.id}</h2>
            <p className="mt-1 text-sm text-slate-400">
              Se anulará el cobro de <span className="font-semibold text-slate-200">{formatMoney(cobro.monto)}</span> del pedido{' '}
              <span className="font-semibold text-slate-200">{cobro.pedido?.codigo}</span>. El monto vuelve a sumar al saldo pendiente.
              El cobro no se borra: queda registrado como anulado.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">{error}</div>
          )}

          <div>
            <label className={labelClass}>Motivo (opcional)</label>
            <textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={`${inputClass} resize-y`} placeholder="Ej: cargado por error" />
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
            <button type="button" onClick={close} className="rounded-xl px-4 py-2 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-white cursor-pointer">
              Volver
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Cancelando...' : 'Cancelar cobro'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

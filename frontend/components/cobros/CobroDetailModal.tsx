'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/Modal/Modal'
import { useModal } from '@/components/Modal/context/ModalContext'
import { getCobro, type CobroDetail } from '@/lib/cobros'
import { CobroEstadoBadge } from './CobroEstadoBadge'
import { ComprobanteLink } from './ComprobanteLink'
import { COBRO_DETAIL_MODAL_ID } from './modalIds'
import { formatFechaCobro, formatMoney, medioPagoLabel, tipoCobroLabel } from './format'

interface CobroDetailModalProps {
  cobroId: number | null
  // Cambia cuando el cobro se editó o canceló, para volver a pedirlo
  refreshKey: number
  onEdit: (cobro: CobroDetail) => void
  onCancel: (cobro: CobroDetail) => void
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-4 py-2.5">
    <dt className="text-sm text-slate-400">{label}</dt>
    <dd className="text-right text-sm font-medium text-slate-200">{children}</dd>
  </div>
)

export const CobroDetailModal = ({ cobroId, refreshKey, onEdit, onCancel }: CobroDetailModalProps) => {
  const { isOpen } = useModal(COBRO_DETAIL_MODAL_ID)
  const [cobro, setCobro] = useState<CobroDetail | null>(null)
  const [error, setError] = useState('')

  // Se pide el cobro al back (GET /admin/cobros/{id}) para mostrar los datos actualizados
  useEffect(() => {
    if (!isOpen || cobroId === null) return
    setError('')
    getCobro(cobroId)
      .then(setCobro)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error al cargar el cobro'))
  }, [isOpen, cobroId, refreshKey])

  // Al cerrar se limpia, para no mostrar el cobro anterior mientras carga el siguiente
  useEffect(() => {
    if (!isOpen) setCobro(null)
  }, [isOpen])

  const anulado = cobro?.estado === 'anulado'

  return (
    <Modal
      id={COBRO_DETAIL_MODAL_ID}
      className="!max-w-lg !overflow-y-auto"
      loading={!cobro && !error}
      loadingText="Cargando cobro..."
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 pr-10">
          <h2 className="text-xl font-bold text-white">Cobro #{cobroId}</h2>
          {cobro && <CobroEstadoBadge estado={cobro.estado} />}
        </div>

        {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">{error}</div>}

        {cobro && (
          <>
            <p className={`text-3xl font-bold tabular-nums ${anulado ? 'text-slate-500 line-through' : 'text-emerald-400'}`}>
              {formatMoney(cobro.monto)}
            </p>

            <dl className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/40 px-4">
              <Row label="Pedido">
                {cobro.pedido?.codigo ?? '—'}
                {cobro.pedido && <span className="block text-xs text-slate-500">Total {formatMoney(cobro.pedido.precio)}</span>}
              </Row>
              {cobro.cliente?.nombre_empresa && <Row label="Empresa">{cobro.cliente.nombre_empresa}</Row>}
              <Row label="Cliente">{cobro.cliente?.nombre_cliente || cobro.cliente?.nombre_empresa || '—'}</Row>
              <Row label="Fecha de cobro">{formatFechaCobro(cobro.fecha_pago)}</Row>
              <Row label="Medio de pago">{medioPagoLabel(cobro.medio_pago)}</Row>
              <Row label="Tipo">{tipoCobroLabel(cobro.tipo_cobro)}</Row>
              <Row label="Vendedor">{cobro.vendedor?.name ?? '—'}</Row>
              <Row label="Registrado por">{cobro.registrado_por ?? '—'}</Row>
              {cobro.referencia_externa && <Row label="Referencia">{cobro.referencia_externa}</Row>}
              {cobro.comprobante_url && (
                <Row label="Comprobante">
                  <ComprobanteLink url={cobro.comprobante_url} className="text-blue-400 hover:underline">Ver</ComprobanteLink>
                </Row>
              )}
            </dl>

            {cobro.observaciones && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Observaciones</p>
                <p className="whitespace-pre-line text-sm text-slate-300">{cobro.observaciones}</p>
              </div>
            )}

            {!anulado && (
              <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
                <button type="button" onClick={() => onCancel(cobro)} className="rounded-xl px-4 py-2 text-sm font-semibold text-rose-400 transition hover:bg-rose-500/10 cursor-pointer">
                  Cancelar cobro
                </button>
                <button type="button" onClick={() => onEdit(cobro)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 cursor-pointer">
                  Editar
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

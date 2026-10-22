'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/Modal/Modal'
import { useModal } from '@/components/Modal/context/ModalContext'
import type { User } from '@/lib/auth'
import type { Pedido } from '@/lib/pedidos'
import { createCobro, updateCobro, MEDIOS_PAGO, TIPOS_COBRO, type CobroDetail, type TipoCobro } from '@/lib/cobros'
import { PedidoPicker } from './PedidoPicker'
import { COBRO_FORM_MODAL_ID } from './modalIds'
import { formatClienteLabel, formatMoney, inputClass, labelClass, toDateInput, todayInput } from './format'

interface CobroFormValues {
  pedido: Pedido | null
  monto: string
  medio_pago: string
  tipo_cobro: TipoCobro
  fecha_pago: string
  vendedor_id: string
  observaciones: string
  referencia_externa: string
}

type FormErrors = Partial<Record<'pedido' | 'monto' | 'fecha_pago', string>>

interface CobroFormModalProps {
  // Si viene un cobro (con su detalle), el modal edita; si no, crea uno nuevo
  cobro: CobroDetail | null
  vendedores: User[]
  onSaved: (cobro: CobroDetail) => void
}

const getDefaults = (cobro: CobroDetail | null): CobroFormValues => ({
  pedido: null,
  monto: cobro ? String(cobro.monto) : '',
  medio_pago: cobro?.medio_pago ?? 'efectivo',
  tipo_cobro: cobro?.tipo_cobro ?? 'parcial',
  fecha_pago: cobro ? toDateInput(cobro.fecha_pago) : todayInput(),
  vendedor_id: cobro?.vendedor?.id ? String(cobro.vendedor.id) : '',
  observaciones: cobro?.observaciones ?? '',
  referencia_externa: cobro?.referencia_externa ?? '',
})

export const CobroFormModal = ({ cobro, vendedores, onSaved }: CobroFormModalProps) => {
  const { isOpen, close } = useModal(COBRO_FORM_MODAL_ID)
  const [values, setValues] = useState<CobroFormValues>(() => getDefaults(cobro))
  const [errors, setErrors] = useState<FormErrors>({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const saldoPedido = Number(values.pedido?.saldo_pendiente) || 0

  // Cada vez que se abre, se carga el cobro a editar (o el form vacío)
  useEffect(() => {
    if (!isOpen) return
    setValues(getDefaults(cobro))
    setErrors({})
    setError('')
  }, [isOpen, cobro])

  const setField = <K extends keyof CobroFormValues>(key: K, value: CobroFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  // Al elegir pedido, el vendedor por defecto es el del pedido
  const selectPedido = (pedido: Pedido | null) => {
    setValues((prev) => ({ ...prev, pedido, vendedor_id: pedido?.user_id ? String(pedido.user_id) : '' }))
    setErrors((prev) => ({ ...prev, pedido: undefined }))
  }

  const validate = (): FormErrors => {
    const result: FormErrors = {}
    const monto = Number(values.monto)
    if (!cobro && !values.pedido) result.pedido = 'Elegí el pedido al que corresponde el cobro'
    if (!values.monto || monto <= 0) result.monto = 'El monto debe ser mayor a 0'
    else if (!cobro && values.pedido && monto > saldoPedido) result.monto = `No puede superar el saldo (${formatMoney(saldoPedido)})`
    if (!values.fecha_pago) result.fecha_pago = 'Elegí la fecha'
    return result
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validation = validate()
    setErrors(validation)
    if (Object.values(validation).some(Boolean)) return

    setSubmitting(true)
    setError('')
    const common = {
      monto: Number(values.monto),
      medio_pago: values.medio_pago,
      tipo_cobro: values.tipo_cobro,
      fecha_pago: values.fecha_pago,
      vendedor_id: values.vendedor_id ? Number(values.vendedor_id) : null,
      observaciones: values.observaciones.trim() || null,
      referencia_externa: values.referencia_externa.trim() || null,
    }
    try {
      const saved = cobro
        ? await updateCobro(cobro.id, common)
        : await createCobro({ ...common, pedido_id: values.pedido!.id })
      onSaved(saved)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar el cobro')
    } finally {
      setSubmitting(false)
    }
  }

  // Medios fuera de la lista (datos viejos) se agregan para no perder el valor al editar
  const medios = !values.medio_pago || MEDIOS_PAGO.some((m) => m.value === values.medio_pago)
    ? MEDIOS_PAGO
    : [...MEDIOS_PAGO, { value: values.medio_pago, label: values.medio_pago }]

  return (
    <Modal id={COBRO_FORM_MODAL_ID} className="!max-w-xl !overflow-y-auto">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="pr-10">
          <h2 className="text-xl font-bold text-white">{cobro ? `Editar cobro #${cobro.id}` : 'Registrar cobro'}</h2>
          {cobro?.pedido && (
            <p className="mt-1 text-sm text-slate-400">
              Pedido {cobro.pedido.codigo} · {formatClienteLabel(cobro.cliente)}
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">{error}</div>
        )}

        {!cobro && (
          <div>
            <label className={labelClass}>Pedido *</label>
            <PedidoPicker value={values.pedido} onChange={selectPedido} />
            {errors.pedido && <p className="mt-1 text-xs text-rose-400">{errors.pedido}</p>}
          </div>
        )}

        <div>
          <label className={labelClass}>Monto *</label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              value={values.monto}
              onChange={(e) => setField('monto', e.target.value)}
              className={inputClass}
            />
            {!cobro && values.pedido && saldoPedido > 0 && (
              <button
                type="button"
                onClick={() => setField('monto', String(saldoPedido))}
                className="shrink-0 rounded-xl border border-slate-800 px-3 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Saldo total
              </button>
            )}
          </div>
          {errors.monto && <p className="mt-1 text-xs text-rose-400">{errors.monto}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Medio de pago *</label>
            <select value={values.medio_pago} onChange={(e) => setField('medio_pago', e.target.value)} className={inputClass}>
              {medios.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Tipo de cobro *</label>
            <select value={values.tipo_cobro} onChange={(e) => setField('tipo_cobro', e.target.value as TipoCobro)} className={inputClass}>
              {TIPOS_COBRO.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Fecha de cobro *</label>
            <input type="date" value={values.fecha_pago} onChange={(e) => setField('fecha_pago', e.target.value)} className={inputClass} />
            {errors.fecha_pago && <p className="mt-1 text-xs text-rose-400">{errors.fecha_pago}</p>}
          </div>
          <div>
            <label className={labelClass}>Vendedor</label>
            <select value={values.vendedor_id} onChange={(e) => setField('vendedor_id', e.target.value)} className={inputClass}>
              <option value="">— Vendedor del pedido —</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Referencia</label>
          <input
            type="text"
            placeholder="N° de transferencia, comprobante..."
            value={values.referencia_externa}
            onChange={(e) => setField('referencia_externa', e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Observaciones</label>
          <textarea rows={2} value={values.observaciones} onChange={(e) => setField('observaciones', e.target.value)} className={`${inputClass} resize-y`} />
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
          <button type="button" onClick={close} className="rounded-xl px-4 py-2 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-white cursor-pointer">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? 'Guardando...' : cobro ? 'Guardar cambios' : 'Registrar cobro'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

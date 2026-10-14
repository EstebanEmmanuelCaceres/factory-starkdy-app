'use client'

import React, { useEffect, useState } from 'react'
import { Modal } from '@/components/Modal/Modal'
import { useModal } from '@/components/Modal/context/ModalContext'
import Field from '@/components/Field'
import { getCliente, type Cliente } from '@/lib/clientes'

export const CLIENT_DETAIL_MODAL_ID = 'cliente-detail'

interface CampoCliente {
  key: keyof Cliente
  label: string
  vacio?: string
  disabled?: boolean
  multiline?: boolean
  fullWidth?: boolean
}

const CAMPOS: CampoCliente[] = [
  { key: 'nombre_cliente', label: 'Nombre del Cliente' },
  { key: 'nombre_empresa', label: 'Nombre de la Empresa' },
  { key: 'telefono', label: 'Teléfono', vacio: 'No especificado' },
  { key: 'email', label: 'Correo Electrónico', vacio: 'No especificado' },
  { key: 'dni', label: 'DNI', vacio: 'No especificado' },
  { key: 'localidad', label: 'Localidad', vacio: 'No especificado' },
  { key: 'provincia', label: 'Provincia', vacio: 'No especificado' },
  { key: 'cp', label: 'Código Postal (CP)', vacio: 'No especificado' },
  { key: 'direccion', label: 'Dirección', vacio: 'No especificada', fullWidth: true },
]

interface ClientDetailModalProps {
  clienteId: number | null
}

export default function ClientDetailModal({ clienteId }: ClientDetailModalProps) {
  const { isOpen } = useModal(CLIENT_DETAIL_MODAL_ID)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen || !clienteId) return

    let cancelado = false
    setLoading(true)
    setError('')
    setCliente(null)

    getCliente(clienteId)
      .then((data) => {
        if (!cancelado) setCliente(data)
      })
      .catch(() => {
        if (!cancelado) setError('No se pudo cargar la información del cliente')
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })

    return () => {
      cancelado = true
    }
  }, [isOpen, clienteId])

  if (!clienteId) return null

  return (
    <Modal id={CLIENT_DETAIL_MODAL_ID} loading={loading} loadingText="Cargando cliente...">
      {error ? (
        <p className="text-rose-400 text-center py-10">{error}</p>
      ) : cliente && (
        <div className="text-slate-300 text-left">
          <h2 className="text-xl font-bold text-white mb-4">Detalles Completos del Cliente</h2>

          <div className="grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
            {CAMPOS.map((campo) => (
              <Field
                key={campo.key}
                label={campo.label}
                value={String(cliente[campo.key] ?? '') || campo.vacio || ''}
                disabled={campo.disabled ?? true}
                multiline={campo.multiline}
                className={campo.fullWidth ? 'col-span-2' : 'col-span-1'}
              />
            ))}

            {/* Estado de Crédito / Límite */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Estado de Crédito / Límite
              </label>
              {Number(cliente.saldo || 0) <= 0 ? (
                <div className="w-full bg-slate-950/50 border border-slate-850 rounded-lg px-3.5 py-2 text-sm font-bold text-slate-400 flex items-center justify-between opacity-80 select-none">
                  <span>Monto Límite: Sin Límite ($0.00)</span>
                  <span className="text-xs text-emerald-400 font-normal">♾️ Sin Restricción</span>
                </div>
              ) : (
                <div className="bg-slate-950/50 border border-slate-850 rounded-lg p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Límite Asignado:</span>
                    <span className="font-bold text-white">${Number(cliente.saldo || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Total en Pedidos:</span>
                    <span className="font-bold text-amber-400">${Number(cliente.total_pedidos || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-800 pt-1.5">
                    <span className="font-semibold text-slate-400">Crédito Disponible:</span>
                    <span className={`font-bold ${cliente.alcanzo_limite ? 'text-rose-400' : 'text-emerald-400'}`}>
                      ${Number(cliente.saldo_disponible || 0).toFixed(2)}
                    </span>
                  </div>
                  {cliente.alcanzo_limite && (
                    <div className="mt-1 bg-rose-500/10 border border-rose-500/20 p-2 rounded text-[11px] text-rose-300 font-bold text-center">
                      🚨 Límite Alcanzado (Consumido: ${Number(cliente.total_pedidos || 0).toFixed(2)} / Límite: ${Number(cliente.saldo || 0).toFixed(2)})
                    </div>
                  )}
                </div>
              )}
            </div>

            <Field
              label="Observaciones"
              value={cliente.observaciones || 'Sin observaciones'}
              multiline
              className="col-span-2"
            />
          </div>
        </div>
      )}
    </Modal>
  )
}

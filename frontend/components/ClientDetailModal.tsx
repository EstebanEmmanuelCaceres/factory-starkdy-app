'use client'

import React, { useEffect, useState } from 'react'
import { Modal } from '@/components/Modal/Modal'
import { useModal } from '@/components/Modal/context/ModalContext'
import Field from '@/components/Field'
import { getCliente, updateCliente, type Cliente, type UpdateClienteInput } from '@/lib/clientes'

export const CLIENT_DETAIL_MODAL_ID = 'cliente-detail'

type CampoEditableKey =
  | 'nombre_cliente'
  | 'nombre_empresa'
  | 'telefono'
  | 'email'
  | 'dni'
  | 'localidad'
  | 'provincia'
  | 'cp'
  | 'direccion'

interface CampoCliente {
  key: CampoEditableKey
  label: string
  vacio?: string
  type?: 'text' | 'email'
  required?: boolean
  placeholder?: string
  fullWidth?: boolean
}

const CAMPOS: CampoCliente[] = [
  { key: 'nombre_cliente', label: 'Nombre del Cliente', required: true },
  { key: 'nombre_empresa', label: 'Nombre de la Empresa', required: true },
  { key: 'telefono', label: 'Teléfono', vacio: 'No especificado', required: true },
  { key: 'email', label: 'Correo Electrónico', vacio: 'No especificado', type: 'email' },
  { key: 'dni', label: 'DNI', vacio: 'No especificado', placeholder: 'Ej. 12345678' },
  { key: 'localidad', label: 'Localidad', vacio: 'No especificado' },
  { key: 'provincia', label: 'Provincia', vacio: 'No especificado' },
  { key: 'cp', label: 'Código Postal (CP)', vacio: 'No especificado' },
  { key: 'direccion', label: 'Dirección', vacio: 'No especificada', fullWidth: true },
]

interface ClientFormState {
  nombre_cliente: string
  nombre_empresa: string
  telefono: string
  email: string
  dni: string
  localidad: string
  provincia: string
  cp: string
  direccion: string
  saldo: string
  observaciones: string
}

function clienteToFormState(cliente: Cliente): ClientFormState {
  return {
    nombre_cliente: cliente.nombre_cliente || '',
    nombre_empresa: cliente.nombre_empresa || '',
    telefono: cliente.telefono || '',
    email: cliente.email || '',
    dni: cliente.dni || '',
    localidad: cliente.localidad || '',
    provincia: cliente.provincia || '',
    cp: cliente.cp || '',
    direccion: cliente.direccion || '',
    saldo: String(cliente.saldo ?? 0),
    observaciones: cliente.observaciones || '',
  }
}

interface ClientDetailModalProps {
  clienteId: number | null
  canEdit?: boolean
  onClientUpdated?: (cliente: Cliente) => void
}

export default function ClientDetailModal({
  clienteId,
  canEdit = true,
  onClientUpdated,
}: ClientDetailModalProps) {
  const { isOpen } = useModal(CLIENT_DETAIL_MODAL_ID)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<ClientFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false)
      setSaveError('')
      setSuccessMessage('')
      setSaving(false)
      return
    }
    if (!clienteId) return

    let cancelado = false
    setLoading(true)
    setError('')
    setSaveError('')
    setSuccessMessage('')
    setIsEditing(false)
    setCliente(null)
    setFormData(null)

    getCliente(clienteId)
      .then((data) => {
        if (!cancelado) {
          setCliente(data)
          setFormData(clienteToFormState(data))
        }
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

  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => setSuccessMessage(''), 3000)
    return () => clearTimeout(timer)
  }, [successMessage])

  if (!clienteId) return null

  const handleStartEdit = () => {
    if (!cliente) return
    setFormData(clienteToFormState(cliente))
    setSaveError('')
    setSuccessMessage('')
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    if (cliente) setFormData(clienteToFormState(cliente))
    setSaveError('')
    setIsEditing(false)
  }

  const handleFieldChange = (key: keyof ClientFormState, value: string) => {
    setFormData((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cliente || !formData || saving) return

    const nombreCliente = formData.nombre_cliente.trim()
    const nombreEmpresa = formData.nombre_empresa.trim()
    const telefono = formData.telefono.trim()

    if (!nombreCliente || !nombreEmpresa || !telefono) {
      setSaveError('Nombre del cliente, nombre de la empresa y teléfono son obligatorios.')
      return
    }

    const emailValue = formData.email.trim() || null
    const dniValue = formData.dni.trim() || null
    const localidadValue = formData.localidad.trim() || null
    const provinciaValue = formData.provincia.trim() || null
    const cpValue = formData.cp.trim() || null
    const direccionValue = formData.direccion.trim() || null
    const observacionesValue = formData.observaciones.trim() || null
    const parsedSaldo = formData.saldo.trim() === '' ? 0 : Number(formData.saldo)

    if (Number.isNaN(parsedSaldo) || parsedSaldo < 0) {
      setSaveError('El límite de crédito debe ser un número válido mayor o igual a 0.')
      return
    }

    const payload: UpdateClienteInput = {}
    if (nombreCliente !== (cliente.nombre_cliente || '')) payload.nombre_cliente = nombreCliente
    if (nombreEmpresa !== (cliente.nombre_empresa || '')) payload.nombre_empresa = nombreEmpresa
    if (telefono !== (cliente.telefono || '')) payload.telefono = telefono
    if (emailValue !== (cliente.email || null)) payload.email = emailValue
    if (dniValue !== (cliente.dni || null)) payload.dni = dniValue
    if (localidadValue !== (cliente.localidad || null)) payload.localidad = localidadValue
    if (provinciaValue !== (cliente.provincia || null)) payload.provincia = provinciaValue
    if (cpValue !== (cliente.cp || null)) payload.cp = cpValue
    if (direccionValue !== (cliente.direccion || null)) payload.direccion = direccionValue
    if (observacionesValue !== (cliente.observaciones || null)) payload.observaciones = observacionesValue
    if (parsedSaldo !== Number(cliente.saldo ?? 0)) payload.saldo = parsedSaldo

    if (Object.keys(payload).length === 0) {
      setIsEditing(false)
      return
    }

    try {
      setSaving(true)
      setSaveError('')
      const updated = await updateCliente(cliente.id, payload)
      setCliente(updated)
      setFormData(clienteToFormState(updated))
      setIsEditing(false)
      setSuccessMessage('Datos del cliente actualizados correctamente')
      onClientUpdated?.(updated)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Error al actualizar el cliente')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal id={CLIENT_DETAIL_MODAL_ID} loading={loading} loadingText="Cargando cliente..." className="max-w-xl">
      {error ? (
        <p className="text-rose-400 text-center py-10">{error}</p>
      ) : cliente && formData && (
        <form onSubmit={handleSubmit} className="text-slate-300 text-left">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pr-10">
            <h2 className="text-xl font-bold text-white">
              {isEditing ? 'Editar Cliente' : 'Detalles Completos del Cliente'}
            </h2>
            {canEdit && !isEditing && (
              <button
                type="button"
                onClick={handleStartEdit}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/50 text-blue-300 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
              >
                <span>✏️</span>
                <span>Editar</span>
              </button>
            )}
          </div>

          {successMessage && (
            <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-3.5 py-2 rounded-xl text-xs font-semibold text-center animate-in fade-in">
              ✓ {successMessage}
            </div>
          )}

          {saveError && (
            <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 px-3.5 py-2 rounded-xl text-xs font-semibold text-center animate-in fade-in">
              ⚠️ {saveError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto pr-1">
            {CAMPOS.map((campo) => (
              <Field
                key={campo.key}
                label={campo.label}
                type={campo.type}
                required={campo.required}
                placeholder={campo.placeholder}
                value={
                  isEditing
                    ? formData[campo.key]
                    : String(cliente[campo.key] ?? '') || campo.vacio || ''
                }
                disabled={!isEditing || saving}
                onChange={(val) => handleFieldChange(campo.key, val)}
                className={campo.fullWidth ? 'sm:col-span-2' : 'col-span-1'}
              />
            ))}

            {/* Estado de Crédito / Límite */}
            <div className="sm:col-span-2">
              {isEditing ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Límite de Crédito / Saldo ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={saving}
                    value={formData.saldo}
                    onChange={(e) => handleFieldChange('saldo', e.target.value)}
                    placeholder="0.00 (Dejar en 0 o vacío para Sin Límite)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition disabled:opacity-60"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Si es 0 o vacío, el cliente operará sin límite. Si es mayor a 0, se aplicará como tope máximo de crédito.
                  </span>
                </div>
              ) : (
                <>
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
                </>
              )}
            </div>

            <Field
              label="Observaciones"
              value={isEditing ? formData.observaciones : cliente.observaciones || 'Sin observaciones'}
              disabled={!isEditing || saving}
              multiline
              onChange={(val) => handleFieldChange('observaciones', val)}
              className="sm:col-span-2"
            />
          </div>

          {isEditing && (
            <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-slate-800">
              <button
                type="button"
                disabled={saving}
                onClick={handleCancelEdit}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow transition disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          )}
        </form>
      )}
    </Modal>
  )
}

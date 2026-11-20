'use client'

import { useRef, useState } from 'react'
import ClientQuickPasteBox from '@/components/ClientQuickPasteBox'
import { type ParsedClienteData } from '@/lib/parseClienteText'
import { createCliente, type Cliente } from '@/lib/clientes'

interface ClienteCreateFormProps {
  /** Texto inicial para el nombre del cliente (ej. lo que se escribió en el buscador) */
  initialNombre?: string
  existingClientes?: Cliente[]
  onCreated: (cliente: Cliente) => void
  /** Si el usuario detecta que el cliente ya existe en el pegado rápido */
  onSelectExisting?: (cliente: Cliente) => void
  onCancel?: () => void
}

const inputClass =
  'w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition'
const labelClass = 'block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5'

export default function ClienteCreateForm({
  initialNombre = '',
  existingClientes = [],
  onCreated,
  onSelectExisting,
  onCancel
}: ClienteCreateFormProps) {
  const [form, setForm] = useState({
    nombre_cliente: initialNombre,
    nombre_empresa: '',
    email: '',
    telefono: '',
    dni: '',
    direccion: '',
    provincia: '',
    cp: '',
    localidad: '',
    saldo: 0,
    observaciones: ''
  })
  const [extraOpen, setExtraOpen] = useState(false)
  const [needsEmpresaWarning, setNeedsEmpresaWarning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const empresaRef = useRef<HTMLInputElement | null>(null)

  const handleParsed = (parsed: ParsedClienteData) => {
    setForm((prev) => ({
      ...prev,
      nombre_cliente: parsed.nombre_cliente || prev.nombre_cliente,
      nombre_empresa: parsed.nombre_empresa || prev.nombre_empresa,
      telefono: parsed.telefono || prev.telefono,
      email: parsed.email || prev.email,
      dni: parsed.dni || prev.dni,
      direccion: parsed.direccion || prev.direccion,
      provincia: parsed.provincia || prev.provincia,
      cp: parsed.cp || prev.cp,
      localidad: parsed.localidad || prev.localidad,
      observaciones: parsed.observaciones || prev.observaciones
    }))
    setExtraOpen(true)
    if (parsed.missingEmpresa && !form.nombre_empresa.trim()) {
      setNeedsEmpresaWarning(true)
      setTimeout(() => empresaRef.current?.focus(), 50)
    } else {
      setNeedsEmpresaWarning(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setError('')
    setSaving(true)
    try {
      const created = await createCliente({
        nombre_cliente: form.nombre_cliente.trim(),
        nombre_empresa: form.nombre_empresa.trim(),
        email: form.email.trim() || null,
        telefono: form.telefono.trim(),
        dni: form.dni.trim() || null,
        direccion: form.direccion.trim() || null,
        provincia: form.provincia.trim() || null,
        cp: form.cp.trim() || null,
        localidad: form.localidad.trim() || null,
        saldo: Number(form.saldo) || 0,
        observaciones: form.observaciones.trim() || null
      })
      onCreated(created)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrar el cliente')
    } finally {
      setSaving(false)
    }
  }

  const set = (key: keyof typeof form, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <ClientQuickPasteBox
        onParsed={handleParsed}
        currentEmpresaValue={form.nombre_empresa}
        existingClientes={existingClientes}
        onSelectExistingClient={onSelectExisting}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Nombre del Cliente *</label>
          <input
            type="text"
            required
            value={form.nombre_cliente}
            onChange={(e) => set('nombre_cliente', e.target.value)}
            className={inputClass}
            placeholder="Ej. Juan Pérez"
          />
        </div>
        <div>
          <label className={labelClass}>Nombre de la Empresa *</label>
          <input
            ref={empresaRef}
            type="text"
            required
            value={form.nombre_empresa}
            onChange={(e) => {
              set('nombre_empresa', e.target.value)
              if (e.target.value.trim()) setNeedsEmpresaWarning(false)
            }}
            className={`w-full bg-slate-950 border rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none transition ${
              needsEmpresaWarning && !form.nombre_empresa.trim()
                ? 'border-amber-500 ring-2 ring-amber-500/30 focus:border-amber-400'
                : 'border-slate-800 focus:border-blue-500'
            }`}
            placeholder="Ej. Empresa S.A. / Particular"
          />
          {needsEmpresaWarning && !form.nombre_empresa.trim() && (
            <span className="text-[11px] text-amber-400 font-medium mt-1 block">
              ⚠️ Por favor, ingresá el nombre de la empresa o razón social.
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Teléfono *</label>
          <input
            type="text"
            required
            value={form.telefono}
            onChange={(e) => set('telefono', e.target.value)}
            className={inputClass}
            placeholder="Ej. +54 9 11 1234-5678"
          />
        </div>
        <div>
          <label className={labelClass}>Correo Electrónico</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className={inputClass}
            placeholder="ejemplo@correo.com"
          />
        </div>
      </div>

      <details
        open={extraOpen}
        onToggle={(e) => setExtraOpen((e.currentTarget as HTMLDetailsElement).open)}
        className="group border border-slate-800 rounded-lg bg-slate-950/30 overflow-hidden"
      >
        <summary className="list-none flex items-center justify-between p-3 text-xs text-slate-400 font-semibold cursor-pointer select-none hover:bg-slate-950/60 transition">
          <span>Información Adicional (Dirección, Facturación, etc.)</span>
          <span className="transition-transform group-open:rotate-180">▼</span>
        </summary>
        <div className="p-3 border-t border-slate-800 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>DNI</label>
              <input type="text" value={form.dni} onChange={(e) => set('dni', e.target.value)} className={inputClass} placeholder="Ej. 12345678" />
            </div>
            <div>
              <label className={labelClass}>Localidad</label>
              <input type="text" value={form.localidad} onChange={(e) => set('localidad', e.target.value)} className={inputClass} placeholder="Ej. Lanús" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Provincia</label>
              <input type="text" value={form.provincia} onChange={(e) => set('provincia', e.target.value)} className={inputClass} placeholder="Ej. Buenos Aires" />
            </div>
            <div>
              <label className={labelClass}>Código Postal (CP)</label>
              <input type="text" value={form.cp} onChange={(e) => set('cp', e.target.value)} className={inputClass} placeholder="Ej. 1824" />
            </div>
          </div>
          <div>
            <label className={labelClass}>Dirección</label>
            <input type="text" value={form.direccion} onChange={(e) => set('direccion', e.target.value)} className={inputClass} placeholder="Ej. Av. 9 de Julio 1234" />
          </div>
          <div>
            <label className={labelClass}>Saldo ($)</label>
            <input
              type="number"
              step="0.01"
              value={form.saldo}
              onChange={(e) => set('saldo', Number(e.target.value))}
              className={inputClass}
              placeholder="0.00"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Si el saldo es negativo, la creación de pedidos estará deshabilitada para este cliente.
            </span>
          </div>
          <div>
            <label className={labelClass}>Observaciones</label>
            <textarea
              rows={2}
              value={form.observaciones}
              onChange={(e) => set('observaciones', e.target.value)}
              className={inputClass}
              placeholder="Notas sobre el cliente..."
            />
          </div>
        </div>
      </details>

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-lg transition"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition"
        >
          {saving ? 'Registrando…' : 'Registrar y seleccionar'}
        </button>
      </div>
    </form>
  )
}

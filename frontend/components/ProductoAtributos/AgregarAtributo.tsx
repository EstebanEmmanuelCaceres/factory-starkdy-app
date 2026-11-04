'use client'

import { useState } from 'react'
import { TIPOS_ATRIBUTO, TIPOS_HABILITADOS, type TipoAtributo } from '@/lib/entities/atributos'
import { inputClass, labelClass } from './styles'

interface AgregarAtributoProps {
  onAgregar: (tipo: TipoAtributo, etiqueta: string) => void
}

// Solo se ofrecen los tipos en uso (texto y opciones); color y extra quedan ocultos por ahora
const TIPOS_DISPONIBLES = TIPOS_ATRIBUTO.filter((t) => TIPOS_HABILITADOS.includes(t.value))

// Paso para sumar un atributo: elegir el tipo y la etiqueta. El resto se completa en su tarjeta.
export const AgregarAtributo = ({ onAgregar }: AgregarAtributoProps) => {
  const [abierto, setAbierto] = useState(false)
  const [tipo, setTipo] = useState<TipoAtributo>('texto')
  const [etiqueta, setEtiqueta] = useState('')

  const cerrar = () => {
    setAbierto(false)
    setTipo('texto')
    setEtiqueta('')
  }

  const confirmar = () => {
    if (!etiqueta.trim()) return
    onAgregar(tipo, etiqueta)
    cerrar()
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-full rounded-xl border border-dashed border-slate-700 py-3 text-sm font-semibold text-blue-400 hover:border-blue-500 hover:bg-blue-500/5 transition cursor-pointer"
      >
        + Agregar atributo
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
      <div>
        <span className={labelClass}>Tipo</span>
        <div className="grid grid-cols-2 gap-2">
          {TIPOS_DISPONIBLES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTipo(t.value)}
              className={`rounded-lg border px-3 py-2 text-left transition cursor-pointer ${tipo === t.value ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-600'
                }`}
              aria-pressed={tipo === t.value}
            >
              <span className="block text-sm font-semibold">
                {t.icon} {t.label}
              </span>
              <span className="block text-[11px] leading-snug text-slate-500">{t.descripcion}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="nuevo-atributo-etiqueta">Etiqueta</label>
        <input
          id="nuevo-atributo-etiqueta"
          type="text"
          autoFocus
          value={etiqueta}
          onChange={(e) => setEtiqueta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              confirmar()
            }
          }}
          maxLength={100}
          className={inputClass}
          placeholder="Ej: Tamaño, Color, Nombre a grabar"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={cerrar} className="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer">
          Cancelar
        </button>
        <button
          type="button"
          onClick={confirmar}
          disabled={!etiqueta.trim()}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
        >
          Agregar
        </button>
      </div>
    </div>
  )
}

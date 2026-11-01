'use client'

import { TIPOS_ATRIBUTO, tieneOpciones, type AtributoProducto } from '@/lib/entities/atributos'
import type { EditorAtributos } from './useAtributosProducto'
import { OpcionesEditor } from './OpcionesEditor'
import { RecargoInput } from './RecargoInput'
import { iconButtonClass, inputClass, labelClass } from './styles'

interface AtributoCardProps {
  atributo: AtributoProducto
  index: number
  total: number
  editor: EditorAtributos
}

export const AtributoCard = ({ atributo, index, total, editor }: AtributoCardProps) => {
  const tipo = TIPOS_ATRIBUTO.find((t) => t.value === atributo.tipo)

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded-lg bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300" title={tipo?.descripcion}>
          {tipo?.icon} {tipo?.label}
        </span>
        <input
          type="text"
          value={atributo.etiqueta}
          onChange={(e) => editor.actualizar(index, { etiqueta: e.target.value })}
          maxLength={100}
          className={`${inputClass} min-w-0 flex-1 font-semibold`}
          placeholder="Etiqueta visible (ej: Tamaño)"
          aria-label="Etiqueta del atributo"
        />
        <div className="flex shrink-0 items-center">
          <button type="button" onClick={() => editor.mover(index, -1)} disabled={index === 0} className={iconButtonClass} title="Subir">
            ↑
          </button>
          <button type="button" onClick={() => editor.mover(index, 1)} disabled={index === total - 1} className={iconButtonClass} title="Bajar">
            ↓
          </button>
          <button type="button" onClick={() => editor.quitar(index)} className={`${iconButtonClass} hover:!text-rose-400`} title="Quitar atributo">
            🗑️
          </button>
        </div>
      </div>

      {(atributo.tipo === 'opciones' || atributo.tipo === 'color') && (
        <div>
          <label className={labelClass}>Prefijo en el carrito (opcional)</label>
          <input
            type="text"
            value={atributo.prefijo_etiqueta ?? ''}
            onChange={(e) => editor.actualizar(index, { prefijo_etiqueta: e.target.value })}
            maxLength={50}
            className={inputClass}
            placeholder={`Ej: "Argolla" → "Argolla Dorada"`}
          />
        </div>
      )}

      {tieneOpciones(atributo) && <OpcionesEditor atributo={atributo} index={index} editor={editor} />}

      {atributo.tipo === 'color' && (
        <p className="text-xs text-slate-500">🎨 El color se elige al cargar cada pedido. No suma recargo.</p>
      )}

      {atributo.tipo === 'texto' && (
        <div>
          <label className={labelClass}>Texto de ejemplo en el campo (opcional)</label>
          <input
            type="text"
            value={atributo.placeholder ?? ''}
            onChange={(e) => editor.actualizar(index, { placeholder: e.target.value })}
            maxLength={100}
            className={inputClass}
            placeholder="Ej: Escribí el nombre a grabar"
          />
        </div>
      )}

      {atributo.tipo === 'extra' && (
        <div>
          <label className={labelClass}>Recargo si se activa</label>
          <RecargoInput value={atributo.recargo} onChange={(recargo) => editor.actualizar(index, { recargo })} className="max-w-[12rem]" />
        </div>
      )}
    </div>
  )
}

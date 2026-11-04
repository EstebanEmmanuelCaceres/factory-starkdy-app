'use client'

import type { AtributoOpciones } from '@/lib/entities/atributos'
import type { EditorAtributos } from './useAtributosProducto'
import { RecargoInput } from './RecargoInput'
import { iconButtonClass, inputClass } from './styles'

interface OpcionesEditorProps {
  atributo: AtributoOpciones
  index: number
  editor: EditorAtributos
}

export const OpcionesEditor = ({ atributo, index, editor }: OpcionesEditorProps) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Opciones ({atributo.opciones.length})</span>
        <span className="text-[11px] text-slate-500">★ = marcada por defecto (si ninguna, la primera)</span>
      </div>

      <div className="space-y-2">
        {atributo.opciones.map((opcion, j) => (
          <div key={j} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <button
              type="button"
              onClick={() => editor.marcarPorDefecto(index, j)}
              className={`shrink-0 w-8 h-8 rounded-lg text-base transition cursor-pointer ${
                opcion.por_defecto ? 'text-amber-400 bg-amber-500/10' : 'text-slate-600 hover:text-slate-300 hover:bg-slate-800'
              }`}
              title={opcion.por_defecto ? 'Opción por defecto (tocar para quitar)' : 'Marcar como opción por defecto'}
              aria-pressed={!!opcion.por_defecto}
            >
              ★
            </button>

            <input
              type="text"
              value={opcion.valor}
              onChange={(e) => editor.actualizarOpcion(index, j, { valor: e.target.value })}
              maxLength={100}
              className={`${inputClass} min-w-[8rem] flex-1`}
              placeholder="Ej: Grande"
              aria-label="Valor de la opción"
            />

            <RecargoInput
              value={opcion.recargo}
              onChange={(recargo) => editor.actualizarOpcion(index, j, { recargo })}
              className="w-28 shrink-0"
            />

            <button
              type="button"
              onClick={() => editor.quitarOpcion(index, j)}
              disabled={atributo.opciones.length === 1}
              className={`${iconButtonClass} hover:!text-rose-400`}
              title={atributo.opciones.length === 1 ? 'Tiene que quedar al menos una opción' : 'Quitar opción'}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => editor.agregarOpcion(index)}
        className="mt-2 text-xs font-semibold text-blue-400 hover:text-blue-300 transition cursor-pointer"
      >
        + Agregar opción
      </button>
    </div>
  )
}

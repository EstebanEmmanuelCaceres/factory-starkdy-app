'use client'

import { Modal } from '@/components/Modal/Modal'
import { useModal } from '@/components/Modal/context/ModalContext'
import type { Product } from '@/lib/products'
import { estaHabilitado } from '@/lib/entities/atributos'
import { PRODUCTO_ATRIBUTOS_MODAL_ID } from './modalIds'
import { useAtributosProducto } from './useAtributosProducto'
import { AtributoCard } from './AtributoCard'
import { AgregarAtributo } from './AgregarAtributo'

interface ProductoAtributosModalProps {
  producto: Product | null
  onSaved: (producto: Product) => void
}

export const ProductoAtributosModal = ({ producto, onSaved }: ProductoAtributosModalProps) => {
  const { isOpen, close } = useModal(PRODUCTO_ATRIBUTOS_MODAL_ID)
  const editor = useAtributosProducto(producto, isOpen)
  const { atributos, errores, guardando, hayCambios } = editor

  // Los atributos de tipos ocultos (color, extra) no se muestran pero se conservan al guardar.
  // Se guarda el índice original porque el editor trabaja sobre la lista completa.
  const visibles = atributos.map((atributo, index) => ({ atributo, index })).filter(({ atributo }) => estaHabilitado(atributo))

  const cerrar = () => {
    if (hayCambios && !confirm('Hay cambios sin guardar en los atributos. ¿Cerrar y descartarlos?')) return
    close()
  }

  const handleGuardar = async () => {
    const actualizado = await editor.guardar()
    if (!actualizado) return
    onSaved(actualizado)
    close()
  }

  const footer = (
    <div className="flex items-center justify-between gap-3 border-t border-slate-800 bg-slate-900 px-6 py-4">
      <span className="text-xs text-slate-500">{hayCambios ? 'Cambios sin guardar' : 'Sin cambios'}</span>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={cerrar}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleGuardar}
          disabled={!hayCambios || guardando}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
        >
          {guardando ? 'Guardando...' : 'Guardar atributos'}
        </button>
      </div>
    </div>
  )

  // El cuerpo del modal no scrollea: el encabezado queda fijo y solo scrollea la lista de atributos
  return (
    <Modal
      id={PRODUCTO_ATRIBUTOS_MODAL_ID}
      onClose={cerrar}
      className="max-w-3xl"
      bodyClassName="!overflow-hidden"
      footer={producto ? footer : undefined}
    >
      {producto && (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="shrink-0 space-y-4">
            <div className="pr-10">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>🏷️</span> Atributos del producto
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Lo que se puede elegir al pedir <span className="font-semibold text-blue-400">{producto.nombre}</span>, en el orden en que se
                muestra. Los recargos se suman al precio unitario.
              </p>
            </div>

            {errores.length > 0 && (
              <ul className="space-y-1 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300" role="alert">
                {errores.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="-mr-3 min-h-0 flex-1 space-y-4 overflow-y-auto pr-3">
            {visibles.length === 0 ? (
              <p className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-6 text-center text-sm text-slate-500">
                Este producto todavía no tiene atributos.
              </p>
            ) : (
              <div className="space-y-3">
                {visibles.map(({ atributo, index }, posicion) => (
                  <AtributoCard
                    key={atributo.clave}
                    atributo={atributo}
                    index={index}
                    esPrimero={posicion === 0}
                    esUltimo={posicion === visibles.length - 1}
                    editor={editor}
                  />
                ))}
              </div>
            )}

            <AgregarAtributo onAgregar={editor.agregar} />
          </div>
        </div>
      )}
    </Modal>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { updateProduct, type Product } from '@/lib/products'
import { estaHabilitado, tieneOpciones, type AtributoProducto, type OpcionAtributo, type TipoAtributo } from '@/lib/entities/atributos'
import { asignarClavesNuevas, crearAtributo, crearOpcion, limpiarAtributos, validarAtributos } from './helpers'

// Campos editables del atributo (cada tipo usa los suyos)
export interface CambiosAtributo {
  etiqueta?: string
  prefijo_etiqueta?: string
  placeholder?: string
  recargo?: number
}

/**
 * Estado del editor de atributos de un producto: se trabaja sobre una copia local
 * y recién al guardar se manda la lista completa al servidor.
 */
export const useAtributosProducto = (producto: Product | null, abierto: boolean) => {
  const [atributos, setAtributos] = useState<AtributoProducto[]>([])
  const [errores, setErrores] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)

  // Cada vez que se abre, arranca desde lo que tiene guardado el producto
  useEffect(() => {
    if (!abierto) return
    setAtributos(structuredClone(producto?.atributos ?? []))
    setErrores([])
  }, [abierto, producto])

  const hayCambios = useMemo(
    () => JSON.stringify(atributos) !== JSON.stringify(producto?.atributos ?? []),
    [atributos, producto],
  )

  // Toda edición pasa por acá: limpia los errores del último intento de guardar
  const modificar = useCallback((fn: (prev: AtributoProducto[]) => AtributoProducto[]) => {
    setAtributos(fn)
    setErrores([])
  }, [])

  const modificarAtributo = useCallback(
    (index: number, fn: (atributo: AtributoProducto) => AtributoProducto) =>
      modificar((prev) => prev.map((a, i) => (i === index ? fn(a) : a))),
    [modificar],
  )

  const agregar = useCallback(
    (tipo: TipoAtributo, etiqueta: string) =>
      modificar((prev) => [...prev, crearAtributo(tipo, etiqueta, prev.map((a) => a.clave))]),
    [modificar],
  )

  const quitar = useCallback((index: number) => modificar((prev) => prev.filter((_, i) => i !== index)), [modificar])

  const mover = useCallback(
    (index: number, direccion: -1 | 1) =>
      modificar((prev) => {
        // Se intercambia con el siguiente visible: los atributos de tipos ocultos no cuentan
        let destino = index + direccion
        while (destino >= 0 && destino < prev.length && !estaHabilitado(prev[destino])) destino += direccion
        if (destino < 0 || destino >= prev.length) return prev
        const lista = [...prev]
        ;[lista[index], lista[destino]] = [lista[destino], lista[index]]
        return lista
      }),
    [modificar],
  )

  const actualizar = useCallback(
    (index: number, cambios: CambiosAtributo) =>
      modificarAtributo(index, (a) => ({ ...a, ...cambios }) as AtributoProducto),
    [modificarAtributo],
  )

  const agregarOpcion = useCallback(
    (index: number) =>
      modificarAtributo(index, (a) =>
        tieneOpciones(a) ? ({ ...a, opciones: [...a.opciones, crearOpcion()] } as AtributoProducto) : a,
      ),
    [modificarAtributo],
  )

  const actualizarOpcion = useCallback(
    (index: number, opcionIndex: number, cambios: Partial<OpcionAtributo>) =>
      modificarAtributo(index, (a) =>
        tieneOpciones(a)
          ? ({ ...a, opciones: a.opciones.map((o, j) => (j === opcionIndex ? { ...o, ...cambios } : o)) } as AtributoProducto)
          : a,
      ),
    [modificarAtributo],
  )

  const quitarOpcion = useCallback(
    (index: number, opcionIndex: number) =>
      modificarAtributo(index, (a) =>
        tieneOpciones(a) ? ({ ...a, opciones: a.opciones.filter((_, j) => j !== opcionIndex) } as AtributoProducto) : a,
      ),
    [modificarAtributo],
  )

  // Solo una por defecto: marcar una desmarca las demás; volver a tocarla la desmarca
  const marcarPorDefecto = useCallback(
    (index: number, opcionIndex: number) =>
      modificarAtributo(index, (a) => {
        if (!tieneOpciones(a)) return a
        const yaEra = !!a.opciones[opcionIndex]?.por_defecto
        return {
          ...a,
          opciones: a.opciones.map((o, j) => {
            const resto = { ...o }
            delete resto.por_defecto
            return j === opcionIndex && !yaEra ? { ...resto, por_defecto: true } : resto
          }),
        } as AtributoProducto
      }),
    [modificarAtributo],
  )

  // Devuelve el producto actualizado, o null si hubo errores (quedan en `errores`)
  const guardar = useCallback(async (): Promise<Product | null> => {
    if (!producto) return null

    const encontrados = validarAtributos(atributos)
    if (encontrados.length > 0) {
      setErrores(encontrados)
      return null
    }

    setGuardando(true)
    try {
      const guardadas = (producto.atributos ?? []).map((a) => a.clave)
      return await updateProduct(producto.id, { atributos: limpiarAtributos(asignarClavesNuevas(atributos, guardadas)) })
    } catch (err: unknown) {
      setErrores([err instanceof Error ? err.message : 'Error al guardar los atributos'])
      return null
    } finally {
      setGuardando(false)
    }
  }, [producto, atributos])

  return {
    atributos,
    errores,
    guardando,
    hayCambios,
    agregar,
    quitar,
    mover,
    actualizar,
    agregarOpcion,
    actualizarOpcion,
    quitarOpcion,
    marcarPorDefecto,
    guardar,
  }
}

export type EditorAtributos = ReturnType<typeof useAtributosProducto>

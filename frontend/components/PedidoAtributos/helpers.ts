import { estaHabilitado, type AtributoOpciones, type AtributoTexto, type ValoresAtributos } from '@/lib/entities/atributos'
import type { Product } from '@/lib/products'

// Las mismas reglas que aplica el backend en App\Services\PedidoLineasService

// Atributos que se cargan en el pedido (los tipos ocultos no se muestran)
export const atributosDelPedido = (product?: Pick<Product, 'atributos'> | null): (AtributoTexto | AtributoOpciones)[] =>
  (product?.atributos ?? []).filter(estaHabilitado)

const opcionPorDefecto = (atributo: AtributoOpciones) =>
  (atributo.opciones.find((o) => o.por_defecto) ?? atributo.opciones[0])?.valor

// Valores con los que arranca una línea nueva: cada atributo de opciones con su opción por defecto
export const valoresPorDefecto = (product?: Pick<Product, 'atributos'> | null): ValoresAtributos => {
  const valores: ValoresAtributos = {}
  for (const atributo of atributosDelPedido(product)) {
    if (atributo.tipo === 'opciones') {
      const valor = opcionPorDefecto(atributo)
      if (valor) valores[atributo.clave] = valor
    }
  }
  return valores
}

// Deja los valores como los guarda el backend: texto sin espacios de más (vacío no se guarda)
// y cada atributo de opciones con un valor válido
export const normalizarValores = (product: Pick<Product, 'atributos'> | null | undefined, valores: ValoresAtributos): ValoresAtributos => {
  const normalizados: ValoresAtributos = {}
  for (const atributo of atributosDelPedido(product)) {
    const valor = (valores[atributo.clave] ?? '').trim()
    if (atributo.tipo === 'texto') {
      if (valor) normalizados[atributo.clave] = valor
      continue
    }
    const elegido = atributo.opciones.some((o) => o.valor === valor) ? valor : opcionPorDefecto(atributo)
    if (elegido) normalizados[atributo.clave] = elegido
  }
  return normalizados
}

// Identifica una línea: mismo producto con los mismos atributos (sin importar el orden de las claves)
export const claveLinea = (productId: number, valores: ValoresAtributos = {}) =>
  `${productId}|${JSON.stringify(Object.keys(valores).sort().map((clave) => [clave, valores[clave]]))}`

// Pares etiqueta/valor para mostrar. Si el producto ya no tiene el atributo, se muestra la clave tal cual.
export const resumenAtributos = (product: Pick<Product, 'atributos'> | null | undefined, valores: ValoresAtributos = {}) => {
  const definiciones = product?.atributos ?? []
  return Object.entries(valores)
    .filter(([, valor]) => valor !== '')
    .map(([clave, valor]) => ({
      clave,
      etiqueta: definiciones.find((a) => a.clave === clave)?.etiqueta ?? clave,
      valor,
    }))
}

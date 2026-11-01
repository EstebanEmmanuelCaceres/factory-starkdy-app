import { tieneOpciones, type AtributoProducto, type OpcionAtributo, type TipoAtributo } from '@/lib/entities/atributos'

/**
 * Genera la clave a partir de la etiqueta ("Color del vaso" → "color_del_vaso").
 * Si ya existe en el producto se le agrega un sufijo (_2, _3...). La clave no se muestra al usuario
 * y no cambia aunque después se edite la etiqueta, porque es lo que se guarda en los pedidos.
 */
export const generarClave = (etiqueta: string, existentes: string[]): string => {
  const base =
    etiqueta
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 45) || 'atributo'

  let clave = base
  for (let n = 2; existentes.includes(clave); n++) {
    clave = `${base}_${n}`
  }
  return clave
}

export const crearOpcion = (): OpcionAtributo => ({ valor: '', recargo: 0 })

// Los atributos con opciones arrancan con una vacía para completar, porque necesitan al menos una
export const crearAtributo = (tipo: TipoAtributo, etiqueta: string, claves: string[]): AtributoProducto => {
  const base = { clave: generarClave(etiqueta, claves), etiqueta: etiqueta.trim() }
  switch (tipo) {
    case 'opciones':
      return { ...base, tipo, opciones: [crearOpcion()] }
    case 'color':
    case 'texto':
      return { ...base, tipo }
    case 'extra':
      return { ...base, tipo, recargo: 0 }
  }
}

// Mensajes para el usuario antes de mandar al servidor (el backend vuelve a validar)
export const validarAtributos = (atributos: AtributoProducto[]): string[] => {
  const errores: string[] = []

  atributos.forEach((atributo, i) => {
    const nombre = atributo.etiqueta.trim() ? `"${atributo.etiqueta.trim()}"` : `#${i + 1}`

    if (!atributo.etiqueta.trim()) {
      errores.push(`El atributo #${i + 1} necesita una etiqueta.`)
    }

    if (!tieneOpciones(atributo)) return

    if (atributo.opciones.length === 0) {
      errores.push(`El atributo ${nombre} necesita al menos una opción.`)
      return
    }

    const valores = new Set<string>()
    atributo.opciones.forEach((opcion, j) => {
      const valor = opcion.valor.trim()
      if (!valor) {
        errores.push(`La opción #${j + 1} del atributo ${nombre} no tiene valor.`)
      } else if (valores.has(valor.toLowerCase())) {
        errores.push(`El atributo ${nombre} tiene la opción "${valor}" repetida.`)
      }
      valores.add(valor.toLowerCase())
    })
  })

  return errores
}

// Deja el JSON prolijo para guardar: sin espacios de más ni campos opcionales vacíos
export const limpiarAtributos = (atributos: AtributoProducto[]): AtributoProducto[] =>
  atributos.map((atributo) => {
    const base = { clave: atributo.clave, etiqueta: atributo.etiqueta.trim() }

    switch (atributo.tipo) {
      case 'texto': {
        const placeholder = atributo.placeholder?.trim()
        return { ...base, tipo: 'texto', ...(placeholder ? { placeholder } : {}) }
      }
      case 'extra':
        return { ...base, tipo: 'extra', recargo: atributo.recargo || 0 }
      case 'color': {
        const prefijo = atributo.prefijo_etiqueta?.trim()
        return { ...base, tipo: 'color', ...(prefijo ? { prefijo_etiqueta: prefijo } : {}) }
      }
      case 'opciones': {
        const prefijo = atributo.prefijo_etiqueta?.trim()
        const opciones = atributo.opciones.map((opcion) => ({
          valor: opcion.valor.trim(),
          recargo: opcion.recargo || 0,
          ...(opcion.por_defecto ? { por_defecto: true } : {}),
        }))
        return { ...base, tipo: 'opciones', ...(prefijo ? { prefijo_etiqueta: prefijo } : {}), opciones }
      }
    }
  })

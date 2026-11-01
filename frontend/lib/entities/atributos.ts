// Formato de productos.atributos (jsonb): lista de atributos en el orden en que se muestran en el configurador.
// El backend valida lo mismo en App\Rules\AtributosProducto.

// Opción de un atributo "opciones"
export interface OpcionAtributo {
  valor: string          // texto de la opción; es lo que se guarda en el pedido
  recargo: number        // pesos que se suman al precio unitario; 0 si no suma nada
  por_defecto?: boolean  // marcada al abrir el configurador; solo una por atributo (si ninguna, se usa la primera)
}

interface AtributoBase {
  clave: string          // ^[a-z0-9_]+$, se guarda en los pedidos: no cambiarla una vez usada
  etiqueta: string       // nombre visible en el configurador y el carrito
}

export interface AtributoOpciones extends AtributoBase {
  tipo: 'opciones'
  prefijo_etiqueta?: string  // texto antes del valor en el carrito
  opciones: OpcionAtributo[]
}

// El producto solo indica que lleva un color: el color se elige en cada pedido y no suma recargo
export interface AtributoColor extends AtributoBase {
  tipo: 'color'
  prefijo_etiqueta?: string
}

export interface AtributoTexto extends AtributoBase {
  tipo: 'texto'
  placeholder?: string
}

export interface AtributoExtra extends AtributoBase {
  tipo: 'extra'
  recargo: number
}

export type AtributoProducto = AtributoOpciones | AtributoColor | AtributoTexto | AtributoExtra
export type TipoAtributo = AtributoProducto['tipo']

export const TIPOS_ATRIBUTO: { value: TipoAtributo; label: string; icon: string; descripcion: string }[] = [
  { value: 'opciones', label: 'Opciones', icon: '🔘', descripcion: 'Elegir una opción de texto. Ej: Tamaño, Forma.' },
  { value: 'color', label: 'Color', icon: '🎨', descripcion: 'El color se elige en cada pedido. Ej: Argolla.' },
  { value: 'texto', label: 'Texto', icon: '✍️', descripcion: 'Texto libre del cliente. Ej: Nombre o frase.' },
  { value: 'extra', label: 'Extra', icon: '➕', descripcion: 'Adicional que se activa o no. Ej: Caja individual.' },
]

export const tieneOpciones = (atributo: AtributoProducto): atributo is AtributoOpciones => atributo.tipo === 'opciones'

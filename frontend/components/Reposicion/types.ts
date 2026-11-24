import type { Pedido } from '@/lib/pedidos'
import type { Prioridad } from '@/components/order-cart/Types'
import type { CrearReposicionInput, MotivoReposicion } from '@/lib/entities/reposiciones'

// Pasos del wizard de reposición. "creando" es mientras se espera la respuesta del backend.
export type PasoReposicion = 'formulario' | 'resumen' | 'creando' | 'creada'

// Una línea del pedido original: se marca si se repone y cuántas unidades (sin pasar de las del pedido)
export interface LineaReposicion {
  lineaId: number
  productoId: number
  producto: string
  maximo: number
  reponer: boolean
  cantidad: number
}

// Valores del formulario (RHF). `priority` se llama igual que en la creación para reusar PriorityField.
export interface ReposicionFormValues {
  lineas: LineaReposicion[]
  motivo: MotivoReposicion | ''
  detalle: string
  priority: Prioridad
  deliveryDate: string
}

const fechaEn = (dias: number) => {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Arranca con todas las líneas del pedido marcadas y con su cantidad completa:
 * lo común es reponer todo y desmarcar o bajar lo que no hace falta.
 */
export const valoresIniciales = (pedido: Pedido | null): ReposicionFormValues => ({
  lineas: (pedido?.productos ?? [])
    .filter((prod) => prod.pivot?.id != null)
    .map((prod) => ({
      lineaId: prod.pivot!.id!,
      productoId: prod.id,
      producto: prod.nombre,
      maximo: prod.pivot!.cantidad,
      reponer: true,
      cantidad: prod.pivot!.cantidad,
    })),
  motivo: '',
  detalle: '',
  priority: pedido?.prioridad ?? 'normal',
  deliveryDate: fechaEn(15),
})

export const lineasAReponer = (lineas: LineaReposicion[]) => lineas.filter((l) => l.reponer)

// Body de POST /api/pedidos/{id}/reposicion: solo las líneas marcadas
export const buildReposicionPayload = (values: ReposicionFormValues): CrearReposicionInput => ({
  motivo: values.motivo as MotivoReposicion,
  detalle: values.detalle.trim() || null,
  lineas: lineasAReponer(values.lineas).map((l) => ({ linea_id: l.lineaId, cantidad: l.cantidad })),
  fecha_entrega: values.deliveryDate || null,
  prioridad: values.priority,
})

// Etapas que muestra el WizardStepper
export const ETAPAS_REPOSICION: { label: string; steps: PasoReposicion[] }[] = [
  { label: 'Reposición', steps: ['formulario'] },
  { label: 'Resumen', steps: ['resumen', 'creando'] },
  { label: 'Creada', steps: ['creada'] },
]

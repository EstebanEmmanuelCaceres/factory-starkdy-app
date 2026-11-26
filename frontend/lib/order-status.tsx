import { toOptions } from './options'

//Prioridad de pedidos

type Priority = 'alta' | 'normal'

const PRIORITY_LABELS: Record<Priority, string> = {
    normal: 'Prioridad Normal',
    alta: 'Prioridad Alta',
}

export const PRIORITY_OPTIONS = toOptions(PRIORITY_LABELS)

//Estados de pedidos

type PedidoState = 'todos' | 'pendiente' | 'listo_para_produccion' | 'en_progreso' | 'completado' | 'enviado' | 'enviado_faltante' | 'cancelado'

const PEDIDO_STATE_LABELS: Record<PedidoState, string> = {
    todos: 'Todos los estados',
    pendiente: 'Pendiente',
    listo_para_produccion: 'Listo para Producción',
    en_progreso: 'En Progreso',
    completado: 'Completado',
    enviado: 'Enviado',
    enviado_faltante: 'Enviado Faltante',
    cancelado: 'Cancelado'
}

export const PEDIDO_STATE_OPTIONS = toOptions(PEDIDO_STATE_LABELS)
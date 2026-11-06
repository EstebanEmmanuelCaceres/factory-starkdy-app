'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Modal from '@/components/Modal'
import { type Pedido, updatePedido, getPedido, type UpdatePedidoInput } from '@/lib/pedidos'
import { fetchClientes, type Cliente } from '@/lib/clientes'
import { fetchProducts, type Product } from '@/lib/products'
import { fetchUsers, type User } from '@/lib/auth'
import { fetchEtapas, topologicalSortEtapas, type Etapa } from '@/lib/entities/etapas'
import { fetchResponsablesEtapas, assignTask, removeTaskAssignment, etapasDesdeTareas, type ResponsableEtapa } from '@/lib/responsable_etapas'
import type { ValoresAtributos } from '@/lib/entities/atributos'
import { AtributosLineaFields } from '@/components/PedidoAtributos/AtributosLineaFields'
import { claveLinea, normalizarValores, valoresPorDefecto } from '@/components/PedidoAtributos/helpers'

// Línea del pedido en edición: un producto puede repetirse con distintos atributos
interface LineaEdicion {
  uid: string
  productId: number
  cantidad: number
  atributos: ValoresAtributos
}

export interface EditPedidoModalProps {
  pedido: Pedido | null
  isOpen: boolean
  onClose: () => void
  onPedidoUpdated?: (updatedPedido: Pedido) => void
  clientes?: Cliente[]
  productos?: Product[]
  users?: User[]
}

export default function EditPedidoModal({
  pedido,
  isOpen,
  onClose,
  onPedidoUpdated,
  clientes: propClientes,
  productos: propProductos,
  users: propUsers
}: EditPedidoModalProps) {
  const [clientesList, setClientesList] = useState<Cliente[]>(propClientes || [])
  const [productosList, setProductosList] = useState<Product[]>(propProductos || [])
  const [operariosList, setOperariosList] = useState<User[]>(propUsers || [])
  
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form State
  const [formData, setFormData] = useState({
    cliente_id: '',
    codigo: '',
    prioridad: 'normal' as 'baja' | 'normal' | 'alta' | 'critica',
    fecha_entrega: '',
    estado: 'pendiente',
    precio: '',
    comentario: '',
    tipo_pago: 'parcial' as 'unico' | 'parcial',
  })
  const [lineas, setLineas] = useState<LineaEdicion[]>([])
  const nextUid = useRef(0)
  const nuevoUid = () => `nueva-${nextUid.current++}`

  // Etapas y asignaciones
  const [localEtapas, setLocalEtapas] = useState<Etapa[]>([])
  // Tareas que ya tiene el pedido: definen las etapas de los productos que ya estaban en él
  const [pedidoTareas, setPedidoTareas] = useState<ResponsableEtapa[]>([])
  const [localAssignments, setLocalAssignments] = useState<Record<string, number | null>>({})
  const [productSearchQuery, setProductSearchQuery] = useState('')

  // Cargar catálogos si no vienen por props
  useEffect(() => {
    if (!isOpen) return

    let isMounted = true

    const loadCatalogData = async () => {
      try {
        if (!propClientes || propClientes.length === 0) {
          const fetchedClis = await fetchClientes().catch(() => [])
          if (isMounted) setClientesList(fetchedClis)
        } else {
          setClientesList(propClientes)
        }

        if (!propProductos || propProductos.length === 0) {
          const fetchedProds = await fetchProducts().catch(() => [])
          if (isMounted) setProductosList(fetchedProds)
        } else {
          setProductosList(propProductos)
        }

        if (!propUsers || propUsers.length === 0) {
          const fetchedUsers = await fetchUsers().catch(() => [])
          if (isMounted) setOperariosList(fetchedUsers)
        } else {
          setOperariosList(propUsers)
        }
      } catch (err) {
        console.error('Error al cargar datos del catálogo:', err)
      }
    }

    loadCatalogData()

    return () => {
      isMounted = false
    }
  }, [isOpen, propClientes, propProductos, propUsers])

  // Cargar datos del pedido seleccionado cuando se abre el modal
  useEffect(() => {
    if (!isOpen || !pedido) return

    setError('')
    setSuccess('')
    setLoading(true)

    const initFormData = async () => {
      // Se trae el pedido actualizado del servidor; si falla, se usa el que vino por props
      let current = pedido
      if (pedido?.id) {
        try {
          const fresh = await getPedido(pedido.id)
          if (fresh) current = fresh
        } catch (err) {
          console.error('Error al obtener datos frescos del pedido:', err)
        }
      }

      const productIds = Array.from(new Set(current.productos?.map((p) => p.id) || []))
      // Cada entrada de current.productos es una línea (con su pivot)
      setLineas((current.productos || []).map((p, i) => ({
        uid: `linea-${p.pivot?.id ?? `${p.id}-${i}`}`,
        productId: p.id,
        cantidad: p.pivot?.cantidad || 1,
        // Las opciones que la línea no tenga guardadas arrancan con su valor por defecto
        atributos: { ...valoresPorDefecto(p), ...(p.pivot?.atributos ?? {}) },
      })))

      const defaultDeliveryDate = (() => {
        const d = new Date()
        d.setDate(d.getDate() + 15)
        return d.toISOString().split('T')[0]
      })()

      setFormData({
        cliente_id: current.cliente_id ? current.cliente_id.toString() : '',
        codigo: current.codigo || '',
        prioridad: current.prioridad || 'normal',
        fecha_entrega: current.fecha_entrega || defaultDeliveryDate,
        estado: current.estado || 'pendiente',
        precio: current.precio !== null && current.precio !== undefined ? current.precio.toString() : '',
        comentario: current.comentario || current.descripcion || '',
        tipo_pago: current.tipo_pago || 'parcial',
      })

      // Precargar etapas y asignaciones
      try {
        const assignments = await fetchResponsablesEtapas({ pedido_id: pedido.id }).catch(() => [])
        setPedidoTareas(assignments)

        if (productIds.length > 0) {
          // Las etapas solo se usan para mostrar/asignar responsables; si alguna falla, avisar
          const stagesResults = await Promise.all(productIds.map(id => etapasDeProducto(id, assignments).catch(() => null)))
          if (stagesResults.some((r) => r === null)) {
            setError('No se pudieron cargar las etapas de algunos productos. Cerrá y volvé a abrir el pedido para ver sus responsables.')
          }
          setLocalEtapas(stagesResults.flatMap((r) => r ?? []))
        } else {
          setLocalEtapas([])
        }

        const mapped: Record<string, number | null> = {}
        assignments.forEach((a) => {
          const epId = (a as any).etapa_producto_id || a.etapa_id
          if (epId) {
            mapped[epId.toString()] = a.user_id
          }
        })
        setLocalAssignments(mapped)
      } catch (err) {
        console.error('Error al precargar etapas y asignaciones:', err)
      } finally {
        setLoading(false)
      }
    }

    initFormData()
  }, [isOpen, pedido])

  // Etapas de un producto para este pedido: si el producto ya estaba en el pedido, las de sus tareas
  // (no cambian aunque se editen las etapas del producto); si es nuevo, las que tiene configuradas hoy.
  const etapasDeProducto = async (productId: number, tareas: ResponsableEtapa[]): Promise<Etapa[]> => {
    const tareasDelProducto = tareas.filter((t) => t.etapa?.producto_id === productId)
    if (tareasDelProducto.length > 0) return etapasDesdeTareas(tareasDelProducto)
    return fetchEtapas({ producto_id: productId })
  }

  const getProduct = (productId: number) =>
    productosList.find((p) => p.id === productId) ?? pedido?.productos?.find((p) => p.id === productId)

  // Productos distintos del pedido (para las etapas y responsables)
  const productIdsDelPedido = useMemo(() => Array.from(new Set(lineas.map((l) => l.productId))), [lineas])

  // Líneas repetidas: mismo producto con los mismos atributos (no se pueden guardar así)
  const lineasRepetidas = useMemo(() => {
    const vistas = new Map<string, number>()
    for (const l of lineas) {
      const key = claveLinea(l.productId, normalizarValores(getProduct(l.productId), l.atributos))
      vistas.set(key, (vistas.get(key) ?? 0) + 1)
    }
    return new Set(
      lineas
        .filter((l) => (vistas.get(claveLinea(l.productId, normalizarValores(getProduct(l.productId), l.atributos))) ?? 0) > 1)
        .map((l) => l.uid)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineas, productosList])

  const handleAgregarLinea = async (productId: number) => {
    const yaEstaba = lineas.some((l) => l.productId === productId)
    setLineas((prev) => [
      ...prev,
      { uid: nuevoUid(), productId, cantidad: 1, atributos: valoresPorDefecto(getProduct(productId)) },
    ])

    // Las etapas son por producto: se cargan solo la primera vez que entra al pedido
    if (yaEstaba) return
    try {
      const productStages = await etapasDeProducto(productId, pedidoTareas)
      setLocalEtapas((prevEtapas) => [...prevEtapas.filter((s) => s.producto_id !== productId), ...productStages])
    } catch (err) {
      console.error('Error al obtener etapas del producto:', err)
    }
  }

  const handleQuitarLinea = (uid: string) => {
    const linea = lineas.find((l) => l.uid === uid)
    const restantes = lineas.filter((l) => l.uid !== uid)
    setLineas(restantes)
    if (linea && !restantes.some((l) => l.productId === linea.productId)) {
      setLocalEtapas((prevEtapas) => prevEtapas.filter((s) => s.producto_id !== linea.productId))
    }
  }

  const handleCambiarLinea = (uid: string, cambios: Partial<Pick<LineaEdicion, 'cantidad' | 'atributos'>>) => {
    setLineas((prev) => prev.map((l) => (l.uid === uid ? { ...l, ...cambios } : l)))
  }

  const handleAssignTask = async (stageId: number | string, userIdVal: string) => {
    if (!pedido) return
    const userId = userIdVal ? parseInt(userIdVal) : null
    const stageKey = stageId.toString()

    setLocalAssignments((prev) => ({
      ...prev,
      [stageKey]: userId
    }))

    try {
      if (userId) {
        await assignTask({
          pedido_id: pedido.id,
          etapa_id: typeof stageId === 'number' ? stageId : parseInt(stageId.toString(), 10),
          user_id: userId,
          estado: 'pendiente'
        })
      } else {
        const existingAssignments = await fetchResponsablesEtapas({ pedido_id: pedido.id }).catch(() => [])
        const currentTask = existingAssignments.find(a => (a as any).etapa_producto_id === stageId || a.etapa_id === stageId)
        if (currentTask) {
          await removeTaskAssignment(currentTask.id).catch(() => {})
        }
      }
    } catch (err) {
      console.error('Error al guardar la asignación de tarea:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pedido) return

    setError('')
    setSuccess('')

    if (!formData.fecha_entrega) {
      setError('Falta seleccionar la fecha estimada de entrega')
      return
    }

    if (!formData.precio || isNaN(parseFloat(formData.precio))) {
      setError('Falta ingresar un precio válido para el pedido')
      return
    }

    const precioNum = parseFloat(formData.precio)

    if (lineasRepetidas.size > 0) {
      setError('Hay productos repetidos con los mismos atributos. Cambiá algún atributo o dejá una sola línea con la cantidad total.')
      return
    }

    try {
      setSaving(true)
      const payload: UpdatePedidoInput = {
        cliente_id: formData.cliente_id ? parseInt(formData.cliente_id) : undefined,
        codigo: formData.codigo.trim(),
        estado: formData.estado,
        prioridad: formData.prioridad,
        fecha_entrega: formData.fecha_entrega,
        precio: precioNum,
        comentario: formData.comentario || null,
        descripcion: formData.comentario || null,
        tipo_pago: formData.tipo_pago,
        productos: lineas.map((l) => ({
          id: l.productId,
          cantidad: l.cantidad || 1,
          atributos: normalizarValores(getProduct(l.productId), l.atributos),
        })),
        asignaciones: Object.entries(localAssignments).map(([key, userId]) => ({
          etapa_id: parseInt(key),
          user_id: userId
        }))
      }

      const updated = await updatePedido(pedido.id, payload)
      setSuccess('Pedido actualizado correctamente')

      if (onPedidoUpdated) {
        onPedidoUpdated(updated)
      }

      setTimeout(() => {
        onClose()
      }, 500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el pedido')
    } finally {
      setSaving(false)
    }
  }

  if (!pedido) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-2xl p-6 text-slate-300 max-h-[90vh] overflow-y-auto"
    >
      <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>✏️</span> Editar Pedido #{pedido.id}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Modifique los datos generales, productos y asignación de operarios del pedido.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 px-3.5 py-2 rounded-xl text-xs font-semibold">
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-3.5 py-2 rounded-xl text-xs font-semibold">
          ✓ {success}
        </div>
      )}

      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
          <span className="text-xs text-slate-400">Cargando datos del pedido...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {/* Cliente */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Cliente
            </label>
            <select
              value={formData.cliente_id}
              onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
            >
              <option value="">-- Seleccionar Cliente --</option>
              {clientesList.map((cli) => (
                <option key={cli.id} value={cli.id}>
                  {cli.nombre_cliente} {cli.nombre_empresa ? `(${cli.nombre_empresa})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Fecha de Entrega y Prioridad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Fecha Estimada de Entrega *
              </label>
              <input
                type="date"
                value={formData.fecha_entrega}
                onChange={(e) => setFormData({ ...formData, fecha_entrega: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Prioridad *
              </label>
              <select
                value={formData.prioridad}
                onChange={(e) => setFormData({ ...formData, prioridad: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              >
                <option value="baja">Baja</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>
          </div>

          {/* Precio y Estado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Precio Total ($) *
              </label>
              <input
                type="text"
                placeholder="Ej. 15000"
                value={formData.precio}
                onChange={(e) => {
                  const val = e.target.value
                  if (/^[0-9]*\.?[0-9]*$/.test(val)) {
                    setFormData({ ...formData, precio: val })
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Estado del Pedido
              </label>
              <select
                value={formData.estado}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              >
                <option value="pendiente">Pendiente</option>
                <option value="listo_para_produccion">Listo para producción</option>
                <option value="en_progreso">En Progreso</option>
                <option value="completado">Completado</option>
                <option value="completado_pd">Completado - Pend. Pago (PD)</option>
                <option value="enviado">Enviado</option>
                <option value="enviado_faltante">Enviado con faltante</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>

          {/* Comentario / Descripción */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Descripción / Observaciones
            </label>
            <textarea
              placeholder="Escribe notas o una descripción detallada para el pedido..."
              value={formData.comentario}
              onChange={(e) => setFormData({ ...formData, comentario: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition h-20 resize-none"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              El bloque &quot;Atributos de los productos&quot; se arma solo con los productos del pedido y se actualiza al guardar.
            </p>
          </div>

          {/* Selección de Productos: cada "Agregar" suma una línea; se puede repetir con otros atributos */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Agregar Productos
            </label>
            <div className="mb-2">
              <input
                type="text"
                placeholder="Filtrar productos..."
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>
            {productosList.length === 0 ? (
              <p className="text-slate-500 italic text-xs">No hay productos disponibles.</p>
            ) : (
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
                {productosList
                  .filter((prod) => (prod.nombre || '').toLowerCase().includes(productSearchQuery.toLowerCase().trim()))
                  .map((prod) => {
                    const enPedido = lineas.filter((l) => l.productId === prod.id).length
                    return (
                      <div key={prod.id} className="flex items-center justify-between gap-2 text-sm px-1.5 py-1 hover:bg-slate-900/60 rounded">
                        <span className="min-w-0 truncate font-semibold text-xs text-slate-200">{prod.nombre}</span>
                        <div className="flex shrink-0 items-center gap-2">
                          {enPedido > 0 && (
                            <span className="text-[10px] font-semibold text-blue-300 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                              En el pedido{enPedido > 1 ? ` (${enPedido})` : ''}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleAgregarLinea(prod.id)}
                            className="text-[11px] font-bold text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 px-2 py-0.5 rounded transition cursor-pointer"
                          >
                            + Agregar
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          {/* Líneas del pedido: cantidad y atributos de cada una */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Productos del Pedido ({lineas.length})
            </label>
            {lineas.length === 0 ? (
              <p className="text-slate-500 italic text-xs">Todavía no hay productos en el pedido.</p>
            ) : (
              <ul className="space-y-2">
                {lineas.map((linea) => {
                  const product = getProduct(linea.productId)
                  const repetida = lineasRepetidas.has(linea.uid)
                  return (
                    <li
                      key={linea.uid}
                      className={`rounded-lg border p-2.5 space-y-2 ${repetida ? 'border-rose-500/50 bg-rose-500/5' : 'border-slate-800 bg-slate-950/60'}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-200">{product?.nombre ?? `Producto #${linea.productId}`}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">Cant:</span>
                        <input
                          type="number"
                          min={1}
                          // Vacío muestra el placeholder "1"; al guardar, vacío se envía como 1
                          value={linea.cantidad || ''}
                          placeholder="1"
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleCambiarLinea(linea.uid, { cantidad: parseInt(e.target.value) || 0 })}
                          className="w-16 placeholder:text-slate-500 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-blue-500 text-center"
                        />
                        <button
                          type="button"
                          onClick={() => handleQuitarLinea(linea.uid)}
                          className="grid size-6 place-items-center rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                          title="Quitar del pedido"
                          aria-label="Quitar del pedido"
                        >
                          ✕
                        </button>
                      </div>
                      {product && (
                        <AtributosLineaFields
                          compact
                          product={product}
                          value={linea.atributos}
                          onChange={(atributos) => handleCambiarLinea(linea.uid, { atributos })}
                        />
                      )}
                      {repetida && (
                        <p className="text-[11px] font-semibold text-rose-300">
                          Este producto ya está en el pedido con los mismos atributos.
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Etapas de Fabricación y Operarios Responsables */}
          {productIdsDelPedido.length > 0 && (
            <div className="border-t border-slate-800 pt-3 space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Asignación de Operarios por Etapa
              </label>
              <div className="space-y-3 max-h-48 overflow-y-auto bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                {productIdsDelPedido.map((prodId) => {
                  const product = getProduct(prodId)
                  const productStages = topologicalSortEtapas(
                    localEtapas.filter(s => s.producto_id === prodId)
                  )

                  return (
                    <div key={prodId} className="space-y-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/40">
                      <div className="flex items-center justify-between border-b border-slate-850 pb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                          {product?.nombre}
                        </span>
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                          {loading ? 'Cargando...' : `${productStages.length} etapas`}
                        </span>
                      </div>

                      {loading ? (
                        <div className="flex items-center gap-2 py-1.5 text-xs text-slate-400">
                          <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                          <span>Cargando etapas...</span>
                        </div>
                      ) : productStages.length === 0 ? (
                        <span className="text-xs text-slate-500 italic block py-1">Sin etapas configuradas.</span>
                      ) : (
                        <div className="space-y-1.5">
                          {productStages.map((stage) => {
                            const stageKey = (stage.id || (stage as any).temp_id).toString()
                            return (
                              <div key={stageKey} className="flex items-center justify-between text-xs bg-slate-950 border border-slate-850 p-2 rounded-lg">
                                <span className="font-semibold text-slate-200">{stage.orden}. {stage.nombre}</span>
                                <select
                                  value={localAssignments[stageKey] || ''}
                                  onChange={(e) => handleAssignTask(stage.id || (stage as any).temp_id, e.target.value)}
                                  className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500 transition"
                                >
                                  <option value="">Sin Asignar</option>
                                  {operariosList.map((op) => (
                                    <option key={op.id} value={op.id}>
                                      👤 {op.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Botones del Formulario */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold shadow transition hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

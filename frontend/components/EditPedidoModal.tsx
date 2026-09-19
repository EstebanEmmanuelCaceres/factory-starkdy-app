'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/Modal'
import { type Pedido, updatePedido, type UpdatePedidoInput } from '@/lib/pedidos'
import { fetchClientes, type Cliente } from '@/lib/clientes'
import { fetchProducts, type Product } from '@/lib/products'
import { fetchUsers, type User } from '@/lib/auth'
import { fetchEtapas, topologicalSortEtapas, type Etapa } from '@/lib/entities/etapas'
import { fetchResponsablesEtapas, assignTask, removeTaskAssignment, type ResponsableEtapa } from '@/lib/responsable_etapas'

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
    selectedProductIds: [] as number[],
    productQuantities: {} as Record<number, number>
  })

  // Etapas y asignaciones
  const [localEtapas, setLocalEtapas] = useState<Etapa[]>([])
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
      const productIds = pedido.productos?.map((p) => p.id) || []
      const quantities = pedido.productos?.reduce((acc, curr) => {
        const qty = (curr as any).pivot?.cantidad || 1
        acc[curr.id] = qty
        return acc
      }, {} as Record<number, number>) || {}

      const defaultDeliveryDate = (() => {
        const d = new Date()
        d.setDate(d.getDate() + 15)
        return d.toISOString().split('T')[0]
      })()

      setFormData({
        cliente_id: pedido.cliente_id ? pedido.cliente_id.toString() : '',
        codigo: pedido.codigo || '',
        prioridad: pedido.prioridad || 'normal',
        fecha_entrega: pedido.fecha_entrega || defaultDeliveryDate,
        estado: pedido.estado || 'pendiente',
        precio: pedido.precio !== null && pedido.precio !== undefined ? pedido.precio.toString() : '',
        comentario: pedido.comentario || '',
        tipo_pago: pedido.tipo_pago || 'parcial',
        selectedProductIds: productIds,
        productQuantities: quantities
      })

      // Precargar etapas y asignaciones
      try {
        if (productIds.length > 0) {
          const stagesResults = await Promise.all(productIds.map(id => fetchEtapas({ producto_id: id }).catch(() => [])))
          setLocalEtapas(stagesResults.flat())
        } else {
          setLocalEtapas([])
        }

        const assignments = await fetchResponsablesEtapas({ pedido_id: pedido.id }).catch(() => [])
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

  const handleProductCheckboxChange = async (productId: number) => {
    const isSelected = formData.selectedProductIds.includes(productId)
    let updatedIds: number[]
    let updatedQuantities = { ...formData.productQuantities }

    if (isSelected) {
      updatedIds = formData.selectedProductIds.filter((id) => id !== productId)
      delete updatedQuantities[productId]
      setLocalEtapas((prevEtapas) => prevEtapas.filter(s => s.producto_id !== productId))
    } else {
      updatedIds = [...formData.selectedProductIds, productId]
      updatedQuantities[productId] = 1
      try {
        const productStages = await fetchEtapas({ producto_id: productId }).catch(() => [])
        setLocalEtapas((prevEtapas) => {
          const filtered = prevEtapas.filter(s => s.producto_id !== productId)
          return [...filtered, ...productStages]
        })
      } catch (err) {
        console.error('Error al obtener etapas del producto:', err)
      }
    }

    setFormData((prev) => ({
      ...prev,
      selectedProductIds: updatedIds,
      productQuantities: updatedQuantities
    }))
  }

  const handleProductQuantityChange = (productId: number, val: number) => {
    setFormData((prev) => ({
      ...prev,
      productQuantities: {
        ...prev.productQuantities,
        [productId]: val
      }
    }))
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
        tipo_pago: formData.tipo_pago,
        productos: formData.selectedProductIds.map((id) => ({
          id,
          cantidad: formData.productQuantities[id] || 1
        })),
        etapas: localEtapas.map((s, index) => ({
          id: s.id || undefined,
          producto_id: s.producto_id,
          nombre: s.nombre,
          orden: index + 1
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
          </div>

          {/* Selección de Productos */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Productos Asociados
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
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                {productosList
                  .filter((prod) => (prod.nombre || '').toLowerCase().includes(productSearchQuery.toLowerCase().trim()))
                  .map((prod) => {
                    const isSelected = formData.selectedProductIds.includes(prod.id)
                    return (
                      <div key={prod.id} className="flex items-center justify-between text-sm p-1 hover:bg-slate-900/60 rounded">
                        <label className="flex items-center gap-2.5 cursor-pointer flex-grow text-left">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleProductCheckboxChange(prod.id)}
                            className="rounded border-slate-800 bg-slate-900 text-blue-600 focus:ring-blue-500/20"
                          />
                          <span className="font-semibold text-xs text-slate-200">{prod.nombre}</span>
                        </label>
                        {isSelected && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 font-semibold">Cant:</span>
                            <input
                              type="number"
                              min="1"
                              value={formData.productQuantities[prod.id] || 1}
                              onChange={(e) => handleProductQuantityChange(prod.id, parseInt(e.target.value) || 1)}
                              className="w-14 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-blue-500 text-center"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          {/* Etapas de Fabricación y Operarios Responsables */}
          {formData.selectedProductIds.length > 0 && (
            <div className="border-t border-slate-800 pt-3 space-y-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Asignación de Operarios por Etapa
              </label>
              <div className="space-y-3 max-h-48 overflow-y-auto bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                {formData.selectedProductIds.map((prodId) => {
                  const product = productosList.find(p => p.id === prodId)
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
                          {productStages.length} etapas
                        </span>
                      </div>

                      {productStages.length === 0 ? (
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

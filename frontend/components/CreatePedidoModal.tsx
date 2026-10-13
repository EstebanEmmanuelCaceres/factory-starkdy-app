'use client'

import React, { useState, useEffect } from 'react'
import { Modal } from './Modal/Modal'
import { useModal } from './Modal/context/ModalContext'
import { fetchClientes, type Cliente } from '@/lib/clientes'
import { fetchProducts, type Product } from '@/lib/products'
import { createPedido, type CreatePedidoInput, type Pedido } from '@/lib/pedidos'
import { fetchEtapas } from '@/lib/entities/etapas'
import { WizardStepper } from './WizardStep'
import { OrderBar } from './order-cart/OrderBar'
import { PaymentMethodField } from './order-cart/PaymentMethodField'
import { FormProvider, useForm } from 'react-hook-form'
import { OrderFormValues, getDefaultOrderValues } from './order-cart/Types'

export const CREATE_PEDIDO_MODAL_ID = 'create-pedido'

export interface CreatePedidoModalProps {
  id?: string
  clientes?: Cliente[]
  productos?: Product[]
  onPedidoCreated?: (pedido?: any) => void
  onClose?: () => void
}

const getPriorityBadgeClass = (priority: string) => {
  switch (priority) {
    case 'critica':
      return 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
    case 'alta':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
    case 'normal':
      return 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
    case 'baja':
    default:
      return 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
  }
}

const getDefaultDeliveryDate = () => {
  const d = new Date()
  d.setDate(d.getDate() + 15)
  return d.toISOString().split('T')[0]
}

export const CreatePedidoModal = ({
  id = CREATE_PEDIDO_MODAL_ID,
  clientes: propClientes,
  productos: propProductos,
  onPedidoCreated,
  onClose,
}: CreatePedidoModalProps) => {
  const { isOpen, close } = useModal(id)

  const [clientesList, setClientesList] = useState<Cliente[]>(propClientes || [])
  const [productosList, setProductosList] = useState<Product[]>(propProductos || [])

  // Pasos del Wizard
  const [wizardStep, setWizardStep] = useState<
    'select_client' | 'client_confirmation' | 'order_details' | 'order_confirmation'
  >('select_client')

  // Estado del selector / registro de cliente
  const [clientMode, setClientMode] = useState<'search' | 'create'>('search')
  const [clientSearchText, setClientSearchText] = useState('')
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false)
  const [selectedWizardClient, setSelectedWizardClient] = useState<Cliente | null>(null)
  const [wizardNewClient, setWizardNewClient] = useState<any | null>(null)

  // Datos del pedido
  const [formData, setFormData] = useState({
    cliente_id: '',
    codigo: '',
    prioridad: 'normal' as 'baja' | 'normal' | 'alta' | 'critica',
    fecha_entrega: getDefaultDeliveryDate(),
    estado: 'pendiente',
    selectedProductIds: [] as number[],
    productQuantities: {} as Record<number, number>,
    precio: '',
    comentario: '',
    tipo_pago: 'parcial' as 'unico' | 'parcial',
    monto_pago_inicial: '',
    medio_pago_inicial: 'transferencia',
    observaciones_pago_inicial: ''
  })

  // Formulario de nuevo cliente rápido
  const [clienteFormData, setClienteFormData] = useState({
    nombre_cliente: '',
    nombre_empresa: '',
    email: '',
    telefono: '',
    dni: '',
    direccion: '',
    provincia: '',
    cp: '',
    localidad: '',
    saldo: 0,
    observaciones: ''
  })

  // Etapas de productos asociados
  const [localEtapas, setLocalEtapas] = useState<any[]>([])
  const [productSearchQuery, setProductSearchQuery] = useState('')
  const [createdPedidoResult, setCreatedPedidoResult] = useState<Pedido | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Sincronizar catálogos si vienen por props o cargarlos al abrir
  useEffect(() => {
    if (propClientes) setClientesList(propClientes)
  }, [propClientes])

  useEffect(() => {
    if (propProductos) setProductosList(propProductos)
  }, [propProductos])

  useEffect(() => {
    if (!isOpen) return
    if (!propClientes || propClientes.length === 0) {
      fetchClientes().then(setClientesList).catch(console.error)
    }
    if (!propProductos || propProductos.length === 0) {
      fetchProducts().then(setProductosList).catch(console.error)
    }
  }, [isOpen, propClientes, propProductos])

  // Al abrir, generar código por defecto
  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        codigo: `PD-${Date.now().toString().slice(-6)}`,
        fecha_entrega: getDefaultDeliveryDate()
      }))
    }
  }, [isOpen])

  const resetForm = () => {
    setWizardStep('select_client')
    setClientMode('search')
    setClientSearchText('')
    setIsClientDropdownOpen(false)
    setSelectedWizardClient(null)
    setWizardNewClient(null)
    setCreatedPedidoResult(null)
    setProductSearchQuery('')
    setError('')
    setSubmitting(false)
    setLocalEtapas([])
    setFormData({
      cliente_id: '',
      codigo: `PD-${Date.now().toString().slice(-6)}`,
      prioridad: 'normal',
      fecha_entrega: getDefaultDeliveryDate(),
      estado: 'pendiente',
      selectedProductIds: [],
      productQuantities: {},
      precio: '',
      comentario: '',
      tipo_pago: 'parcial',
      monto_pago_inicial: '',
      medio_pago_inicial: 'transferencia',
      observaciones_pago_inicial: ''
    })
    setClienteFormData({
      nombre_cliente: '',
      nombre_empresa: '',
      email: '',
      telefono: '',
      dni: '',
      direccion: '',
      provincia: '',
      cp: '',
      localidad: '',
      saldo: 0,
      observaciones: ''
    })
  }

  const handleClose = () => {
    resetForm()
    close()
    onClose?.()
  }

  const handleProductCheckboxChange = async (productId: number) => {
    const alreadySelected = formData.selectedProductIds.includes(productId)
    const updatedIds = alreadySelected
      ? formData.selectedProductIds.filter((id) => id !== productId)
      : [...formData.selectedProductIds, productId]

    const updatedQuantities = { ...formData.productQuantities }
    if (alreadySelected) {
      delete updatedQuantities[productId]
      setLocalEtapas((stages) => stages.filter((s) => s.producto_id !== productId))
    } else {
      updatedQuantities[productId] = 0
      try {
        const productStages = await fetchEtapas({ producto_id: productId })
        setLocalEtapas((prevEtapas) => {
          const filtered = prevEtapas.filter((s) => s.producto_id !== productId)
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

  const handleWizardCreateClienteSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const payload = {
      nombre_cliente: clienteFormData.nombre_cliente.trim(),
      nombre_empresa: clienteFormData.nombre_empresa.trim(),
      email: clienteFormData.email?.trim() || null,
      telefono: clienteFormData.telefono.trim(),
      dni: clienteFormData.dni?.trim() || null,
      direccion: clienteFormData.direccion?.trim() || null,
      provincia: clienteFormData.provincia?.trim() || null,
      cp: clienteFormData.cp?.trim() || null,
      localidad: clienteFormData.localidad?.trim() || null,
      saldo: Number(clienteFormData.saldo) || 0,
      observaciones: clienteFormData.observaciones?.trim() || null
    }

    setWizardNewClient(payload)

    const tempClient: Cliente = {
      id: 0,
      nombre_cliente: payload.nombre_cliente,
      nombre_empresa: payload.nombre_empresa,
      telefono: payload.telefono,
      email: payload.email,
      dni: payload.dni,
      direccion: payload.direccion,
      provincia: payload.provincia,
      cp: payload.cp,
      localidad: payload.localidad,
      ingreso: 0,
      valor_total: 0,
      saldo: payload.saldo,
      observaciones: payload.observaciones,
      created_at: '',
      updated_at: ''
    }

    setSelectedWizardClient(tempClient)
    setFormData((prev) => ({
      ...prev,
      cliente_id: 'new'
    }))
    setClientSearchText(`${payload.nombre_cliente} - ${payload.nombre_empresa}`)
    setWizardStep('order_details')
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.cliente_id) {
      setError('Falta seleccionar el cliente')
      return
    }

    if (!formData.fecha_entrega) {
      setError('Falta seleccionar la fecha estimada de entrega')
      return
    }

    if (!formData.precio || isNaN(parseFloat(formData.precio))) {
      setError('Falta ingresar el precio del pedido')
      return
    }

    const montoInicialNum = formData.monto_pago_inicial ? parseFloat(formData.monto_pago_inicial) : 0
    const precioNum = parseFloat(formData.precio)

    if (montoInicialNum > 0 && montoInicialNum > precioNum) {
      setError(`El pago inicial ($${montoInicialNum.toLocaleString('es-AR')}) no puede superar el precio total ($${precioNum.toLocaleString('es-AR')})`)
      return
    }

    setSubmitting(true)
    try {
      const isNewClient = formData.cliente_id === 'new'
      const payload: CreatePedidoInput = {
        cliente_id: isNewClient ? null : parseInt(formData.cliente_id),
        cliente: isNewClient ? wizardNewClient : null,
        codigo: formData.codigo.trim() || `PD-${Date.now().toString().slice(-6)}`,
        prioridad: formData.prioridad,
        fecha_entrega: formData.fecha_entrega,
        precio: precioNum,
        comentario: formData.comentario || null,
        tipo_pago: formData.tipo_pago,
        monto_pago_inicial: montoInicialNum > 0 ? montoInicialNum : null,
        medio_pago_inicial: montoInicialNum > 0 ? formData.medio_pago_inicial : null,
        observaciones_pago_inicial: montoInicialNum > 0 ? formData.observaciones_pago_inicial : null,
        productos: formData.selectedProductIds.map((pid) => ({
          id: pid,
          cantidad: formData.productQuantities[pid] || 1
        })),
        etapas: localEtapas.map((s, index) => ({
          id: s.id || null,
          temp_id: s.temp_id || null,
          producto_id: s.producto_id,
          nombre: s.nombre,
          orden: index + 1
        }))
      }

      const newPedido = await createPedido(payload)
      setCreatedPedidoResult(newPedido)
      onPedidoCreated?.(newPedido)
      setWizardStep('order_confirmation')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear el pedido')
    } finally {
      setSubmitting(false)
    }
  }

  const methods = useForm<OrderFormValues>({ defaultValues: getDefaultOrderValues() })

  if (!isOpen) return null

  return (
    <Modal id={id} onClose={handleClose}>
      <FormProvider {...methods}>
        <div className='flex flex-wrap relative pb-4 border-b border-slate-800 w-full justify-between'>
          <h2 className="text-xl font-bold text-white">Registrar Nuevo Pedido</h2>
          <WizardStepper currentStep={wizardStep} />
        </div>

        {/* Errores internos del wizard */}
        {error && (
          <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-200 px-3 py-2 rounded-lg flex items-center gap-2 text-xs">
            <span>❌</span>
            <span className="font-semibold">{error}</span>
          </div>
        )}
        {/* Paso 1: Selección o Registro de Cliente */}

        {wizardStep === 'select_client' && (
          <div className="mt-4 space-y-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Seleccionar o Registrar Cliente
            </h3>

            {/* Selector de modo */}
            <div className="flex bg-slate-950/80 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setClientMode('search')
                  setError('')
                }}
                className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-md transition ${clientMode === 'search'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                🔍 Buscar Cliente Existente
              </button>
              <button
                type="button"
                onClick={() => {
                  setClientMode('create')
                  setError('')
                }}
                className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-md transition ${clientMode === 'create'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                ➕ Registrar Nuevo Cliente
              </button>
            </div>

            {clientMode === 'search' ? (
              <div className="space-y-3 relative text-left">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Buscar Cliente *
                </label>
                <input
                  type="text"
                  placeholder="Escribe el nombre o empresa del cliente..."
                  value={clientSearchText}
                  onChange={(e) => {
                    setClientSearchText(e.target.value)
                    setIsClientDropdownOpen(true)
                  }}
                  onFocus={() => setIsClientDropdownOpen(true)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                />

                {isClientDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsClientDropdownOpen(false)} />
                    <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-lg shadow-xl divide-y divide-slate-900 text-left">
                      {clientesList
                        .filter((c) => {
                          const query = clientSearchText.toLowerCase().trim()
                          return (
                            (c.nombre_cliente || '').toLowerCase().includes(query) ||
                            (c.nombre_empresa || '').toLowerCase().includes(query) ||
                            (c.email || '').toLowerCase().includes(query)
                          )
                        })
                        .map((c) => {
                          const isBlocked = Boolean(
                            c.alcanzo_limite ||
                            (Number(c.saldo || 0) > 0 &&
                              Number(c.total_pedidos || 0) >= Number(c.saldo || 0))
                          )
                          return (
                            <div
                              key={c.id}
                              onClick={() => {
                                setFormData({ ...formData, cliente_id: c.id.toString() })
                                setClientSearchText(`${c.nombre_cliente} - ${c.nombre_empresa}`)
                                setSelectedWizardClient(c)
                                setIsClientDropdownOpen(false)
                                methods.setValue('client', {
                                  id: c.id,
                                  nombre_cliente: c.nombre_cliente,
                                  nombre_empresa: c.nombre_empresa,
                                })
                              }}
                              className={`px-3.5 py-2 cursor-pointer text-sm transition flex justify-between items-center ${isBlocked
                                ? 'bg-rose-950/20 hover:bg-rose-900/30 text-rose-300'
                                : 'hover:bg-slate-900 text-slate-300 hover:text-white'
                                }`}
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">{c.nombre_cliente}</span>
                                  {isBlocked && (
                                    <span className="text-[10px] bg-rose-500/20 text-rose-400 font-bold px-1.5 py-0.5 rounded border border-rose-500/30">
                                      🚨 Alcanzó el límite
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-slate-500">{c.nombre_empresa}</span>
                              </div>
                              {c.email && <span className="text-xs text-slate-500">{c.email}</span>}
                            </div>
                          )
                        })}
                      {clientesList.filter((c) => {
                        const query = clientSearchText.toLowerCase().trim()
                        return (
                          (c.nombre_cliente || '').toLowerCase().includes(query) ||
                          (c.nombre_empresa || '').toLowerCase().includes(query) ||
                          (c.email || '').toLowerCase().includes(query)
                        )
                      }).length === 0 && (
                          <div className="px-3.5 py-2 text-xs text-slate-500 italic text-center">
                            No se encontraron clientes con ese nombre.
                          </div>
                        )}
                    </div>
                  </>
                )}

                {/* Tarjeta de cliente seleccionado */}
                {selectedWizardClient && (
                  <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-1">
                      <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                        Cliente Seleccionado
                      </span>
                      {selectedWizardClient.alcanzo_limite ||
                        (Number(selectedWizardClient.saldo || 0) > 0 &&
                          Number(selectedWizardClient.total_pedidos || 0) >=
                          Number(selectedWizardClient.saldo || 0)) ? (
                        <span className="text-rose-400 text-xs font-bold">⛔ Límite Alcanzado</span>
                      ) : (
                        <span className="text-emerald-400 text-xs">✓ Listo</span>
                      )}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-white">
                        {selectedWizardClient.nombre_cliente}
                      </span>
                      <span className="text-xs text-slate-400 block">
                        {selectedWizardClient.nombre_empresa}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-1">
                      <div>📞 {selectedWizardClient.telefono || 'Sin teléfono'}</div>
                      <div>✉️ {selectedWizardClient.email || 'Sin correo'}</div>
                    </div>

                    {Number(selectedWizardClient.saldo || 0) > 0 ? (
                      <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-lg text-xs space-y-1 mt-1">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Límite de Crédito:</span>
                          <span className="font-bold text-white">
                            ${Number(selectedWizardClient.saldo).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total en Pedidos:</span>
                          <span className="font-bold text-amber-400">
                            ${Number(selectedWizardClient.total_pedidos || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-slate-800 pt-1">
                          <span className="font-semibold text-slate-300">Crédito Disponible:</span>
                          <span
                            className={`font-bold ${selectedWizardClient.alcanzo_limite ||
                              Number(selectedWizardClient.total_pedidos || 0) >=
                              Number(selectedWizardClient.saldo || 0)
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                              }`}
                          >
                            $
                            {Number(
                              selectedWizardClient.saldo_disponible ??
                              Number(selectedWizardClient.saldo) -
                              Number(selectedWizardClient.total_pedidos || 0)
                            ).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 bg-slate-900/40 p-2 rounded border border-slate-850">
                        ♾️ Cliente sin límite de crédito configurado.
                      </div>
                    )}

                    {(selectedWizardClient.alcanzo_limite ||
                      (Number(selectedWizardClient.saldo || 0) > 0 &&
                        Number(selectedWizardClient.total_pedidos || 0) >=
                        Number(selectedWizardClient.saldo || 0))) && (
                        <div className="mt-1 bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl text-rose-300 text-xs font-semibold flex items-center gap-2.5">
                          <span className="text-lg">⛔</span>
                          <div>
                            <span className="font-bold block text-sm mb-0.5">
                              ¡Ha alcanzado el límite de crédito!
                            </span>
                            Total en pedidos ($
                            {Number(selectedWizardClient.total_pedidos || 0).toFixed(2)}) alcanzó o
                            superó el límite asignado ($
                            {Number(selectedWizardClient.saldo || 0).toFixed(2)}). Debe saldar o ampliar
                            el límite para registrar nuevos pedidos.
                          </div>
                        </div>
                      )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800 mt-6">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={
                      !formData.cliente_id ||
                      Boolean(
                        selectedWizardClient?.alcanzo_limite ||
                        (Number(selectedWizardClient?.saldo || 0) > 0 &&
                          Number(selectedWizardClient?.total_pedidos || 0) >=
                          Number(selectedWizardClient?.saldo || 0))
                      )
                    }
                    onClick={() => setWizardStep('order_details')}
                    className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium shadow transition hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 cursor-pointer"
                  >
                    Continuar ➡️
                  </button>
                </div>
              </div>
            ) : (
              /* Formulario de Registro Rápido integrado */
              <form onSubmit={handleWizardCreateClienteSubmit} className="space-y-4 text-left">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Nombre del Cliente *
                    </label>
                    <input
                      type="text"
                      required
                      value={clienteFormData.nombre_cliente}
                      onChange={(e) =>
                        setClienteFormData({ ...clienteFormData, nombre_cliente: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                      placeholder="Ej. Juan Pérez"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Nombre de la Empresa *
                    </label>
                    <input
                      type="text"
                      required
                      value={clienteFormData.nombre_empresa}
                      onChange={(e) =>
                        setClienteFormData({ ...clienteFormData, nombre_empresa: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                      placeholder="Ej. Empresa S.A."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Teléfono *
                    </label>
                    <input
                      type="text"
                      required
                      value={clienteFormData.telefono || ''}
                      onChange={(e) =>
                        setClienteFormData({ ...clienteFormData, telefono: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                      placeholder="Ej. +54 9 11 1234-5678"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      value={clienteFormData.email || ''}
                      onChange={(e) =>
                        setClienteFormData({ ...clienteFormData, email: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                      placeholder="ejemplo@correo.com"
                    />
                  </div>
                </div>

                <details className="group border border-slate-800 rounded-lg bg-slate-950/30 overflow-hidden">
                  <summary className="list-none flex items-center justify-between p-3 text-xs text-slate-400 font-semibold cursor-pointer select-none hover:bg-slate-950/60 transition">
                    <span>Información Adicional (Dirección, Facturación, etc.)</span>
                    <span className="transition-transform group-open:rotate-180">▼</span>
                  </summary>
                  <div className="p-3 border-t border-slate-800 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                          DNI
                        </label>
                        <input
                          type="text"
                          value={clienteFormData.dni || ''}
                          onChange={(e) =>
                            setClienteFormData({ ...clienteFormData, dni: e.target.value })
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                          placeholder="Ej. 12345678"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                          Localidad
                        </label>
                        <input
                          type="text"
                          value={clienteFormData.localidad || ''}
                          onChange={(e) =>
                            setClienteFormData({ ...clienteFormData, localidad: e.target.value })
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                          placeholder="Ej. Lanús"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                          Provincia
                        </label>
                        <input
                          type="text"
                          value={clienteFormData.provincia || ''}
                          onChange={(e) =>
                            setClienteFormData({ ...clienteFormData, provincia: e.target.value })
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                          placeholder="Ej. Buenos Aires"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                          Código Postal (CP)
                        </label>
                        <input
                          type="text"
                          value={clienteFormData.cp || ''}
                          onChange={(e) =>
                            setClienteFormData({ ...clienteFormData, cp: e.target.value })
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                          placeholder="Ej. 1824"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Dirección
                      </label>
                      <input
                        type="text"
                        value={clienteFormData.direccion || ''}
                        onChange={(e) =>
                          setClienteFormData({ ...clienteFormData, direccion: e.target.value })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                        placeholder="Ej. Av. 9 de Julio 1234"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Saldo ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={clienteFormData.saldo}
                        onChange={(e) =>
                          setClienteFormData({
                            ...clienteFormData,
                            saldo: Number(e.target.value)
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                        placeholder="0.00"
                      />
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        Si el saldo es negativo, la creación de pedidos estará deshabilitada para este cliente.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Observaciones
                      </label>
                      <textarea
                        rows={2}
                        value={clienteFormData.observaciones || ''}
                        onChange={(e) =>
                          setClienteFormData({ ...clienteFormData, observaciones: e.target.value })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                        placeholder="Notas sobre el cliente..."
                      />
                    </div>
                  </div>
                </details>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800 mt-6">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium shadow transition hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  >
                    Registrar y Continuar ➡️
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Paso 1.5: Confirmación de Registro de Cliente */}
        {wizardStep === 'client_confirmation' && selectedWizardClient && (
          <div className="space-y-6 text-center py-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-center mx-auto w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-2xl shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              ✅
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">¡Cliente Registrado con Éxito!</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Se ha guardado la ficha del cliente en el sistema y se ha seleccionado automáticamente para este pedido.
              </p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 text-left max-w-md mx-auto space-y-3">
              <div className="border-b border-slate-850 pb-2 flex justify-between items-center">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Ficha de Cliente
                </span>
                <span className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-mono">
                  ID: #{selectedWizardClient.id}
                </span>
              </div>
              <div>
                <span className="text-sm font-bold text-white block">
                  {selectedWizardClient.nombre_cliente}
                </span>
                <span className="text-xs text-slate-400 font-medium block">
                  {selectedWizardClient.nombre_empresa}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400 pt-2 border-t border-slate-850/50">
                <div>📞 {selectedWizardClient.telefono || 'Sin teléfono'}</div>
                <div>✉️ {selectedWizardClient.email || 'Sin correo'}</div>
                <div className="sm:col-span-2">
                  📍{' '}
                  {selectedWizardClient.direccion
                    ? `${selectedWizardClient.direccion}, ${selectedWizardClient.localidad || ''}`
                    : 'Sin dirección registrada'}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-6 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setWizardStep('select_client')}
                className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={() => setWizardStep('order_details')}
                className="px-5 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow transition hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                Continuar al Pedido ➡️
              </button>
            </div>
          </div>
        )}

        {/* Paso 2: Creación de Pedido */}
        {selectedWizardClient && wizardStep === 'order_details' && (
          <>
            <div className='px-6 py-4 border-b border-[#1b263d]'>
              <OrderBar onChangeClient={() => setWizardStep('select_client')} />
            </div>
            <div className="w-full flex-1 min-h-0 block lg:grid grid-cols-[minmax(0,1fr)_420px] grid-rows-[minmax(0,1fr)]">
              <section id="products" className='w-full px-6 pb-7 overflow-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-900 relative'>
                <div className="flex items-center gap-2 w-full sticky pt-5 pb-[14px] top-0 bg-slate-900 ">
                  <input type="text" className='w-full h-[44px] rounded-[10px] border border-[#2a3a59] bg-[#08101d] text-[#e7ecf5] font-[inherit] text-[14px] outline-none transition-[border-color,box-shadow] duration-150 [color-scheme:dark] min-h-11 resize-y py-[11px] px-[14px] leading-[1.45]' placeholder="Buscar un producto..." />
                </div>
                <div className='grid grid-cols-[repeat(auto-fill,minmax(212px,1fr))] gap-[14px]'>
                  <div className='group flex flex-col overflow-hidden rounded-[14px] border border-[#1b263d] bg-[#0f192b] text-left text-[#e7ecf5] transition duration-150 hover:-translate-y-0.5 hover:border-[#3b4f7a] hover:shadow-[0_12px_28px_rgba(0,0,0,0.35)] cursor-pointer'>
                    {/* Imagen */}
                    {/* Contenido */}
                    <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3">
                      <p className="text-[15px] font-semibold text-[#e7ecf5]">Nombre de producto</p>
                      <div className="flex items-center justify-between mt-5 pt-2.5">
                        <p className="text-[15px] font-bold tabular-nums">
                          <span className="text-xs font-medium text-[#8390ab]">desde </span>
                          2000
                          <span className="text-xs font-medium text-[#8390ab]"> /u</span>
                        </p>
                        <button
                          type="button"
                          className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-[#2a3a59] text-[#a8b3c8] transition-colors group-hover:border-[#2563eb] group-hover:bg-[#2563eb] group-hover:text-white"
                        >
                          <svg viewBox="0 0 24 24" className="size-[18px] fill-none stroke-current stroke-2 [stroke-linecap:round]">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className='group flex flex-col overflow-hidden rounded-[14px] border border-[#1b263d] bg-[#0f192b] text-left text-[#e7ecf5] transition duration-150 hover:-translate-y-0.5 hover:border-[#3b4f7a] hover:shadow-[0_12px_28px_rgba(0,0,0,0.35)] cursor-pointer'>
                    {/* Imagen */}
                    {/* Contenido */}
                    <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3">
                      <p className="text-[15px] font-semibold text-[#e7ecf5]">Nombre de producto</p>
                      <div className="flex items-center justify-between mt-5 pt-2.5">
                        <p className="text-[15px] font-bold tabular-nums">
                          <span className="text-xs font-medium text-[#8390ab]">desde </span>
                          2000
                          <span className="text-xs font-medium text-[#8390ab]"> /u</span>
                        </p>
                        <button
                          type="button"
                          className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-[#2a3a59] text-[#a8b3c8] transition-colors group-hover:border-[#2563eb] group-hover:bg-[#2563eb] group-hover:text-white"
                        >
                          <svg viewBox="0 0 24 24" className="size-[18px] fill-none stroke-current stroke-2 [stroke-linecap:round]">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className='group flex flex-col overflow-hidden rounded-[14px] border border-[#1b263d] bg-[#0f192b] text-left text-[#e7ecf5] transition duration-150 hover:-translate-y-0.5 hover:border-[#3b4f7a] hover:shadow-[0_12px_28px_rgba(0,0,0,0.35)] cursor-pointer'>
                    {/* Imagen */}
                    {/* Contenido */}
                    <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3">
                      <p className="text-[15px] font-semibold text-[#e7ecf5]">Nombre de producto</p>
                      <div className="flex items-center justify-between mt-5 pt-2.5">
                        <p className="text-[15px] font-bold tabular-nums">
                          <span className="text-xs font-medium text-[#8390ab]">desde </span>
                          2000
                          <span className="text-xs font-medium text-[#8390ab]"> /u</span>
                        </p>
                        <button
                          type="button"
                          className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-[#2a3a59] text-[#a8b3c8] transition-colors group-hover:border-[#2563eb] group-hover:bg-[#2563eb] group-hover:text-white"
                        >
                          <svg viewBox="0 0 24 24" className="size-[18px] fill-none stroke-current stroke-2 [stroke-linecap:round]">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className='group flex flex-col overflow-hidden rounded-[14px] border border-[#1b263d] bg-[#0f192b] text-left text-[#e7ecf5] transition duration-150 hover:-translate-y-0.5 hover:border-[#3b4f7a] hover:shadow-[0_12px_28px_rgba(0,0,0,0.35)] cursor-pointer'>
                    {/* Imagen */}
                    {/* Contenido */}
                    <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3">
                      <p className="text-[15px] font-semibold text-[#e7ecf5]">Nombre de producto</p>
                      <div className="flex items-center justify-between mt-5 pt-2.5">
                        <p className="text-[15px] font-bold tabular-nums">
                          <span className="text-xs font-medium text-[#8390ab]">desde </span>
                          2000
                          <span className="text-xs font-medium text-[#8390ab]"> /u</span>
                        </p>
                        <button
                          type="button"
                          className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-[#2a3a59] text-[#a8b3c8] transition-colors group-hover:border-[#2563eb] group-hover:bg-[#2563eb] group-hover:text-white"
                        >
                          <svg viewBox="0 0 24 24" className="size-[18px] fill-none stroke-current stroke-2 [stroke-linecap:round]">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className='group flex flex-col overflow-hidden rounded-[14px] border border-[#1b263d] bg-[#0f192b] text-left text-[#e7ecf5] transition duration-150 hover:-translate-y-0.5 hover:border-[#3b4f7a] hover:shadow-[0_12px_28px_rgba(0,0,0,0.35)] cursor-pointer'>
                    {/* Imagen */}
                    {/* Contenido */}
                    <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3">
                      <p className="text-[15px] font-semibold text-[#e7ecf5]">Nombre de producto</p>
                      <div className="flex items-center justify-between mt-5 pt-2.5">
                        <p className="text-[15px] font-bold tabular-nums">
                          <span className="text-xs font-medium text-[#8390ab]">desde </span>
                          2000
                          <span className="text-xs font-medium text-[#8390ab]"> /u</span>
                        </p>
                        <button
                          type="button"
                          className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-[#2a3a59] text-[#a8b3c8] transition-colors group-hover:border-[#2563eb] group-hover:bg-[#2563eb] group-hover:text-white"
                        >
                          <svg viewBox="0 0 24 24" className="size-[18px] fill-none stroke-current stroke-2 [stroke-linecap:round]">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className='group flex flex-col overflow-hidden rounded-[14px] border border-[#1b263d] bg-[#0f192b] text-left text-[#e7ecf5] transition duration-150 hover:-translate-y-0.5 hover:border-[#3b4f7a] hover:shadow-[0_12px_28px_rgba(0,0,0,0.35)] cursor-pointer'>
                    {/* Imagen */}
                    {/* Contenido */}
                    <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3">
                      <p className="text-[15px] font-semibold text-[#e7ecf5]">Nombre de producto</p>
                      <div className="flex items-center justify-between mt-5 pt-2.5">
                        <p className="text-[15px] font-bold tabular-nums">
                          <span className="text-xs font-medium text-[#8390ab]">desde </span>
                          2000
                          <span className="text-xs font-medium text-[#8390ab]"> /u</span>
                        </p>
                        <button
                          type="button"
                          className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-[#2a3a59] text-[#a8b3c8] transition-colors group-hover:border-[#2563eb] group-hover:bg-[#2563eb] group-hover:text-white"
                        >
                          <svg viewBox="0 0 24 24" className="size-[18px] fill-none stroke-current stroke-2 [stroke-linecap:round]">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className='group flex flex-col overflow-hidden rounded-[14px] border border-[#1b263d] bg-[#0f192b] text-left text-[#e7ecf5] transition duration-150 hover:-translate-y-0.5 hover:border-[#3b4f7a] hover:shadow-[0_12px_28px_rgba(0,0,0,0.35)] cursor-pointer'>
                    {/* Imagen */}
                    {/* Contenido */}
                    <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3">
                      <p className="text-[15px] font-semibold text-[#e7ecf5]">Nombre de producto</p>
                      <div className="flex items-center justify-between mt-5 pt-2.5">
                        <p className="text-[15px] font-bold tabular-nums">
                          <span className="text-xs font-medium text-[#8390ab]">desde </span>
                          2000
                          <span className="text-xs font-medium text-[#8390ab]"> /u</span>
                        </p>
                        <button
                          type="button"
                          className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-[#2a3a59] text-[#a8b3c8] transition-colors group-hover:border-[#2563eb] group-hover:bg-[#2563eb] group-hover:text-white"
                        >
                          <svg viewBox="0 0 24 24" className="size-[18px] fill-none stroke-current stroke-2 [stroke-linecap:round]">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className='group flex flex-col overflow-hidden rounded-[14px] border border-[#1b263d] bg-[#0f192b] text-left text-[#e7ecf5] transition duration-150 hover:-translate-y-0.5 hover:border-[#3b4f7a] hover:shadow-[0_12px_28px_rgba(0,0,0,0.35)] cursor-pointer'>
                    {/* Imagen */}
                    {/* Contenido */}
                    <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3">
                      <p className="text-[15px] font-semibold text-[#e7ecf5]">Nombre de producto</p>
                      <div className="flex items-center justify-between mt-5 pt-2.5">
                        <p className="text-[15px] font-bold tabular-nums">
                          <span className="text-xs font-medium text-[#8390ab]">desde </span>
                          2000
                          <span className="text-xs font-medium text-[#8390ab]"> /u</span>
                        </p>
                        <button
                          type="button"
                          className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-[#2a3a59] text-[#a8b3c8] transition-colors group-hover:border-[#2563eb] group-hover:bg-[#2563eb] group-hover:text-white"
                        >
                          <svg viewBox="0 0 24 24" className="size-[18px] fill-none stroke-current stroke-2 [stroke-linecap:round]">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className='group flex flex-col overflow-hidden rounded-[14px] border border-[#1b263d] bg-[#0f192b] text-left text-[#e7ecf5] transition duration-150 hover:-translate-y-0.5 hover:border-[#3b4f7a] hover:shadow-[0_12px_28px_rgba(0,0,0,0.35)] cursor-pointer'>
                    {/* Imagen */}
                    {/* Contenido */}
                    <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3">
                      <p className="text-[15px] font-semibold text-[#e7ecf5]">Nombre de producto</p>
                      <div className="flex items-center justify-between mt-5 pt-2.5">
                        <p className="text-[15px] font-bold tabular-nums">
                          <span className="text-xs font-medium text-[#8390ab]">desde </span>
                          2000
                          <span className="text-xs font-medium text-[#8390ab]"> /u</span>
                        </p>
                        <button
                          type="button"
                          className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-[#2a3a59] text-[#a8b3c8] transition-colors group-hover:border-[#2563eb] group-hover:bg-[#2563eb] group-hover:text-white"
                        >
                          <svg viewBox="0 0 24 24" className="size-[18px] fill-none stroke-current stroke-2 [stroke-linecap:round]">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className='group flex flex-col overflow-hidden rounded-[14px] border border-[#1b263d] bg-[#0f192b] text-left text-[#e7ecf5] transition duration-150 hover:-translate-y-0.5 hover:border-[#3b4f7a] hover:shadow-[0_12px_28px_rgba(0,0,0,0.35)] cursor-pointer'>
                    {/* Imagen */}
                    {/* Contenido */}
                    <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3">
                      <p className="text-[15px] font-semibold text-[#e7ecf5]">Nombre de producto</p>
                      <div className="flex items-center justify-between mt-5 pt-2.5">
                        <p className="text-[15px] font-bold tabular-nums">
                          <span className="text-xs font-medium text-[#8390ab]">desde </span>
                          2000
                          <span className="text-xs font-medium text-[#8390ab]"> /u</span>
                        </p>
                        <button
                          type="button"
                          className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-[#2a3a59] text-[#a8b3c8] transition-colors group-hover:border-[#2563eb] group-hover:bg-[#2563eb] group-hover:text-white"
                        >
                          <svg viewBox="0 0 24 24" className="size-[18px] fill-none stroke-current stroke-2 [stroke-linecap:round]">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
              {/* Panel derecho: Productos del pedido */}
              <aside id="resume-order" className="flex flex-col pt-5 px-5 pb-6 gap-3.5 border-l border-[#1b263d]">
                <div className="flex justify-between">
                  <p className="text-[12px] font-semibold tracking-[.1em] uppercase text-[#a8b3c8]">Productos del pedido</p>
                  <span>(0)</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 bg-[#0f192b] border-dashed border-[#2a3a59] border rounded-[12px] py-7 px-4 text-center text-[#8390ab] stroke-current stroke-2 fill-none">
                  <svg data-dc-tpl="229" className="w-[26px] h-[26px]" viewBox="0 0 24 24" aria-hidden="true"><path data-dc-tpl="230" d="M3 7.5l9-4.5 9 4.5-9 4.5z"></path><path data-dc-tpl="231" d="M3 7.5v9l9 4.5 9-4.5v-9"></path><path data-dc-tpl="232" d="M12 12v9"></path></svg>
                  <p className="text-[15px] text-[#e7ecf5]">Todavía no agregaste productos</p>
                  <p className="text-[13px] text-[#a8b3c8]">Buscalos por nombre o tocá uno del catálogo para configurarlo.</p>
                </div>
                <div className='flex flex-col gap-2.5 p-3.5 border border-[#34d39947] rounded-[12px] bg-[#0a1918]'>
                  <div className='flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.08em] text-[#34d399]'>
                    <svg data-dc-tpl="300" className="stroke-current stroke-2 fill-none w-[16px] h-[16px]" viewBox="0 0 24 24" aria-hidden="true"><rect data-dc-tpl="301" x="2.5" y="6" width="19" height="12" rx="2"></rect><circle data-dc-tpl="302" cx="12" cy="12" r="2.6"></circle><path data-dc-tpl="303" d="M6 9.5v5M18 9.5v5"></path></svg>
                    <p>Pago inicial / adelanto</p>
                    <p className='ml-auto text-[11px] font-semibold tracking-normal text-[#8390ab] normal-case'>Opcional</p>
                  </div>
                  <div className='flex gap-2'>
                    <div className='flex items-center gap-2 w-full h-[44px] px-[14px] rounded-[10px] border border-[#2a3a59] bg-[#08101d] text-[#e7ecf5] font-[inherit] text-[14px] outline-none transition-[border-color,box-shadow] duration-150 [color-scheme:dark]'>
                      <p className='text-[#a8b3c8]'>$</p>
                      <input type="number" className='w-full h-full bg-transparent outline-none text-[#e7ecf5] placeholder-[#8390ab] text-[14px]' placeholder='0,00' />
                    </div>
                    <button className='px-3 text-[13px] border border-[#2a3a59] text-[#a8b3c8] hover:bg-[#152139] hover:text-[#e7ecf5] cursor-pointer rounded-[10px]' type="button">50%</button>
                    <button type="button" className='px-3 text-[13px] border border-[#2a3a59] text-[#a8b3c8] hover:bg-[#152139] hover:text-[#e7ecf5] cursor-pointer rounded-[10px]'>Total</button>
                  </div>
                  <PaymentMethodField />
                  <div className='flex items-center justify-between gap-3 pt-2.5 border-t border-[#34d39947] text-[#a8b3c8]'>
                    <p className='text-[12px]'>Saldo pendiente</p>
                    <p className='text-[18px] font-bold text-[#34d399]'>$ 0</p>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )
        }
      </FormProvider >
    </Modal >
  )
}

//       {/* Paso 3: Confirmación de Pedido */}
//       {wizardStep === 'order_confirmation' && createdPedidoResult && (
//         <div className="space-y-6 text-center py-6 animate-in fade-in zoom-in-95 duration-200">
//           <div className="flex items-center justify-center mx-auto w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-3xl shadow-[0_0_15px_rgba(16,185,129,0.2)]">
//             🎉
//           </div>
//           <div className="space-y-2">
//             <h3 className="text-lg font-bold text-white">¡Pedido Creado con Éxito!</h3>
//             <p className="text-xs text-slate-400 max-w-sm mx-auto">
//               El pedido de fabricación ha sido registrado correctamente y está listo para ser procesado.
//             </p>
//           </div>

//           <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 text-left max-w-md mx-auto space-y-3">
//             <div className="border-b border-slate-850 pb-2 flex justify-between items-center">
//               <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
//                 Ficha de Pedido
//               </span>
//               <span className="text-xs font-mono font-bold text-white bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg">
//                 #{createdPedidoResult.id}
//               </span>
//             </div>

//             <div className="space-y-1">
//               <span className="text-[10px] text-slate-500 uppercase font-semibold">
//                 Cliente Asignado
//               </span>
//               <span className="text-sm font-bold text-white block">
//                 {selectedWizardClient?.nombre_cliente || 'N/A'}
//               </span>
//               <span className="text-xs text-slate-400 block">
//                 {selectedWizardClient?.nombre_empresa || 'N/A'}
//               </span>
//             </div>

//             <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-850/50 text-xs">
//               <div>
//                 <span className="text-slate-500 block mb-0.5">Prioridad</span>
//                 <span
//                   className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize ${getPriorityBadgeClass(
//                     createdPedidoResult.prioridad
//                   )}`}
//                 >
//                   {createdPedidoResult.prioridad}
//                 </span>
//               </div>
//               <div>
//                 <span className="text-slate-500 block mb-0.5">Fecha de Entrega</span>
//                 <span className="font-semibold text-slate-300">
//                   {createdPedidoResult.fecha_entrega || 'No planificada'}
//                 </span>
//               </div>
//               <div>
//                 <span className="text-slate-500 block mb-0.5">Precio</span>
//                 <span className="font-semibold text-slate-300">
//                   {createdPedidoResult.precio !== null && createdPedidoResult.precio !== undefined
//                     ? `$ ${parseFloat(createdPedidoResult.precio.toString()).toLocaleString('es-AR', {
//                         minimumFractionDigits: 2
//                       })}`
//                     : 'Sin precio'}
//                 </span>
//               </div>
//             </div>

//             {formData.selectedProductIds.length > 0 && (
//               <div className="pt-3 border-t border-slate-850/50 space-y-1.5">
//                 <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
//                   Productos Asociados
//                 </span>
//                 <div className="flex flex-wrap gap-1.5">
//                   {formData.selectedProductIds.map((pId) => {
//                     const p = productosList.find((prod) => prod.id === pId)
//                     const qty = formData.productQuantities[pId] || 1
//                     return p ? (
//                       <span
//                         key={pId}
//                         className="bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2.5 py-1 rounded-md"
//                       >
//                         {p.nombre} <span className="text-slate-500 font-bold ml-1">x{qty}</span>
//                       </span>
//                     ) : null
//                   })}
//                 </div>
//               </div>
//             )}

//             {(createdPedidoResult.monto_pagado || 0) > 0 && (
//               <div className="pt-3 border-t border-slate-850/50 space-y-1 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg">
//                 <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block flex items-center gap-1">
//                   💵 Pago Inicial Registrado Con Éxito
//                 </span>
//                 <div className="flex justify-between items-center text-xs text-slate-300">
//                   <span>Monto Pagado:</span>
//                   <span className="font-bold font-mono text-emerald-300">
//                     $
//                     {parseFloat(
//                       (createdPedidoResult.monto_pagado || 0).toString()
//                     ).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
//                   </span>
//                 </div>
//                 <div className="flex justify-between items-center text-xs text-slate-400">
//                   <span>Saldo Pendiente:</span>
//                   <span className="font-semibold font-mono text-white">
//                     $
//                     {parseFloat(
//                       (createdPedidoResult.saldo_pendiente || 0).toString()
//                     ).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
//                   </span>
//                 </div>
//               </div>
//             )}
//           </div>

//           <div className="flex items-center justify-center gap-3 pt-6 border-t border-slate-800">
//             <button
//               type="button"
//               onClick={handleClose}
//               className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow transition hover:scale-[1.02] active:scale-[0.98] rounded-lg text-sm cursor-pointer"
//             >
//               Finalizar y Ver en Panel
//             </button>
//           </div>
//         </div>
//       )}
export default CreatePedidoModal

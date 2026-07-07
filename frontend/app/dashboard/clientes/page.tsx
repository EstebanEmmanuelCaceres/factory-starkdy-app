'use client'

import { useEffect, useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import {
  fetchClientes,
  createCliente,
  updateCliente,
  deleteCliente,
  type Cliente,
  type CreateClienteInput,
  type UpdateClienteInput
} from '@/lib/clientes'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Filtros
  const [searchQuery, setSearchQuery] = useState('')

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)

  // Datos de Formulario
  const [formData, setFormData] = useState<CreateClienteInput>({
    nombre_cliente: '',
    nombre_empresa: '',
    telefono: '',
    email: ''
  })

  const loadClientes = async (search?: string) => {
    setLoading(true)
    setError('')
    try {
      const filters: { search?: string } = {}
      if (search !== undefined) {
        if (search) filters.search = search
      } else if (searchQuery) {
        filters.search = searchQuery
      }

      const data = await fetchClientes(filters)
      setClientes(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar los clientes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClientes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showNotification = (message: string) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  const handleOpenCreateModal = () => {
    setFormData({
      nombre_cliente: '',
      nombre_empresa: '',
      telefono: '',
      email: ''
    })
    setIsCreateModalOpen(true)
  }

  const handleOpenEditModal = (cliente: Cliente) => {
    setSelectedCliente(cliente)
    setFormData({
      nombre_cliente: cliente.nombre_cliente,
      nombre_empresa: cliente.nombre_empresa,
      telefono: cliente.telefono,
      email: cliente.email || ''
    })
    setIsEditModalOpen(true)
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      // Ajustar campos vacíos a nulos
      const payload = {
        nombre_cliente: formData.nombre_cliente.trim(),
        nombre_empresa: formData.nombre_empresa.trim(),
        telefono: formData.telefono.trim(),
        email: formData.email?.trim() || null
      }
      await createCliente(payload)
      setIsCreateModalOpen(false)
      showNotification('Cliente registrado correctamente')
      loadClientes()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrar el cliente')
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCliente) return
    setError('')

    // Construir payload con cambios parciales (PATCH)
    const payload: UpdateClienteInput = {}

    const nombreClienteValue = formData.nombre_cliente.trim()
    const nombreEmpresaValue = formData.nombre_empresa.trim()
    const telefonoValue = formData.telefono.trim()
    const emailValue = formData.email?.trim() || null

    if (nombreClienteValue !== selectedCliente.nombre_cliente) {
      payload.nombre_cliente = nombreClienteValue
    }
    if (nombreEmpresaValue !== selectedCliente.nombre_empresa) {
      payload.nombre_empresa = nombreEmpresaValue
    }
    if (telefonoValue !== selectedCliente.telefono) {
      payload.telefono = telefonoValue
    }
    if (emailValue !== selectedCliente.email) {
      payload.email = emailValue
    }

    // Si no hay cambios, simplemente cerrar el modal
    if (Object.keys(payload).length === 0) {
      setIsEditModalOpen(false)
      return
    }

    try {
      await updateCliente(selectedCliente.id, payload)
      setIsEditModalOpen(false)
      showNotification('Cliente actualizado correctamente')
      loadClientes()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el cliente')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas dar de baja a este cliente?')) return
    setError('')
    try {
      await deleteCliente(id)
      showNotification('Cliente dado de baja correctamente')
      loadClientes()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al dar de baja al cliente')
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      loadClientes()
    }
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    loadClientes('')
  }

  return (
    <RoleGuard allowedRoles={['admin']}>
      <main className="page-content p-6 max-w-7xl mx-auto text-white">
        {/* Notificación de Éxito */}
        {successMessage && (
          <div className="fixed top-4 right-4 z-50 bg-emerald-500 text-white px-4 py-3 rounded-lg shadow-xl border border-emerald-400 flex items-center gap-2 animate-bounce">
            <span>✅</span>
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {/* Notificación de Error */}
        {error && (
          <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-200 px-4 py-3 rounded-lg flex items-center gap-2">
            <span>❌</span>
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Encabezado y Filtros */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Panel de Clientes</h1>
            <p className="text-sm text-slate-400">Gestiona los clientes registrados, busca por nombre o correo y edita su información.</p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2.5 rounded-lg shadow transition duration-200 text-sm self-start md:self-auto hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>➕</span> Nuevo Cliente
          </button>
        </div>

        {/* Barra de Filtros */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-md">
          <div className="w-full flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {/* Buscador */}
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Buscar por nombre o correo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3.5 py-2 pl-9 text-sm text-white placeholder-slate-500 focus:outline-none transition duration-150"
              />
              <span className="absolute left-3.5 top-2.5 text-slate-500 text-sm">🔍</span>
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 text-sm"
                  title="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={() => loadClientes()}
              className="bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition hover:scale-[1.02] active:scale-[0.98]"
            >
              Buscar
            </button>
          </div>
        </div>

        {/* Listado de Clientes */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
              <span className="text-sm">Cargando clientes de la base de datos...</span>
            </div>
          ) : clientes.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <span className="text-4xl">👥</span>
              <span className="text-sm font-medium">No se encontraron clientes registrados</span>
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="text-xs text-blue-500 hover:underline mt-1"
                >
                  Limpiar búsqueda
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                    <th className="px-6 py-4">ID</th>
                    <th className="px-6 py-4">Nombre Cliente</th>
                    <th className="px-6 py-4">Nombre Empresa</th>
                    <th className="px-6 py-4">Teléfono</th>
                    <th className="px-6 py-4">Correo Electrónico</th>
                    <th className="px-6 py-4">Registrado</th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm">
                  {clientes.map((cliente) => (
                    <tr key={cliente.id} className="hover:bg-slate-800/40 text-slate-300 transition duration-100">
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">#{cliente.id}</td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-white">{cliente.nombre_cliente}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {cliente.nombre_empresa}
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {cliente.telefono}
                      </td>
                      <td className="px-6 py-4">
                        {cliente.email ? (
                          <span className="text-slate-300">{cliente.email}</span>
                        ) : (
                          <span className="text-slate-600 italic">No especificado</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">
                        {new Date(cliente.created_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2.5">
                          <button
                            onClick={() => handleOpenEditModal(cliente)}
                            className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition"
                            title="Editar cliente"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(cliente.id)}
                            className="text-rose-400 hover:text-rose-300 p-1 hover:bg-rose-500/10 rounded transition"
                            title="Dar de baja cliente"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal de Creación */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
              <h2 className="text-xl font-bold text-white mb-4">Registrar Nuevo Cliente</h2>
              <form onSubmit={handleCreateSubmit} className="space-y-4 text-slate-300">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Nombre Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nombre_cliente}
                    onChange={(e) => setFormData({ ...formData, nombre_cliente: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Nombre Empresa *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nombre_empresa}
                    onChange={(e) => setFormData({ ...formData, nombre_empresa: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    placeholder="Ej. Empresa S.A."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Teléfono *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
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
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    placeholder="ejemplo@correo.com"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium shadow transition hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Registrar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Edición */}
        {isEditModalOpen && selectedCliente && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
              <h2 className="text-xl font-bold text-white mb-4">Editar Cliente</h2>
              <form onSubmit={handleEditSubmit} className="space-y-4 text-slate-300">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Nombre Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nombre_cliente}
                    onChange={(e) => setFormData({ ...formData, nombre_cliente: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Nombre Empresa *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nombre_empresa}
                    onChange={(e) => setFormData({ ...formData, nombre_empresa: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Teléfono *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium shadow transition hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </RoleGuard>
  )
}

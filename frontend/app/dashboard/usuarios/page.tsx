'use client'

import { useEffect, useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import Modal from '@/components/Modal'
import Pagination from '@/components/Pagination'
import { getStoredUser, ROLE_COLORS } from '@/lib/auth'
import {
  fetchAdminUsers,
  fetchRoles,
  createUser,
  updateUser,
  changeUserRole,
  changeUserPassword,
  deleteUser,
  type UserManagementItem,
  type Role,
  type CreateUserInput,
  type UpdateUserInput
} from '@/lib/users'

function getInitials(name: string) {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export default function UsuariosPage() {
  const currentUser = getStoredUser()

  const [users, setUsers] = useState<UserManagementItem[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Filtros y Búsqueda
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<number | ''>('')

  // Paginación
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 12

  // Modales state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // Target User seleccionado para acciones
  const [selectedUser, setSelectedUser] = useState<UserManagementItem | null>(null)

  // Form states
  const [createForm, setCreateForm] = useState<CreateUserInput>({
    name: '',
    email: '',
    password: '',
    role_id: 0,
  })

  const [editForm, setEditForm] = useState<UpdateUserInput>({
    name: '',
    email: '',
  })

  const [newRoleId, setNewRoleId] = useState<number>(0)
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Cargar usuarios y roles
  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [usersData, rolesData] = await Promise.all([
        fetchAdminUsers({
          search: searchQuery || undefined,
          role_id: selectedRoleFilter !== '' ? Number(selectedRoleFilter) : undefined,
        }),
        fetchRoles(),
      ])
      setUsers(usersData)
      setRoles(rolesData)

      // Set default role_id if available
      if (rolesData.length > 0 && createForm.role_id === 0) {
        setCreateForm((prev) => ({ ...prev, role_id: rolesData[0].id }))
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar los usuarios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedRoleFilter])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedRoleFilter])

  const showNotification = (msg: string) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(''), 4000)
  }

  // Handlers para Crear Usuario
  const handleOpenCreateModal = () => {
    const defaultRoleId = roles.length > 0 ? roles[0].id : 0
    setCreateForm({ name: '', email: '', password: '', role_id: defaultRoleId })
    setError('')
    setIsCreateModalOpen(true)
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const created = await createUser(createForm)
      showNotification(`Usuario "${created.name}" creado con éxito.`)
      setIsCreateModalOpen(false)
      loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear el usuario')
    } finally {
      setSubmitting(false)
    }
  }

  // Handlers para Editar Usuario
  const handleOpenEditModal = (user: UserManagementItem) => {
    setSelectedUser(user)
    setEditForm({ name: user.name, email: user.email })
    setError('')
    setIsEditModalOpen(true)
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    setSubmitting(true)
    setError('')
    try {
      const updated = await updateUser(selectedUser.id, editForm)
      showNotification(`Usuario "${updated.name}" actualizado correctamente.`)
      setIsEditModalOpen(false)
      loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el usuario')
    } finally {
      setSubmitting(false)
    }
  }

  // Handlers para Cambiar Rol
  const handleOpenRoleModal = (user: UserManagementItem) => {
    setSelectedUser(user)
    setNewRoleId(user.role_id)
    setError('')
    setIsRoleModalOpen(true)
  }

  const handleChangeRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    setSubmitting(true)
    setError('')
    try {
      const updated = await changeUserRole(selectedUser.id, newRoleId)
      showNotification(`Rol de "${updated.name}" cambiado a "${updated.role_label}".`)
      setIsRoleModalOpen(false)
      loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cambiar el rol')
    } finally {
      setSubmitting(false)
    }
  }

  // Handlers para Cambiar Contraseña
  const handleOpenPasswordModal = (user: UserManagementItem) => {
    setSelectedUser(user)
    setNewPassword('')
    setShowPassword(false)
    setError('')
    setIsPasswordModalOpen(true)
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const msg = await changeUserPassword(selectedUser.id, newPassword)
      showNotification(msg || `Contraseña de "${selectedUser.name}" actualizada con éxito.`)
      setIsPasswordModalOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cambiar la contraseña')
    } finally {
      setSubmitting(false)
    }
  }

  // Handlers para Eliminar Usuario
  const handleOpenDeleteModal = (user: UserManagementItem) => {
    if (user.id === currentUser?.id) {
      alert('No puedes eliminar tu propia cuenta de usuario.')
      return
    }
    setSelectedUser(user)
    setError('')
    setIsDeleteModalOpen(true)
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return
    setSubmitting(true)
    setError('')
    try {
      await deleteUser(selectedUser.id)
      showNotification(`Usuario "${selectedUser.name}" eliminado correctamente.`)
      setIsDeleteModalOpen(false)
      loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el usuario')
    } finally {
      setSubmitting(false)
    }
  }

  // Paginación de resultados
  const totalItems = users.length
  const paginatedUsers = users.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <RoleGuard allowedRoles={['admin']}>
      <div className="p-6 max-w-7xl mx-auto space-y-6">

        {/* Header con título y botón de acción */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800/80 backdrop-blur-md">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">Gestión de Usuarios</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {users.length} {users.length === 1 ? 'usuario' : 'usuarios'}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Administración de cuentas, asignación de roles y actualización de contraseñas.
            </p>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-blue-600/20 active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Usuario
          </button>
        </div>

        {/* Notificaciones globales */}
        {successMessage && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>{successMessage}</span>
            </div>
          </div>
        )}

        {/* Barra de Filtros y Búsqueda */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 relative">
            <svg className="w-5 h-5 absolute left-3.5 top-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por nombre o correo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-sm"
            />
          </div>

          <div>
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-blue-500 transition text-sm"
            >
              <option value="">Todos los Roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.slug})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabla de Usuarios */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
              <p>Cargando usuarios...</p>
            </div>
          ) : paginatedUsers.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <p className="text-base font-medium">No se encontraron usuarios</p>
              <p className="text-xs text-slate-500 mt-1">Intenta ajustando los términos de búsqueda o filtros.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                    <th className="py-4 px-6">Usuario</th>
                    <th className="py-4 px-6">Rol</th>
                    <th className="py-4 px-6">Fecha Registro</th>
                    <th className="py-4 px-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paginatedUsers.map((u) => {
                    const isSelf = currentUser?.id === u.id
                    const roleColor = ROLE_COLORS[u.role] || '#475569'

                    return (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition group">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md text-sm shrink-0"
                              style={{ background: `linear-gradient(135deg, ${roleColor}, rgba(15,23,42,0.8))` }}
                            >
                              {getInitials(u.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-100 truncate flex items-center gap-2">
                                {u.name}
                                {isSelf && (
                                  <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded font-normal">
                                    Tú
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 truncate">{u.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-6">
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold tracking-wide border shadow-sm"
                            style={{
                              backgroundColor: `${roleColor}15`,
                              borderColor: `${roleColor}40`,
                              color: roleColor,
                            }}
                          >
                            {u.role_label}
                          </span>
                        </td>

                        <td className="py-4 px-6 text-slate-400 text-xs">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString('es-AR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          }) : '—'}
                        </td>

                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Cambiar Rol rápido */}
                            <button
                              onClick={() => handleOpenRoleModal(u)}
                              title="Gestionar Rol"
                              className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                            </button>

                            {/* Cambiar Contraseña */}
                            <button
                              onClick={() => handleOpenPasswordModal(u)}
                              title="Cambiar Contraseña"
                              className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                              </svg>
                            </button>

                            {/* Editar datos generales */}
                            <button
                              onClick={() => handleOpenEditModal(u)}
                              title="Editar Usuario"
                              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>

                            {/* Eliminar usuario */}
                            <button
                              onClick={() => handleOpenDeleteModal(u)}
                              disabled={isSelf}
                              title={isSelf ? 'No puedes eliminarte a ti mismo' : 'Eliminar Usuario'}
                              className={`p-2 rounded-lg transition ${isSelf ? 'text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-red-400 hover:bg-red-400/10'}`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Componente de Paginación */}
          {totalItems > pageSize && (
            <div className="p-4 border-t border-slate-800 bg-slate-950/30">
              <Pagination
                currentPage={currentPage}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={(page) => setCurrentPage(page)}
              />
            </div>
          )}
        </div>

        {/* MODAL: Crear Usuario */}
        <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
          <div className="p-6">
            <h2 className="text-xl font-bold text-white mb-1">Crear Nuevo Usuario</h2>
            <p className="text-xs text-slate-400 mb-6">Completa los campos para dar de alta una nueva cuenta.</p>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Juan Pérez"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  placeholder="juan@fabrica.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Contraseña Inicial</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Rol Asignado</label>
                <select
                  required
                  value={createForm.role_id}
                  onChange={(e) => setCreateForm({ ...createForm, role_id: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </Modal>

        {/* MODAL: Editar Usuario */}
        <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}>
          <div className="p-6">
            <h2 className="text-xl font-bold text-white mb-1">Editar Usuario</h2>
            <p className="text-xs text-slate-400 mb-6">Actualiza los datos del usuario seleccionado.</p>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </Modal>

        {/* MODAL: Cambiar Rol Rápidamente */}
        <Modal isOpen={isRoleModalOpen} onClose={() => setIsRoleModalOpen(false)}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Gestionar Rol de Usuario</h2>
                <p className="text-xs text-slate-400">{selectedUser?.name} ({selectedUser?.email})</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleChangeRole} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Seleccionar Nuevo Rol</label>
                <select
                  value={newRoleId}
                  onChange={(e) => setNewRoleId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm rounded-xl transition disabled:opacity-50"
                >
                  {submitting ? 'Actualizando...' : 'Actualizar Rol'}
                </button>
              </div>
            </form>
          </div>
        </Modal>

        {/* MODAL: Cambiar Contraseña */}
        <Modal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Cambiar Contraseña</h2>
                <p className="text-xs text-slate-400">{selectedUser?.name} ({selectedUser?.email})</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nueva Contraseña</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition text-xs"
                  >
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition disabled:opacity-50"
                >
                  {submitting ? 'Cambiando...' : 'Cambiar Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </Modal>

        {/* MODAL: Confirmar Eliminación */}
        <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Eliminar Usuario</h2>
                <p className="text-xs text-slate-400">Esta acción no se puede deshacer.</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
                {error}
              </div>
            )}

            <p className="text-sm text-slate-300 mb-6">
              ¿Estás seguro de que deseas eliminar permanentemente a la cuenta de usuario{' '}
              <strong className="text-white">{selectedUser?.name}</strong> ({selectedUser?.email})?
            </p>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={submitting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-xl transition disabled:opacity-50"
              >
                {submitting ? 'Eliminando...' : 'Eliminar Usuario'}
              </button>
            </div>
          </div>
        </Modal>

      </div>
    </RoleGuard>
  )
}

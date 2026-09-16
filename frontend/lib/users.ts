import api from './api'

export interface Role {
  id: number
  slug: string
  name: string
}

export interface UserManagementItem {
  id: number
  name: string
  email: string
  role: string
  role_id: number
  role_label: string
  created_at: string
}

export interface CreateUserInput {
  name: string
  email: string
  password: string
  role_id: number
}

export interface UpdateUserInput {
  name: string
  email: string
  role_id?: number
}

export interface AdminUsersFilters {
  search?: string
  role_id?: number
}

// ── Obtener lista de usuarios (Admin) ──────────────────────────────────
export async function fetchAdminUsers(filters?: AdminUsersFilters): Promise<UserManagementItem[]> {
  const params = new URLSearchParams()
  if (filters?.search) params.append('search', filters.search)
  if (filters?.role_id) params.append('role_id', filters.role_id.toString())

  const { data } = await api.get<{ users: UserManagementItem[] }>(`/admin/users?${params.toString()}`)
  return data.users
}

// ── Obtener lista de roles ─────────────────────────────────────────────
export async function fetchRoles(): Promise<Role[]> {
  const { data } = await api.get<{ roles: Role[] }>('/admin/roles')
  return data.roles
}

// ── Crear nuevo usuario ───────────────────────────────────────────────
export async function createUser(input: CreateUserInput): Promise<UserManagementItem> {
  const { data } = await api.post<{ user: UserManagementItem; message: string }>('/admin/users', input)
  return data.user
}

// ── Actualizar información general de usuario ─────────────────────────
export async function updateUser(id: number, input: UpdateUserInput): Promise<UserManagementItem> {
  const { data } = await api.patch<{ user: UserManagementItem; message: string }>(`/admin/users/${id}`, input)
  return data.user
}

// ── Cambiar rol de usuario ─────────────────────────────────────────────
export async function changeUserRole(id: number, role_id: number): Promise<UserManagementItem> {
  const { data } = await api.patch<{ user: UserManagementItem; message: string }>(`/admin/users/${id}/role`, { role_id })
  return data.user
}

// ── Cambiar contraseña de usuario ──────────────────────────────────────
export async function changeUserPassword(id: number, password: string): Promise<string> {
  const { data } = await api.patch<{ message: string }>(`/admin/users/${id}/password`, { password })
  return data.message
}

// ── Eliminar usuario ───────────────────────────────────────────────────
export async function deleteUser(id: number): Promise<string> {
  const { data } = await api.delete<{ message: string }>(`/admin/users/${id}`)
  return data.message
}

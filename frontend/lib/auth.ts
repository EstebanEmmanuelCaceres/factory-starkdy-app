import Cookies from 'js-cookie'
import api from './api'

export interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'supervisor' | 'operator' | 'user'
  role_label: string
  created_at: string
}

export interface LoginResponse {
  message: string
  user: User
  token: string
}

// ── Iniciar sesión ─────────────────────────────────────────────
export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', {
    email,
    password,
  })

  // Persistir token en cookie (para middleware SSR) y localStorage (para client)
  Cookies.set('auth_token', data.token, { expires: 7, sameSite: 'lax' })
  localStorage.setItem('auth_token', data.token)
  localStorage.setItem('auth_user', JSON.stringify(data.user))

  return data
}

// ── Registrar usuario ───────────────────────────────────────────
export async function register(
  name: string,
  email: string,
  password: string
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/register', {
    name,
    email,
    password,
  })

  // Persistir token en cookie y localStorage
  Cookies.set('auth_token', data.token, { expires: 7, sameSite: 'lax' })
  localStorage.setItem('auth_token', data.token)
  localStorage.setItem('auth_user', JSON.stringify(data.user))

  return data
}

// ── Cerrar sesión ──────────────────────────────────────────────
export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout')
  } catch {
    // Si falla el servidor, igual limpiamos localmente
  } finally {
    Cookies.remove('auth_token')
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
  }
}

// ── Obtener usuario actual desde la API ───────────────────────
export async function fetchMe(): Promise<User> {
  const { data } = await api.get<{ user: User }>('/auth/me')
  return data.user
}

// ── Obtener todos los usuarios desde la API ───────────────────
export async function fetchUsers(): Promise<User[]> {
  const { data } = await api.get<{ users: User[] }>('/users')
  return data.users
}

// ── Helpers locales ────────────────────────────────────────────
export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('auth_user')
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token') || Cookies.get('auth_token') || null
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

export const ROLE_COLORS: Record<string, string> = {
  admin: '#D41515',
  supervisor: '#B91C1C',
  operator: '#16A34A',
  user: '#475569',
}

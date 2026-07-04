import axios from 'axios'
import Cookies from 'js-cookie'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 15000,
})

// ── Interceptor de REQUEST: adjuntar token ──────────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token =
      localStorage.getItem('auth_token') || Cookies.get('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// ── Interceptor de RESPONSE: manejar errores 401 ───────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      Cookies.remove('auth_token')
      window.location.href = '/login'
    }

    // Extraer mensaje de error legible
    const message =
      error.response?.data?.message ||
      error.response?.data?.errors?.email?.[0] ||
      error.message ||
      'Error desconocido'

    return Promise.reject(new Error(message))
  }
)

export default api

import axios from 'axios'
import Cookies from 'js-cookie'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30000,
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

// ── Interceptor de RESPONSE: manejar errores 401 y formatear validation errors ───────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      Cookies.remove('auth_token')
      window.location.href = '/login'
    }

    // Extraer mensajes de validación de Laravel o mensaje general
    let message = ''

    if (error.response?.data?.errors && typeof error.response.data.errors === 'object') {
      const errObj = error.response.data.errors
      const messagesList: string[] = []
      Object.keys(errObj).forEach((key) => {
        const val = errObj[key]
        if (Array.isArray(val)) {
          messagesList.push(...val)
        } else if (typeof val === 'string') {
          messagesList.push(val)
        }
      })
      if (messagesList.length > 0) {
        message = messagesList.join('. ')
      }
    }

    if (!message) {
      message =
        error.response?.data?.message ||
        error.message ||
        'Error al procesar la solicitud'
    }

    // Ocultar mensajes de excepciones técnicas SQL
    if (
      message.includes('SQLSTATE') ||
      message.includes('Connection:') ||
      message.includes('not-null constraint')
    ) {
      message = 'Error en el servidor. Por favor, vuelva a intentarlo más tarde.'
    }

    return Promise.reject(new Error(message))
  }
)

export default api

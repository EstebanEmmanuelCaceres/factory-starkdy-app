'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { login } from '@/lib/auth'

// ── Demo credentials ───────────────────────────────────────────────
const DEMO_USERS = {
  admin: { email: 'admin@fabrica.com', label: 'Admin' },
  supervisor: { email: 'supervisor@fabrica.com', label: 'Supervisor' },
  operator: { email: 'operador@fabrica.com', label: 'Operador' },
} as const

// ─────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await login(email, password)
      router.push(redirect)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (role: keyof typeof DEMO_USERS) => {
    setEmail(DEMO_USERS[role].email)
    setPassword('password')
    setError('')
  }

  return (
    <main className="login-page">
      {/* Fondo animado */}
      <div className="login-bg" aria-hidden="true">
        <div className="bg-grid" />
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
      </div>

      <div className="login-container">
        {/* Logotipo
        <div className="login-logo">
          <img src="/logo.png" alt="Logo" className="login-logo-img" />
        </div> */}

        {/* Tarjeta de login */}
        <div className="login-card">
          <h1 className="login-title">Iniciar Sesión</h1>
          <p className="login-description">
            Ingresa tus credenciales para acceder al panel de control
          </p>

          {error && (
            <div className="error-alert" role="alert">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 2a1 1 0 0 1 1 1v3a1 1 0 0 1-2 0V4a1 1 0 0 1 1-1zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form" noValidate>
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@fabrica.com"
                className="form-input"
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="form-input"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              className="login-btn"
              disabled={loading}
            >
              {loading ? (
                <span className="btn-loading">
                  <span className="spinner" aria-hidden="true" />
                  Verificando credenciales...
                </span>
              ) : (
                'Ingresar al Sistema'
              )}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            ¿No tienes una cuenta?{' '}
            <a href="/register" style={{ color: 'var(--blue-light)', fontWeight: 600, textDecoration: 'none' }}>
              Regístrate aquí
            </a>
          </p>

          {/* Credenciales de demo */}
          <div className="demo-section">
            <p className="demo-title">Acceso rápido — Demo</p>
            <div className="demo-buttons">
              {(Object.keys(DEMO_USERS) as Array<keyof typeof DEMO_USERS>).map(
                (role) => (
                  <button
                    key={role}
                    id={`demo-${role}-btn`}
                    type="button"
                    className={`demo-btn demo-${role}`}
                    onClick={() => fillDemo(role)}
                  >
                    {DEMO_USERS[role].label}
                  </button>
                )
              )}
            </div>
            <p className="demo-password">
              Contraseña de demo: <code>password</code>
            </p>
          </div>
        </div>

        <p className="login-footer">
          Sistema de Gestión Industrial © {new Date().getFullYear()}
        </p>
      </div>
    </main>
  )
}

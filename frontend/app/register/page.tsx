'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { register } from '@/lib/auth'

// ── Ícono de fábrica SVG ───────────────────────────────────────────
function FactoryIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="1" y="14" width="26" height="13" rx="2" fill="#3b82f6" />
      <path
        d="M1 14L7 8L13 14L19 5L25 14"
        stroke="#60a5fa"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <rect x="5"  y="18" width="5" height="9" rx="1" fill="#1e3a5f" />
      <rect x="12" y="18" width="5" height="9" rx="1" fill="#1e3a5f" />
      <rect x="19" y="18" width="5" height="9" rx="1" fill="#1e3a5f" />
      <circle cx="3" cy="12" r="1.5" fill="#f97316" />
      <circle cx="7" cy="8"  r="1.5" fill="#f97316" />
    </svg>
  )
}

export default function RegisterPage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await register(name, email, password)
      router.push('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrarse'
      setError(msg)
    } finally {
      setLoading(false)
    }
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
        {/* Logotipo */}
        <div className="login-logo">
          <div className="logo-icon">
            <FactoryIcon />
          </div>
          <div>
            <div className="logo-title">Sistema Fábrica</div>
            <div className="logo-subtitle">Gestión Industrial</div>
          </div>
        </div>

        {/* Tarjeta de registro */}
        <div className="login-card">
          <h1 className="login-title">Crear una Cuenta</h1>
          <p className="login-description">
            Regístrate para obtener acceso al sistema
          </p>

          {error && (
            <div className="error-alert" role="alert">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M15 8A7 7 0 111 8a7 7 0 0114 0zm-8-3a1 1 0 112 0v4a1 1 0 11-2 0V5zm1 7a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="name" className="form-label">
                Nombre Completo
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan Pérez"
                className="form-input"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Correo Electrónico
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
                placeholder="Mínimo 8 caracteres"
                className="form-input"
                required
                autoComplete="new-password"
              />
            </div>

            <button
              id="register-submit-btn"
              type="submit"
              className="login-btn"
              disabled={loading}
            >
              {loading ? (
                <span className="btn-loading">
                  <span className="spinner" aria-hidden="true" />
                  Creando cuenta...
                </span>
              ) : (
                'Registrarse'
              )}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            ¿Ya tienes una cuenta?{' '}
            <a href="/login" style={{ color: 'var(--blue-light)', fontWeight: 600, textDecoration: 'none' }}>
              Inicia sesión aquí
            </a>
          </p>
        </div>

        <p className="login-footer">
          Sistema de Gestión Industrial © {new Date().getFullYear()}
        </p>
      </div>
    </main>
  )
}

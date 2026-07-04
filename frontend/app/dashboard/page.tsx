'use client'

import { useEffect, useState } from 'react'
import { fetchUsers, type User } from '@/lib/auth'

export default function DashboardPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadUsers = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const data = await fetchUsers()
      setUsers(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar los usuarios'
      setError(msg)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  return (
    <main className="page-content">

      {/* Tabla de usuarios de la base de datos */}
      <div className="panel bg-slate-900 border border-slate-700">
        <div className="panel-header">
          <span className="panel-title text-slate-300">Usuarios Registrados en la Base de Datos</span>
          <button
            className="panel-action"
            onClick={() => loadUsers(true)}
            disabled={loading || refreshing}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {refreshing ? 'Cargando...' : '🔄 Actualizar'}
          </button>
        </div>
        <div className="panel-body">
          {loading ? (
            <div className="loading-state">
              <span style={{ display: 'block', marginBottom: '8px' }}>⏳</span>
              Cargando usuarios desde PostgreSQL...
            </div>
          ) : error ? (
            <div className="error-state">
              <span style={{ display: 'block', marginBottom: '8px' }}>❌</span>
              {error}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="users-table text-slate-400">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Fecha de Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} id={`user-row-${u.id}`}>
                      <td>#{u.id}</td>
                      <td className="user-name-cell">
                        <div className="user-avatar-mini">
                          {u.name.substring(0, 2).toUpperCase()}
                        </div>
                        {u.name}
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`user-role-badge role-${u.role}`}>
                          {u.role_label}
                        </span>
                      </td>
                      <td>{u.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

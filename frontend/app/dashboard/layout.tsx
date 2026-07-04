'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import Header  from '@/components/Header'
import { getStoredUser, fetchMe, type User } from '@/lib/auth'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    // Cargar usuario desde localStorage primero (instantáneo)
    const stored = getStoredUser()
    if (stored) setUser(stored)

    // Luego verificar con la API (actualiza datos)
    fetchMe()
      .then((u) => {
        setUser(u)
        localStorage.setItem('auth_user', JSON.stringify(u))
      })
      .catch(() => {
        // Si falla (401) el interceptor de Axios redirige a /login
      })
  }, [])

  return (
    <div className="dashboard-layout">
      <Sidebar user={user} />
      <div className="dashboard-main">
        <Header user={user} />
        {children}
      </div>
    </div>
  )
}

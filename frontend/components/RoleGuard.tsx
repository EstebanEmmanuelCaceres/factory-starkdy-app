'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredUser } from '@/lib/auth'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: ('admin' | 'supervisor' | 'operator' | 'user')[]
  fallbackHref?: string
}

export default function RoleGuard({
  children,
  allowedRoles,
  fallbackHref = '/dashboard',
}: RoleGuardProps) {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const user = getStoredUser()
    if (!user) {
      router.push('/login')
      return
    }

    if (allowedRoles.includes(user.role)) {
      setAuthorized(true)
    } else {
      router.push(fallbackHref)
    }
    setLoading(false)
  }, [allowedRoles, fallbackHref, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-slate-400">Verificando permisos...</div>
      </div>
    )
  }

  return authorized ? <>{children}</> : null
}

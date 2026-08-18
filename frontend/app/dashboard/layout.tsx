'use client'

import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { getStoredUser, fetchMe, type User } from '@/lib/auth'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<User | null>(null)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  useEffect(() => {
    // Cargar usuario desde localStorage primero (instantáneo)
    const stored = getStoredUser()
    if (stored) setUser(stored)
  }, [])

  return (
    <div className="dashboard-layout min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar
        user={user}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />
      <div className="dashboard-main flex-1 flex flex-col min-h-screen w-full min-w-0 transition-all duration-200">
        <Header
          user={user}
          onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        />
        <main className="page-content flex-1 p-4 xs:p-5 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

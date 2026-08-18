'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { type User, ROLE_COLORS } from '@/lib/auth'

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Resumen general del sistema' },
  '/dashboard/productos': { title: 'Productos', subtitle: 'Catálogo y gestión de productos' },
  '/dashboard/clientes': { title: 'Clientes', subtitle: 'Directorio y cuentas de clientes' },
  '/dashboard/pedidos': { title: 'Pedidos', subtitle: 'Gestión y seguimiento de pedidos' },
  '/dashboard/saldos': { title: 'Saldos Pendientes', subtitle: 'Control de cobros y cuentas corrientes' },
  '/dashboard/tareas': { title: 'Mis Tareas', subtitle: 'Tareas operativas de producción' },
  '/dashboard/historial': { title: 'Historial', subtitle: 'Registro de producción y cambios de estado' },
}

interface HeaderProps {
  user: User | null
  onToggleSidebar?: () => void
}

export default function Header({ user, onToggleSidebar }: HeaderProps) {
  const pathname = usePathname()
  const page = PAGE_TITLES[pathname] ?? { title: 'Sistema Fábrica', subtitle: '' }

  return (
    <header className="dashboard-header border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 px-4 xs:px-5 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      {/* Lado izquierdo con botón de menú mobile */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl text-slate-300 hover:text-white bg-slate-950/70 border border-slate-800 hover:bg-slate-800 transition shadow-sm flex items-center justify-center shrink-0"
          aria-label="Abrir menú de navegación"
          title="Abrir menú"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
        <div className="header-left">
          <h1 className="text-sm xs:text-base sm:text-lg font-bold text-white leading-tight">{page.title}</h1>
          {page.subtitle && <p className="text-[11px] xs:text-xs text-slate-400 hidden xs:block">{page.subtitle}</p>}
        </div>
      </div>

      {/* Lado derecho */}
      <div className="header-right flex items-center gap-3">
        <div
          className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-950/40 px-2.5 py-1 rounded-full border border-slate-800/60"
          title="Sistema en línea"
        >
          <span className="status-dot" aria-hidden="true" />
          <span className="text-[11px] font-medium hidden xs:inline">En línea</span>
        </div>
      </div>
    </header>
  )
}

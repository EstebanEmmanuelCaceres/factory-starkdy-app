'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { type User, ROLE_COLORS } from '@/lib/auth'

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Resumen general del sistema' },
  '/dashboard/production': { title: 'Producción', subtitle: 'Control de órdenes y líneas de producción' },
  '/dashboard/inventory': { title: 'Inventario', subtitle: 'Stock y movimientos de materiales' },
  '/dashboard/employees': { title: 'Personal', subtitle: 'Gestión de operarios y turnos' },
  '/dashboard/machines': { title: 'Maquinaria', subtitle: 'Estado y disponibilidad de equipos' },
  '/dashboard/maintenance': { title: 'Mantenimiento', subtitle: 'Programación y registro de mantenimientos' },
  '/dashboard/quality': { title: 'Calidad', subtitle: 'Control de calidad y no conformidades' },
  '/dashboard/reports': { title: 'Reportes', subtitle: 'Métricas y análisis de producción' },
}

interface HeaderProps {
  user: User | null
}

export default function Header({ user }: HeaderProps) {
  const pathname = usePathname()
  const [time, setTime] = useState('')

  // useEffect(() => {
  //   const tick = () =>
  //     setTime(
  //       new Date().toLocaleTimeString('es-AR', {
  //         hour: '2-digit',
  //         minute: '2-digit',
  //       })
  //     )
  //   tick()
  //   const id = setInterval(tick, 60_000)
  //   return () => clearInterval(id)
  // }, [])

  const page = PAGE_TITLES[pathname] ?? { title: 'Sistema Fábrica', subtitle: '' }

  return (
    <header className="dashboard-header">
      {/* Título de la página actual */}
      <div className="header-left">
        <h1>{page.title}</h1>
        {page.subtitle && <p>{page.subtitle}</p>}
      </div>

      {/* Lado derecho */}
      <div className="header-right">
        {/* Hora */}
        {/* <span className="header-time" aria-label="Hora actual">
          🕐 {time}
        </span> */}

        {/* Indicador de sistema en línea */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}
          title="Sistema en línea"
        >
          <span className="status-dot" aria-hidden="true" />
          <span>En línea</span>
        </div>

        {/* Info del usuario (visible en header en pantallas grandes) */}
        {/* {user && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              paddingLeft: 12,
              borderLeft: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700,
                background: `linear-gradient(135deg, ${ROLE_COLORS[user.role] ?? 'var(--blue)'}, rgba(0,0,0,0.4))`,
                color: 'white',
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              {user.name
                .split(' ')
                .slice(0, 2)
                .map((n) => n[0])
                .join('')
                .toUpperCase()}
            </div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {user.name.split(' ')[0]}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {user.role_label}
              </div>
            </div>
          </div>
        )} */}
      </div>
    </header>
  )
}

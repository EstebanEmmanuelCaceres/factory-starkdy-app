'use client'

import { usePathname, useRouter } from 'next/navigation'
import { logout, type User, ROLE_COLORS } from '@/lib/auth'



// ── Íconos de navegación (SVG inline) ─────────────────────────────
const Icons = {
  dashboard: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  products: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  customers: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  logout: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  orders: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="15" y2="16" />
      <line x1="9" y1="8" x2="10" y2="8" />
    </svg>
  ),
}

// ── Estructura de navegación ───────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: 'Principal',
    items: [
      { id: 'dashboard', label: 'Dashboard', href: '/dashboard', Icon: Icons.dashboard, available: true },
      { id: 'productos', label: 'Productos', href: '/dashboard/productos', Icon: Icons.products, available: true, roles: ['admin'] },
      { id: 'clientes', label: 'Clientes', href: '/dashboard/clientes', Icon: Icons.customers, available: true, roles: ['admin'] },
      { id: 'pedidos', label: 'Pedidos', href: '/dashboard/pedidos', Icon: Icons.orders, available: true, roles: ['admin', 'supervisor'] }
    ]
  }
]

// ── Initials del usuario ───────────────────────────────────────────
function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

// ─────────────────────────────────────────────────────────────────
interface SidebarProps {
  user: User | null
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <nav className="sidebar" aria-label="Navegación principal">
      {/* Logo */}
      <div className="sidebar-logo">
        <img src="/logo.png" alt="Logo" className="sidebar-logo-img" />
      </div>

      {/* Navegación */}
      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="sidebar-section">
          <div className="sidebar-section-label">{section.label}</div>
          {section.items.map((item: any) => {
            // Filtrar ítems de navegación según el rol del usuario
            if (item.roles && (!user || !item.roles.includes(user.role))) {
              return null
            }
            const isActive = pathname === item.href
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => item.available && router.push(item.href)}
                style={{ width: '100%', textAlign: 'left', opacity: item.available ? 1 : 0.55 }}
                title={item.available ? item.label : `${item.label} — próximamente`}
              >
                <span className="nav-icon">
                  <item.Icon />
                </span>
                {item.label}
                {!item.available && (
                  <span className="nav-badge">Pronto</span>
                )}
              </button>
            )
          })}
        </div>
      ))}

      {/* Footer — usuario */}
      <div className="sidebar-footer">
        {user ? (
          <div className="user-card">
            <div
              className="user-avatar"
              style={{ background: `linear-gradient(135deg, ${ROLE_COLORS[user.role] ?? 'var(--blue)'}, rgba(0,0,0,0.4))` }}
            >
              {getInitials(user.name)}
            </div>
            <div className="user-info">
              <div className="user-name">{user.name}</div>
              <span className={`user-role-badge role-${user.role}`}>
                {user.role_label}
              </span>
            </div>
            <button
              id="sidebar-logout-btn"
              className="logout-btn"
              onClick={handleLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <Icons.logout />
            </button>
          </div>
        ) : (
          <div className="user-card" style={{ opacity: 0.5 }}>
            <div className="user-avatar" style={{ background: 'var(--border)' }}>?</div>
            <div className="user-info">
              <div className="user-name">Cargando...</div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Sistema de Gestión — Fábrica',
    template: '%s | Sistema Fábrica',
  },
  description:
    'Plataforma de gestión industrial para control de operaciones, inventario, producción y personal de fábrica.',
  robots: 'noindex, nofollow',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}

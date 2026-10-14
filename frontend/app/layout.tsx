/* eslint-disable @next/next/no-page-custom-font */
import type { Metadata } from 'next'
import './globals.css'
import { ModalProvider } from '@/components/Modal/context/ModalContext'

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ModalProvider>
          {children}
          <div id="modal-root" />
        </ModalProvider>
      </body>
    </html>
  )
}


'use client'

import { useState, type ReactNode } from 'react'
import Modal from '@/components/Modal'

export const isPdfUrl = (url: string) => /\.pdf(\?|$)/i.test(url)

interface ComprobanteLinkProps {
  url: string
  className?: string
  children: ReactNode
}

/** Botón que abre el comprobante (PDF o imagen) en un modal, sin salir de la pantalla. */
export const ComprobanteLink = ({ url, className = '', children }: ComprobanteLinkProps) => {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`cursor-pointer ${className}`}>
        {children}
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} className="!max-w-4xl lg:!w-[90%] p-4">
        <div className="flex items-center gap-3 pb-3 pr-12">
          <h3 className="text-base font-bold text-white">Comprobante</h3>
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
            Abrir en pestaña nueva
          </a>
        </div>
        {isPdfUrl(url) ? (
          <iframe src={url} title="Comprobante" className="h-[75vh] w-full rounded-lg border border-slate-800 bg-white" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Comprobante" className="mx-auto max-h-[75vh] max-w-full rounded-lg object-contain" />
        )}
      </Modal>
    </>
  )
}

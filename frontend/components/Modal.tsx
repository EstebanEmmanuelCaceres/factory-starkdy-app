'use client'

import React, { useEffect, useState, ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  isOpen: boolean
  onClose?: () => void
  children: ReactNode
  className?: string
  containerClassName?: string
  hideCloseButton?: boolean
}

export default function Modal({
  isOpen,
  onClose,
  children,
  className = '',
  containerClassName = '',
  hideCloseButton = false,
}: ModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen || !mounted) return null

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto ${containerClassName}`}
    >
      <div
        className={`bg-slate-900 border border-slate-800 rounded-2xl w-full max-h-[90vh] shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-150 overflow-y-auto text-slate-300 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {onClose && !hideCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-50 text-slate-400 hover:text-white hover:bg-slate-800/80 p-2 rounded-xl transition cursor-pointer flex items-center justify-center"
            title="Cerrar modal"
            aria-label="Cerrar modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body
  )
}

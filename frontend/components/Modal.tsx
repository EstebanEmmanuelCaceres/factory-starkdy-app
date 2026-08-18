'use client'

import React, { useEffect, useState, ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  isOpen: boolean
  onClose?: () => void
  children: ReactNode
  className?: string
  containerClassName?: string
}

export default function Modal({
  isOpen,
  onClose,
  children,
  className = '',
  containerClassName = '',
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
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose()
        }
      }}
    >
      <div
        className={`bg-slate-900 border border-slate-800 rounded-2xl w-full max-h-[90vh] shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-150 overflow-y-auto text-slate-300 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}

'use client'

import React from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalItems: number
  pageSize?: number // Default is 10
  onPageChange: (page: number) => void
}

export default function Pagination({
  currentPage,
  totalItems,
  pageSize = 10,
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize)

  if (totalPages <= 1) {
    // Si hay 1 o menos páginas, mostramos la barra igual para mantener el layout fijo pero deshabilitada,
    // o simplemente no mostramos navegación pero sí el texto de cantidad.
    // Para que la UI sea consistente con "altura fija", renderizarla siempre ayuda a mantener el contenedor de la misma altura.
  }

  // Generar números de página
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)
      if (currentPage > 3) {
        pages.push('...')
      }

      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (currentPage < totalPages - 2) {
        pages.push('...')
      }
      pages.push(totalPages)
    }
    return pages
  }

  const pages = getPageNumbers()
  const from = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const to = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-slate-900 border-t border-slate-800 text-slate-400 text-sm select-none">
      <div>
        Mostrando <span className="font-semibold text-white">{from}</span> a{' '}
        <span className="font-semibold text-white">{to}</span> de{' '}
        <span className="font-semibold text-white">{totalItems}</span> registros
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          {/* Ir al principio */}
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition duration-150"
            title="Primera página"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          {/* Anterior */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition duration-150"
            title="Página anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Números de página */}
          <div className="flex items-center gap-1">
            {pages.map((page, idx) => {
              if (page === '...') {
                return (
                  <span key={`ellipsis-${idx}`} className="px-2 py-1 text-slate-600">
                    ...
                  </span>
                )
              }

              const isCurrent = page === currentPage
              return (
                <button
                  key={`page-${page}`}
                  onClick={() => onPageChange(page as number)}
                  className={`min-w-[34px] h-8 px-2.5 rounded-lg text-xs font-medium transition duration-150 ${
                    isCurrent
                      ? 'bg-blue-600 text-white font-semibold shadow'
                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {page}
                </button>
              )
            })}
          </div>

          {/* Siguiente */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition duration-150"
            title="Página siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Ir al final */}
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition duration-150"
            title="Última página"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

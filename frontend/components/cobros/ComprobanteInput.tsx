'use client'

import { useRef, useState } from 'react'
import { uploadComprobante } from '@/lib/cobros'
import { labelClass } from './format'
import { ComprobanteLink, isPdfUrl } from './ComprobanteLink'

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp'
const MAX_MB = 10

interface ComprobanteInputProps {
  // URL del comprobante ya cargado (o null / '' si no hay)
  value: string | null
  onChange: (url: string | null) => void
  // Avisa al formulario para que no deje guardar mientras se sube el archivo
  onUploadingChange?: (uploading: boolean) => void
  // Estilo compacto para el PaymentModal
  compact?: boolean
}

/** Selector de comprobante (PDF o imagen): sube el archivo apenas se elige y devuelve la URL. */
export const ComprobanteInput = ({ value, onChange, onUploadingChange, compact = false }: ComprobanteInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const setBusy = (busy: boolean) => {
    setUploading(busy)
    onUploadingChange?.(busy)
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    if (!ACCEPT.split(',').includes(file.type)) {
      setError('Subí un PDF o una imagen (JPG, PNG, WEBP).')
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`El archivo no puede pesar más de ${MAX_MB} MB.`)
      return
    }
    setBusy(true)
    try {
      onChange(await uploadComprobante(file))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el comprobante')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const label = compact
    ? 'block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1'
    : labelClass
  const btn = compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'

  return (
    <div>
      <label className={label}>
        Comprobante <span className="font-normal lowercase text-slate-500">(PDF o imagen, opcional)</span>
      </label>

      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />

      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-2">
          {isPdfUrl(value) ? (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-xs font-bold text-rose-300">PDF</span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Comprobante" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
          )}
          <ComprobanteLink url={value} className="min-w-0 flex-1 truncate text-left text-xs text-blue-400 hover:underline">
            Ver comprobante
          </ComprobanteLink>
          <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} className={`rounded-lg border border-slate-800 font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50 cursor-pointer ${btn}`}>
            {uploading ? 'Subiendo...' : 'Cambiar'}
          </button>
          <button type="button" disabled={uploading} onClick={() => onChange(null)} className={`rounded-lg font-semibold text-rose-400 hover:bg-rose-500/10 disabled:opacity-50 cursor-pointer ${btn}`}>
            Quitar
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className={`w-full rounded-xl border border-dashed border-slate-700 text-slate-400 transition hover:border-blue-500 hover:text-white disabled:opacity-50 cursor-pointer ${btn}`}
        >
          {uploading ? 'Subiendo...' : 'Adjuntar comprobante (PDF o imagen)'}
        </button>
      )}

      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import {
  fetchOrderImages,
  uploadOrderImages,
  setPrimaryOrderImage,
  deleteOrderImage,
  type OrderImage
} from '@/lib/entities/orderImages'

interface OrderImageGalleryProps {
  orderId: number
  orderCode?: string
  onImagesUpdated?: () => void
}

export default function OrderImageGallery({ orderId, orderCode, onImagesUpdated }: OrderImageGalleryProps) {
  const [images, setImages] = useState<OrderImage[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadImages = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchOrderImages(orderId)
      setImages(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar las imágenes del pedido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadImages()
  }, [orderId])

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      // Ignorar si el usuario está escribiendo en un input o textarea
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return
      }

      const items = e.clipboardData?.items
      if (!items) return

      const files: File[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile()
          if (blob) {
            const ext = item.type.split('/')[1] || 'png'
            const file = new File([blob], `pedido_${orderId}_pegado_${Date.now()}.${ext}`, { type: item.type })
            files.push(file)
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault()
        setUploading(true)
        setError('')
        try {
          const updated = await uploadOrderImages(orderId, files)
          setImages(updated)
          showNotification('Imagen pegada desde el portapapeles subida correctamente')
          notifyUpdate()
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Error al subir la imagen pegada')
        } finally {
          setUploading(false)
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [orderId])

  const notifyUpdate = () => {
    if (onImagesUpdated) onImagesUpdated()
  }

  const showNotification = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const filesArray = Array.from(e.target.files)
    setUploading(true)
    setError('')
    try {
      const updated = await uploadOrderImages(orderId, filesArray)
      setImages(updated)
      showNotification('Imagen(es) del pedido subida(s) correctamente')
      notifyUpdate()
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al subir la imagen')
    } finally {
      setUploading(false)
    }
  }

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!urlInput.trim()) return
    setUploading(true)
    setError('')
    try {
      const updated = await uploadOrderImages(orderId, undefined, [urlInput.trim()])
      setImages(updated)
      setUrlInput('')
      showNotification('Imagen agregada desde URL')
      notifyUpdate()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al agregar imagen por URL')
    } finally {
      setUploading(false)
    }
  }

  const handleSetPrimary = async (imageId: number) => {
    setError('')
    try {
      const updated = await setPrimaryOrderImage(orderId, imageId)
      setImages(updated)
      showNotification('Portada / Imagen principal del pedido actualizada')
      notifyUpdate()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al actualizar imagen principal')
    }
  }

  const handleDelete = async (imageId: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta imagen del pedido?')) return
    setError('')
    try {
      const updated = await deleteOrderImage(orderId, imageId)
      setImages(updated)
      showNotification('Imagen eliminada')
      notifyUpdate()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al eliminar la imagen')
    }
  }

  return (
    <div className="space-y-6">
      {/* Alertas */}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-3.5 py-2.5 rounded-lg flex items-center gap-2 animate-in fade-in">
          <span>✅</span>
          <span className="font-medium">{success}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs px-3.5 py-2.5 rounded-lg flex items-center gap-2 animate-in fade-in">
          <span>❌</span>
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Zona de Carga / Upload */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Subir nuevas imágenes / planos del pedido</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Subir archivo local */}
          <div className="border-2 border-dashed border-slate-800 hover:border-blue-500/50 bg-slate-900/40 rounded-xl p-4 flex flex-col items-center justify-center text-center transition cursor-pointer group"
               onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <div className="w-10 h-10 rounded-full bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              📁
            </div>
            <span className="text-xs font-semibold text-slate-200">Seleccionar archivos o Pegar (Ctrl + V)</span>
            <span className="text-[10px] text-slate-500 mt-1">Sube archivos o pega directamente fotos del portapapeles</span>
          </div>

          {/* Subir por URL externa */}
          <form onSubmit={handleUrlSubmit} className="border border-slate-800 bg-slate-900/40 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-200 block mb-1">Agregar por URL externa</span>
              <p className="text-[10px] text-slate-500 mb-2">Ingresa el enlace directo de una imagen u orden de trabajo online.</p>
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://ejemplo.com/plano.jpg"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
              />
              <button
                type="submit"
                disabled={uploading || !urlInput.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              >
                Agregar
              </button>
            </div>
          </form>
        </div>

        {uploading && (
          <div className="flex items-center gap-2 text-blue-400 text-xs py-1 animate-pulse">
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-blue-400 border-t-transparent"></div>
            <span>Procesando y guardando imagen(es)...</span>
          </div>
        )}
      </div>

      {/* Grilla de Imágenes */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span>🖼️</span> Galería del Pedido {orderCode ? `(${orderCode})` : ''} ({images.length})
          </h4>
          <span className="text-[11px] text-slate-500">La primera imagen cargada es la <strong>Portada / Plano Principal</strong></span>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
            <span className="text-xs">Cargando imágenes del pedido...</span>
          </div>
        ) : images.length === 0 ? (
          <div className="py-12 border border-slate-800/80 rounded-xl bg-slate-950/30 flex flex-col items-center justify-center text-slate-500 gap-2">
            <span className="text-3xl">🖼️</span>
            <span className="text-xs font-medium">Este pedido aún no tiene imágenes o planos adjuntos.</span>
            <span className="text-[10px] text-slate-600">Sube la primera imagen para establecer la portada del pedido.</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {images.map((img) => (
              <div
                key={img.id}
                className={`relative group rounded-xl overflow-hidden border bg-slate-950 transition shadow-md ${
                  img.es_principal
                    ? 'border-amber-500/80 ring-2 ring-amber-500/20'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Visualizador de la imagen */}
                <div className="aspect-square relative flex items-center justify-center bg-slate-900/60 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={`Pedido ${orderCode || ''} imagen`}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><rect width='200' height='200' fill='%230f172a'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2364748b' font-family='sans-serif' font-size='13'>Imagen no disponible</text></svg>"
                    }}
                  />

                  {/* Badge Portada / Secundaria */}
                  <div className="absolute top-2 left-2 z-10">
                    {img.es_principal ? (
                      <span className="bg-amber-500 text-slate-950 font-extrabold text-[10px] uppercase px-2 py-0.5 rounded-full shadow-lg border border-amber-300 flex items-center gap-1">
                        ⭐ Portada
                      </span>
                    ) : (
                      <span className="bg-slate-900/80 text-slate-400 font-medium text-[10px] px-2 py-0.5 rounded-full border border-slate-700 backdrop-blur-sm">
                        Secundaria
                      </span>
                    )}
                  </div>

                  {/* Overlay con acciones */}
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition duration-150 flex flex-col items-center justify-center gap-2 p-2">
                    {!img.es_principal && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(img.id)}
                        className="w-full bg-amber-500/20 hover:bg-amber-500 border border-amber-500/50 text-amber-300 hover:text-slate-950 text-[11px] font-bold py-1.5 px-2 rounded-lg transition"
                      >
                        ★ Hacer Portada
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(img.id)}
                      className="w-full bg-rose-500/20 hover:bg-rose-500 border border-rose-500/50 text-rose-300 hover:text-white text-[11px] font-bold py-1.5 px-2 rounded-lg transition"
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

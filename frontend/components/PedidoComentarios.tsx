'use client'

import { useEffect, useRef, useState } from 'react'
import { getStoredUser } from '@/lib/auth'
import type { OrderImage } from '@/lib/entities/orderImages'
import {
  createPedidoComentario,
  deletePedidoComentario,
  updatePedidoComentario,
  type ComentarioPedido,
} from '@/lib/pedidos'
import { ImageLightbox } from './ImageLightbox'

interface PedidoComentariosProps {
  pedidoId: number
  comentarios: ComentarioPedido[]
  onChange: (comentarios: ComentarioPedido[]) => void
  // Las imágenes de un comentario nuevo también son del pedido: el padre las suma a la galería
  onImagenesAgregadas?: (imagenes: OrderImage[]) => void
}

const MAX_IMAGENES = 10

const formatFecha = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
}

// Comentarios del pedido: publicar con texto y/o imágenes, editar y eliminar (autor o admin)
export default function PedidoComentarios({ pedidoId, comentarios, onChange, onImagenesAgregadas }: PedidoComentariosProps) {
  const [texto, setTexto] = useState('')
  const [archivos, setArchivos] = useState<File[]>([])
  const [publicando, setPublicando] = useState(false)
  const [editando, setEditando] = useState<{ id: number; texto: string } | null>(null)
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null)
  const inputArchivos = useRef<HTMLInputElement>(null)

  const usuario = getStoredUser()
  const puedeModificar = (c: ComentarioPedido) => !!usuario && (c.user_id === usuario.id || usuario.role === 'admin')

  // Vistas previas de las imágenes elegidas (se liberan al cambiar la selección)
  const [previews, setPreviews] = useState<string[]>([])
  useEffect(() => {
    const urls = archivos.map((f) => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach(URL.revokeObjectURL)
  }, [archivos])

  const agregarArchivos = (files: FileList | null) => {
    if (!files) return
    const imagenes = Array.from(files).filter((f) => f.type.startsWith('image/'))
    setArchivos((prev) => [...prev, ...imagenes].slice(0, MAX_IMAGENES))
  }

  const ejecutar = async (accion: () => Promise<void>, mensajeError: string) => {
    setError('')
    try {
      await accion()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : mensajeError)
    }
  }

  const publicar = () =>
    ejecutar(async () => {
      setPublicando(true)
      try {
        const nuevo = await createPedidoComentario(pedidoId, texto, archivos)
        onChange([nuevo, ...comentarios])
        if (nuevo.imagenes.length > 0) onImagenesAgregadas?.(nuevo.imagenes)
        setTexto('')
        setArchivos([])
      } finally {
        setPublicando(false)
      }
    }, 'Error al publicar el comentario')

  const guardarEdicion = () =>
    ejecutar(async () => {
      if (!editando?.texto.trim()) return
      const cambios = await updatePedidoComentario(pedidoId, editando.id, editando.texto.trim())
      onChange(comentarios.map((c) => (c.id === cambios.id ? { ...c, ...cambios } : c)))
      setEditando(null)
    }, 'Error al editar el comentario')

  const eliminar = (comentario: ComentarioPedido) =>
    ejecutar(async () => {
      if (!confirm('¿Eliminar este comentario? Sus imágenes quedan en la galería del pedido.')) return
      await deletePedidoComentario(pedidoId, comentario.id)
      onChange(comentarios.filter((c) => c.id !== comentario.id))
    }, 'Error al eliminar el comentario')

  const puedePublicar = (texto.trim() !== '' || archivos.length > 0) && !publicando

  return (
    <div className="flex flex-col text-left">
      {/* Nuevo comentario */}
      <div
        className="space-y-2 mb-4"
        onPaste={(e) => agregarArchivos(e.clipboardData.files)}
      >
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe un comentario o pegá una imagen..."
          maxLength={1000}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none h-16"
        />

        {previews.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {previews.map((url, i) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="size-14 rounded-md object-cover border border-slate-700" />
                <button
                  type="button"
                  onClick={() => setArchivos((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-slate-800 text-[10px] text-slate-200 hover:bg-rose-600"
                  aria-label="Quitar imagen"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!puedePublicar}
            onClick={publicar}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded text-xs font-semibold transition"
          >
            {publicando ? 'Publicando...' : 'Comentar'}
          </button>
          <button
            type="button"
            onClick={() => inputArchivos.current?.click()}
            disabled={archivos.length >= MAX_IMAGENES}
            className="px-2.5 py-1 rounded text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 transition"
          >
            📎 Imagen
          </button>
          <input
            ref={inputArchivos}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              agregarArchivos(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>

      {/* Listado */}
      <div className="space-y-3 flex-grow">
        {comentarios.length === 0 ? (
          <p className="text-xs text-slate-500 italic text-center py-4">No hay comentarios en este pedido todavía.</p>
        ) : (
          comentarios.map((c) => {
            const enEdicion = editando?.id === c.id
            const urls = (c.imagenes ?? []).map((img) => img.url)
            return (
              <div key={c.id} className="group bg-slate-950/30 border border-slate-800/50 p-2.5 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="font-bold text-slate-300">{c.user?.name || 'Usuario'}</span>
                  <span className="text-slate-500 font-mono">
                    {formatFecha(c.created_at)}
                    {c.updated_at !== c.created_at && <span className="ml-1 italic">(editado)</span>}
                  </span>
                </div>

                {enEdicion ? (
                  <div className="space-y-1.5">
                    <textarea
                      value={editando.texto}
                      onChange={(e) => setEditando({ id: c.id, texto: e.target.value })}
                      maxLength={1000}
                      autoFocus
                      className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white focus:outline-none focus:border-blue-500 resize-none h-16"
                    />
                    <div className="flex gap-1.5">
                      <button type="button" onClick={guardarEdicion} disabled={!editando.texto.trim()} className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-[11px] font-semibold">
                        Guardar
                      </button>
                      <button type="button" onClick={() => setEditando(null)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-semibold">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  c.cuerpo && <p className="text-xs text-slate-200 leading-relaxed break-words whitespace-pre-wrap">{c.cuerpo}</p>
                )}

                {urls.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {urls.map((url, i) => (
                      <button key={url} type="button" onClick={() => setLightbox({ urls, index: i })} className="cursor-zoom-in">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="size-16 rounded-md object-cover border border-slate-700 hover:border-blue-500 transition" />
                      </button>
                    ))}
                  </div>
                )}

                {puedeModificar(c) && !enEdicion && (
                  <div className="flex gap-3 text-[11px] font-semibold">
                    {c.cuerpo && (
                      <button type="button" onClick={() => setEditando({ id: c.id, texto: c.cuerpo })} className="text-slate-400 hover:text-white">
                        Editar
                      </button>
                    )}
                    <button type="button" onClick={() => eliminar(c)} className="text-slate-400 hover:text-rose-400">
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {lightbox && (
        <ImageLightbox
          images={lightbox.urls.map((url) => ({ url }))}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}

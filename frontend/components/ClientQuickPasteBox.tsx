'use client'

import { useState } from 'react'
import { parseClienteText, type ParsedClienteData } from '@/lib/parseClienteText'
import { type Cliente } from '@/lib/clientes'

interface ClientQuickPasteBoxProps {
  onParsed: (data: ParsedClienteData) => void
  currentEmpresaValue?: string
  existingClientes?: Cliente[]
  onSelectExistingClient?: (cliente: Cliente) => void
}

export default function ClientQuickPasteBox({
  onParsed,
  currentEmpresaValue = '',
  existingClientes = [],
  onSelectExistingClient
}: ClientQuickPasteBoxProps) {
  const [rawText, setRawText] = useState('')
  const [showTextarea, setShowTextarea] = useState(false)
  const [lastParsed, setLastParsed] = useState<ParsedClienteData | null>(null)
  const [parseError, setParseError] = useState('')
  const [duplicateClient, setDuplicateClient] = useState<Cliente | null>(null)

  const findDuplicate = (parsed: ParsedClienteData): Cliente | null => {
    if (!existingClientes || existingClientes.length === 0) return null
    const cleanDni = parsed.dni.replace(/\D/g, '')
    const cleanEmail = parsed.email.toLowerCase().trim()

    return (
      existingClientes.find((c) => {
        if (cleanEmail && c.email && c.email.toLowerCase().trim() === cleanEmail) {
          return true
        }
        if (cleanDni && cleanDni.length >= 6 && c.dni) {
          const existingDni = c.dni.replace(/\D/g, '')
          if (existingDni === cleanDni) return true
        }
        return false
      }) || null
    )
  }

  const processText = (textToProcess: string) => {
    setParseError('')
    if (!textToProcess.trim()) {
      setParseError('El texto está vacío. Pegá los datos enviados por el cliente.')
      return
    }

    const parsed = parseClienteText(textToProcess)
    if (parsed.extractedCount === 0) {
      setParseError('No se detectaron campos con el formato esperado (Ej: "Nombre y apellido: ...", "Dni: ...").')
      return
    }

    setLastParsed(parsed)
    setDuplicateClient(findDuplicate(parsed))
    onParsed(parsed)
    setShowTextarea(false)
  }

  const handlePasteFromClipboard = async () => {
    setParseError('')
    try {
      if (!navigator.clipboard?.readText) {
        setShowTextarea(true)
        return
      }
      const text = await navigator.clipboard.readText()
      if (!text.trim()) {
        setShowTextarea(true)
        setParseError('El portapapeles está vacío. Pegá el mensaje manualmente abajo.')
        return
      }
      setRawText(text)
      processText(text)
    } catch {
      // Si el navegador bloquea el permiso del portapapeles, abrimos el textarea para Ctrl+V
      setShowTextarea(true)
    }
  }

  const handleTextareaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text')
    if (pasted && pasted.trim()) {
      e.preventDefault()
      setRawText(pasted)
      processText(pasted)
    }
  }

  const showMissingEmpresaWarning =
    lastParsed && lastParsed.missingEmpresa && !currentEmpresaValue.trim()

  return (
    <div className="bg-slate-950/70 border border-indigo-500/30 rounded-xl p-4 space-y-3 text-left">
      <div className="flex items-start gap-2.5">
        <span className="text-base leading-none mt-0.5">⚡</span>
        <div className="flex-1">
          <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider block">
            Autocompletar desde WhatsApp / Mensaje
          </span>
          <span className="text-xs text-slate-400 mt-0.5 block">
            Pegá la respuesta del cliente con sus datos de envío para rellenar los campos automáticamente.
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => setShowTextarea((prev) => !prev)}
          className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-900 transition"
        >
          {showTextarea ? 'Ocultar cuadro' : 'Pegar manual'}
        </button>
        <button
          type="button"
          onClick={handlePasteFromClipboard}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow transition hover:scale-[1.02] active:scale-[0.98]"
        >
          <span>📋</span> Pegar del portapapeles
        </button>
      </div>

      {showTextarea && (
        <div className="space-y-2 pt-1 border-t border-slate-800/80">
          <textarea
            rows={3}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            onPaste={handleTextareaPaste}
            placeholder="Pegá acá (Ctrl + V) el mensaje del cliente... Ej: Nombre y apellido: Juan Perez _Dni: ..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setRawText('')
                setParseError('')
              }}
              className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded transition"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => processText(rawText)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1 rounded-lg transition"
            >
              Extraer y completar campos
            </button>
          </div>
        </div>
      )}

      {parseError && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
          <span>❌</span>
          <span>{parseError}</span>
        </div>
      )}

      {lastParsed && lastParsed.extractedCount > 0 && !parseError && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs px-3 py-2 rounded-lg flex items-center justify-between gap-2">
          <span>
            ✅ Se completaron <strong>{lastParsed.extractedCount} campos</strong> automáticamente. Revisá los datos antes de continuar.
          </span>
        </div>
      )}

      {showMissingEmpresaWarning && (
        <div className="bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs px-3 py-2.5 rounded-lg flex items-start gap-2 animate-pulse">
          <span className="text-sm leading-none mt-0.5">⚠️</span>
          <div>
            <span className="font-bold block">Falta cargar el Nombre de la Empresa</span>
            <span className="text-amber-200/90">
              Este dato es obligatorio y no venía en el mensaje del cliente. Completalo en el campo resaltado abajo.
            </span>
          </div>
        </div>
      )}

      {duplicateClient && (
        <div className="bg-blue-500/10 border border-blue-500/30 text-blue-200 text-xs px-3 py-2.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="font-bold block text-blue-300">
              🔎 Ya existe un cliente con este DNI o Correo:
            </span>
            <span>
              {duplicateClient.nombre_cliente} ({duplicateClient.nombre_empresa})
            </span>
          </div>
          {onSelectExistingClient && (
            <button
              type="button"
              onClick={() => onSelectExistingClient(duplicateClient)}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs shrink-0 transition"
            >
              Usar cliente existente ➡️
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export interface ParsedClienteData {
  nombre_cliente: string
  nombre_empresa: string
  telefono: string
  email: string
  dni: string
  direccion: string
  provincia: string
  cp: string
  localidad: string
  observaciones: string
  extractedCount: number
  missingEmpresa: boolean
}

type FieldKey =
  | 'intro'
  | 'nombre_cliente'
  | 'nombre_empresa'
  | 'dni'
  | 'email'
  | 'direccion'
  | 'aclaracion'
  | 'provincia'
  | 'cp'
  | 'localidad'
  | 'telefono'
  | 'como_nos_conociste'
  | 'observaciones_extra'

interface AnchorDef {
  key: FieldKey
  regex: RegExp
}

const ANCHOR_DEFS: AnchorDef[] = [
  {
    key: 'intro',
    regex: /te\s+pido\s+estos\s+datos(?:\s+para\s+el\s+env[ií]o)?\s*:?/gi
  },
  {
    key: 'nombre_cliente',
    regex: /(?:nombre\s+y\s+apellido(?:s)?|apellido(?:s)?\s+y\s+nombre(?:s)?|nombre\s+completo|nombre\s+del\s+cliente|nombre(?!\s+de\s+(?:la\s+)?empresa))\s*:/gi
  },
  {
    key: 'nombre_empresa',
    regex: /(?:nombre\s+de\s+(?:la\s+)?empresa|raz[oó]n\s+social|empresa|negocio)\s*:/gi
  },
  {
    key: 'dni',
    regex: /(?:dni\s*\/\s*cuit|cuit\s*\/\s*dni|dni|cuit|cuil|documento)\s*:/gi
  },
  {
    key: 'email',
    regex: /(?:correo\s+electr[oó]nico|e-?mail|correo|mail)\s*:/gi
  },
  {
    key: 'direccion',
    regex: /(?:direcci[oó]n(?:\s+de\s+entrega|\s+de\s+env[ií]o)?|domicilio|calle\s+y\s+n[uú]mero|calle)\s*:/gi
  },
  {
    key: 'aclaracion',
    regex: /(?:cualquier\s+aclaraci[oó]n(?:\s+para\s+la\s+entrega)?|aclaraci[oó]n(?:\s+para\s+la\s+entrega|\s+de\s+entrega)?|piso\s*\/?\s*dpto|depto\s*\/?\s*timbre|referencia\s+de\s+entrega)\s*:/gi
  },
  {
    key: 'provincia',
    regex: /(?:provincia|prov\.?)\s*:/gi
  },
  {
    key: 'cp',
    regex: /(?:c[oó]digo\s+postal|cod\.?\s*postal|c\.?\s*p\.?)\s*:/gi
  },
  {
    key: 'localidad',
    regex: /(?:localidad(?:\s*\([^)]*\))?|ciudad)\s*:/gi
  },
  {
    key: 'telefono',
    regex: /(?:celular\s+de\s+contacto|tel[eé]fono\s+de\s+contacto|n[uú]mero\s+de\s+celular|celular|tel[eé]fono|cel\.?|tel\.?|whatsapp|wsp)\s*:/gi
  },
  {
    key: 'como_nos_conociste',
    regex: /(?:¿?\s*c[oó]mo\s+nos\s+conociste\s*\??)\s*:/gi
  },
  {
    key: 'observaciones_extra',
    regex: /(?:observaciones|notas\s+adicionales|notas)\s*:/gi
  }
]

function cleanValue(raw: string): string {
  return raw
    // Quitar separadores de formato de WhatsApp (_ * ~ • -) al inicio y al final
    .replace(/^[\s_*~•\-:]+/, '')
    .replace(/[\s_*~•\-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanEmail(raw: string): string {
  const cleaned = cleanValue(raw)
  // Si viene como link markdown [correo@gmail.com](mailto:correo@gmail.com)
  const markdownMatch = cleaned.match(/\[([^\]]+)\]\(mailto:[^)]+\)/i)
  if (markdownMatch?.[1]) {
    return markdownMatch[1].trim()
  }
  const emailMatch = cleaned.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  if (emailMatch?.[0]) {
    return emailMatch[0].trim()
  }
  return cleaned
}

/**
 * Parsea el mensaje de texto enviado por el cliente (WhatsApp / Instagram / etc.)
 * y extrae los campos para pre-llenar el formulario de creación de cliente.
 */
export function parseClienteText(text: string): ParsedClienteData {
  const matches: Array<{ key: FieldKey; start: number; end: number }> = []

  for (const def of ANCHOR_DEFS) {
    const regex = new RegExp(def.regex.source, def.regex.flags)
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        key: def.key,
        start: match.index,
        end: match.index + match[0].length
      })
    }
  }

  // Ordenar por posición de aparición; si empatan en inicio, priorizar el match más largo
  matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start))

  // Filtrar matches solapados (ej: si una etiqueta está contenida dentro de otra)
  const filteredMatches: typeof matches = []
  for (const m of matches) {
    const prev = filteredMatches[filteredMatches.length - 1]
    if (!prev || m.start >= prev.end) {
      filteredMatches.push(m)
    }
  }

  const rawFields: Partial<Record<FieldKey, string>> = {}

  for (let i = 0; i < filteredMatches.length; i++) {
    const current = filteredMatches[i]
    if (current.key === 'intro') continue

    const next = filteredMatches[i + 1]
    const sliceEnd = next ? next.start : text.length
    const rawSegment = text.slice(current.end, sliceEnd)
    const cleaned = current.key === 'email' ? cleanEmail(rawSegment) : cleanValue(rawSegment)

    if (cleaned && !rawFields[current.key]) {
      rawFields[current.key] = cleaned
    }
  }

  // Si copiaron el mensaje empezando directamente desde el nombre (sin la etiqueta "Nombre y apellido:")
  // ej: "Gauna Mariano Exequiel_Dni: 38.542.630_..."
  if (!rawFields.nombre_cliente && filteredMatches.length > 0) {
    const firstNonIntroIdx = filteredMatches.findIndex((m) => m.key !== 'intro')
    if (firstNonIntroIdx !== -1) {
      const firstAnchor = filteredMatches[firstNonIntroIdx]
      const prefixStart = firstNonIntroIdx > 0 ? filteredMatches[firstNonIntroIdx - 1].end : 0
      const rawPrefix = text.slice(prefixStart, firstAnchor.start)
      const cleanedPrefix = cleanValue(rawPrefix)
      if (cleanedPrefix && cleanedPrefix.length >= 2 && cleanedPrefix.length <= 80 && !cleanedPrefix.includes(':')) {
        rawFields.nombre_cliente = cleanedPrefix
      }
    }
  }

  const direccionBase = rawFields.direccion || ''
  const aclaracion = rawFields.aclaracion || ''
  const direccionCompleta =
    direccionBase && aclaracion
      ? `${direccionBase} - ${aclaracion}`
      : direccionBase || aclaracion

  const observacionesParts: string[] = []
  if (rawFields.como_nos_conociste) {
    observacionesParts.push(`Cómo nos conociste: ${rawFields.como_nos_conociste}`)
  }
  if (rawFields.observaciones_extra) {
    observacionesParts.push(rawFields.observaciones_extra)
  }

  const result: ParsedClienteData = {
    nombre_cliente: rawFields.nombre_cliente || '',
    nombre_empresa: rawFields.nombre_empresa || '',
    telefono: rawFields.telefono || '',
    email: rawFields.email || '',
    dni: rawFields.dni || '',
    direccion: direccionCompleta,
    provincia: rawFields.provincia || '',
    cp: rawFields.cp || '',
    localidad: rawFields.localidad || '',
    observaciones: observacionesParts.join(' | '),
    extractedCount: 0,
    missingEmpresa: !rawFields.nombre_empresa
  }

  const mainKeys: Array<keyof ParsedClienteData> = [
    'nombre_cliente',
    'nombre_empresa',
    'telefono',
    'email',
    'dni',
    'direccion',
    'provincia',
    'cp',
    'localidad',
    'observaciones'
  ]

  result.extractedCount = mainKeys.filter((k) => Boolean(result[k])).length

  return result
}

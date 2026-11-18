import localidadesData from './andreaniLocalidades.json'

/**
 * Normaliza un texto removiendo tildes, caracteres especiales y llevándolo a mayúsculas.
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
}

/**
 * Índice en memoria para búsqueda ultra rápida O(1) de localidades Andreani.
 */
let cpIndex: Map<string, string[]> | null = null
let localidadIndex: Map<string, string[]> | null = null

function ensureIndexes() {
  if (cpIndex && localidadIndex) return

  cpIndex = new Map<string, string[]>()
  localidadIndex = new Map<string, string[]>()

  const list = localidadesData as string[]
  for (const item of list) {
    // Formato: "PROVINCIA / LOCALIDAD / CP"
    const parts = item.split('/')
    if (parts.length === 3) {
      const prov = normalizeText(parts[0])
      const loc = normalizeText(parts[1])
      const cp = parts[2].trim()

      // Índice por CP
      if (cp) {
        const byCp = cpIndex.get(cp) ?? []
        byCp.push(item)
        cpIndex.set(cp, byCp)
      }

      // Índice por Localidad + Provincia
      const locKey = `${loc}|${prov}`
      const byLoc = localidadIndex.get(locKey) ?? []
      byLoc.push(item)
      localidadIndex.set(locKey, byLoc)
    }
  }
}

/**
 * Busca la coincidencia exacta o más cercana en el catálogo de localidades oficial de Andreani.
 * Si encuentra coincidencia, retorna el string canónico "PROVINCIA / LOCALIDAD / CP".
 * Si no encuentra coincidencia, genera la cadena con el formato que Andreani espera.
 */
export function findAndreaniLocation(
  provinciaRaw?: string | null,
  localidadRaw?: string | null,
  cpRaw?: string | null
): string {
  ensureIndexes()

  const cleanCp = (cpRaw ?? '').replace(/\D/g, '').trim()
  const normProv = normalizeText(provinciaRaw)
  const normLoc = normalizeText(localidadRaw)

  // 1. Búsqueda por CP
  if (cleanCp && cpIndex) {
    const candidates = cpIndex.get(cleanCp)
    if (candidates && candidates.length > 0) {
      if (candidates.length === 1) {
        return candidates[0]
      }
      // Si hay más de una localidad con el mismo CP, buscamos la que coincida en nombre
      if (normLoc) {
        const matchLoc = candidates.find((c) => {
          const parts = c.split('/')
          return normalizeText(parts[1]) === normLoc
        })
        if (matchLoc) return matchLoc
      }
      // O coincidencia en provincia
      if (normProv) {
        const matchProv = candidates.find((c) => {
          const parts = c.split('/')
          return normalizeText(parts[0]).includes(normProv) || normProv.includes(normalizeText(parts[0]))
        })
        if (matchProv) return matchProv
      }
      return candidates[0]
    }
  }

  // 2. Búsqueda por Localidad y Provincia
  if (normLoc && localidadIndex) {
    // Intento con clave exacta
    const exactKey = `${normLoc}|${normProv}`
    const byLoc = localidadIndex.get(exactKey)
    if (byLoc && byLoc.length > 0) {
      return byLoc[0]
    }

    // Intento buscando solo por localidad en la lista
    const list = localidadesData as string[]
    const candidate = list.find((item) => {
      const parts = item.split('/')
      if (parts.length !== 3) return false
      const pLoc = normalizeText(parts[1])
      const pProv = normalizeText(parts[0])
      const locMatches = pLoc === normLoc || pLoc.includes(normLoc) || normLoc.includes(pLoc)
      const provMatches = !normProv || pProv.includes(normProv) || normProv.includes(pProv)
      return locMatches && provMatches
    })

    if (candidate) return candidate
  }

  // 3. Fallback: formatear con la estructura exigida "PROVINCIA / LOCALIDAD / CP"
  const provFinal = normProv || 'BUENOS AIRES'
  const locFinal = normLoc || 'CAPITAL FEDERAL'
  const cpFinal = cleanCp || '1000'
  return `${provFinal} / ${locFinal} / ${cpFinal}`
}

/**
 * Separa nombre y apellido tomando la última palabra como Apellido, tal como indicó el usuario.
 */
export function parseNombreApellido(
  nombreCliente?: string | null,
  nombreEmpresa?: string | null
): { nombre: string; apellido: string } {
  const full = (nombreCliente || nombreEmpresa || '').trim().replace(/\s+/g, ' ')
  if (!full) {
    return { nombre: 'Cliente', apellido: '-' }
  }

  const parts = full.split(' ')
  if (parts.length === 1) {
    return { nombre: parts[0], apellido: parts[0] }
  }

  const apellido = parts[parts.length - 1]
  const nombre = parts.slice(0, -1).join(' ')
  return { nombre, apellido }
}

/**
 * Parser inteligente de celular para separar "Celular código" (prefijo sin 0) y "Celular número" (sin 15).
 */
export function parseCelular(telefonoRaw?: string | null): { codigo: string; numero: string } {
  if (!telefonoRaw) {
    return { codigo: '', numero: '' }
  }

  // Limpiar solo dígitos
  let digits = telefonoRaw.replace(/\D/g, '')

  // Remover prefijo internacional de Argentina (549 o 54)
  if (digits.startsWith('549')) {
    digits = digits.slice(3)
  } else if (digits.startsWith('54')) {
    digits = digits.slice(2)
  }

  // Remover 0 inicial
  digits = digits.replace(/^0+/, '')

  // Códigos de área comunes de 2 dígitos en Argentina (AMBA / CABA)
  if (digits.startsWith('11')) {
    let numPart = digits.slice(2)
    if (numPart.startsWith('15')) numPart = numPart.slice(2)
    return { codigo: '11', numero: numPart }
  }

  // Códigos de área de 3 dígitos más comunes (La Plata, Mar del Plata, Rosario, Córdoba, Mendoza, Santa Fe, Salta, etc.)
  const codigos3 = [
    '220', '221', '223', '230', '237', '260', '261', '264', '280', '291', '294', '299',
    '341', '342', '343', '348', '351', '353', '358', '370', '376', '379', '381', '383',
    '385', '387', '388'
  ]

  for (const c3 of codigos3) {
    if (digits.startsWith(c3)) {
      let numPart = digits.slice(3)
      if (numPart.startsWith('15')) numPart = numPart.slice(2)
      return { codigo: c3, numero: numPart }
    }
  }

  // Si tiene exactamente 10 dígitos (estándar nacional sin 0 ni 15):
  if (digits.length === 10) {
    // Si no coincidió con los anteriores, tomamos los primeros 3 o 4 dígitos según convención
    return { codigo: digits.slice(0, 3), numero: digits.slice(3) }
  }

  // Si tiene 11 dígitos y empieza con 15 en medio (ej: 351 + 15 + 7 dígitos = 12 dígitos)
  if (digits.length >= 11) {
    const posibleCod = digits.slice(0, 3)
    let rest = digits.slice(3)
    if (rest.startsWith('15')) rest = rest.slice(2)
    return { codigo: posibleCod, numero: rest }
  }

  // Fallback para teléfonos cortos o locales (asumir AMBA 11 o primeros dígitos)
  if (digits.length > 6) {
    const cod = digits.slice(0, 2)
    const num = digits.slice(2)
    return { codigo: cod, numero: num }
  }

  return { codigo: '', numero: digits }
}

/**
 * Parser inteligente de dirección para extraer Calle, Número, Piso y Departamento.
 */
export function parseDireccion(direccionRaw?: string | null): {
  calle: string
  numero: string
  piso: string
  depto: string
} {
  if (!direccionRaw || !direccionRaw.trim()) {
    return { calle: '', numero: '0', piso: '', depto: '' }
  }

  let text = direccionRaw.trim()

  let piso = ''
  let depto = ''

  // 1. Extraer Piso si existe (ej: "Piso 4", "4° piso", "4to piso")
  const pisoMatch = text.match(/(?:piso|p\.?|nivel)\s*([0-9a-zA-Z]+)/i)
  if (pisoMatch) {
    piso = pisoMatch[1]
    text = text.replace(pisoMatch[0], ' ')
  }

  // 2. Extraer Departamento si existe (ej: "Dpto 2B", "depto B", "dto. 4")
  const deptoMatch = text.match(/(?:departamento|depto\.?|dpto\.?|dto\.?|of\.?|oficina)\s*([0-9a-zA-Z]+)/i)
  if (deptoMatch) {
    depto = deptoMatch[1]
    text = text.replace(deptoMatch[0], ' ')
  }

  // Limpiar separadores sobrantes
  text = text.replace(/[,;]/g, ' ').replace(/\s+/g, ' ').trim()

  // 3. Extraer Número de altura
  // Buscar un indicador explícito como "N° 1234", "Nro 1234", "# 1234"
  const explicitNumMatch = text.match(/(?:nro\.?|n°|nº|#)\s*([0-9]+)/i)
  if (explicitNumMatch) {
    const numero = explicitNumMatch[1]
    const calle = text.replace(explicitNumMatch[0], '').trim()
    return { calle: calle || text, numero, piso, depto }
  }

  // Buscar el último número aislado o seguido de final de línea que suele ser la altura
  // (Ej: "San Martín 1540", "Calle 50 1234")
  const numRegex = /\b([0-9]+)\b/g
  let lastMatch: RegExpExecArray | null = null
  let m: RegExpExecArray | null = null
  while ((m = numRegex.exec(text)) !== null) {
    lastMatch = m
  }

  if (lastMatch && lastMatch.index !== undefined && lastMatch.index > 0) {
    const numero = lastMatch[1]
    const index = lastMatch.index
    const calle = text.slice(0, index).trim()
    const remainder = text.slice(index + numero.length).trim()
    // Si sobró algo al final como una letra sola ("B") y no teníamos depto:
    if (!depto && /^[a-zA-Z]$/.test(remainder)) {
      depto = remainder.toUpperCase()
    }
    return { calle: calle || text, numero, piso, depto }
  }

  // Si no se encontró número, dejar '0' o 'S/N'
  return { calle: text, numero: '0', piso, depto }
}

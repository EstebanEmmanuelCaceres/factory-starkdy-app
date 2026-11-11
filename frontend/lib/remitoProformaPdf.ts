import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Base64 del logo STARK DY (blanco y rojo)
export const STARKDY_LOGO_BASE64 =
    'data:image/png;base64,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'

// Base64 del logo INDUSTRIA ARGENTINA con trama celeste y sol (JPEG nativo de alta compatibilidad con jsPDF)
export const INDUSTRIA_ARGENTINA_LOGO_BASE64 =
    'data:image/jpeg;base64,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'

export interface RemitoProformaItem {
    nombre: string
    atributosTexto?: string
    cantidad: number
    precioUnitario: number
    total: number
}

export interface RemitoProformaData {
    codigo?: string
    fecha?: string
    clienteNombre?: string
    clienteEmpresa?: string
    items: RemitoProformaItem[]
    total: number
    validezDias?: number
}

// Formateador de moneda en estilo argentino ($ 195.000 o $ 780)
export function formatMoneyAr(amount: number): string {
    const formatted = new Intl.NumberFormat('es-AR', {
        minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
    }).format(amount)
    return `$${formatted}`
}

// Crea en un canvas la insignia oficial de Banco Galicia en alta resolución
function createGaliciaBadgeDataUrl(): string {
    if (typeof document === 'undefined') return ''
    try {
        const canvas = document.createElement('canvas')
        canvas.width = 320
        canvas.height = 96
        const ctx = canvas.getContext('2d')
        if (!ctx) return ''

        // Fondo redondeado rojo/naranja Galicia (#cb2821)
        const radius = 16
        ctx.fillStyle = '#cb2821'
        ctx.beginPath()
        ctx.moveTo(radius, 0)
        ctx.lineTo(canvas.width - radius, 0)
        ctx.quadraticCurveTo(canvas.width, 0, canvas.width, radius)
        ctx.lineTo(canvas.width, canvas.height - radius)
        ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - radius, canvas.height)
        ctx.lineTo(radius, canvas.height)
        ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - radius)
        ctx.lineTo(0, radius)
        ctx.quadraticCurveTo(0, 0, radius, 0)
        ctx.closePath()
        ctx.fill()

        // Símbolo / Cruz estilizada en blanco a la izquierda
        ctx.save()
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 4
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        // Cruz con brazos floronados y punta espada
        const cx = 56
        const cy = 48
        // Poste vertical
        ctx.beginPath()
        ctx.moveTo(cx, cy - 28)
        // Punta superior (forma de corazón / flor de lis)
        ctx.bezierCurveTo(cx - 8, cy - 24, cx - 12, cy - 14, cx - 4, cy - 10)
        ctx.lineTo(cx - 4, cy - 2)
        // Brazo izquierdo
        ctx.lineTo(cx - 24, cy - 2)
        ctx.quadraticCurveTo(cx - 28, cy - 8, cx - 32, cy - 8)
        ctx.quadraticCurveTo(cx - 30, cy + 4, cx - 32, cy + 8)
        ctx.quadraticCurveTo(cx - 28, cy + 8, cx - 24, cy + 2)
        ctx.lineTo(cx - 4, cy + 2)
        // Hoja inferior tipo espada
        ctx.lineTo(cx - 3, cy + 22)
        ctx.lineTo(cx, cy + 30)
        ctx.lineTo(cx + 3, cy + 22)
        ctx.lineTo(cx + 4, cy + 2)
        // Brazo derecho
        ctx.lineTo(cx + 24, cy + 2)
        ctx.quadraticCurveTo(cx + 28, cy + 8, cx + 32, cy + 8)
        ctx.quadraticCurveTo(cx + 30, cy + 4, cx + 32, cy - 8)
        ctx.quadraticCurveTo(cx + 28, cy - 8, cx + 24, cy - 2)
        ctx.lineTo(cx + 4, cy - 2)
        ctx.lineTo(cx + 4, cy - 10)
        ctx.bezierCurveTo(cx + 12, cy - 14, cx + 8, cy - 24, cx, cy - 28)
        ctx.closePath()
        ctx.fill()
        ctx.restore()

        // Texto "Galicia" en blanco bold
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 50px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        ctx.textBaseline = 'middle'
        ctx.fillText('Galicia', 114, 50)

        return canvas.toDataURL('image/png')
    } catch {
        return ''
    }
}

export function generateRemitoProformaPdf(data: RemitoProformaData): jsPDF {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    })

    const PAGE_WIDTH = 210
    const PAGE_HEIGHT = 297
    const MARGIN_X = 12
    const HEADER_BAR_HEIGHT = 22
    const FOOTER_BAR_HEIGHT = 20

    // Función para dibujar encabezado y pie de página negro
    const drawHeaderAndFooter = (isLastPage = false) => {
        // === 1. TOP HEADER BANNER (Negro) ===
        doc.setFillColor(0, 0, 0)
        doc.rect(0, 0, PAGE_WIDTH, HEADER_BAR_HEIGHT, 'F')

        // Logo STARK DY izquierda
        try {
            doc.addImage(STARKDY_LOGO_BASE64, 'PNG', 12, 5, 52, 5.6)
        } catch {
            // Fallback texto si la imagen fallara
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(14)
            doc.setTextColor(255, 255, 255)
            doc.text('STARK', 12, 10)
            doc.setTextColor(220, 38, 38)
            doc.text('DY', 32, 10)
        }

        // Subtítulo debajo de logo
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.5)
        doc.setTextColor(255, 255, 255)
        doc.text('WWW.STARKDY.COM.AR', 12, 16.5)

        // Centro: RAZON SOCIAL & CUIT
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.5)
        doc.setTextColor(255, 255, 255)
        doc.text('RAZON SOCIAL: COMATE SRL', PAGE_WIDTH / 2, 9, { align: 'center' })
        doc.text('CUIT: 30716010690', PAGE_WIDTH / 2, 14.5, { align: 'center' })

        // Derecha: Logo INDUSTRIA ARGENTINA con sol y trama
        const indArgWidth = 24
        const indArgHeight = 10.18
        const indArgX = PAGE_WIDTH - 12 - indArgWidth
        const indArgY = (HEADER_BAR_HEIGHT - indArgHeight) / 2
        try {
            doc.addImage(INDUSTRIA_ARGENTINA_LOGO_BASE64, 'JPEG', indArgX, indArgY, indArgWidth, indArgHeight)
        } catch {
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(8.5)
            doc.setTextColor(56, 189, 248) // Cyan / celeste
            doc.text('INDUSTRIA', PAGE_WIDTH - 12, 9, { align: 'right' })
            doc.text('ARGENTINA', PAGE_WIDTH - 12, 14.5, { align: 'right' })
        }

        // === 2. BOTTOM FOOTER BANNER (Negro) ===
        const footerY = PAGE_HEIGHT - FOOTER_BAR_HEIGHT
        doc.setFillColor(0, 0, 0)
        doc.rect(0, footerY, PAGE_WIDTH, FOOTER_BAR_HEIGHT, 'F')

        // Logo STARK DY izquierda footer
        try {
            doc.addImage(STARKDY_LOGO_BASE64, 'PNG', 12, footerY + 4, 52, 5.6)
        } catch {
            // ignore
        }
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.5)
        doc.setTextColor(255, 255, 255)
        doc.text('WWW.STARKDY.COM.AR', 12, footerY + 14.5)

        // Centro: LIDERES EN MERCH PUBLICITARIO
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(255, 255, 255)
        doc.text('LIDERES EN MERCH PUBLICITARIO', PAGE_WIDTH / 2, footerY + 11.5, { align: 'center' })

        // Derecha: Logo INDUSTRIA ARGENTINA con sol y trama
        const indArgFooterY = footerY + (FOOTER_BAR_HEIGHT - indArgHeight) / 2
        try {
            doc.addImage(INDUSTRIA_ARGENTINA_LOGO_BASE64, 'JPEG', indArgX, indArgFooterY, indArgWidth, indArgHeight)
        } catch {
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(8.5)
            doc.setTextColor(56, 189, 248)
            doc.text('INDUSTRIA', PAGE_WIDTH - 12, footerY + 8.5, { align: 'right' })
            doc.text('ARGENTINA', PAGE_WIDTH - 12, footerY + 14, { align: 'right' })
        }
    }

    // === TÍTULO PRINCIPAL ===
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(20, 48, 88) // Azul marino oscuro
    doc.text('REMITO PROFORMA', PAGE_WIDTH / 2, 38, { align: 'center' })

    // SUBTÍTULO
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(100, 116, 139) // Slate gray
    const validez = data.validezDias || 3
    doc.text(`Nota: Esta nota de pedido tiene una validez de ${validez} días hábiles.`, PAGE_WIDTH / 2, 45, { align: 'center' })

    // METADATOS OPCIONALES (Cliente / Fecha / Código)
    let startTableY = 50
    const clienteTexto = [data.clienteNombre, data.clienteEmpresa].filter(Boolean).join(' - ')
    if (clienteTexto || data.fecha || data.codigo) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.5)
        doc.setTextColor(71, 85, 105)

        if (clienteTexto) {
            doc.text(`Cliente: ${clienteTexto}`, MARGIN_X, 51)
        }

        const metaRight: string[] = []
        if (data.codigo) metaRight.push(`Pedido #${data.codigo}`)
        if (data.fecha) metaRight.push(`Fecha: ${data.fecha}`)
        if (metaRight.length > 0) {
            doc.text(metaRight.join(' | '), PAGE_WIDTH - MARGIN_X, 51, { align: 'right' })
        }
        startTableY = 55
    }

    // === TABLA DE PRODUCTOS ===
    // Armar filas de productos
    const tableBody: any[] = data.items.map((item) => {
        let nombre = item.nombre
        if (item.atributosTexto) {
            nombre += `\n(${item.atributosTexto})`
        }
        return [
            nombre,
            formatMoneyAr(item.precioUnitario),
            String(item.cantidad),
            formatMoneyAr(item.total),
        ]
    })

    // Rellenar con filas vacías para mantener la estética clásica de remito/formulario (mínimo 4 filas)
    const minRows = 4
    const emptyRowsToAdd = Math.max(0, minRows - tableBody.length)
    for (let i = 0; i < emptyRowsToAdd; i++) {
        tableBody.push(['', '', '', ''])
    }

    // Fila final de Saldo Total
    const totalRow = [
        { content: '', colSpan: 2, styles: { fillColor: [255, 255, 255], lineWidth: { top: 0.2, bottom: 0.2, left: 0.2, right: 0.2 } } },
        {
            content: 'Saldo Total:',
            styles: {
                halign: 'right',
                fontStyle: 'bold',
                fillColor: [241, 245, 249],
                textColor: [30, 41, 59],
                fontSize: 10,
            },
        },
        {
            content: formatMoneyAr(data.total),
            styles: {
                halign: 'right',
                fontStyle: 'bold',
                fillColor: [232, 240, 254], // Suave celeste grisáceo
                textColor: [15, 23, 42],
                fontSize: 10.5,
            },
        },
    ]
    tableBody.push(totalRow)

    const autoTableFn = (autoTable as any).default || autoTable

    autoTableFn(doc, {
        startY: startTableY,
        margin: { left: MARGIN_X, right: MARGIN_X, top: HEADER_BAR_HEIGHT + 8, bottom: FOOTER_BAR_HEIGHT + 8 },
        head: [['Producto', 'Precio Unitario', 'Cantidad', 'Total']],
        body: tableBody,
        theme: 'grid',
        tableWidth: PAGE_WIDTH - MARGIN_X * 2,
        headStyles: {
            fillColor: [25, 107, 184], // Azul institucional (#196bb8)
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9.5,
            cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
            lineColor: [255, 255, 255],
            lineWidth: 0.1,
        },
        bodyStyles: {
            textColor: [15, 23, 42],
            fontSize: 9,
            cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
            lineColor: [203, 213, 225], // Bordes gris azulado suave
            lineWidth: 0.2,
            valign: 'middle',
        },
        columnStyles: {
            0: { cellWidth: 84, halign: 'left' },
            1: { cellWidth: 34, halign: 'center' },
            2: { cellWidth: 30, halign: 'center' },
            3: { cellWidth: 38, halign: 'right' },
        },
        didDrawPage: () => {
            drawHeaderAndFooter(false)
        },
    })

    // === SECCIÓN DATOS BANCARIOS (GALICIA) ===
    let finalY = (doc as any).lastAutoTable?.finalY || 160

    // Si queda poco espacio antes del footer, agregar página
    if (finalY + 55 > PAGE_HEIGHT - FOOTER_BAR_HEIGHT) {
        doc.addPage()
        drawHeaderAndFooter(true)
        finalY = HEADER_BAR_HEIGHT + 15
    }

    const bankStartY = finalY + 10
    const badgeX = MARGIN_X + 2
    const badgeWidth = 38
    const badgeHeight = 11.5

    // Insignia Galicia
    const galiciaBadgeUrl = createGaliciaBadgeDataUrl()
    if (galiciaBadgeUrl) {
        try {
            doc.addImage(galiciaBadgeUrl, 'PNG', badgeX, bankStartY, badgeWidth, badgeHeight)
        } catch {
            // fallback
            doc.setFillColor(203, 40, 33)
            doc.roundedRect(badgeX, bankStartY, badgeWidth, badgeHeight, 2, 2, 'F')
            doc.setTextColor(255, 255, 255)
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(10.5)
            doc.text('† Galicia', badgeX + 4, bankStartY + 7.5)
        }
    } else {
        doc.setFillColor(203, 40, 33)
        doc.roundedRect(badgeX, bankStartY, badgeWidth, badgeHeight, 2, 2, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10.5)
        doc.text('† Galicia', badgeX + 4, bankStartY + 7.5)
    }

    // Lista de datos bancarios COMATE SRL
    const bankDetailsY = bankStartY + badgeHeight + 5
    const bankLines = [
        'Número de cuenta: 0008893-4 166-5',
        'CUIT: 30-71601069-0',
        'Razón Social: COMATE SRL',
        'CBU: 0070166820000008893451',
        'Alias: STARKDY',
    ]

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(15, 23, 42)

    bankLines.forEach((line, index) => {
        doc.text(line, badgeX, bankDetailsY + index * 5)
    })

    // Asegurar que el header y footer se dibujen en la primera página
    drawHeaderAndFooter(true)

    return doc
}

export function downloadRemitoProformaPdf(data: RemitoProformaData, customFilename?: string): void {
    const doc = generateRemitoProformaPdf(data)
    const cleanClient = (data.clienteNombre || data.clienteEmpresa || 'cliente')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .toLowerCase()
    const filename = customFilename || `remito-proforma-${cleanClient}.pdf`
    doc.save(filename)
}

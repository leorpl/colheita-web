import XLSX from 'xlsx'

function colWidthForColumn(aoa, colIdx) {
  let best = 10
  for (let r = 0; r < aoa.length; r++) {
    const v = aoa[r]?.[colIdx]
    if (v === null || v === undefined) continue
    const s = String(v)
    best = Math.max(best, s.length)
  }
  // keep readable, avoid absurd widths
  return Math.min(60, Math.max(10, best + 2))
}

export const xlsxExportService = {
  // Build a minimal, Excel-friendly XLSX buffer.
  // - freeze first row
  // - autofilter header row
  // - set reasonable column widths
  aoaToXlsxBuffer({ sheetName = 'Planilha', aoa } = {}) {
    const safeName = String(sheetName || 'Planilha').slice(0, 31) || 'Planilha'
    const table = Array.isArray(aoa) ? aoa : []
    if (!table.length) {
      return Buffer.from('')
    }

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(table, { cellDates: true })

    // Freeze header row
    ws['!views'] = [{ state: 'frozen', ySplit: 1 }]

    // Autofilter
    const cols = Array.isArray(table[0]) ? table[0].length : 0
    if (cols > 0 && table.length > 1) {
      const ref = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: table.length - 1, c: cols - 1 } })
      ws['!autofilter'] = { ref }
    }

    // Column widths
    if (cols > 0) {
      ws['!cols'] = new Array(cols).fill(null).map((_, c) => ({ wch: colWidthForColumn(table, c) }))
    }

    XLSX.utils.book_append_sheet(wb, ws, safeName)
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  },
}

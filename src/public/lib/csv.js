export function csvEscape(v) {
  const s = String(v ?? '')
  if (/[";\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`
  return s
}

export function csvNumber(n, digits = 2) {
  if (n === null || n === undefined) return ''
  if (typeof n === 'string') {
    // aceita "1.234,56" ou "1234,56" ou "1234.56"
    const s = n.trim()
    if (!s) return ''
    const cleaned = s
      .replace(/\s+/g, '')
      .replaceAll('R$', '')
      .replaceAll('.', '')
      .replaceAll(',', '.')
    const x2 = Number(cleaned)
    if (!Number.isFinite(x2)) return s
    return x2.toFixed(digits).replace('.', ',')
  }
  const x = Number(n)
  if (!Number.isFinite(x)) return ''
  return x.toFixed(digits).replace('.', ',')
}

export function downloadCsv(filename, headers, rows) {
  const sep = ';'
  const lines = []
  // ajuda o Excel a reconhecer o separador
  lines.push(`sep=${sep}`)
  lines.push(headers.map(csvEscape).join(sep))
  for (const r of rows) {
    lines.push(r.map(csvEscape).join(sep))
  }
  // Excel (Windows) tende a interpretar CSV como ANSI; BOM + CRLF melhora compatibilidade.
  const content = `\uFEFF${lines.join('\r\n')}`
  const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

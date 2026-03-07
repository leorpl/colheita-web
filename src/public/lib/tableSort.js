function parsePtNumberForSort(s) {
  const raw = String(s ?? '').trim()
  if (!raw) return NaN

  let t = raw
    .replaceAll('R$', '')
    .replaceAll('kg', '')
    .replaceAll('sc/ha', '')
    .replaceAll('%', '')
    .trim()

  // remove spaces
  t = t.replace(/\s+/g, '')

  // keep digits and separators
  t = t.replace(/[^0-9,.-]/g, '')

  // pt-BR: thousands '.' and decimal ','
  if (t.includes(',') && t.includes('.')) {
    t = t.replaceAll('.', '').replaceAll(',', '.')
  } else if (t.includes(',') && !t.includes('.')) {
    t = t.replaceAll(',', '.')
  }

  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

function cellSortValue(cell) {
  if (!cell) return { type: 'empty', value: null }

  const ds = cell.getAttribute('data-sort')
  if (ds !== null) return { type: 'text', value: String(ds).trim().toLowerCase() }

  const input = cell.querySelector?.('input,select,textarea')
  const txt = input ? String(input.value ?? '') : String(cell.textContent ?? '')
  const s = txt.trim()
  if (!s || s === '-') return { type: 'empty', value: null }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { type: 'date', value: s }

  const n = parsePtNumberForSort(s)
  if (Number.isFinite(n)) return { type: 'number', value: n }

  return { type: 'text', value: s.toLowerCase() }
}

function compareSort(a, b) {
  if (a.type === 'empty' && b.type === 'empty') return 0
  if (a.type === 'empty') return 1
  if (b.type === 'empty') return -1

  if (a.type === 'number' && b.type === 'number') return a.value - b.value
  if (a.type === 'date' && b.type === 'date') return String(a.value).localeCompare(String(b.value))
  const coll = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })
  return coll.compare(String(a.value), String(b.value))
}

export function initTableSorting(rootEl) {
  if (!rootEl) return
  rootEl.querySelectorAll('table').forEach((table) => {
    if (table.dataset.sortInit === '1') return
    const thead = table.querySelector('thead')
    const tbody = table.querySelector('tbody')
    if (!thead || !tbody) return

    // Usa a ultima linha do header com colunas "reais" (evita desalinhamento quando existe <th colspan> acima).
    const headRows = Array.from(thead.querySelectorAll('tr'))
    const headerRow =
      headRows
        .slice()
        .reverse()
        .find((tr) =>
          Array.from(tr.querySelectorAll('th')).some((x) => !(x.colSpan && x.colSpan > 1)),
        ) || headRows[headRows.length - 1]

    if (!headerRow) return

    const ths = Array.from(headerRow.querySelectorAll('th')).filter((th) => !(th.colSpan && th.colSpan > 1))

    ths.forEach((th) => {
      const label = String(th.textContent ?? '').trim()
      if (!label) return
      if (th.dataset.nosort === '1') return

      th.classList.add('sortable')
      th.tabIndex = 0
      th.setAttribute('role', 'button')
      th.setAttribute('aria-label', `${label} (ordenar)`) 

      const handler = () => {
        const idx = ths.indexOf(th)
        if (idx < 0) return

        const prevCol = Number(table.dataset.sortCol)
        let dir = table.dataset.sortDir === 'desc' ? 'desc' : 'asc'
        if (Number.isFinite(prevCol) && prevCol === idx) dir = dir === 'asc' ? 'desc' : 'asc'
        else dir = 'asc'

        table.dataset.sortCol = String(idx)
        table.dataset.sortDir = dir

        ths.forEach((x) => x.classList.remove('sorted-asc', 'sorted-desc'))
        th.classList.add(dir === 'asc' ? 'sorted-asc' : 'sorted-desc')

        const rows = Array.from(tbody.querySelectorAll('tr'))
        const decorated = rows.map((row, i) => {
          const cell = row.children[idx]
          return { row, i, v: cellSortValue(cell) }
        })

        decorated.sort((x, y) => {
          const c = compareSort(x.v, y.v)
          if (c !== 0) return dir === 'asc' ? c : -c
          return x.i - y.i
        })

        const frag = document.createDocumentFragment()
        decorated.forEach((d) => frag.appendChild(d.row))
        tbody.appendChild(frag)
      }

      th.addEventListener('click', handler)
      th.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handler()
        }
      })
    })

    table.dataset.sortInit = '1'
  })
}

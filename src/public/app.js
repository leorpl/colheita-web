const view = document.querySelector('#view')
const toastEl = document.querySelector('#toast')
const btnRefresh = document.querySelector('#btnRefresh')

const dlg = document.querySelector('#dlg')
const dlgTitle = document.querySelector('#dlgTitle')
const dlgBody = document.querySelector('#dlgBody')
const dlgSubmit = document.querySelector('#dlgSubmit')
const dlgForm = document.querySelector('#dlgForm')

const FAZENDA_NAZCA_PUBLIC = {
  nome: 'Fazenda Nazca',
  localizacao: {
    endereco: 'Corguinhos, Iguatama - MG, 38910-000',
    plus_code: 'R43C+VR Iguatama, Minas Gerais',
    maps_url: 'https://www.google.com/maps/place/Fazenda+Nazca/@-20.1952815,-45.877929,17z/data=!4m6!3m5!1s0x94b38bbe4a2e2619:0x600ef49de0667b82!8m2!3d-20.1952815!4d-45.877929!16s%2Fg%2F11ptmc1gd1',
    // Snapshot (26/02/2026): 4,2 (5 avaliacoes)
    maps_rating: '4,2',
    maps_reviews: '5',
  },
  links: {
    instagram: 'https://www.instagram.com/fazendanazca/',
    facebook: 'https://www.facebook.com/fazendanazca/?locale=pt_BR',
    reel: 'https://www.instagram.com/reel/DFYXxdUywpF/',
  },
}

// Simple popover for help tips
let helpPopoverEl = null

function ensureHelpPopover() {
  if (helpPopoverEl) return helpPopoverEl
  helpPopoverEl = document.createElement('div')
  helpPopoverEl.className = 'help-pop'
  helpPopoverEl.setAttribute('role', 'dialog')
  helpPopoverEl.setAttribute('aria-modal', 'false')
  helpPopoverEl.style.display = 'none'

  // If a <dialog> is open, render inside it so it stays on top
  if (dlg?.open) dlg.appendChild(helpPopoverEl)
  else document.body.appendChild(helpPopoverEl)

  document.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('[data-help]')
    if (btn) {
      e.preventDefault()
      const text = btn.getAttribute('data-help') || ''
      showHelpPopover(btn, text)
      return
    }

    // click outside closes
    if (helpPopoverEl && helpPopoverEl.style.display !== 'none') {
      if (!helpPopoverEl.contains(e.target)) hideHelpPopover()
    }
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideHelpPopover()
  })

  if (dlg) {
    dlg.addEventListener('close', () => hideHelpPopover())
    dlg.addEventListener('cancel', () => hideHelpPopover())
  }

  return helpPopoverEl
}

function showHelpPopover(anchorEl, text) {
  const pop = ensureHelpPopover()

  // Move popover to the dialog top layer when needed
  if (dlg?.open && pop.parentNode !== dlg) dlg.appendChild(pop)
  if (!dlg?.open && pop.parentNode !== document.body) document.body.appendChild(pop)

  pop.textContent = text
  pop.style.display = 'block'
  const r = anchorEl.getBoundingClientRect()
  const pad = 8
  const maxW = Math.min(360, window.innerWidth - 24)
  pop.style.maxWidth = `${maxW}px`

  // Measure after display
  const pr = pop.getBoundingClientRect()
  let left = r.left
  let top = r.bottom + 8
  if (left + pr.width > window.innerWidth - pad) {
    left = window.innerWidth - pad - pr.width
  }
  if (top + pr.height > window.innerHeight - pad) {
    top = r.top - 8 - pr.height
  }
  pop.style.left = `${Math.max(pad, left)}px`
  pop.style.top = `${Math.max(pad, top)}px`
}

function hideHelpPopover() {
  if (!helpPopoverEl) return
  helpPopoverEl.style.display = 'none'
}

// init once so click handler is registered
ensureHelpPopover()

function fmtNum(n, digits = 2) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '-'
  return x.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function fmtKg(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '-'
  return `${fmtNum(x, 0)} kg`
}

function fmtMoney(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '-'
  return x.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function toast(title, message) {
  toastEl.innerHTML = `<div class="t">${escapeHtml(title)}</div><div class="m">${escapeHtml(message)}</div>`
  toastEl.classList.add('show')
  window.clearTimeout(toastEl._t)
  toastEl._t = window.setTimeout(() => toastEl.classList.remove('show'), 3300)
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function csvEscape(v) {
  const s = String(v ?? '')
  if (/[";\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`
  return s
}

function csvNumber(n, digits = 2) {
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

function downloadCsv(filename, headers, rows) {
  const sep = ';'
  const lines = []
  // ajuda o Excel a reconhecer o separador
  lines.push(`sep=${sep}`)
  lines.push(headers.map(csvEscape).join(sep))
  for (const r of rows) {
    lines.push(r.map(csvEscape).join(sep))
  }
  const content = `\ufeff${lines.join('\n')}`
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    if (res.status === 401 && location.pathname !== '/login') {
      location.href = '/login'
      return null
    }
    const msg = data?.message || `Erro ${res.status}`
    const err = new Error(msg)
    if (data?.details) err.details = data.details
    throw err
  }
  return data
}

const cache = {
  safras: null,
  talhoes: null,
  destinos: null,
  motoristas: null,
  tiposPlantio: null,
}

async function loadLookups() {
  const [safras, talhoes, destinos, motoristas, tiposPlantio] = await Promise.all([
    api('/api/safras'),
    api('/api/talhoes'),
    api('/api/destinos'),
    api('/api/motoristas'),
    api('/api/tipos-plantio'),
  ])
  cache.safras = safras
  cache.talhoes = talhoes
  cache.destinos = destinos
  cache.motoristas = motoristas
  cache.tiposPlantio = tiposPlantio
}

function activeNav(route) {
  document.querySelectorAll('.nav-item').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === route)
  })
}

function setView(html) {
  view.innerHTML = html
  initTableSorting(view)
}

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

function initTableSorting(rootEl) {
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
          Array.from(tr.querySelectorAll('th')).some(
            (x) => !(x.colSpan && x.colSpan > 1),
          ),
        ) || headRows[headRows.length - 1]

    if (!headerRow) return

    const ths = Array.from(headerRow.querySelectorAll('th')).filter(
      (th) => !(th.colSpan && th.colSpan > 1),
    )

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

function formField({
  label,
  name,
  type = 'text',
  value = '',
  placeholder = '',
  span = 'col6',
  step,
  inputmode,
  pattern,
}) {
  const stepAttr = step ? ` step="${step}"` : ''
  const inputModeAttr = inputmode ? ` inputmode="${escapeHtml(inputmode)}"` : ''
  const patternAttr = pattern ? ` pattern="${escapeHtml(pattern)}"` : ''
  return `<div class="field ${span}">
    <div class="label">${label}</div>
    <input name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value ?? '')}" placeholder="${escapeHtml(placeholder)}"${stepAttr}${inputModeAttr}${patternAttr} />
  </div>`
}

function selectField({ label, name, options, value, span = 'col6' }) {
  const opts = options
    .map((o) => {
      const sel = String(o.value) === String(value) ? ' selected' : ''
      return `<option value="${escapeHtml(o.value)}"${sel}>${escapeHtml(o.label)}</option>`
    })
    .join('')
  return `<div class="field ${span}">
    <div class="label">${escapeHtml(label)}</div>
    <select name="${escapeHtml(name)}">${opts}</select>
  </div>`
}

function textareaField({ label, name, value = '', placeholder = '', span = 'col12' }) {
  return `<div class="field ${span}">
    <div class="label">${escapeHtml(label)}</div>
    <textarea name="${escapeHtml(name)}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value ?? '')}</textarea>
  </div>`
}

function sectionTitle(title) {
  return `<div class="sec col12"><div class="sec-title">${escapeHtml(title)}</div><div class="sec-line"></div></div>`
}

function helpTip(text) {
  const t = escapeHtml(text)
  return `<button class="help" type="button" aria-label="Ajuda" data-help="${t}" title="${t}">?</button>`
}

function openDialog({ title, bodyHtml, onSubmit, submitLabel = 'Salvar' }) {
  dlgTitle.textContent = title
  dlgBody.innerHTML = bodyHtml
  dlgSubmit.textContent = submitLabel
  dlgForm.onsubmit = async (e) => {
    const submitterValue = String(e.submitter?.value || '')
    if (submitterValue === 'cancel') {
      // allow the dialog to close
      e.preventDefault()
      dlg.close('cancel')
      return
    }

    e.preventDefault()
    const fd = new FormData(dlgForm)
    const obj = Object.fromEntries(fd.entries())
    if (onSubmit) await onSubmit(obj)
    dlg.close('default')
  }

  // ESC should behave like cancel
  dlg.oncancel = (e) => {
    e.preventDefault()
    dlg.close('cancel')
  }

  dlg.showModal()
}

function confirmDanger(message) {
  return new Promise((resolve) => {
    openDialog({
      title: 'Confirmar',
      submitLabel: 'Excluir',
      bodyHtml: `<div class="hint">${escapeHtml(message)}</div>`,
      onSubmit: async () => resolve(true),
    })
    const onClose = () => {
      dlg.removeEventListener('close', onClose)
      if (dlg.returnValue !== 'default') resolve(false)
    }
    dlg.addEventListener('close', onClose)
  })
}

function asNumberOrNull(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function parseNumberPt(v) {
  if (v === null || v === undefined) return NaN
  if (typeof v === 'number') return v
  const s = String(v).trim().replace(',', '.')
  return Number(s)
}

function parseLatLngFromGoogleMapsUrl(url) {
  const raw = String(url || '').trim()
  if (!raw) return null

  // Common: .../@-20.1952815,-45.877929,17z...
  const mAt = raw.match(/@\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/)
  if (mAt) {
    const lat = Number(mAt[1])
    const lng = Number(mAt[2])
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  }

  // Common: ...!3d-20.1952815!4d-45.877929...
  const m3d = raw.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  if (m3d) {
    const lat = Number(m3d[1])
    const lng = Number(m3d[2])
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  }

  try {
    const u = new URL(raw)
    const ll = u.searchParams.get('ll') || u.searchParams.get('q') || u.searchParams.get('query')
    if (ll) {
      const parts = decodeURIComponent(ll).split(',').map((x) => x.trim())
      if (parts.length >= 2) {
        const lat = Number(parts[0])
        const lng = Number(parts[1])
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
      }
    }
  } catch {
    // ignore
  }

  return null
}

function haversineKm(a, b) {
  const lat1 = Number(a?.lat)
  const lon1 = Number(a?.lng)
  const lat2 = Number(b?.lat)
  const lon2 = Number(b?.lng)
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return NaN
  const R = 6371
  const toRad = (x) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLon / 2)
  const q =
    s1 * s1 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * (s2 * s2)
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(q)))
}

const NAZCA_COORDS =
  parseLatLngFromGoogleMapsUrl(FAZENDA_NAZCA_PUBLIC.localizacao.maps_url) ||
  { lat: -20.1952815, lng: -45.877929 }

function parsePercent100OrZero(v, fieldName) {
  if (v === '' || v === null || v === undefined) return 0
  const n = parseNumberPt(v)
  if (!Number.isFinite(n)) throw new Error(`Campo invalido: ${fieldName}`)
  return n
}

function fmtPctFromFrac(frac, digits = 2) {
  const x = Number(frac)
  if (!Number.isFinite(x)) return '-'
  return `${fmtNum(x * 100, digits)}%`
}

function fmtSacas(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '-'
  return fmtNum(x, 2)
}

function clamp01(x) {
  const n = Number(x)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function polarToCartesian(cx, cy, r, angleRad) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  }
}

function arcPath(cx, cy, rOuter, rInner, start, end) {
  const large = end - start > Math.PI ? 1 : 0
  const p1 = polarToCartesian(cx, cy, rOuter, start)
  const p2 = polarToCartesian(cx, cy, rOuter, end)
  const p3 = polarToCartesian(cx, cy, rInner, end)
  const p4 = polarToCartesian(cx, cy, rInner, start)
  return `M ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 ${large} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rInner} ${rInner} 0 ${large} 0 ${p4.x} ${p4.y} Z`
}

function svgDonut({
  parts,
  size = 140,
  thickness = 18,
  startAngle = -Math.PI / 2,
} = {}) {
  const total = parts.reduce((a, p) => a + Math.max(0, Number(p.value) || 0), 0)
  const rOuter = size / 2
  const rInner = rOuter - thickness
  const cx = rOuter
  const cy = rOuter

  if (!(total > 0)) {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle cx="${cx}" cy="${cy}" r="${(rOuter + rInner) / 2}" fill="none" stroke="rgba(15,26,22,.14)" stroke-width="${thickness}"></circle>
      </svg>
    `.trim()
  }

  const positive = parts
    .map((p) => ({ ...p, value: Math.max(0, Number(p.value) || 0) }))
    .filter((p) => p.value > 0)
  if (positive.length === 1) {
    const color = positive[0].color
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle cx="${cx}" cy="${cy}" r="${(rOuter + rInner) / 2}" fill="none" stroke="${escapeHtml(color)}" stroke-width="${thickness}"></circle>
      </svg>
    `.trim()
  }

  let a = startAngle
  const segs = parts
    .map((p) => {
      const v = Math.max(0, Number(p.value) || 0)
      const frac = total > 0 ? v / total : 0
      const a2 = a + frac * Math.PI * 2
      const d = arcPath(cx, cy, rOuter, rInner, a, a2)
      a = a2
      return `<path d="${d}" fill="${escapeHtml(p.color)}"></path>`
    })
    .join('')

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      ${segs}
    </svg>
  `.trim()
}

function legendHtml(parts) {
  return `<div class="legend">${parts
    .map(
      (p) =>
        `<div class="row"><span class="sw" style="background:${escapeHtml(p.color)}"></span><span>${escapeHtml(p.label)}</span></div>`,
    )
    .join('')}</div>`
}

const DEFAULT_MAPS_URL =
  'https://www.google.com/maps/d/edit?mid=1I31t4h-O1Scw04_yJqcTAs8EqUid5IE&usp=sharing'

async function renderPainel() {
  activeNav('painel')
  const p = await api('/api/relatorios/painel')
  const totals = p.totals_geral
  const ultima = p.ultima_safra
  const atual = p.safra_atual || p.safra_painel || ultima
  const totalsUlt = p.totals_ultima_safra
  const safraLabel = atual?.safra ? String(atual.safra) : '-'
  const safraHint = p.safra_painel ? 'Definida em Safras' : 'Ultima safra cadastrada'
  setView(`
    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Painel</div>
          <div class="panel-sub">Safra selecionada: <b>${escapeHtml(safraLabel)}</b> <span style="opacity:.8">(${escapeHtml(safraHint)})</span> | Comparativo: total geral x total da safra.</div>
        </div>
        <div class="pill"><span class="dot"></span><span>Online</span></div>
      </div>
      <div class="panel-body">
        <div class="grid">
          <div class="stat span4">
            <div class="stat-k">Area plantada (ha)</div>
            <div class="stat-v">${fmtNum(p.area_plantada_ha, 2)}</div>
            <div class="stat-h">Soma dos talhões ATIVO (base geral)</div>
          </div>
          <div class="stat span4">
            <div class="stat-k">Safra selecionada</div>
            <div class="stat-v">${escapeHtml(atual?.safra || '-') }</div>
            <div class="stat-h">${escapeHtml(atual?.plantio || '')}</div>
          </div>
          <div class="stat span4">
            <div class="stat-k">Base</div>
            <div class="stat-v">Todas as safras</div>
            <div class="stat-h">Comparativo geral x safra selecionada</div>
          </div>

          <div class="span12">${sectionTitle('Graficos')}</div>
          <div class="span12">
            <div class="charts">
              <div class="chart-card" id="chartArea">
                <div class="chart-head">
                   <div class="chart-title">Área colhida</div>
                  <div class="chart-sub">Safra selecionada</div>
                </div>
                <div class="chart-body"><div class="hint">Carregando...</div></div>
              </div>
              <div class="chart-card" id="chartDest">
                <div class="chart-head">
                  <div class="chart-title">Entregas por destino</div>
                  <div class="chart-sub">Sacas (top destinos)</div>
                </div>
                <div class="chart-body"><div class="hint">Carregando...</div></div>
              </div>
              <div class="chart-card wide" id="chartBars">
                <div class="chart-head">
                  <div class="chart-title">Ranking de destinos</div>
                  <div class="chart-sub">Distribuicao em sacas (safra selecionada)</div>
                </div>
                <div class="chart-body"><div class="hint">Carregando...</div></div>
              </div>
            </div>
          </div>

          <div class="span12">${sectionTitle(`Safra selecionada (${escapeHtml(safraLabel)})`)}</div>
          <div class="stat span4">
            <div class="stat-k">Peso bruto</div>
            <div class="stat-v">${fmtKg(totalsUlt?.peso_bruto_kg || 0)}</div>
            <div class="stat-h">Totais filtrados por safra</div>
          </div>
          <div class="stat span4">
            <div class="stat-k">Peso limpo e seco</div>
            <div class="stat-v">${fmtKg(totalsUlt?.peso_limpo_seco_kg || 0)}</div>
            <div class="stat-h">Totais filtrados por safra</div>
          </div>
          <div class="stat span4">
            <div class="stat-k">Sacas</div>
            <div class="stat-v">${fmtNum(totalsUlt?.sacas || 0, 2)}</div>
            <div class="stat-h">Totais filtrados por safra</div>
          </div>
          <div class="stat span4">
            <div class="stat-k">Umidade (kg)</div>
            <div class="stat-v">${fmtKg(totalsUlt?.umidade_kg || 0)}</div>
            <div class="stat-h">Totais filtrados por safra</div>
          </div>
          <div class="stat span4">
            <div class="stat-k">Frete total</div>
            <div class="stat-v">${fmtMoney(totalsUlt?.sub_total_frete || 0)}</div>
            <div class="stat-h">Totais filtrados por safra</div>
          </div>
          <div class="stat span4">
            <div class="stat-k">Produtividade ajustada</div>
            <div class="stat-v">${fmtNum(p.produtividade_ultima_safra_ajustada_sacas_ha, 2)} sc/ha</div>
            <div class="stat-h">Sacas / area colhida informada</div>
          </div>

          <div class="span12">${sectionTitle('Total geral (todas as safras)')}</div>
          <div class="stat span4">
            <div class="stat-k">Peso bruto</div>
            <div class="stat-v">${fmtKg(totals.peso_bruto_kg)}</div>
            <div class="stat-h">Soma de (carga - tara)</div>
          </div>
          <div class="stat span4">
            <div class="stat-k">Peso limpo e seco</div>
            <div class="stat-v">${fmtKg(totals.peso_limpo_seco_kg)}</div>
            <div class="stat-h">Descontos: umidade + defeitos</div>
          </div>
          <div class="stat span4">
            <div class="stat-k">Sacas</div>
            <div class="stat-v">${fmtNum(totals.sacas, 2)}</div>
            <div class="stat-h">Base 60 kg</div>
          </div>
          <div class="stat span4">
            <div class="stat-k">Umidade (kg)</div>
            <div class="stat-v">${fmtKg(totals.umidade_kg)}</div>
            <div class="stat-h">Umidade-base configurada</div>
          </div>
          <div class="stat span4">
            <div class="stat-k">Frete total</div>
            <div class="stat-v">${fmtMoney(totals.sub_total_frete)}</div>
            <div class="stat-h">Peso bruto (em sacas) x tabela</div>
          </div>
          <div class="stat span4">
            <div class="stat-k">Produtividade</div>
            <div class="stat-v">${fmtNum(p.produtividade_geral_sacas_ha, 2)} sc/ha</div>
            <div class="stat-h">Sacas / area plantada</div>
          </div>
        </div>
      </div>
    </section>
  `)

  // Charts (async enrichment)
  try {
    const safra_id = Number(atual?.id)
    const areaPlantada = Number(p.area_plantada_ha || 0)
    const areaColhida = Number(p.area_colhida_ultima_safra_ha || 0)
    const areaRest = Math.max(0, areaPlantada - areaColhida)

    const areaParts = [
      {
        label: `Colhida: ${fmtNum(areaColhida, 2)} ha`,
        value: areaColhida,
        color: 'rgba(30,106,77,.92)',
      },
      {
        label: `Restante: ${fmtNum(areaRest, 2)} ha`,
        value: areaRest,
        color: 'rgba(15,26,22,.12)',
      },
    ]

    const elArea = view.querySelector('#chartArea .chart-body')
    if (elArea) {
      const pct = areaPlantada > 0 ? clamp01(areaColhida / areaPlantada) : 0
      elArea.innerHTML = `${svgDonut({ parts: areaParts, size: 150, thickness: 20 })}<div>${legendHtml([
        { ...areaParts[0], label: `${areaParts[0].label} (${fmtNum(pct * 100, 1)}%)` },
        areaParts[1],
      ])}</div>`
    }

    if (Number.isFinite(safra_id) && safra_id > 0) {
      const des = await api(`/api/relatorios/entregas-por-destino?safra_id=${safra_id}`)
      const sorted = (des || [])
        .map((d) => ({ name: d.destino_local, sacas: Number(d.entrega_sacas || 0) }))
        .filter((d) => d.sacas > 0)
        .sort((a, b) => b.sacas - a.sacas)

      const top = sorted.slice(0, 6)
      const outros = sorted.slice(6).reduce((a, x) => a + x.sacas, 0)
      if (outros > 0) top.push({ name: 'Outros', sacas: outros })

      const palette = [
        '#1e6a4d',
        '#d19a2b',
        '#2a7f62',
        '#b07a19',
        '#3a8a6f',
        '#8f6b22',
        'rgba(15,26,22,.18)',
      ]

      const parts = top.map((t, i) => ({
        label: `${t.name}: ${fmtNum(t.sacas, 2)} sc`,
        value: t.sacas,
        color: palette[i % palette.length],
      }))

      const elDest = view.querySelector('#chartDest .chart-body')
      if (elDest) {
        elDest.innerHTML = parts.length
          ? `${svgDonut({ parts, size: 150, thickness: 22 })}<div>${legendHtml(parts)}</div>`
          : '<div class="hint">Sem entregas no periodo.</div>'
      }

      const elBars = view.querySelector('#chartBars .chart-body')
      if (elBars) {
        const all = (des || []).map((d) => {
          const trava = Number(d.trava_sacas || 0)
          const entrega = Number(d.entrega_sacas || 0)
          const base = trava > 0 ? trava : Math.max(1, entrega)
          const pct = base > 0 ? clamp01(entrega / base) : 0
          const falta = trava > 0 ? Math.max(0, trava - entrega) : 0
          return {
            name: d.destino_local,
            trava,
            entrega,
            base,
            pct,
            falta,
          }
        })

        // show all destinos; order: with trava first, then by % desc, then entrega desc
        all.sort((a, b) => {
          const at = a.trava > 0 ? 1 : 0
          const bt = b.trava > 0 ? 1 : 0
          if (at !== bt) return bt - at
          if (b.pct !== a.pct) return b.pct - a.pct
          return b.entrega - a.entrega
        })

        elBars.innerHTML = `<div class="bars">${all
          .map((d) => {
            const pct100 = d.trava > 0 ? d.pct * 100 : 100
            const val =
              d.trava > 0
                ? `${fmtNum(d.entrega, 2)} / ${fmtNum(d.trava, 2)} sc` +
                  (d.falta > 0 ? ` | falta ${fmtNum(d.falta, 2)} sc` : ' | OK')
                : `${fmtNum(d.entrega, 2)} sc | sem trava`
            return `
              <div class="bar">
                <div class="name">${escapeHtml(d.name)}</div>
                <div class="track">
                  <div class="fill" style="width:${pct100}%"></div>
                </div>
                <div class="val">${escapeHtml(val)}</div>
              </div>
            `
          })
          .join('')}</div>`
      }
    }
  } catch {
    // ignore chart errors
  }
}

async function renderCrudPage({
  route,
  title,
  subtitle,
  fetchPath,
  columns,
  onCreate,
  onEdit,
  onDelete,
  addLabel,
  extraActions,
  onAction,
}) {
  activeNav(route)
  const items = await api(fetchPath)
  const th = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')

  const rows = items
    .map((it) => {
      const tds = columns
        .map((c) => {
          const shown = c.format ? c.format(it[c.key], it) : it[c.key] ?? ''
          let sortAttr = ''
          if (typeof c.sort === 'function') {
            const sv = c.sort(it[c.key], it)
            if (sv !== null && sv !== undefined && String(sv).trim() !== '') {
              sortAttr = ` data-sort="${escapeHtml(String(sv))}"`
            }
          }
          return `<td${sortAttr}>${escapeHtml(shown)}</td>`
        })
        .join('')

      const extraBtns = (extraActions || [])
        .map((a) => {
          const cls = a.className || 'ghost'
          return `<button class="btn small ${escapeHtml(cls)}" data-act="${escapeHtml(a.act)}" data-id="${it.id}">${escapeHtml(a.label)}</button>`
        })
        .join('')

      return `<tr>
        ${tds}
        <td class="actions">
          ${extraBtns}
          <button class="btn small ghost" data-act="edit" data-id="${it.id}">Editar</button>
          <button class="btn small danger" data-act="del" data-id="${it.id}">Excluir</button>
        </td>
      </tr>`
    })
    .join('')

  setView(`
    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">${escapeHtml(title)}</div>
          <div class="panel-sub">${escapeHtml(subtitle)}</div>
        </div>
        <button class="btn" id="btnAdd">${escapeHtml(addLabel || 'Cadastrar')}</button>
      </div>
      <div class="panel-body">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>${th}<th></th></tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="${columns.length + 1}">Nenhum registro.</td></tr>`}
            </tbody>
          </table>
        </div>
        <div class="hint">Dica: cadastre primeiro <span class="kbd">Destinos</span>, <span class="kbd">Motoristas</span> e <span class="kbd">Fretes</span> para lançar viagens sem erros.</div>
      </div>
    </section>
  `)

  view.querySelector('#btnAdd').onclick = () => onCreate()
  view.querySelectorAll('[data-act]').forEach((btn) => {
    btn.onclick = async () => {
      const id = Number(btn.dataset.id)
      const act = btn.dataset.act
      const item = items.find((x) => x.id === id)
      if (act === 'edit') return onEdit(item)
      if (act === 'del') return onDelete(item)
      if (onAction) return onAction(act, item)
    }
  })
}

async function renderSafras() {
  await loadLookups()
  const plantioOptions = cache.tiposPlantio.map((p) => ({ value: p.nome, label: p.nome }))

  await renderCrudPage({
    route: 'safras',
    title: 'Safras',
    subtitle: 'Defina safra, plantio e area (ha).',
    fetchPath: '/api/safras',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'safra', label: 'Safra' },
      {
        key: 'plantio',
        label: 'Plantio',
        sort: (v, it) => `${v || ''} ${it.safra || ''}`.trim(),
      },
      { key: 'data_referencia', label: 'Data ref.' },
      {
        key: 'painel',
        label: 'Painel',
        format: (v) => (Number(v) === 1 ? 'SIM' : ''),
      },
    ],
    extraActions: [{ act: 'painel', label: 'Mostrar no painel', className: 'ghost' }],
    onAction: async (act, item) => {
      if (act !== 'painel') return
      await api(`/api/safras/${item.id}/painel`, {
        method: 'PUT',
        body: { painel: true },
      })
      toast('OK', `Safra "${item.safra}" definida no Painel.`)
      renderSafras()
    },
    onCreate: () => {
      openDialog({
        title: 'Nova safra',
        bodyHtml: `
          <div class="form-grid">
            ${formField({ label: 'Safra', name: 'safra', placeholder: '2025-2026', span: 'col6' })}
            ${selectField({ label: 'Plantio', name: 'plantio', options: plantioOptions, value: plantioOptions[0]?.value, span: 'col6' })}
            ${formField({ label: 'Data de referencia', name: 'data_referencia', type: 'date', value: '', span: 'col6' })}
            <div class="field col12"><div class="label">Área</div><div class="hint">A área é calculada nos relatórios a partir dos talhões (ATIVO) e do % de área colhida.</div></div>
          </div>`,
        onSubmit: async (obj) => {
          await api('/api/safras', {
            method: 'POST',
            body: {
              safra: obj.safra,
              plantio: obj.plantio || null,
              data_referencia: obj.data_referencia || null,
            },
          })
          toast('Salvo', 'Safra cadastrada.')
          renderSafras()
        },
      })
    },
    onEdit: (it) => {
      openDialog({
        title: `Editar safra #${it.id}`,
        bodyHtml: `
          <div class="form-grid">
            ${formField({ label: 'Safra', name: 'safra', value: it.safra, span: 'col6' })}
            ${selectField({ label: 'Plantio', name: 'plantio', options: plantioOptions, value: it.plantio ?? plantioOptions[0]?.value, span: 'col6' })}
            ${formField({ label: 'Data de referencia', name: 'data_referencia', type: 'date', value: it.data_referencia ?? '', span: 'col6' })}
            <div class="field col12"><div class="label">Área</div><div class="hint">Campo mantido no banco por compatibilidade, mas a UI não edita.</div></div>
          </div>`,
        onSubmit: async (obj) => {
          await api(`/api/safras/${it.id}`, {
            method: 'PUT',
            body: {
              safra: obj.safra,
              plantio: obj.plantio || null,
              data_referencia: obj.data_referencia || null,
            },
          })
          toast('Atualizado', 'Safra atualizada.')
          renderSafras()
        },
      })
    },
    onDelete: async (it) => {
      if (!(await confirmDanger(`Excluir a safra "${it.safra}"?`))) return
      await api(`/api/safras/${it.id}`, { method: 'DELETE' })
      toast('Excluído', 'Safra removida.')
      renderSafras()
    },
    addLabel: 'Nova safra',
  })
}

async function renderTalhoes() {
  await renderCrudPage({
    route: 'talhoes',
    title: 'Talhões',
    subtitle: 'Cadastre o talhão e seus hectares.',
    fetchPath: '/api/talhoes',
    columns: [
      { key: 'id', label: 'ID' },
      {
        key: 'local',
        label: 'Local',
        sort: (_v, it) => `${it.local || ''} ${it.nome || ''} ${it.codigo || ''}`.trim(),
      },
      {
        key: 'nome',
        label: 'Nome',
        sort: (_v, it) => `${it.nome || ''} ${it.local || ''}`.trim(),
      },
      {
        key: 'hectares',
        label: 'Area (ha)',
        format: (v) => fmtNum(v, 2),
        sort: (v) => Number(v) || 0,
      },
      { key: 'situacao', label: 'Situacao' },
    ],
    extraActions: [{ act: 'view', label: 'Visualizar', className: 'ghost' }],
    onAction: async (act, it) => {
      if (act !== 'view') return
      window.open(`/talhao.html?id=${encodeURIComponent(it.id)}`, '_blank', 'noopener')
    },
    onCreate: () => {
      openDialog({
        title: 'Novo talhão',
        bodyHtml: `
          <div class="form-grid">
            ${formField({ label: 'Codigo', name: 'codigo', placeholder: 'NZ_06_MORRINHO', span: 'col6' })}
            ${formField({ label: 'Local', name: 'local', placeholder: 'Nazca', span: 'col6' })}
            ${formField({ label: 'Nome', name: 'nome', placeholder: 'Morrinho', span: 'col6' })}
            ${formField({ label: 'Situacao', name: 'situacao', placeholder: 'ATIVO', span: 'col6' })}
            ${formField({ label: 'Hectares', name: 'hectares', type: 'number', step: '0.01', value: '0', span: 'col6' })}
            ${formField({ label: 'Posse', name: 'posse', placeholder: 'PROPRIO / ARRENDADO', span: 'col6' })}
            ${formField({ label: 'Contrato', name: 'contrato', placeholder: 'Contrato', span: 'col6' })}
            ${formField({ label: 'Irrigacao', name: 'irrigacao', placeholder: 'SIM/NAO', span: 'col4' })}
            ${formField({ label: 'Foto (URL)', name: 'foto_url', placeholder: 'https://...', span: 'col8' })}
            ${formField({ label: 'Mapa (URL)', name: 'maps_url', value: DEFAULT_MAPS_URL, placeholder: 'https://www.google.com/maps/d/edit?mid=...', span: 'col12' })}
            ${formField({ label: 'Tipo de solo', name: 'tipo_solo', placeholder: 'Argiloso...', span: 'col4' })}
            ${formField({ label: 'Calagem', name: 'calagem', placeholder: 'Info', span: 'col4' })}
            ${formField({ label: 'Gessagem', name: 'gessagem', placeholder: 'Info', span: 'col4' })}
            ${formField({ label: 'Fosforo corretivo', name: 'fosforo_corretivo', placeholder: 'Info', span: 'col4' })}
            ${textareaField({ label: 'Observacoes', name: 'observacoes' })}
          </div>`,
        onSubmit: async (obj) => {
          await api('/api/talhoes', {
            method: 'POST',
            body: {
              codigo: obj.codigo,
              local: obj.local || null,
              nome: obj.nome || null,
              situacao: obj.situacao || null,
              hectares: Number(obj.hectares),
              posse: obj.posse || null,
              contrato: obj.contrato || null,
              irrigacao: obj.irrigacao || null,
              foto_url: obj.foto_url || null,
              maps_url: (obj.maps_url || DEFAULT_MAPS_URL) || null,
              tipo_solo: obj.tipo_solo || null,
              calagem: obj.calagem || null,
              gessagem: obj.gessagem || null,
              fosforo_corretivo: obj.fosforo_corretivo || null,
              observacoes: obj.observacoes || null,
            },
          })
          toast('Salvo', 'Talhão cadastrado.')
          renderTalhoes()
        },
      })
    },
    onEdit: (it) => {
      openDialog({
        title: `Editar talhão #${it.id}`,
        bodyHtml: `
          <div class="form-grid">
            ${formField({ label: 'Codigo', name: 'codigo', value: it.codigo, span: 'col6' })}
            ${formField({ label: 'Local', name: 'local', value: it.local ?? '', span: 'col6' })}
            ${formField({ label: 'Nome', name: 'nome', value: it.nome ?? '', span: 'col6' })}
            ${formField({ label: 'Situacao', name: 'situacao', value: it.situacao ?? '', span: 'col6' })}
            ${formField({ label: 'Hectares', name: 'hectares', type: 'number', step: '0.01', value: it.hectares, span: 'col6' })}
            ${formField({ label: 'Posse', name: 'posse', value: it.posse ?? '', span: 'col6' })}
            ${formField({ label: 'Contrato', name: 'contrato', value: it.contrato ?? '', span: 'col6' })}
            ${formField({ label: 'Irrigacao', name: 'irrigacao', value: it.irrigacao ?? '', span: 'col4' })}
            ${formField({ label: 'Foto (URL)', name: 'foto_url', value: it.foto_url ?? '', span: 'col8' })}
            ${formField({ label: 'Mapa (URL)', name: 'maps_url', value: it.maps_url ?? DEFAULT_MAPS_URL, span: 'col12' })}
            ${formField({ label: 'Tipo de solo', name: 'tipo_solo', value: it.tipo_solo ?? '', span: 'col4' })}
            ${formField({ label: 'Calagem', name: 'calagem', value: it.calagem ?? '', span: 'col4' })}
            ${formField({ label: 'Gessagem', name: 'gessagem', value: it.gessagem ?? '', span: 'col4' })}
            ${formField({ label: 'Fosforo corretivo', name: 'fosforo_corretivo', value: it.fosforo_corretivo ?? '', span: 'col4' })}
            ${textareaField({ label: 'Observacoes', name: 'observacoes', value: it.observacoes ?? '' })}
          </div>`,
        onSubmit: async (obj) => {
          await api(`/api/talhoes/${it.id}`, {
            method: 'PUT',
            body: {
              codigo: obj.codigo,
              local: obj.local || null,
              nome: obj.nome || null,
              situacao: obj.situacao || null,
              hectares: Number(obj.hectares),
              posse: obj.posse || null,
              contrato: obj.contrato || null,
              irrigacao: obj.irrigacao || null,
              foto_url: obj.foto_url || null,
              maps_url: (obj.maps_url || DEFAULT_MAPS_URL) || null,
              tipo_solo: obj.tipo_solo || null,
              calagem: obj.calagem || null,
              gessagem: obj.gessagem || null,
              fosforo_corretivo: obj.fosforo_corretivo || null,
              observacoes: obj.observacoes || null,
            },
          })
          toast('Atualizado', 'Talhão atualizado.')
          renderTalhoes()
        },
      })
    },
    onDelete: async (it) => {
      if (!(await confirmDanger(`Excluir o talhão "${it.codigo}"?`))) return
      await api(`/api/talhoes/${it.id}`, { method: 'DELETE' })
      toast('Excluído', 'Talhão removido.')
      renderTalhoes()
    },
    addLabel: 'Novo talhão',
  })
}

async function renderDestinos() {
  await renderCrudPage({
    route: 'destinos',
    title: 'Destinos',
    subtitle: 'Cadastre destino e opcionalmente a trava (sacas) e distancia (km).',
    fetchPath: '/api/destinos',
    columns: [
      { key: 'id', label: 'ID' },
      {
        key: 'local',
        label: 'Destino',
        sort: (_v, it) => `${it.local || ''} ${it.codigo || ''}`.trim(),
      },
      { key: 'codigo', label: 'Codigo' },
      { key: 'trava_sacas', label: 'Trava (sacas)', format: (v) => (v === null ? '-' : fmtNum(v, 2)) },
      { key: 'distancia_km', label: 'Km', format: (v) => (v === null ? '-' : fmtNum(v, 1)) },
    ],
    onCreate: () => {
      openDialog({
        title: 'Novo destino',
        bodyHtml: `
          <div class="form-grid">
            ${formField({ label: 'Codigo', name: 'codigo', placeholder: 'TB01-AP', span: 'col6' })}
            ${formField({ label: 'Nome', name: 'local', placeholder: 'Formiga AP', span: 'col6' })}
            ${formField({ label: 'Mapa (URL)', name: 'maps_url', placeholder: 'https://www.google.com/maps/...', span: 'col12' })}
            <div class="field col12">
              <div class="label">Ilustracao (Google Maps)</div>
              <div class="hint" id="destMapHint">Cole um link do Google Maps com coordenadas (ex: contém <span class="kbd">@lat,lng</span>) para mostrar o mapa e sugerir a distância.</div>
              <div class="mini-map" id="destMapPrev" style="margin-top:8px;display:none"><iframe title="Mapa" loading="lazy"></iframe></div>
              <div class="hint" style="margin-top:8px">Distância sugerida (linha reta): <b id="destDistSug">-</b> km</div>
            </div>
            ${formField({ label: 'Trava (sacas)', name: 'trava_sacas', type: 'number', step: '0.01', value: '', span: 'col6' })}
            ${formField({ label: 'Distancia (km)', name: 'distancia_km', type: 'number', step: '0.1', value: '', span: 'col6' })}
            ${textareaField({ label: 'Observacoes', name: 'observacoes' })}
          </div>`,
        onSubmit: async (obj) => {
          await api('/api/destinos', {
            method: 'POST',
            body: {
              codigo: obj.codigo,
              local: obj.local,
              maps_url: obj.maps_url || null,
              trava_sacas: asNumberOrNull(obj.trava_sacas),
              distancia_km: asNumberOrNull(obj.distancia_km),
              observacoes: obj.observacoes || null,
            },
          })
          toast('Salvo', 'Destino cadastrado.')
          renderDestinos()
        },
      })

      // Preview + distancia automatica
      const mapsEl = dlgForm.querySelector('input[name="maps_url"]')
      const distEl = dlgForm.querySelector('input[name="distancia_km"]')
      const prevWrap = dlgBody.querySelector('#destMapPrev')
      const prevFrame = prevWrap?.querySelector('iframe')
      const sugEl = dlgBody.querySelector('#destDistSug')
      const hintEl = dlgBody.querySelector('#destMapHint')

      if (distEl) {
        distEl.dataset.userEdited = distEl.value ? '1' : '0'
        distEl.addEventListener('input', () => {
          distEl.dataset.userEdited = '1'
        })
      }

      function refreshMaps() {
        const url = String(mapsEl?.value || '').trim()
        const p = parseLatLngFromGoogleMapsUrl(url)
        if (!p) {
          if (prevWrap) prevWrap.style.display = 'none'
          if (sugEl) sugEl.textContent = '-'
          if (hintEl) {
            hintEl.textContent =
              'Cole um link do Google Maps com coordenadas (ex: contém @lat,lng) para mostrar o mapa e sugerir a distância.'
          }
          return
        }

        const km = haversineKm(NAZCA_COORDS, p)
        if (sugEl) sugEl.textContent = Number.isFinite(km) ? fmtNum(km, 1) : '-'
        if (distEl && (distEl.dataset.userEdited !== '1') && !String(distEl.value || '').trim()) {
          if (Number.isFinite(km)) distEl.value = fmtNum(km, 1).replace(',', '.')
        }

        if (prevWrap && prevFrame) {
          prevWrap.style.display = 'block'
          prevFrame.src = `https://www.google.com/maps?q=${encodeURIComponent(
            `${p.lat},${p.lng}`,
          )}&z=16&output=embed`
        }

        if (hintEl) {
          hintEl.textContent =
            'Preview baseado nas coordenadas do link. A distância sugerida é em linha reta (Nazca -> destino).'
        }
      }

      if (mapsEl) {
        mapsEl.addEventListener('input', () => refreshMaps())
        mapsEl.addEventListener('change', () => refreshMaps())
      }
      refreshMaps()
    },
    onEdit: (it) => {
      openDialog({
        title: `Editar destino #${it.id}`,
        bodyHtml: `
          <div class="form-grid">
            ${formField({ label: 'Codigo', name: 'codigo', value: it.codigo, span: 'col6' })}
            ${formField({ label: 'Nome', name: 'local', value: it.local, span: 'col6' })}
            ${formField({ label: 'Mapa (URL)', name: 'maps_url', value: it.maps_url ?? '', span: 'col12' })}
            <div class="field col12"><div class="label">Mapa</div><div class="hint">${it.maps_url ? `<a class="btn ghost" target="_blank" rel="noreferrer" href="${escapeHtml(it.maps_url)}">Abrir mapa</a>` : 'Sem mapa cadastrado.'}</div></div>
            <div class="field col12">
              <div class="label">Ilustracao (Google Maps)</div>
              <div class="hint" id="destMapHint">Cole um link do Google Maps com coordenadas (ex: contém <span class="kbd">@lat,lng</span>) para mostrar o mapa e sugerir a distância.</div>
              <div class="mini-map" id="destMapPrev" style="margin-top:8px;display:none"><iframe title="Mapa" loading="lazy"></iframe></div>
              <div class="hint" style="margin-top:8px">Distância sugerida (linha reta): <b id="destDistSug">-</b> km</div>
            </div>
            ${formField({ label: 'Trava (sacas)', name: 'trava_sacas', type: 'number', step: '0.01', value: it.trava_sacas ?? '', span: 'col6' })}
            ${formField({ label: 'Distancia (km)', name: 'distancia_km', type: 'number', step: '0.1', value: it.distancia_km ?? '', span: 'col6' })}
            ${textareaField({ label: 'Observacoes', name: 'observacoes', value: it.observacoes ?? '' })}
          </div>`,
        onSubmit: async (obj) => {
          await api(`/api/destinos/${it.id}`, {
            method: 'PUT',
            body: {
              codigo: obj.codigo,
              local: obj.local,
              maps_url: obj.maps_url || null,
              trava_sacas: asNumberOrNull(obj.trava_sacas),
              distancia_km: asNumberOrNull(obj.distancia_km),
              observacoes: obj.observacoes || null,
            },
          })
          toast('Atualizado', 'Destino atualizado.')
          renderDestinos()
        },
      })

      // Preview + distancia automatica
      const mapsEl = dlgForm.querySelector('input[name="maps_url"]')
      const distEl = dlgForm.querySelector('input[name="distancia_km"]')
      const prevWrap = dlgBody.querySelector('#destMapPrev')
      const prevFrame = prevWrap?.querySelector('iframe')
      const sugEl = dlgBody.querySelector('#destDistSug')
      const hintEl = dlgBody.querySelector('#destMapHint')

      if (distEl) {
        distEl.dataset.userEdited = distEl.value ? '1' : '0'
        distEl.addEventListener('input', () => {
          distEl.dataset.userEdited = '1'
        })
      }

      function refreshMaps() {
        const url = String(mapsEl?.value || '').trim()
        const p = parseLatLngFromGoogleMapsUrl(url)
        if (!p) {
          if (prevWrap) prevWrap.style.display = 'none'
          if (sugEl) sugEl.textContent = '-'
          if (hintEl) {
            hintEl.textContent =
              'Cole um link do Google Maps com coordenadas (ex: contém @lat,lng) para mostrar o mapa e sugerir a distância.'
          }
          return
        }

        const km = haversineKm(NAZCA_COORDS, p)
        if (sugEl) sugEl.textContent = Number.isFinite(km) ? fmtNum(km, 1) : '-'
        if (distEl && (distEl.dataset.userEdited !== '1') && !String(distEl.value || '').trim()) {
          if (Number.isFinite(km)) distEl.value = fmtNum(km, 1).replace(',', '.')
        }

        if (prevWrap && prevFrame) {
          prevWrap.style.display = 'block'
          prevFrame.src = `https://www.google.com/maps?q=${encodeURIComponent(
            `${p.lat},${p.lng}`,
          )}&z=16&output=embed`
        }

        if (hintEl) {
          hintEl.textContent =
            'Preview baseado nas coordenadas do link. A distância sugerida é em linha reta (Nazca -> destino).'
        }
      }

      if (mapsEl) {
        mapsEl.addEventListener('input', () => refreshMaps())
        mapsEl.addEventListener('change', () => refreshMaps())
      }
      refreshMaps()
    },
    onDelete: async (it) => {
      if (!(await confirmDanger(`Excluir o destino "${it.local}"?`))) return
      await api(`/api/destinos/${it.id}`, { method: 'DELETE' })
      toast('Excluído', 'Destino removido.')
      renderDestinos()
    },
    addLabel: 'Novo destino',
  })
}

async function renderMotoristas() {
  await renderCrudPage({
    route: 'motoristas',
    title: 'Motoristas',
    subtitle: 'Cadastre motoristas e dados para pagamento.',
    fetchPath: '/api/motoristas',
    columns: [
      { key: 'id', label: 'ID' },
      {
        key: 'nome',
        label: 'Nome',
        sort: (_v, it) => `${it.nome || ''} ${it.placa || ''}`.trim(),
      },
      { key: 'placa', label: 'Placa' },
      { key: 'cpf', label: 'CPF/RG' },
      { key: 'pix_conta', label: 'PIX/Conta' },
    ],
    onCreate: () => {
      openDialog({
        title: 'Novo motorista',
        bodyHtml: `
          <div class="form-grid">
            ${formField({ label: 'Nome', name: 'nome', placeholder: 'Marcelo', span: 'col6' })}
            ${formField({ label: 'Placa', name: 'placa', placeholder: 'MSD6914', span: 'col6' })}
            ${formField({ label: 'CPF/RG', name: 'cpf', placeholder: '000.000.000-00', span: 'col6' })}
            ${formField({ label: 'Banco', name: 'banco', placeholder: 'Banco', span: 'col6' })}
            ${formField({ label: 'PIX/Conta', name: 'pix_conta', placeholder: 'Chave', span: 'col6' })}
            ${formField({ label: 'Tipo veiculo', name: 'tipo_veiculo', placeholder: 'Carreta', span: 'col6' })}
            ${formField({ label: 'Capacidade (kg)', name: 'capacidade_kg', type: 'number', step: '1', value: '', span: 'col6' })}
          </div>`,
        onSubmit: async (obj) => {
          await api('/api/motoristas', {
            method: 'POST',
            body: {
              nome: obj.nome,
              placa: obj.placa || null,
              cpf: obj.cpf || null,
              banco: obj.banco || null,
              pix_conta: obj.pix_conta || null,
              tipo_veiculo: obj.tipo_veiculo || null,
              capacidade_kg: asNumberOrNull(obj.capacidade_kg),
            },
          })
          toast('Salvo', 'Motorista cadastrado.')
          renderMotoristas()
        },
      })
    },
    onEdit: (it) => {
      openDialog({
        title: `Editar motorista #${it.id}`,
        bodyHtml: `
          <div class="form-grid">
            ${formField({ label: 'Nome', name: 'nome', value: it.nome, span: 'col6' })}
            ${formField({ label: 'Placa', name: 'placa', value: it.placa ?? '', span: 'col6' })}
            ${formField({ label: 'CPF/RG', name: 'cpf', value: it.cpf ?? '', span: 'col6' })}
            ${formField({ label: 'Banco', name: 'banco', value: it.banco ?? '', span: 'col6' })}
            ${formField({ label: 'PIX/Conta', name: 'pix_conta', value: it.pix_conta ?? '', span: 'col6' })}
            ${formField({ label: 'Tipo veiculo', name: 'tipo_veiculo', value: it.tipo_veiculo ?? '', span: 'col6' })}
            ${formField({ label: 'Capacidade (kg)', name: 'capacidade_kg', type: 'number', step: '1', value: it.capacidade_kg ?? '', span: 'col6' })}
          </div>`,
        onSubmit: async (obj) => {
          await api(`/api/motoristas/${it.id}`, {
            method: 'PUT',
            body: {
              nome: obj.nome,
              placa: obj.placa || null,
              cpf: obj.cpf || null,
              banco: obj.banco || null,
              pix_conta: obj.pix_conta || null,
              tipo_veiculo: obj.tipo_veiculo || null,
              capacidade_kg: asNumberOrNull(obj.capacidade_kg),
            },
          })
          toast('Atualizado', 'Motorista atualizado.')
          renderMotoristas()
        },
      })
    },
    onDelete: async (it) => {
      if (!(await confirmDanger(`Excluir o motorista "${it.nome}"?`))) return
      await api(`/api/motoristas/${it.id}`, { method: 'DELETE' })
      toast('Excluído', 'Motorista removido.')
      renderMotoristas()
    },
    addLabel: 'Novo motorista',
  })
}

async function renderUsuarios() {
  activeNav('usuarios')
  await loadLookups()
  const users = await api('/api/users')

  const roleOptions = [
    { value: 'admin', label: 'Admin (tudo)' },
    { value: 'gestor', label: 'Gestor (operacao + config)' },
    { value: 'operador', label: 'Operador (colheita)' },
    { value: 'leitura', label: 'Leitura' },
    { value: 'motorista', label: 'Motorista (futuro)' },
  ]

  const motOpts = [{ value: '', label: '-' }].concat(
    (cache.motoristas || []).map((m) => ({
      value: m.id,
      label: `${m.nome} (${m.placa || '-'})`,
    })),
  )

  const allMenus = [
    { key: 'painel', label: 'Painel' },
    { key: 'colheita', label: 'Colheita' },
    { key: 'area-colhida', label: 'Área colhida' },
    { key: 'relatorios', label: 'Relatórios' },
    { key: 'quitacao-motoristas', label: 'Quitação motoristas' },
    { key: 'safras', label: 'Safras' },
    { key: 'talhoes', label: 'Talhões' },
    { key: 'destinos', label: 'Destinos' },
    { key: 'motoristas', label: 'Motoristas' },
    { key: 'fretes', label: 'Fretes' },
    { key: 'regras-destino', label: 'Regras do destino' },
    { key: 'tipos-plantio', label: 'Tipos de plantio' },
    { key: 'fazenda', label: 'Fazenda Nazca' },
    { key: 'usuarios', label: 'Usuários' },
  ]

  function parseMenusJson(s) {
    try {
      const v = s ? JSON.parse(s) : null
      return Array.isArray(v) ? v.map((x) => String(x)) : []
    } catch {
      return []
    }
  }

  const rows = (users || [])
    .map((u) => {
      return `<tr>
        <td>${escapeHtml(u.username)}</td>
        <td>${escapeHtml(u.nome || '')}</td>
        <td>${escapeHtml(u.role)}</td>
        <td>${escapeHtml(String(u.active ? 'SIM' : 'NAO'))}</td>
        <td class="actions">
          <button class="btn small ghost" data-act="uedit" data-id="${u.id}">Editar</button>
          <button class="btn small ghost" data-act="upwd" data-id="${u.id}">Senha</button>
          <button class="btn small danger" data-act="udel" data-id="${u.id}">Excluir</button>
        </td>
      </tr>`
    })
    .join('')

  setView(`
    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Usuários</div>
          <div class="panel-sub">Controle de acesso por perfil (permissões). Ative em \`AUTH_ENABLED=1\`.</div>
        </div>
          <button class="btn" id="btnUAdd">Novo usuário</button>
      </div>
      <div class="panel-body">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Usuario</th><th>Nome</th><th>Role</th><th>Ativo</th><th></th></tr></thead>
            <tbody>${rows || `<tr><td colspan="5">Nenhum usuario.</td></tr>`}</tbody>
          </table>
        </div>
        <div class="hint">Boas praticas: use \`admin\` só para cadastro e manutencao; operadores nao precisam ver valores de pagamento.</div>
      </div>
    </section>
  `)

  view.querySelector('#btnUAdd').onclick = () => {
    openDialog({
      title: 'Novo usuário',
      submitLabel: 'Criar',
      bodyHtml: `
        <div class="form-grid">
          ${formField({ label: 'Usuario (login)', name: 'username', placeholder: 'joao', span: 'col6' })}
          ${formField({ label: 'Nome', name: 'nome', placeholder: 'Joao', span: 'col6' })}
          ${selectField({ label: 'Role', name: 'role', options: roleOptions, value: 'operador', span: 'col6' })}
          ${selectField({ label: 'Motorista (se role=motorista)', name: 'motorista_id', options: motOpts, value: '', span: 'col6' })}
          ${formField({ label: 'Senha', name: 'password', type: 'password', value: '', span: 'col6' })}
          <div class="field col12"><div class="label">Menus</div><div class="hint">Marque as telas que este usuário pode acessar (menu lateral).</div>
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px">
              ${allMenus
                .map(
                  (m) =>
                    `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="menu__${escapeHtml(m.key)}" ${m.key === 'usuarios' ? '' : 'checked'} /> ${escapeHtml(m.label)}</label>`,
                )
                .join('')}
            </div>
          </div>
          <div class="field col12"><div class="hint">Senha min: 8 caracteres. Para motorista, vincule ao cadastro existente.</div></div>
        </div>
      `,
      onSubmit: async (obj) => {
        const menus = []
        for (const m of allMenus) {
          if (dlgForm.querySelector(`input[name="menu__${m.key}"]`)?.checked) {
            menus.push(m.key)
          }
        }
        await api('/api/users', {
          method: 'POST',
          body: {
            username: obj.username,
            nome: obj.nome || null,
            role: obj.role,
            motorista_id: obj.motorista_id ? Number(obj.motorista_id) : null,
            menus,
            password: obj.password,
          },
        })
        toast('OK', 'Usuário criado.')
        renderUsuarios()
      },
    })
  }

  view.querySelectorAll('[data-act]').forEach((btn) => {
    btn.onclick = async () => {
      const id = Number(btn.dataset.id)
      const act = btn.dataset.act
      const u = (users || []).find((x) => Number(x.id) === id)
      if (!u) return

      if (act === 'uedit') {
        const uMenus = parseMenusJson(u.menus_json)
        openDialog({
          title: `Editar usuário #${u.id}`,
          submitLabel: 'Salvar',
          bodyHtml: `
            <div class="form-grid">
              ${formField({ label: 'Usuario (login)', name: 'username', value: u.username, span: 'col6' })}
              ${formField({ label: 'Nome', name: 'nome', value: u.nome || '', span: 'col6' })}
              ${selectField({ label: 'Role', name: 'role', options: roleOptions, value: u.role, span: 'col6' })}
              ${selectField({ label: 'Motorista (se role=motorista)', name: 'motorista_id', options: motOpts, value: u.motorista_id || '', span: 'col6' })}
              <div class="field col6"><div class="label">Ativo</div><select name="active"><option value="true" ${u.active ? 'selected' : ''}>SIM</option><option value="false" ${!u.active ? 'selected' : ''}>NAO</option></select></div>
              <div class="field col12"><div class="label">Menus</div><div class="hint">Marque as telas que este usuário pode acessar (menu lateral).</div>
                <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px">
                  ${allMenus
                    .map((m) => {
                      const checked = uMenus.includes(m.key)
                      return `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="menu__${escapeHtml(m.key)}" ${checked ? 'checked' : ''} /> ${escapeHtml(m.label)}</label>`
                    })
                    .join('')}
                </div>
              </div>
            </div>
          `,
          onSubmit: async (obj) => {
            const menus = []
            for (const m of allMenus) {
              if (dlgForm.querySelector(`input[name="menu__${m.key}"]`)?.checked) {
                menus.push(m.key)
              }
            }
            await api(`/api/users/${u.id}`, {
              method: 'PUT',
              body: {
                username: obj.username,
                nome: obj.nome || null,
                role: obj.role,
                motorista_id: obj.motorista_id ? Number(obj.motorista_id) : null,
                active: obj.active === 'true',
                menus,
              },
            })
            toast('OK', 'Usuário atualizado.')
            renderUsuarios()
          },
        })
      }

      if (act === 'upwd') {
        openDialog({
          title: `Alterar senha (${u.username})`,
          submitLabel: 'Salvar senha',
          bodyHtml: `
            <div class="form-grid">
              ${formField({ label: 'Nova senha', name: 'password', type: 'password', value: '', span: 'col6' })}
            </div>
          `,
          onSubmit: async (obj) => {
            await api(`/api/users/${u.id}/password`, {
              method: 'PUT',
              body: { password: obj.password },
            })
            toast('OK', 'Senha atualizada.')
          },
        })
      }

      if (act === 'udel') {
        if (!(await confirmDanger(`Excluir o usuário "${u.username}"?`))) return
        await api(`/api/users/${u.id}`, { method: 'DELETE' })
        toast('OK', 'Usuário excluído.')
        renderUsuarios()
      }
    }
  })
}

async function renderTiposPlantio() {
  activeNav('tipos-plantio')
  const items = await api('/api/tipos-plantio')

  const rows = items
    .map((it) => {
      return `<tr>
        <td>${it.id}</td>
        <td>${escapeHtml(it.nome)}</td>
        <td class="actions">
          <button class="btn small ghost" data-act="edit" data-id="${it.id}">Editar</button>
          <button class="btn small danger" data-act="del" data-id="${it.id}">Excluir</button>
        </td>
      </tr>`
    })
    .join('')

  setView(`
    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Tipos de plantio</div>
          <div class="panel-sub">Lista padrao para preencher Safras e Colheita.</div>
        </div>
        <button class="btn" id="btnAdd">Novo tipo</button>
      </div>
      <div class="panel-body">
        <div class="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Nome</th><th></th></tr></thead>
            <tbody>${rows || `<tr><td colspan="3">Nenhum registro.</td></tr>`}</tbody>
          </table>
        </div>
          <div class="hint">Valores iniciais: SOJA e MILHO (seed automático).</div>
      </div>
    </section>
  `)

  view.querySelector('#btnAdd').onclick = () => {
    openDialog({
      title: 'Novo tipo de plantio',
      bodyHtml: `<div class="form-grid">${formField({ label: 'Nome', name: 'nome', placeholder: 'SOJA', span: 'col6' })}</div>`,
      onSubmit: async (obj) => {
        await api('/api/tipos-plantio', { method: 'POST', body: { nome: obj.nome } })
        toast('Salvo', 'Tipo cadastrado.')
        renderTiposPlantio()
      },
    })
  }

  view.querySelectorAll('[data-act]').forEach((btn) => {
    btn.onclick = async () => {
      const id = Number(btn.dataset.id)
      const act = btn.dataset.act
      const item = items.find((x) => x.id === id)
      if (act === 'edit') {
        openDialog({
          title: `Editar tipo #${id}`,
          bodyHtml: `<div class="form-grid">${formField({ label: 'Nome', name: 'nome', value: item.nome, span: 'col6' })}</div>`,
          onSubmit: async (obj) => {
            await api(`/api/tipos-plantio/${id}`, { method: 'PUT', body: { nome: obj.nome } })
            toast('Atualizado', 'Tipo atualizado.')
            renderTiposPlantio()
          },
        })
      }
      if (act === 'del') {
        if (!(await confirmDanger(`Excluir o tipo "${item.nome}"?`))) return
        await api(`/api/tipos-plantio/${id}`, { method: 'DELETE' })
        toast('Excluído', 'Tipo removido.')
        renderTiposPlantio()
      }
    }
  })
}

async function renderFretes() {
  activeNav('fretes')
  await loadLookups()
  const items = await api('/api/fretes')

  const safraOptions = cache.safras.map((s) => ({ value: s.id, label: `${s.safra} (#${s.id})` }))
  const motoristaOptions = cache.motoristas.map((m) => ({ value: m.id, label: `${m.nome} (#${m.id})` }))
  const destinoOptions = cache.destinos.map((d) => ({ value: d.id, label: `${d.local}` }))

  const rows = items
    .map((it) => {
      return `<tr>
        <td>${it.id}</td>
        <td>${escapeHtml(it.safra_nome)}</td>
        <td data-sort="${escapeHtml(`${it.motorista_nome || ''} ${it.destino_local || ''} ${it.safra_nome || ''}`.trim())}">${escapeHtml(it.motorista_nome)}</td>
        <td data-sort="${escapeHtml(`${it.destino_local || ''} ${it.motorista_nome || ''} ${it.safra_nome || ''}`.trim())}">${escapeHtml(it.destino_local)}</td>
        <td>${fmtMoney(it.valor_por_saca)}</td>
        <td class="actions">
          <button class="btn small ghost" data-act="edit" data-id="${it.id}">Editar</button>
          <button class="btn small danger" data-act="del" data-id="${it.id}">Excluir</button>
        </td>
      </tr>`
    })
    .join('')

  setView(`
    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Fretes</div>
          <div class="panel-sub">Tabela por motorista x destino (R$ por saca de frete).</div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn ghost" id="btnCopySafra">Copiar de safra</button>
          <button class="btn ghost" id="btnGridSafra">Editar em grade</button>
          <button class="btn" id="btnAdd">Definir frete</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Safra</th><th>Motorista</th><th>Destino</th><th>Valor por saca</th><th></th></tr></thead>
            <tbody>${rows || `<tr><td colspan="6">Nenhum frete cadastrado.</td></tr>`}</tbody>
          </table>
        </div>
        <div class="hint">O frete e usado no calculo automatico de <span class="kbd">sub_total_frete</span> ao lancar uma viagem.</div>
      </div>
    </section>
  `)

  view.querySelector('#btnAdd').onclick = () => {
    openDialog({
      title: 'Definir frete (upsert)',
      bodyHtml: `
        <div class="form-grid">
          ${selectField({ label: 'Safra', name: 'safra_id', options: safraOptions, value: safraOptions[0]?.value, span: 'col6' })}
          ${selectField({ label: 'Motorista', name: 'motorista_id', options: motoristaOptions, value: motoristaOptions[0]?.value, span: 'col6' })}
          ${selectField({ label: 'Destino', name: 'destino_id', options: destinoOptions, value: destinoOptions[0]?.value, span: 'col6' })}
          ${formField({ label: 'Valor por saca (R$)', name: 'valor_por_saca', type: 'number', step: '0.01', value: '4.5', span: 'col6' })}
        </div>`,
      onSubmit: async (obj) => {
        await api('/api/fretes', {
          method: 'POST',
          body: {
            safra_id: Number(obj.safra_id),
            motorista_id: Number(obj.motorista_id),
            destino_id: Number(obj.destino_id),
            valor_por_saca: Number(obj.valor_por_saca),
          },
        })
        toast('Salvo', 'Frete atualizado (viagens recalculadas).')
        renderFretes()
      },
    })
  }

  view.querySelector('#btnCopySafra').onclick = () => {
    openDialog({
      title: 'Copiar fretes de uma safra',
      submitLabel: 'Copiar',
      bodyHtml: `
        <div class="form-grid">
          ${selectField({ label: 'Safra origem', name: 'from_safra_id', options: safraOptions, value: safraOptions[0]?.value, span: 'col6' })}
          ${selectField({ label: 'Safra destino', name: 'to_safra_id', options: safraOptions, value: safraOptions[0]?.value, span: 'col6' })}
          <div class="field col12">
            <div class="label">Filtro</div>
            <div class="hint" style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">
              <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="only_origin_motoristas" checked /> Somente motoristas com frete na origem</label>
              <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="only_origin_destinos" checked /> Somente destinos com frete na origem</label>
              <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="only_destinos_trava" /> Somente destinos com trava</label>
            </div>
          </div>
          <div class="field col12">
            <div class="label">Preview (motoristas x destinos)</div>
             <div class="hint">Valores serão inseridos/atualizados na safra destino.</div>
            <div class="table-wrap" style="margin-top:8px" id="copyPreview"><table><tbody><tr><td>Selecione a safra origem.</td></tr></tbody></table></div>
          </div>
        </div>
      `,
      onSubmit: async (obj) => {
        const from_safra_id = Number(obj.from_safra_id)
        const to_safra_id = Number(obj.to_safra_id)
        if (from_safra_id === to_safra_id) {
          toast('Erro', 'Safra origem e destino devem ser diferentes.')
          return
        }
        const inputs = Array.from(
          dlgBody.querySelectorAll('#copyPreview input[data-m][data-d]'),
        )
        const items2 = []
        for (const el of inputs) {
          if (el.disabled) continue
          const raw = String(el.value || '').trim()
          if (!raw) continue
          const valor = parseNumberPt(raw)
          if (!Number.isFinite(valor) || valor < 0) {
            throw new Error('Valor por saca invalido na grade')
          }
          items2.push({
            motorista_id: Number(el.dataset.m),
            destino_id: Number(el.dataset.d),
            valor_por_saca: valor,
          })
        }
        if (!items2.length) {
          toast('Erro', 'Nenhum valor preenchido para copiar.')
          return
        }
        const r = await api('/api/fretes/bulk-upsert', {
          method: 'POST',
          body: { safra_id: to_safra_id, items: items2 },
        })
        toast('OK', `Atualizados ${r.upserted} fretes na safra destino.`)
        renderFretes()
      },
    })

    const fromEl = dlgForm.querySelector('select[name="from_safra_id"]')
    const previewEl = dlgBody.querySelector('#copyPreview')
    const ckOnlyMot = dlgForm.querySelector('input[name="only_origin_motoristas"]')
    const ckOnlyDes = dlgForm.querySelector('input[name="only_origin_destinos"]')
    const ckOnlyTrava = dlgForm.querySelector('input[name="only_destinos_trava"]')
    const skipMot = new Set()
    if (previewEl) {
      previewEl.onclick = (e) => {
        const btn = e.target?.closest?.('button[data-act="row-skip"]')
        if (!btn) return
        const mid = Number(btn.dataset.m)
        if (!Number.isFinite(mid)) return
        if (skipMot.has(mid)) skipMot.delete(mid)
        else skipMot.add(mid)
        renderPreview()
      }
    }

    function renderPreview() {
      if (!previewEl || !fromEl) return
      const from = Number(fromEl.value)
      if (!Number.isFinite(from) || from <= 0) return
      const fretesFrom = items.filter((f) => Number(f.safra_id) === from)
      const map = new Map(
        fretesFrom.map((f) => [`${f.motorista_id}:${f.destino_id}`, f.valor_por_saca]),
      )

      const motIds = new Set(fretesFrom.map((f) => Number(f.motorista_id)))
      const desIds = new Set(fretesFrom.map((f) => Number(f.destino_id)))

      const onlyMot = ckOnlyMot?.checked !== false
      const onlyDes = ckOnlyDes?.checked !== false
      const onlyTrava = ckOnlyTrava?.checked === true

      const rows = (cache.motoristas || []).filter((m) =>
        onlyMot ? motIds.has(Number(m.id)) : true,
      )

      const cols = (cache.destinos || [])
        .filter((d) => (onlyDes ? desIds.has(Number(d.id)) : true))
        .filter((d) => (onlyTrava ? Number(d.trava_sacas || 0) > 0 : true))

      const head = `<thead><tr><th>Motorista</th>${cols
        .map((d) => `<th>${escapeHtml(d.local)}</th>`)
        .join('')}</tr></thead>`

      const bodyHtml = rows
        .map((m) => {
          const skip = skipMot.has(Number(m.id))
          const tds = cols
            .map((d) => {
              const v = map.get(`${m.id}:${d.id}`)
              const val = v === undefined || v === null ? '' : fmtNum(Number(v), 2)
              return `<td style="white-space:nowrap"><input class="grid-in" inputmode="decimal" pattern="[0-9.,]*" data-m="${m.id}" data-d="${d.id}" value="${escapeHtml(val)}" ${skip ? 'disabled' : ''} /></td>`
            })
            .join('')
          return `<tr class="${skip ? 'grid-skip' : ''}">
            <td style="white-space:nowrap">
              <button type="button" class="btn small ghost" data-act="row-skip" data-m="${m.id}">${skip ? 'Incluir' : 'Ignorar'}</button>
              <span style="margin-left:8px">${escapeHtml(m.nome)}</span>
            </td>
            ${tds}
          </tr>`
        })
        .join('')

      const info = `<div class="hint" style="margin:6px 0 0">Edite os valores na tabela antes de copiar. Linhas: ${rows.length} | Colunas: ${cols.length} | Fretes na origem: ${fretesFrom.length}</div>`
      previewEl.innerHTML = `<table>${head}<tbody>${bodyHtml || `<tr><td colspan="${cols.length + 1}">Nenhum dado para o filtro.</td></tr>`}</tbody></table>${info}`
    }

    if (fromEl) fromEl.onchange = renderPreview
    if (ckOnlyMot) ckOnlyMot.onchange = renderPreview
    if (ckOnlyDes) ckOnlyDes.onchange = renderPreview
    if (ckOnlyTrava) ckOnlyTrava.onchange = renderPreview
    renderPreview()
  }

  view.querySelector('#btnGridSafra').onclick = () => {
    openDialog({
      title: 'Editar fretes em grade (por safra)',
      submitLabel: 'Salvar grade',
      bodyHtml: `
        <div class="form-grid">
          ${selectField({ label: 'Safra', name: 'safra_id', options: safraOptions, value: safraOptions[0]?.value, span: 'col6' })}
          <div class="field col12">
            <div class="label">Filtro</div>
            <div class="hint" style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">
              <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="only_has_values" checked /> Somente motoristas/destinos com frete</label>
              <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="only_destinos_trava" /> Somente destinos com trava</label>
            </div>
          </div>
          <div class="field col12">
            <div class="label">Grade (motoristas x destinos)</div>
            <div class="hint">Edite os valores (R$/sc) e salve.</div>
            <div class="table-wrap" style="margin-top:8px" id="gridPreview"><table><tbody><tr><td>Carregando...</td></tr></tbody></table></div>
          </div>
        </div>
      `,
      onSubmit: async (obj) => {
        const safra_id = Number(obj.safra_id)
        const inputs = Array.from(
          dlgBody.querySelectorAll('#gridPreview input[data-m][data-d]'),
        )
        const items2 = []
        for (const el of inputs) {
          if (el.disabled) continue
          const raw = String(el.value || '').trim()
          if (!raw) continue
          const valor = parseNumberPt(raw)
          if (!Number.isFinite(valor) || valor < 0) {
            throw new Error('Valor por saca invalido na grade')
          }
          items2.push({
            motorista_id: Number(el.dataset.m),
            destino_id: Number(el.dataset.d),
            valor_por_saca: valor,
          })
        }
        if (!items2.length) {
          toast('Erro', 'Nenhum valor preenchido para salvar.')
          return
        }
        const r = await api('/api/fretes/bulk-upsert', {
          method: 'POST',
          body: { safra_id, items: items2 },
        })
        toast('OK', `Salvos ${r.upserted} fretes.`)
        renderFretes()
      },
    })

    const selSafra = dlgForm.querySelector('select[name="safra_id"]')
    const ckOnlyHas = dlgForm.querySelector('input[name="only_has_values"]')
    const ckOnlyTrava = dlgForm.querySelector('input[name="only_destinos_trava"]')
    const previewEl = dlgBody.querySelector('#gridPreview')

    const skipMot = new Set()
    if (previewEl) {
      previewEl.onclick = (e) => {
        const btn = e.target?.closest?.('button[data-act="row-skip"]')
        if (!btn) return
        const mid = Number(btn.dataset.m)
        if (!Number.isFinite(mid)) return
        if (skipMot.has(mid)) skipMot.delete(mid)
        else skipMot.add(mid)
        renderGrid()
      }
    }

    function renderGrid() {
      if (!previewEl || !selSafra) return
      const safra_id = Number(selSafra.value)
      const fretesS = items.filter((f) => Number(f.safra_id) === safra_id)
      const map = new Map(
        fretesS.map((f) => [`${f.motorista_id}:${f.destino_id}`, f.valor_por_saca]),
      )

      const motIds = new Set(fretesS.map((f) => Number(f.motorista_id)))
      const desIds = new Set(fretesS.map((f) => Number(f.destino_id)))

      const onlyHas = ckOnlyHas?.checked !== false
      const onlyTrava = ckOnlyTrava?.checked === true

      const rows = (cache.motoristas || []).filter((m) =>
        onlyHas ? motIds.has(Number(m.id)) : true,
      )
      const cols = (cache.destinos || [])
        .filter((d) => (onlyHas ? desIds.has(Number(d.id)) : true))
        .filter((d) => (onlyTrava ? Number(d.trava_sacas || 0) > 0 : true))

      const head = `<thead><tr><th>Motorista</th>${cols
        .map((d) => `<th>${escapeHtml(d.local)}</th>`)
        .join('')}</tr></thead>`

      const bodyHtml = rows
        .map((m) => {
          const skip = skipMot.has(Number(m.id))
          const tds = cols
            .map((d) => {
              const v = map.get(`${m.id}:${d.id}`)
              const val = v === undefined || v === null ? '' : fmtNum(Number(v), 2)
              return `<td style="white-space:nowrap"><input class="grid-in" inputmode="decimal" pattern="[0-9.,]*" data-m="${m.id}" data-d="${d.id}" value="${escapeHtml(val)}" ${skip ? 'disabled' : ''} /></td>`
            })
            .join('')
          return `<tr class="${skip ? 'grid-skip' : ''}">
            <td style="white-space:nowrap">
              <button type="button" class="btn small ghost" data-act="row-skip" data-m="${m.id}">${skip ? 'Incluir' : 'Ignorar'}</button>
              <span style="margin-left:8px">${escapeHtml(m.nome)}</span>
            </td>
            ${tds}
          </tr>`
        })
        .join('')

      const info = `<div class="hint" style="margin:6px 0 0">Linhas: ${rows.length} | Colunas: ${cols.length} | Fretes na safra: ${fretesS.length}</div>`
      previewEl.innerHTML = `<table>${head}<tbody>${bodyHtml || `<tr><td colspan="${cols.length + 1}">Nenhum dado para o filtro.</td></tr>`}</tbody></table>${info}`
    }

    if (selSafra) selSafra.onchange = renderGrid
    if (ckOnlyHas) ckOnlyHas.onchange = renderGrid
    if (ckOnlyTrava) ckOnlyTrava.onchange = renderGrid
    renderGrid()
  }

  view.querySelectorAll('[data-act]').forEach((btn) => {
    btn.onclick = async () => {
      const id = Number(btn.dataset.id)
      const act = btn.dataset.act
      const item = items.find((x) => x.id === id)
      if (!item) return

      if (act === 'edit') {
        openDialog({
          title: `Editar frete #${id}`,
          submitLabel: 'Salvar',
          bodyHtml: `
            <div class="form-grid">
              ${selectField({ label: 'Safra', name: 'safra_id', options: safraOptions, value: item.safra_id, span: 'col6' })}
              ${selectField({ label: 'Motorista', name: 'motorista_id', options: motoristaOptions, value: item.motorista_id, span: 'col6' })}
              ${selectField({ label: 'Destino', name: 'destino_id', options: destinoOptions, value: item.destino_id, span: 'col6' })}
              ${formField({ label: 'Valor por saca (R$)', name: 'valor_por_saca', type: 'number', step: '0.01', value: String(item.valor_por_saca ?? 0), span: 'col6' })}
              <div class="field col12"><div class="hint">Ao salvar, o sistema recalcula o frete nas colheitas ja lancadas que baterem (safra, motorista, destino).</div></div>
            </div>`,
          onSubmit: async (obj) => {
            await api('/api/fretes', {
              method: 'POST',
              body: {
                safra_id: Number(obj.safra_id),
                motorista_id: Number(obj.motorista_id),
                destino_id: Number(obj.destino_id),
                valor_por_saca: Number(obj.valor_por_saca),
              },
            })
            toast('Atualizado', 'Frete atualizado (viagens recalculadas).')
            renderFretes()
          },
        })
      }

      if (act === 'del') {
        if (!(await confirmDanger(`Excluir o frete #${id}?`))) return
        await api(`/api/fretes/${id}`, { method: 'DELETE' })
        toast('Excluído', 'Frete removido.')
        renderFretes()
      }
    }
  })
}

async function renderRegrasDestino() {
  activeNav('regras-destino')
  await loadLookups()

  const safraOptions = cache.safras.map((s) => ({ value: s.id, label: s.safra }))
  const destinoOptions = cache.destinos.map((d) => ({ value: d.id, label: `${d.local}` }))
  const plantioOptions = cache.tiposPlantio.map((p) => ({
    value: p.nome,
    label: p.nome,
  }))

  const prefer = cache.safras.find((s) => s.safra === '2025-2026')
  const safraId = prefer?.id ?? safraOptions[0]?.value
  const destinoId = destinoOptions[0]?.value

  setView(`
    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Regras do destino (por safra)</div>
          <div class="panel-sub">Limites de qualidade e tabela de desconto de umidade.</div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn ghost" id="btnCopyRule">Copiar regras</button>
          <button class="btn" id="btnSalvar">Salvar regras</button>
        </div>
      </div>
      <div class="panel-body">
        <form class="form-grid rule-form" id="ruleForm">
          ${selectField({ label: 'Safra', name: 'safra_id', options: safraOptions, value: safraId, span: 'col6' })}
          ${selectField({ label: 'Destino', name: 'destino_id', options: destinoOptions, value: destinoId, span: 'col6' })}

          ${selectField({ label: 'Tipo plantio', name: 'tipo_plantio', options: plantioOptions, value: plantioOptions[0]?.value || '', span: 'col6' })}

          ${formField({ label: `Trava (sacas) ${helpTip('Quando a soma de sacas da safra para o destino ultrapassa a trava, o lancamento alerta (nao bloqueia).')}`, name: 'trava_sacas', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: '', span: 'col4' })}

          ${formField({ label: 'Custo p/ saca (Silo) R$/sc limpa', name: 'custo_silo_por_saca', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: '0,00', span: 'col4' })}
          ${formField({ label: 'Custo p/ saca (Terceiros) R$/sc limpa', name: 'custo_terceiros_por_saca', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: '0,00', span: 'col4' })}

          ${formField({ label: 'Impureza limite (%)', name: 'impureza_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: '0,00', span: 'col4' })}
          ${formField({ label: 'Ardidos limite (%)', name: 'ardidos_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: '0,00', span: 'col4' })}
          ${formField({ label: 'Queimados limite (%)', name: 'queimados_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: '0,00', span: 'col4' })}
          ${formField({ label: 'Avariados limite (%)', name: 'avariados_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: '0,00', span: 'col4' })}
          ${formField({ label: 'Esverdiados limite (%)', name: 'esverdiados_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: '0,00', span: 'col4' })}
          ${formField({ label: 'Quebrados limite (%)', name: 'quebrados_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: '0,00', span: 'col4' })}

          <div class="field col12">
            <div class="label">Tabela de umidade</div>
            <div class="hint">Defina faixas: desconto (%) e custo de secagem (R$/sc).</div>
            <div class="table-wrap rule-wrap" style="margin-top:8px">
              <table>
                <thead><tr><th>Umid (&gt;)</th><th>Umid (&lt;=)</th><th>Desconto (%)</th><th>Secagem (R$/sc)</th><th></th></tr></thead>
                <tbody id="faixas"></tbody>
              </table>
            </div>
            <div style="margin-top:10px;display:flex;gap:10px;justify-content:flex-end">
              <button class="btn ghost" type="button" id="btnAddFaixa">Adicionar faixa</button>
            </div>
          </div>
        </form>
      </div>
    </section>
  `)

  const form = view.querySelector('#ruleForm')
  const faixasEl = view.querySelector('#faixas')
  const btnSalvar = view.querySelector('#btnSalvar')
  const btnAddFaixa = view.querySelector('#btnAddFaixa')
  const btnCopyRule = view.querySelector('#btnCopyRule')

  function faixaRow(f = { umid_gt: '', umid_lte: '', desconto_pct: '' }) {
    return `<tr>
      <td style="width:90px"><input type="text" inputmode="decimal" pattern="[0-9.,]*" name="umid_gt" value="${escapeHtml(f.umid_gt)}" /></td>
      <td style="width:90px"><input type="text" inputmode="decimal" pattern="[0-9.,]*" name="umid_lte" value="${escapeHtml(f.umid_lte)}" /></td>
      <td style="width:110px"><input type="text" inputmode="decimal" pattern="[0-9.,]*" name="desconto_pct" value="${escapeHtml(f.desconto_pct)}" /></td>
      <td style="width:120px"><input type="text" inputmode="decimal" pattern="[0-9.,]*" name="custo_secagem_por_saca" value="${escapeHtml(f.custo_secagem_por_saca ?? '')}" /></td>
      <td class="actions"><button class="btn small danger" type="button" data-act="rm">Remover</button></td>
    </tr>`
  }

  function bindFaixaRemove() {
    faixasEl.querySelectorAll('[data-act="rm"]').forEach((b) => {
      b.onclick = () => {
        b.closest('tr')?.remove()
      }
    })
  }

  async function load() {
    const fd = new FormData(form)
    const safra_id = Number(fd.get('safra_id'))
    const destino_id = Number(fd.get('destino_id'))
    const tipo_plantio = String(fd.get('tipo_plantio') || '')
    const qp = new URLSearchParams({
      safra_id: String(safra_id),
      destino_id: String(destino_id),
    })
    qp.set('tipo_plantio', tipo_plantio)
    const regra = await api(`/api/destino-regras/one?${qp.toString()}`)

    form.trava_sacas.value =
      regra?.trava_sacas === null || regra?.trava_sacas === undefined
        ? ''
        : fmtNum(regra.trava_sacas, 2)
    form.custo_silo_por_saca.value = fmtNum(regra?.custo_silo_por_saca ?? 0, 2)
    form.custo_terceiros_por_saca.value = fmtNum(
      regra?.custo_terceiros_por_saca ?? 0,
      2,
    )
    form.impureza_limite_pct.value = fmtNum(
      (regra?.impureza_limite_pct ?? 0) * 100,
      2,
    )
    form.ardidos_limite_pct.value = fmtNum(
      (regra?.ardidos_limite_pct ?? 0) * 100,
      2,
    )
    form.queimados_limite_pct.value = fmtNum(
      (regra?.queimados_limite_pct ?? 0) * 100,
      2,
    )
    form.avariados_limite_pct.value = fmtNum(
      (regra?.avariados_limite_pct ?? 0) * 100,
      2,
    )
    form.esverdiados_limite_pct.value = fmtNum(
      (regra?.esverdiados_limite_pct ?? 0) * 100,
      2,
    )
    form.quebrados_limite_pct.value = fmtNum(
      (regra?.quebrados_limite_pct ?? 0) * 100,
      2,
    )

     const faixas = regra?.umidade_faixas ?? []
     faixasEl.innerHTML = faixas.length
        ? faixas
            .map((f) => faixaRow({
              umid_gt: fmtNum(f.umid_gt * 100, 2),
              umid_lte: fmtNum(f.umid_lte * 100, 2),
              desconto_pct: fmtNum(f.desconto_pct * 100, 2),
              custo_secagem_por_saca: fmtNum(Number(f.custo_secagem_por_saca ?? 0), 2),
            }))
            .join('')
        : `<tr><td colspan="5">Nenhuma faixa cadastrada.</td></tr>`
    bindFaixaRemove()
  }

  form.safra_id.onchange = load
  form.destino_id.onchange = load
  form.tipo_plantio.onchange = load

  btnAddFaixa.onclick = () => {
    if (faixasEl.textContent.includes('Nenhuma faixa')) faixasEl.innerHTML = ''
    faixasEl.insertAdjacentHTML('beforeend', faixaRow())
    bindFaixaRemove()
  }

  btnSalvar.onclick = async () => {
    const fd = new FormData(form)
    const safra_id = Number(fd.get('safra_id'))
    const destino_id = Number(fd.get('destino_id'))
    const tipo_plantio = String(fd.get('tipo_plantio') || '')

    const numOr0 = (v) => {
      const s = String(v ?? '').trim()
      if (!s) return 0
      const n = parseNumberPt(s)
      if (!Number.isFinite(n)) throw new Error('Numero invalido')
      return n
    }

    const faixas = []
    faixasEl.querySelectorAll('tr').forEach((tr) => {
      const inputs = tr.querySelectorAll('input')
      if (inputs.length < 3) return
      const umid_gt = parseNumberPt(inputs[0].value)
      const umid_lte = parseNumberPt(inputs[1].value)
      const desconto = parseNumberPt(inputs[2].value)
      const custo = inputs[3] ? parseNumberPt(inputs[3].value) : 0
      if (!Number.isFinite(umid_gt) || !Number.isFinite(umid_lte) || !Number.isFinite(desconto)) return
      faixas.push({
        umid_gt,
        umid_lte,
        desconto_pct: desconto,
        custo_secagem_por_saca: Number.isFinite(custo) ? custo : 0,
      })
    })

    await api('/api/destino-regras', {
      method: 'POST',
      body: {
        safra_id,
        destino_id,
        tipo_plantio,
        trava_sacas: String(fd.get('trava_sacas') || '').trim() === '' ? null : numOr0(fd.get('trava_sacas')),
        custo_silo_por_saca: numOr0(fd.get('custo_silo_por_saca')),
        custo_terceiros_por_saca: numOr0(fd.get('custo_terceiros_por_saca')),
        impureza_limite_pct: numOr0(fd.get('impureza_limite_pct')),
        ardidos_limite_pct: numOr0(fd.get('ardidos_limite_pct')),
        queimados_limite_pct: numOr0(fd.get('queimados_limite_pct')),
        avariados_limite_pct: numOr0(fd.get('avariados_limite_pct')),
        esverdiados_limite_pct: numOr0(fd.get('esverdiados_limite_pct')),
        quebrados_limite_pct: numOr0(fd.get('quebrados_limite_pct')),
        umidade_faixas: faixas,
      },
    })
    toast('Salvo', 'Regras do destino atualizadas.')
    load()
  }

  await load()

  if (btnCopyRule) {
    btnCopyRule.onclick = () => {
      const safraOptions2 = cache.safras.map((s) => ({ value: s.id, label: s.safra }))
      const destinoOptions2 = cache.destinos.map((d) => ({ value: d.id, label: `${d.local}` }))
      const plantioOptions2 = cache.tiposPlantio.map((p) => ({ value: p.nome, label: p.nome }))

      openDialog({
        title: 'Copiar regras do destino',
        submitLabel: 'Aplicar no destino',
        bodyHtml: `
          <div class="form-grid">
            <div class="field col12">
              <div class="label">Origem</div>
              <div class="hint">Selecione safra, destino e tipo de plantio para carregar as regras.</div>
            </div>

            ${selectField({ label: 'Safra (origem)', name: 'from_safra_id', options: safraOptions2, value: form.safra_id.value, span: 'col4' })}
            ${selectField({ label: 'Destino (origem)', name: 'from_destino_id', options: destinoOptions2, value: form.destino_id.value, span: 'col4' })}
            ${selectField({ label: 'Tipo (origem)', name: 'from_tipo_plantio', options: plantioOptions2, value: form.tipo_plantio.value, span: 'col4' })}

            <div class="field col12" style="margin-top:6px">
              <div class="label">Destino</div>
              <div class="hint">Estas regras serao salvas no destino selecionado (sobrescreve as faixas).</div>
            </div>

            ${selectField({ label: 'Safra (destino)', name: 'to_safra_id', options: safraOptions2, value: form.safra_id.value, span: 'col4' })}
            ${selectField({ label: 'Destino (destino)', name: 'to_destino_id', options: destinoOptions2, value: form.destino_id.value, span: 'col4' })}
            ${selectField({ label: 'Tipo (destino)', name: 'to_tipo_plantio', options: plantioOptions2, value: form.tipo_plantio.value, span: 'col4' })}

            <div class="field col12">
              <div class="label">Preview (editavel)</div>
              <div class="hint">Ajuste antes de aplicar. Campos vazios viram 0; faixas precisam de numeros.</div>
              <div id="ruleCopyPrev" style="margin-top:8px"></div>
            </div>

            <div class="field col12">
              <label style="display:flex;gap:8px;align-items:center">
                <input type="checkbox" name="overwrite" checked /> Sobrescrever se ja existir no destino
              </label>
            </div>
          </div>
        `,
        onSubmit: async (obj) => {
          const to_safra_id = Number(obj.to_safra_id)
          const to_destino_id = Number(obj.to_destino_id)
          const to_tipo_plantio = String(obj.to_tipo_plantio || '').trim()
          if (!to_tipo_plantio) throw new Error('Tipo (destino) obrigatorio')

          const overwrite = obj.overwrite === 'on'
          const existsQ = new URLSearchParams({
            safra_id: String(to_safra_id),
            destino_id: String(to_destino_id),
            tipo_plantio: to_tipo_plantio,
          })
          const exists = await api(`/api/destino-regras/one?${existsQ.toString()}`)
          if (exists && !overwrite) {
            toast('Erro', 'Ja existe regra no destino. Marque sobrescrever.')
            return
          }

          const prev = dlgBody.querySelector('#ruleCopyPrev')
          const getVal = (name) => String(prev?.querySelector(`[name="${name}"]`)?.value || '').trim()
          const numOr0 = (v) => {
            const s = String(v ?? '').trim()
            if (!s) return 0
            const n = parseNumberPt(s)
            if (!Number.isFinite(n)) throw new Error(`Numero invalido: ${s}`)
            return n
          }

          const faixas = []
          prev?.querySelectorAll('tbody tr').forEach((tr) => {
            const ins = tr.querySelectorAll('input')
            if (ins.length < 4) return
            const umid_gt = parseNumberPt(ins[0].value)
            const umid_lte = parseNumberPt(ins[1].value)
            const desconto_pct = parseNumberPt(ins[2].value)
            const custo_secagem_por_saca = parseNumberPt(ins[3].value)
            if (!Number.isFinite(umid_gt) || !Number.isFinite(umid_lte) || !Number.isFinite(desconto_pct)) return
            faixas.push({
              umid_gt,
              umid_lte,
              desconto_pct,
              custo_secagem_por_saca: Number.isFinite(custo_secagem_por_saca)
                ? custo_secagem_por_saca
                : 0,
            })
          })

          await api('/api/destino-regras', {
            method: 'POST',
            body: {
              safra_id: to_safra_id,
              destino_id: to_destino_id,
              tipo_plantio: to_tipo_plantio,
              trava_sacas: getVal('trava_sacas') ? numOr0(getVal('trava_sacas')) : null,
              custo_silo_por_saca: numOr0(getVal('custo_silo_por_saca')),
              custo_terceiros_por_saca: numOr0(getVal('custo_terceiros_por_saca')),
              impureza_limite_pct: numOr0(getVal('impureza_limite_pct')),
              ardidos_limite_pct: numOr0(getVal('ardidos_limite_pct')),
              queimados_limite_pct: numOr0(getVal('queimados_limite_pct')),
              avariados_limite_pct: numOr0(getVal('avariados_limite_pct')),
              esverdiados_limite_pct: numOr0(getVal('esverdiados_limite_pct')),
              quebrados_limite_pct: numOr0(getVal('quebrados_limite_pct')),
              umidade_faixas: faixas,
            },
          })

          toast('OK', 'Regras copiadas para o destino.')
          load()
        },
      })

      const prevEl = dlgBody.querySelector('#ruleCopyPrev')
      const fromSafraEl = dlgForm.querySelector('select[name="from_safra_id"]')
      const fromDesEl = dlgForm.querySelector('select[name="from_destino_id"]')
      const fromTipoEl = dlgForm.querySelector('select[name="from_tipo_plantio"]')

      function faixaRow2(f) {
        return `<tr>
          <td style="width:90px"><input type="text" inputmode="decimal" pattern="[0-9.,]*" value="${escapeHtml(f.umid_gt)}" /></td>
          <td style="width:90px"><input type="text" inputmode="decimal" pattern="[0-9.,]*" value="${escapeHtml(f.umid_lte)}" /></td>
          <td style="width:110px"><input type="text" inputmode="decimal" pattern="[0-9.,]*" value="${escapeHtml(f.desconto_pct)}" /></td>
          <td style="width:120px"><input type="text" inputmode="decimal" pattern="[0-9.,]*" value="${escapeHtml(f.custo_secagem_por_saca)}" /></td>
        </tr>`
      }

      async function loadFrom() {
        if (!prevEl) return
        const safra_id = Number(fromSafraEl.value)
        const destino_id = Number(fromDesEl.value)
        const tipo_plantio = String(fromTipoEl.value || '').trim()
        const qp = new URLSearchParams({
          safra_id: String(safra_id),
          destino_id: String(destino_id),
          tipo_plantio,
        })
        const regra = await api(`/api/destino-regras/one?${qp.toString()}`)
        if (!regra) {
          prevEl.innerHTML = `<div class="hint">Não existe regra para a origem selecionada.</div>`
          return
        }

        const faixas = regra.umidade_faixas || []
        const bodyRows = faixas.length
          ? faixas
              .map((f) =>
                faixaRow2({
                  umid_gt: fmtNum(f.umid_gt * 100, 2),
                  umid_lte: fmtNum(f.umid_lte * 100, 2),
                  desconto_pct: fmtNum(f.desconto_pct * 100, 2),
                  custo_secagem_por_saca: fmtNum(Number(f.custo_secagem_por_saca || 0), 2),
                }),
              )
              .join('')
          : `<tr><td colspan="4">Sem faixas.</td></tr>`

        prevEl.innerHTML = `
          <div class="form-grid" style="margin:0">
            ${formField({ label: 'Trava (sacas)', name: 'trava_sacas', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: regra.trava_sacas === null || regra.trava_sacas === undefined ? '' : fmtNum(regra.trava_sacas, 2), span: 'col4' })}
            ${formField({ label: 'Custo Silo (R$/sc)', name: 'custo_silo_por_saca', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: fmtNum(regra.custo_silo_por_saca || 0, 2), span: 'col4' })}
            ${formField({ label: 'Custo Terceiros (R$/sc)', name: 'custo_terceiros_por_saca', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: fmtNum(regra.custo_terceiros_por_saca || 0, 2), span: 'col4' })}
            ${formField({ label: 'Impureza limite %', name: 'impureza_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: fmtNum((regra.impureza_limite_pct || 0) * 100, 2), span: 'col4' })}
            ${formField({ label: 'Ardidos limite %', name: 'ardidos_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: fmtNum((regra.ardidos_limite_pct || 0) * 100, 2), span: 'col4' })}
            ${formField({ label: 'Queimados limite %', name: 'queimados_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: fmtNum((regra.queimados_limite_pct || 0) * 100, 2), span: 'col4' })}
            ${formField({ label: 'Avariados limite %', name: 'avariados_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: fmtNum((regra.avariados_limite_pct || 0) * 100, 2), span: 'col4' })}
            ${formField({ label: 'Esverdiados limite %', name: 'esverdiados_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: fmtNum((regra.esverdiados_limite_pct || 0) * 100, 2), span: 'col4' })}
            ${formField({ label: 'Quebrados limite %', name: 'quebrados_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: fmtNum((regra.quebrados_limite_pct || 0) * 100, 2), span: 'col4' })}
          </div>

          <div class="table-wrap rule-wrap" style="margin-top:10px">
            <table>
              <thead><tr><th>Umid (&gt;)</th><th>Umid (&lt;=)</th><th>Desconto (%)</th><th>Secagem (R$/sc)</th></tr></thead>
              <tbody>${bodyRows}</tbody>
            </table>
          </div>
        `
      }

      if (fromSafraEl) fromSafraEl.onchange = loadFrom
      if (fromDesEl) fromDesEl.onchange = loadFrom
      if (fromTipoEl) fromTipoEl.onchange = loadFrom
      loadFrom()
    }
  }
}

function debounce(fn, ms) {
  let t = null
  return (...args) => {
    window.clearTimeout(t)
    t = window.setTimeout(() => fn(...args), ms)
  }
}

function talhaoLabel(t, by) {
  const nome = String(t?.nome ?? '').trim()
  const local = String(t?.local ?? '').trim()
  if (nome && local) {
    if (by === 'local') return `${local} - ${nome}`
    return `${nome} (${local})`
  }
  return nome || local || ''
}

function sortTalhoes(list, by) {
  const key = by === 'local' ? 'local' : 'nome'
  const other = key === 'nome' ? 'local' : 'nome'
  const a0 = (x) => String(x?.[key] ?? '').trim().toLocaleLowerCase('pt-BR')
  const a1 = (x) => String(x?.[other] ?? '').trim().toLocaleLowerCase('pt-BR')
  return list
    .slice()
    .sort((a, b) => (a0(a) || '').localeCompare(a0(b) || '', 'pt-BR') || (a1(a) || '').localeCompare(a1(b) || '', 'pt-BR'))
}

async function renderColheitaBase(variant) {
  activeNav('colheita')
  await loadLookups()

  const safraOptions = [{ value: '', label: 'Todas' }].concat(
    cache.safras.map((s) => ({ value: s.id, label: `${s.safra} (#${s.id})` })),
  )

  function buildTalhaoFilterOptions(by) {
    return [{ value: '', label: 'Todos' }].concat(
      sortTalhoes(cache.talhoes, by).map((t) => ({
        value: t.id,
        label: talhaoLabel(t, by),
      })),
    )
  }

  const talhaoOptions = buildTalhaoFilterOptions('nome')
  const destinoOptions = [{ value: '', label: 'Todos' }].concat(
    cache.destinos.map((d) => ({ value: d.id, label: `${d.local}` })),
  )
  const motoristaOptions = [{ value: '', label: 'Todos' }].concat(
    cache.motoristas.map((m) => ({ value: m.id, label: `${m.nome} (${m.placa || '-'})` })),
  )

  setView(`
    <section class="panel">
      <div class="panel-head">
          <div>
            <div class="panel-title">Colheita</div>
            <div class="panel-sub">Lance cargas (colheita) e veja totais filtrados.</div>
          </div>
        <button class="btn" id="btnAdd">Nova colheita</button>
      </div>
      <div class="panel-body">
        <div class="toolbar">
          <form class="filters" id="filtersForm">
            ${selectField({ label: 'Safra', name: 'safra_id', options: safraOptions, value: '', span: 'field' }).replace('field field', 'field')}
            ${selectField({ label: 'Ordem talhão', name: 'talhao_sort', options: [{ value: 'nome', label: 'Nome' }, { value: 'local', label: 'Local' }], value: 'nome', span: 'field' }).replace('field field', 'field')}
            ${selectField({ label: 'Talhão', name: 'talhao_id', options: talhaoOptions, value: '', span: 'field' }).replace('field field', 'field')}
            ${selectField({ label: 'Destino', name: 'destino_id', options: destinoOptions, value: '', span: 'field' }).replace('field field', 'field')}
            ${selectField({ label: 'Motorista', name: 'motorista_id', options: motoristaOptions, value: '', span: 'field' }).replace('field field', 'field')}
            <div class="field">
              <div class="label">De</div>
              <input name="de" type="date" />
            </div>
            <div class="field">
              <div class="label">Até</div>
              <input name="ate" type="date" />
            </div>
          </form>
          <div>
            <button class="btn ghost" id="btnApply" type="button">Aplicar</button>
          </div>
        </div>

        <div class="grid" id="totals"></div>

        <div class="table-wrap" style="margin-top:12px">
          <table>
            <thead>
              <tr>
                <th>Ficha</th>
                <th>Safra</th>
                <th>Talhão</th>
                <th>Local</th>
                <th>Destino</th>
                <th>Motorista</th>
                <th>Umidade %</th>
                <th>Peso bruto</th>
                <th>Peso limpo e seco</th>
                <th>Desconto %</th>
                <th>Sacas</th>
                <th>Frete</th>
                <th></th>
              </tr>
            </thead>
                <tbody id="tbody"><tr><td colspan="13">Carregando...</td></tr></tbody>
          </table>
        </div>
      </div>
    </section>
  `)

  const tbody = view.querySelector('#tbody')
  const totalsEl = view.querySelector('#totals')
  const filtersEl = view.querySelector('#filtersForm')

  const selTalhaoFilter = filtersEl.querySelector('select[name="talhao_id"]')
  const selTalhaoSortFilter = filtersEl.querySelector('select[name="talhao_sort"]')
  function applyTalhaoFilterSort() {
    if (!selTalhaoFilter || !selTalhaoSortFilter) return
    const current = selTalhaoFilter.value
    const opts = buildTalhaoFilterOptions(selTalhaoSortFilter.value)
    selTalhaoFilter.innerHTML = opts
      .map(
        (o) =>
          `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`,
      )
      .join('')
    selTalhaoFilter.value = current
  }

  if (selTalhaoSortFilter) {
    selTalhaoSortFilter.onchange = () => {
      applyTalhaoFilterSort()
    }
  }

  async function refreshList() {
    const fd = new FormData(filtersEl)
    const q = new URLSearchParams()
    for (const [k, v] of fd.entries()) {
      if (v !== '') q.set(k, v)
    }
    const data = await api(`/api/viagens?${q.toString()}`)

    const t = data.totals
    totalsEl.innerHTML = `
      <div class="stat span4"><div class="stat-k">Sacas (filtrado)</div><div class="stat-v">${fmtNum(t.sacas, 2)}</div><div class="stat-h">Peso limpo e seco / 60</div></div>
      <div class="stat span4"><div class="stat-k">Peso limpo e seco</div><div class="stat-v">${fmtKg(t.peso_limpo_seco_kg)}</div><div class="stat-h">Liquido apos descontos</div></div>
      <div class="stat span4"><div class="stat-k">Frete (filtrado)</div><div class="stat-v">${fmtMoney(t.sub_total_frete)}</div><div class="stat-h">Peso bruto (sacas) x tabela</div></div>
    `

    tbody.innerHTML = data.items
      .map((v) => {
        const umidRaw = Number(v.umidade_pct)
        const umid =
          Number.isFinite(umidRaw) && umidRaw > 1 ? umidRaw / 100 : umidRaw
        const humClass =
          Number.isFinite(umid) && umid < 0.13
            ? 'hum-low'
            : Number.isFinite(umid) && umid > 0.18
              ? 'hum-high'
              : ''

        const pb = Number(v.peso_bruto_kg)
        const pls = Number(v.peso_limpo_seco_kg)
        const descPct =
          Number.isFinite(pb) && pb > 0 && Number.isFinite(pls)
            ? clamp01(1 - pls / pb) * 100
            : 0
        return `<tr class="${humClass}">
          <td><code class="mono">${escapeHtml(v.ficha)}</code></td>
          <td>${escapeHtml(v.safra_nome)}</td>
          <td data-sort="${escapeHtml(`${v.talhao_nome || ''} ${v.talhao_local || ''} ${v.ficha || ''}`.trim())}">${escapeHtml(v.talhao_nome || '')}</td>
          <td data-sort="${escapeHtml(`${v.talhao_local || ''} ${v.talhao_nome || ''} ${v.ficha || ''}`.trim())}">${escapeHtml(v.talhao_local || '')}</td>
          <td data-sort="${escapeHtml(`${v.destino_local || ''} ${v.talhao_nome || ''} ${v.motorista_nome || ''}`.trim())}">${escapeHtml(v.destino_local)}</td>
          <td data-sort="${escapeHtml(`${v.motorista_nome || ''} ${v.destino_local || ''} ${v.talhao_nome || ''}`.trim())}">${escapeHtml(v.motorista_nome)}</td>
          <td>${Number.isFinite(umid) ? `${fmtNum(umid * 100, 2)}%` : '-'}</td>
          <td>${fmtKg(v.peso_bruto_kg)}</td>
          <td>${fmtKg(v.peso_limpo_seco_kg)}</td>
          <td>${fmtNum(descPct, 2)}%</td>
          <td>${fmtNum(v.sacas, 2)}</td>
          <td>${fmtMoney(v.sub_total_frete)}</td>
          <td class="actions">
            <button class="btn small ghost" data-act="edit" data-id="${v.id}">Editar</button>
            <button class="btn small danger" data-act="del" data-id="${v.id}">Excluir</button>
          </td>
        </tr>`
      })
      .join('')

    if (!data.items.length) tbody.innerHTML = `<tr><td colspan="13">Nenhuma viagem.</td></tr>`

    tbody.querySelectorAll('[data-act]').forEach((btn) => {
      btn.onclick = async () => {
        const id = Number(btn.dataset.id)
        const act = btn.dataset.act
        if (act === 'del') {
          if (!(await confirmDanger(`Excluir a viagem #${id}?`))) return
          await api(`/api/viagens/${id}`, { method: 'DELETE' })
          toast('Excluída', 'Viagem removida.')
          refreshList()
          return
        }
        if (act === 'edit') {
          const full = await api(`/api/viagens/${id}`)
          openViagemDialog({ mode: 'edit', viagem: full })
        }
      }
    })
  }

  view.querySelector('#btnApply').onclick = refreshList
  view.querySelector('#btnAdd').onclick = () => openViagemDialog({ mode: 'create' })
  await refreshList()

  function openViagemDialog({ mode, viagem }) {
    dlg.dataset.variant = variant || ''
    const clearVariant = () => {
      dlg.dataset.variant = ''
      dlg.removeEventListener('close', clearVariant)
    }
    dlg.addEventListener('close', clearVariant)

    const isEdit = mode === 'edit'
    const safraOpts = cache.safras.map((s) => ({ value: s.id, label: s.safra }))
    function buildTalhaoOpts(by) {
      return sortTalhoes(cache.talhoes, by).map((t) => ({
        value: t.id,
        label: talhaoLabel(t, by),
      }))
    }

    const talhaoOpts = buildTalhaoOpts('nome')
    const destinoOpts = cache.destinos.map((d) => ({ value: d.id, label: `${d.local}` }))
    const motoristaOpts = cache.motoristas.map((m) => ({ value: m.id, label: `${m.nome} (${m.placa || '-'})` }))

    const plantioOpts = (cache.tiposPlantio || []).map((p) => ({
      value: p.nome,
      label: p.nome,
    }))

    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    const base = viagem
      ? {
          ...viagem,
          // converter fracao (API) -> % (UI)
          umidade_pct: (Number(viagem.umidade_pct) * 100).toFixed(2),
          impureza_pct: (Number(viagem.impureza_pct) * 100).toFixed(2),
          ardidos_pct: (Number(viagem.ardidos_pct) * 100).toFixed(2),
          queimados_pct: (Number(viagem.queimados_pct) * 100).toFixed(2),
          avariados_pct: (Number(viagem.avariados_pct) * 100).toFixed(2),
          esverdiados_pct: (Number(viagem.esverdiados_pct) * 100).toFixed(2),
          quebrados_pct: (Number(viagem.quebrados_pct) * 100).toFixed(2),
          impureza_limite_pct: (Number(viagem.impureza_limite_pct) * 100).toFixed(2),
          ardidos_limite_pct: (Number(viagem.ardidos_limite_pct) * 100).toFixed(2),
          queimados_limite_pct: (Number(viagem.queimados_limite_pct) * 100).toFixed(2),
          avariados_limite_pct: (Number(viagem.avariados_limite_pct) * 100).toFixed(2),
          esverdiados_limite_pct: (Number(viagem.esverdiados_limite_pct) * 100).toFixed(2),
          quebrados_limite_pct: (Number(viagem.quebrados_limite_pct) * 100).toFixed(2),
          umidade_desc_pct_manual:
            viagem.umidade_desc_pct_manual === null ||
            viagem.umidade_desc_pct_manual === undefined
              ? ''
              : (Number(viagem.umidade_desc_pct_manual) * 100).toFixed(2),
        }
       : {
       ficha: '',
       safra_id: cache.safras[0]?.id,
       tipo_plantio: '',
       talhao_id: cache.talhoes[0]?.id,
       local: '',
      destino_id: cache.destinos[0]?.id,
      motorista_id: cache.motoristas[0]?.id,
      placa: '',
      data_saida: today,
      hora_saida: hhmm,
      data_entrega: '',
      hora_entrega: '',
      carga_total_kg: '',
      tara_kg: '',
      umidade_pct: '',
      impureza_pct: '',
      ardidos_pct: '',
      queimados_pct: '',
      avariados_pct: '',
      esverdiados_pct: '',
      quebrados_pct: '',
      impureza_limite_pct: '0.00',
      ardidos_limite_pct: '0.00',
      queimados_limite_pct: '0.00',
      avariados_limite_pct: '0.00',
      esverdiados_limite_pct: '0.00',
      quebrados_limite_pct: '0.00',
      umidade_desc_pct_manual: '',
    }

    const safraPlantioSuggested =
      cache.safras.find((s) => String(s.id) === String(base.safra_id))?.plantio ||
      plantioOpts[0]?.value ||
      ''
    if (
      safraPlantioSuggested &&
      !plantioOpts.some((o) => String(o.value) === String(safraPlantioSuggested))
    ) {
      plantioOpts.unshift({
        value: safraPlantioSuggested,
        label: safraPlantioSuggested,
      })
    }

    const plantioValue =
      String(base.tipo_plantio || '').trim() ||
      String(safraPlantioSuggested || '').trim() ||
      plantioOpts[0]?.value ||
      ''

    openDialog({
      title: isEdit ? `Editar colheita #${viagem.id}` : 'Nova colheita',
      submitLabel: isEdit ? 'Salvar' : 'Cadastrar',
      bodyHtml: `
        ${
          variant === 'rev01'
            ? `<div id="preview" class="hint">Preencha os campos para ver o calculo (preview).</div>`
            : ''
        }
        <div class="form-grid" id="vForm">
          ${sectionTitle('Identificacao')}
          ${formField({ label: 'Ficha', name: 'ficha', value: base.ficha, placeholder: '001', span: 'col3' })}
          ${selectField({ label: 'Safra', name: 'safra_id', options: safraOpts, value: base.safra_id, span: 'col3' })}
          ${selectField({ label: 'Plantio', name: 'tipo_plantio', options: plantioOpts, value: plantioValue, span: 'col3' })}
          ${formField({ label: 'Local', name: 'local', value: base.local ?? '', placeholder: '', span: 'col3' })}

           ${selectField({ label: 'Ordenar talhões', name: 'talhao_sort', options: [{ value: 'nome', label: 'Por nome' }, { value: 'local', label: 'Por local' }], value: 'nome', span: 'col3' })}
           ${selectField({ label: 'Talhão', name: 'talhao_id', options: talhaoOpts, value: base.talhao_id, span: 'col9' })}
          ${selectField({ label: 'Destino', name: 'destino_id', options: destinoOpts, value: base.destino_id, span: 'col6' })}
          ${selectField({ label: 'Motorista', name: 'motorista_id', options: motoristaOpts, value: base.motorista_id, span: 'col6' })}

          ${sectionTitle('Regras e limites do destino')}
          <div class="field col12">
            <div class="label">Trava do destino</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
              <span class="pill"><span class="dot" id="travaDot"></span><span id="travaStatus">Carregando...</span></span>
              <span class="pill"><span class="dot"></span><span>Entregue: <b id="travaEntregue">-</b> sc</span></span>
              <span class="pill"><span class="dot"></span><span>Limite: <b id="travaLimite">-</b> sc</span></span>
              <span class="pill"><span class="dot"></span><span>Restante: <b id="travaRestante">-</b> sc</span></span>
              <span class="pill"><span class="dot" id="regraDot"></span><span id="regraInfo">Carregando regras...</span></span>
            </div>
            <div class="hint">Regras e limites sao carregados por destino + safra. Se voce alterar algum limite, o campo fica amarelo.</div>
          </div>

          ${formField({ label: 'Impureza limite %', name: 'impureza_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.impureza_limite_pct ?? '0.00', span: 'col3' })}
          ${formField({ label: 'Ardidos limite %', name: 'ardidos_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.ardidos_limite_pct ?? '0.00', span: 'col3' })}
          ${formField({ label: 'Queimados limite %', name: 'queimados_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.queimados_limite_pct ?? '0.00', span: 'col3' })}
          ${formField({ label: 'Avariados limite %', name: 'avariados_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.avariados_limite_pct ?? '0.00', span: 'col3' })}
          ${formField({ label: 'Esverdiados limite %', name: 'esverdiados_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.esverdiados_limite_pct ?? '0.00', span: 'col3' })}
          ${formField({ label: 'Quebrados limite %', name: 'quebrados_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.quebrados_limite_pct ?? '0.00', span: 'col3' })}

          ${sectionTitle('Data e transporte')}
          ${formField({ label: 'Placa', name: 'placa', value: base.placa ?? '', placeholder: 'AAA0A00', span: 'col4' })}
          ${formField({ label: 'Data saida', name: 'data_saida', type: 'date', value: base.data_saida ?? '', span: 'col4' })}
          ${formField({ label: 'Hora saida', name: 'hora_saida', type: 'time', value: base.hora_saida ?? '', span: 'col4' })}
           ${formField({ label: 'Data entrega', name: 'data_entrega', type: 'date', value: base.data_entrega ?? '', span: 'col6' })}
           ${formField({ label: 'Hora entrega', name: 'hora_entrega', type: 'time', value: base.hora_entrega ?? '', span: 'col6' })}

          ${sectionTitle('Pesagem e umidade')}
          ${formField({ label: 'Carga total (kg)', name: 'carga_total_kg', type: 'number', step: '1', value: base.carga_total_kg, span: 'col4' })}
          ${formField({ label: 'Tara (kg)', name: 'tara_kg', type: 'number', step: '1', value: base.tara_kg, span: 'col4' })}
          ${formField({ label: `Umidade % ${helpTip('Valor informado pela amostra do silo (laboratorio).')}`, name: 'umidade_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.umidade_pct, span: 'col4' })}
          ${formField({ label: `Desconto umidade % ${helpTip('Sugerido automaticamente pela tabela do destino (por safra) a partir da umidade informada. Voce pode ajustar; se ficar diferente da tabela, o campo fica amarelo.')}`, name: 'umidade_desc_pct_manual', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.umidade_desc_pct_manual ?? '', span: 'col4' })}

          ${sectionTitle('Qualidade (amostra do silo)')}
          ${formField({ label: 'Impureza %', name: 'impureza_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.impureza_pct, span: 'col3' })}
          ${formField({ label: 'Ardidos %', name: 'ardidos_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.ardidos_pct, span: 'col3' })}
          ${formField({ label: 'Queimados %', name: 'queimados_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.queimados_pct, span: 'col3' })}
          ${formField({ label: 'Avariados %', name: 'avariados_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.avariados_pct, span: 'col3' })}
          ${formField({ label: 'Esverdiados %', name: 'esverdiados_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.esverdiados_pct, span: 'col3' })}
          ${formField({ label: 'Quebrados %', name: 'quebrados_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.quebrados_pct, span: 'col3' })}
        </div>
        ${
          variant !== 'rev01'
            ? `<div class="hint" id="preview">Preencha os campos para ver o calculo (preview).</div>`
            : ''
        }
      `,
      onSubmit: async (obj) => {
        const umidEl = dlgForm.querySelector('input[name="umidade_desc_pct_manual"]')
        const umidUserEdited = umidEl && umidEl.dataset.userEdited === '1'
        const umidSuggestedHundredths = Number(
          umidEl?.dataset?.suggestedHundredths ?? '0',
        )

        let umidManualValue = null
        if (umidUserEdited) {
          const currentValue = parseNumberPt(obj.umidade_desc_pct_manual)
          const currentHundredths = Math.round(currentValue * 100)
          if (
            Number.isFinite(currentHundredths) &&
            currentHundredths !== umidSuggestedHundredths
          ) {
            umidManualValue = currentValue
          }
        }

        const body = {
          ficha: obj.ficha,
          safra_id: Number(obj.safra_id),
          tipo_plantio: obj.tipo_plantio || null,
          talhao_id: Number(obj.talhao_id),
          local: obj.local || null,
          destino_id: Number(obj.destino_id),
          motorista_id: Number(obj.motorista_id),
          placa: obj.placa || null,
          data_saida: obj.data_saida || null,
          hora_saida: obj.hora_saida || null,
          data_entrega: obj.data_entrega || null,
          hora_entrega: obj.hora_entrega || null,
          carga_total_kg: parseNumberPt(obj.carga_total_kg),
          tara_kg: parseNumberPt(obj.tara_kg),
          umidade_pct: parsePercent100OrZero(obj.umidade_pct, 'umidade_pct'),
          // Campo unico: se igual ao sugerido, manda null (usa tabela); se diferente, manda valor.
          umidade_desc_pct_manual: umidManualValue,
          impureza_pct: parsePercent100OrZero(obj.impureza_pct, 'impureza_pct'),
          ardidos_pct: parsePercent100OrZero(obj.ardidos_pct, 'ardidos_pct'),
          queimados_pct: parsePercent100OrZero(obj.queimados_pct, 'queimados_pct'),
          avariados_pct: parsePercent100OrZero(obj.avariados_pct, 'avariados_pct'),
          esverdiados_pct: parsePercent100OrZero(obj.esverdiados_pct, 'esverdiados_pct'),
          quebrados_pct: parsePercent100OrZero(obj.quebrados_pct, 'quebrados_pct'),
          impureza_limite_pct: parsePercent100OrZero(obj.impureza_limite_pct, 'impureza_limite_pct'),
          ardidos_limite_pct: parsePercent100OrZero(obj.ardidos_limite_pct, 'ardidos_limite_pct'),
          queimados_limite_pct: parsePercent100OrZero(obj.queimados_limite_pct, 'queimados_limite_pct'),
          avariados_limite_pct: parsePercent100OrZero(obj.avariados_limite_pct, 'avariados_limite_pct'),
          esverdiados_limite_pct: parsePercent100OrZero(obj.esverdiados_limite_pct, 'esverdiados_limite_pct'),
          quebrados_limite_pct: parsePercent100OrZero(obj.quebrados_limite_pct, 'quebrados_limite_pct'),
        }

        if (isEdit) {
          const r = await api(`/api/viagens/${viagem.id}`, { method: 'PUT', body })
          toast('Atualizado', 'Colheita atualizada.')
          if (r?.trava?.atingida) {
            toast('Atencao', 'Trava do destino estourada (salvo mesmo assim).')
          }
        } else {
          const r = await api('/api/viagens', { method: 'POST', body })
          toast('Cadastrada', 'Colheita registrada.')
          if (r?.trava?.atingida) {
            toast('Atencao', 'Trava do destino estourada (salvo mesmo assim).')
          }
        }
        refreshList()
      },
    })

    const inputFicha = dlgForm.querySelector('input[name="ficha"]')
    const selPlantio = dlgForm.querySelector('select[name="tipo_plantio"]')
    const inputPlaca = dlgForm.querySelector('input[name="placa"]')
    const inputLocal = dlgForm.querySelector('input[name="local"]')
    const selMotorista = dlgForm.querySelector('select[name="motorista_id"]')
    const selTalhao = dlgForm.querySelector('select[name="talhao_id"]')
    const selTalhaoSort = dlgForm.querySelector('select[name="talhao_sort"]')
    const selDestino = dlgForm.querySelector('select[name="destino_id"]')
    const selSafra = dlgForm.querySelector('select[name="safra_id"]')
    const inputUmidDesc = dlgForm.querySelector(
      'input[name="umidade_desc_pct_manual"]',
    )

    async function suggestNextFicha() {
      if (isEdit) return
      if (!inputFicha || !selSafra) return
      try {
        const safra_id = Number(selSafra.value)
        if (!Number.isFinite(safra_id) || safra_id <= 0) return
        const r = await api(`/api/viagens/next-ficha?safra_id=${safra_id}`)
        inputFicha.dataset.suggested = String(r.next_ficha ?? '')
        if (inputFicha.dataset.userEdited !== '1') {
          inputFicha.value = String(r.next_ficha ?? '')
          inputFicha.dataset.userEdited = '0'
        }
      } catch {
        // sugestao e opcional
      }
    }

    function updatePlantioHighlight() {
      if (!selPlantio) return
      const suggested = String(selPlantio.dataset.suggested || '').trim()
      selPlantio.style.background = ''
      if (!suggested) return
      if (String(selPlantio.value || '').trim() !== suggested) {
        selPlantio.style.background = '#fff3c4'
      }
    }

    function suggestPlantioFromSafra() {
      if (!selPlantio || !selSafra) return
      const sid = Number(selSafra.value)
      const s = (cache.safras || []).find((x) => x.id === sid)
      const suggested = String(s?.plantio ?? '').trim()
      selPlantio.dataset.suggested = suggested

      if (suggested) {
        const has = Array.from(selPlantio.options).some(
          (o) => String(o.value) === suggested,
        )
        if (!has) {
          const opt = document.createElement('option')
          opt.value = suggested
          opt.textContent = suggested
          selPlantio.insertBefore(opt, selPlantio.firstChild)
        }
      }

      if (!isEdit && selPlantio.dataset.userEdited !== '1' && suggested) {
        selPlantio.value = suggested
      }
      updatePlantioHighlight()
    }

    if (selPlantio) {
      selPlantio.dataset.userEdited = isEdit
        ? selPlantio.value
          ? '1'
          : '0'
        : '0'
      selPlantio.addEventListener('change', () => {
        selPlantio.dataset.userEdited = '1'
        updatePlantioHighlight()
        if (inputUmidDesc) inputUmidDesc.dataset.userEdited = '0'
        applyDestinoDefaults().finally(runPreview)
      })
    }

    if (inputFicha) {
      inputFicha.dataset.userEdited = isEdit
        ? inputFicha.value
          ? '1'
          : '0'
        : '0'
      inputFicha.addEventListener('input', () => {
        inputFicha.dataset.userEdited = '1'
      })
    }

    function applyTalhaoSort() {
      if (!selTalhaoSort || !selTalhao) return
      const current = selTalhao.value
      const opts = buildTalhaoOpts(selTalhaoSort.value)
      selTalhao.innerHTML = opts
        .map(
          (o) =>
            `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`,
        )
        .join('')
      if (current) selTalhao.value = current
    }

    if (selTalhaoSort) {
      selTalhaoSort.onchange = () => {
        applyTalhaoSort()
      }
    }

    function baselineUmidSuggestedHundredths() {
      if (!inputUmidDesc) return 0
      return Number(inputUmidDesc.dataset.suggestedHundredths ?? '0')
    }

    function setSuggestedUmidFromPreview(p) {
      if (!inputUmidDesc) return
      const suggestedPct = Number(p.umidade_desc_pct_sugerida) * 100
      if (!Number.isFinite(suggestedPct)) return
      const suggestedHundredths = Math.round(suggestedPct * 100)
      inputUmidDesc.dataset.suggestedHundredths = String(suggestedHundredths)

      // se usuario nao mexeu, auto-preenche com o sugerido
      if (inputUmidDesc.dataset.userEdited !== '1') {
        inputUmidDesc.value = (suggestedHundredths / 100).toFixed(2)
      }
    }

    function updateUmidHighlight() {
      if (!inputUmidDesc) return
      const suggested = baselineUmidSuggestedHundredths()
      const raw = String(inputUmidDesc.value ?? '').trim()
      inputUmidDesc.style.background = ''
      if (!raw) return

      const current = Math.round(parseNumberPt(raw) * 100)
      if (!Number.isFinite(current)) return
      if (current !== suggested) inputUmidDesc.style.background = '#fff3c4'
    }

    const limitFieldNames = [
      'impureza_limite_pct',
      'ardidos_limite_pct',
      'queimados_limite_pct',
      'avariados_limite_pct',
      'esverdiados_limite_pct',
      'quebrados_limite_pct',
    ]

    function toHundredthsPct(n) {
      const x = Number(n)
      if (!Number.isFinite(x)) return null
      return Math.round(x * 100)
    }

    function setBaselineLimitsFromRegra(regra) {
      for (const name of limitFieldNames) {
        const el = dlgForm.querySelector(`input[name="${name}"]`)
        if (!el) continue
        const frac = regra?.[name] ?? 0
        const baselineHundredths = toHundredthsPct(frac * 100) ?? 0
        el.dataset.baselineHundredths = String(baselineHundredths)
      }
    }

    function updateLimitHighlight() {
      let anyDiff = false
      for (const name of limitFieldNames) {
        const el = dlgForm.querySelector(`input[name="${name}"]`)
        if (!el) continue

        const baseline = Number(el.dataset.baselineHundredths ?? '0')
        const current = toHundredthsPct(parseNumberPt(el.value))

        el.style.background = ''
        if (current === null) continue

        if (current !== baseline) {
          anyDiff = true
          el.style.background = '#fff3c4'
        }
      }
      return anyDiff
    }

    function setLocalFromTalhao() {
      const tid = Number(selTalhao.value)
      const t = cache.talhoes.find((x) => x.id === tid)
      if (!t) return
      inputLocal.value = t.local || ''
    }

    function setPlacaFromMotorista() {
      const mid = Number(selMotorista.value)
      const m = cache.motoristas.find((x) => x.id === mid)
      if (!m) return
      if (m.placa) inputPlaca.value = m.placa
    }

    function setDestinoRegraUi({ regra, preview } = {}) {
      const travaDot = dlgForm.querySelector('#travaDot')
      const travaStatus = dlgForm.querySelector('#travaStatus')
      const travaEntregue = dlgForm.querySelector('#travaEntregue')
      const travaLimite = dlgForm.querySelector('#travaLimite')
      const travaRestante = dlgForm.querySelector('#travaRestante')
      const regraDot = dlgForm.querySelector('#regraDot')
      const regraInfo = dlgForm.querySelector('#regraInfo')

      const trava = preview?.trava
      const limite =
        trava && Number.isFinite(Number(trava.trava_sacas))
          ? Number(trava.trava_sacas)
          : Number.isFinite(Number(regra?.trava_sacas))
            ? Number(regra.trava_sacas)
            : null
      const entregue =
        trava && Number.isFinite(Number(trava.entrega_atual_sacas))
          ? Number(trava.entrega_atual_sacas)
          : null

      const restante =
        Number.isFinite(limite) && limite > 0 && Number.isFinite(entregue)
          ? Math.max(0, limite - entregue)
          : null

      const ratio =
        Number.isFinite(limite) && limite > 0 && Number.isFinite(entregue)
          ? entregue / limite
          : null

      let statusText = 'Sem trava'
      let dotClass = ''
      if (Number.isFinite(limite) && limite > 0) {
        if (!Number.isFinite(entregue)) {
          statusText = 'Trava definida'
          dotClass = 'warn'
        } else if (ratio >= 1) {
          statusText = 'Trava atingida'
          dotClass = 'bad'
        } else if (ratio >= 0.85) {
          statusText = 'Perto da trava'
          dotClass = 'warn'
        } else {
          statusText = 'OK'
          dotClass = ''
        }
      }

      if (travaStatus) travaStatus.textContent = statusText
      if (travaDot) travaDot.className = `dot ${dotClass}`.trim()
      if (travaLimite) travaLimite.textContent = Number.isFinite(limite) ? fmtSacas(limite) : '-'
      if (travaEntregue)
        travaEntregue.textContent = Number.isFinite(entregue) ? fmtSacas(entregue) : '-'
      if (travaRestante)
        travaRestante.textContent = Number.isFinite(restante) ? fmtSacas(restante) : '-'

      const regraExiste =
        typeof preview?.destino_regra_existe === 'boolean'
          ? preview.destino_regra_existe
          : !!regra
      const faixasQtd =
        Number.isFinite(Number(preview?.umidade_faixas_qtd))
          ? Number(preview.umidade_faixas_qtd)
          : Array.isArray(regra?.umidade_faixas)
            ? regra.umidade_faixas.length
            : null

      if (regraInfo) {
        if (!regraExiste) {
          regraInfo.textContent = 'Regras do destino: NAO CADASTRADO'
        } else {
          regraInfo.textContent = `Regras do destino: OK${faixasQtd === null ? '' : ` (${faixasQtd} faixas)`}`
        }
      }
      if (regraDot) regraDot.className = `dot ${regraExiste ? '' : 'bad'}`.trim()
    }

    async function applyDestinoDefaults() {
      try {
        const safra_id = Number(
          dlgForm.querySelector('select[name="safra_id"]').value,
        )
        const destino_id = Number(selDestino.value)
        const tipo_plantio = String(
          dlgForm.querySelector('select[name="tipo_plantio"]').value || '',
        )
        const qp = new URLSearchParams({
          safra_id: String(safra_id),
          destino_id: String(destino_id),
        })
        if (tipo_plantio) qp.set('tipo_plantio', tipo_plantio)
        const regra = await api(`/api/destino-regras/one?${qp.toString()}`)

        setBaselineLimitsFromRegra(regra)
        const map = [
          ['impureza_limite_pct', regra?.impureza_limite_pct ?? 0],
          ['ardidos_limite_pct', regra?.ardidos_limite_pct ?? 0],
          ['queimados_limite_pct', regra?.queimados_limite_pct ?? 0],
          ['avariados_limite_pct', regra?.avariados_limite_pct ?? 0],
          ['esverdiados_limite_pct', regra?.esverdiados_limite_pct ?? 0],
          ['quebrados_limite_pct', regra?.quebrados_limite_pct ?? 0],
        ]

        for (const [name, v] of map) {
          const el = dlgForm.querySelector(`input[name="${name}"]`)
          if (!el) continue
          // ao trocar destino, sempre carregar os limites do destino (evita ficar com limites do destino anterior)
          el.value = ((v ?? 0) * 100).toFixed(2)
        }

        updateLimitHighlight()
        setDestinoRegraUi({ regra })
      } catch {
        // regras sao opcionais
      }
    }

    const previewEl = document.querySelector('#preview')
    const vForm = document.querySelector('#vForm')
    const runPreview = debounce(async () => {
      try {
        const fd = new FormData(dlgForm)
        const obj = Object.fromEntries(fd.entries())
        if (!obj.carga_total_kg || !obj.tara_kg) {
          previewEl.textContent = 'Preencha os campos para ver o calculo (preview).'
          return
        }
        const body = {
          ficha: obj.ficha || '1',
          safra_id: Number(obj.safra_id),
          tipo_plantio: obj.tipo_plantio || null,
          talhao_id: Number(obj.talhao_id),
          local: obj.local || null,
          destino_id: Number(obj.destino_id),
          motorista_id: Number(obj.motorista_id),
          placa: obj.placa || null,
          data_saida: obj.data_saida || null,
          hora_saida: obj.hora_saida || null,
          data_entrega: obj.data_entrega || null,
          hora_entrega: obj.hora_entrega || null,
          carga_total_kg: parseNumberPt(obj.carga_total_kg),
          tara_kg: parseNumberPt(obj.tara_kg),
          umidade_pct: parsePercent100OrZero(obj.umidade_pct, 'umidade_pct'),
          umidade_desc_pct_manual:
            inputUmidDesc && inputUmidDesc.dataset.userEdited === '1'
              ? parseNumberPt(obj.umidade_desc_pct_manual)
              : null,
          impureza_pct: parsePercent100OrZero(obj.impureza_pct, 'impureza_pct'),
          ardidos_pct: parsePercent100OrZero(obj.ardidos_pct, 'ardidos_pct'),
          queimados_pct: parsePercent100OrZero(obj.queimados_pct, 'queimados_pct'),
          avariados_pct: parsePercent100OrZero(obj.avariados_pct, 'avariados_pct'),
          esverdiados_pct: parsePercent100OrZero(obj.esverdiados_pct, 'esverdiados_pct'),
          quebrados_pct: parsePercent100OrZero(obj.quebrados_pct, 'quebrados_pct'),
          impureza_limite_pct: parsePercent100OrZero(obj.impureza_limite_pct, 'impureza_limite_pct'),
          ardidos_limite_pct: parsePercent100OrZero(obj.ardidos_limite_pct, 'ardidos_limite_pct'),
          queimados_limite_pct: parsePercent100OrZero(obj.queimados_limite_pct, 'queimados_limite_pct'),
          avariados_limite_pct: parsePercent100OrZero(obj.avariados_limite_pct, 'avariados_limite_pct'),
          esverdiados_limite_pct: parsePercent100OrZero(obj.esverdiados_limite_pct, 'esverdiados_limite_pct'),
          quebrados_limite_pct: parsePercent100OrZero(obj.quebrados_limite_pct, 'quebrados_limite_pct'),
        }
        const p = await api('/api/viagens/preview', { method: 'POST', body })

        // trava: manter calculos, apenas sinalizar
        const trava = p.trava
        if (trava?.atingida) {
          dlg.dataset.trava = '1'
        } else {
          dlg.dataset.trava = ''
        }

        setSuggestedUmidFromPreview(p)
        updateUmidHighlight()

        setDestinoRegraUi({ preview: p })

        updateLimitHighlight()

        previewEl.innerHTML = `
          <span class="pill"><span class="dot"></span><span>Peso bruto: <b>${fmtKg(p.peso_bruto_kg)}</b></span></span>
          ${
            p.secagem_custo_por_saca && Number(p.secagem_custo_por_saca) > 0
              ? `<span class="pill"><span class="dot warn"></span><span>Secagem: <b>${fmtMoney(p.sub_total_secagem)}</b> (R$ ${fmtNum(p.secagem_custo_por_saca, 2)}/sc)</span></span>`
              : ''
          }
          ${
            p.custo_silo_por_saca && Number(p.custo_silo_por_saca) > 0
              ? `<span class="pill"><span class="dot warn"></span><span>Custos (Silo): <b>${fmtMoney(p.sub_total_custo_silo)}</b> (R$ ${fmtNum(p.custo_silo_por_saca, 2)}/sc limpa | abat.: ${fmtMoney(p.abatimento_por_saca_silo)}/sc)</span></span>`
              : ''
          }
          ${
            p.custo_terceiros_por_saca && Number(p.custo_terceiros_por_saca) > 0
              ? `<span class="pill"><span class="dot warn"></span><span>Custos (Terceiros): <b>${fmtMoney(p.sub_total_custo_terceiros)}</b> (R$ ${fmtNum(p.custo_terceiros_por_saca, 2)}/sc limpa | abat.: ${fmtMoney(p.abatimento_por_saca_terceiros)}/sc)</span></span>`
              : ''
          }
          <span class="pill"><span class="dot warn"></span><span>Umidade: <b>${fmtKg(p.umidade_kg)}</b> (sugerido: ${fmtNum(p.umidade_desc_pct_sugerida * 100, 2)}% | aplicado: ${fmtNum(p.umidade_desc_pct * 100, 2)}% | origem: ${escapeHtml(p.umidade_origem)})</span></span>
          <span class="pill"><span class="dot warn"></span><span>Impureza: <b>${fmtKg(p.impureza_kg)}</b> (${fmtPctFromFrac(p.impureza_pct)} - ${fmtPctFromFrac(p.impureza_limite_pct)})</span></span>
          <span class="pill"><span class="dot warn"></span><span>Ardidos: <b>${fmtKg(p.ardidos_kg)}</b> (${fmtPctFromFrac(p.ardidos_pct)} - ${fmtPctFromFrac(p.ardidos_limite_pct)})</span></span>
          <span class="pill"><span class="dot warn"></span><span>Queimados: <b>${fmtKg(p.queimados_kg)}</b> (${fmtPctFromFrac(p.queimados_pct)} - ${fmtPctFromFrac(p.queimados_limite_pct)})</span></span>
          <span class="pill"><span class="dot warn"></span><span>Avariados: <b>${fmtKg(p.avariados_kg)}</b> (${fmtPctFromFrac(p.avariados_pct)} - ${fmtPctFromFrac(p.avariados_limite_pct)})</span></span>
          <span class="pill"><span class="dot warn"></span><span>Esverdiados: <b>${fmtKg(p.esverdiados_kg)}</b> (${fmtPctFromFrac(p.esverdiados_pct)} - ${fmtPctFromFrac(p.esverdiados_limite_pct)})</span></span>
          <span class="pill"><span class="dot warn"></span><span>Quebrados: <b>${fmtKg(p.quebrados_kg)}</b> (${fmtPctFromFrac(p.quebrados_pct)} - ${fmtPctFromFrac(p.quebrados_limite_pct)})</span></span>
          <span class="pill"><span class="dot"></span><span>Peso limpo/seco: <b>${fmtKg(p.peso_limpo_seco_kg)}</b></span></span>
          <span class="pill"><span class="dot"></span><span>Sacas: <b>${fmtNum(p.sacas, 2)}</b></span></span>
          <span class="pill"><span class="dot"></span><span>Frete: <b>${fmtMoney(p.sub_total_frete)}</b> (R$ ${fmtNum(p.frete_tabela, 2)}/sc)</span></span>
        `
      } catch (e) {
        dlg.dataset.trava = ''
        setDestinoRegraUi({})
        previewEl.innerHTML = `<span class="pill"><span class="dot bad"></span><span>${escapeHtml(e.message)}</span></span>`
      }
    }, 250)

    // comportamento amigavel: preencher local/placa e puxar limites do destino
    inputLocal.readOnly = true
    setLocalFromTalhao()
    setPlacaFromMotorista()
    suggestPlantioFromSafra()
    suggestNextFicha().finally(() => {
      applyDestinoDefaults().finally(runPreview)
    })

    // Campo unico de desconto de umidade: ao editar, marca como alterado
    if (inputUmidDesc) {
      inputUmidDesc.dataset.userEdited = inputUmidDesc.value ? '1' : '0'
      inputUmidDesc.addEventListener('input', () => {
        inputUmidDesc.dataset.userEdited = inputUmidDesc.value ? '1' : '0'
        updateUmidHighlight()
      })
    }

    // ao alterar limites manualmente, destacar quando diferente do destino
    for (const name of limitFieldNames) {
      const el = dlgForm.querySelector(`input[name="${name}"]`)
      if (!el) continue
      el.addEventListener('input', () => {
        updateLimitHighlight()
      })
    }

    selTalhao.onchange = () => {
      setLocalFromTalhao()
      runPreview()
    }
    selMotorista.onchange = () => {
      setPlacaFromMotorista()
      runPreview()
    }
    selDestino.onchange = () => {
      if (inputUmidDesc) inputUmidDesc.dataset.userEdited = '0'
      applyDestinoDefaults().finally(runPreview)
    }

    if (selSafra) {
      selSafra.onchange = () => {
        if (selPlantio && selPlantio.dataset.userEdited !== '1') {
          selPlantio.dataset.userEdited = '0'
        }
        suggestPlantioFromSafra()
        if (!isEdit && inputFicha && inputFicha.dataset.userEdited !== '1') {
          inputFicha.dataset.userEdited = '0'
        }
        suggestNextFicha()
        if (inputUmidDesc) inputUmidDesc.dataset.userEdited = '0'
        applyDestinoDefaults().finally(runPreview)
      }
    }

    vForm.querySelectorAll('input,select,textarea').forEach((el) => {
      el.addEventListener('input', runPreview)
      el.addEventListener('change', runPreview)
    })

    runPreview()
  }
}

async function renderRelatorios() {
  activeNav('relatorios')
  await loadLookups()

  const safraOpts = cache.safras.map((s) => ({ value: s.id, label: s.safra }))
  const safraId = safraOpts[0]?.value

  setView(`
    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Relatórios</div>
          <div class="panel-sub">Resumo por talhão, entregas por destino e pagamento de motoristas.</div>
        </div>
      </div>
      <div class="panel-body">
        <div class="grid">
          <div class="span12">
            <div class="toolbar">
              <form class="filters" id="rFilters">
                ${selectField({ label: 'Safra', name: 'safra_id', options: safraOpts, value: safraId, span: 'field' }).replace('field field', 'field')}
                <div class="field"><div class="label">De</div><input name="de" type="date" /></div>
                <div class="field"><div class="label">Até</div><input name="ate" type="date" /></div>
              </form>
              <div>
                <button class="btn ghost" id="btnRun" type="button">Atualizar</button>
                <button class="btn ghost" id="btnExpTal" type="button">Exportar resumo</button>
                <button class="btn ghost" id="btnExpDes" type="button">Exportar destinos</button>
                <button class="btn ghost" id="btnExpPay" type="button">Exportar motoristas</button>
                <button class="btn" id="btnExpRaw" type="button">Dados brutos (CSV)</button>
              </div>
            </div>
          </div>

          <div class="span12">
            <div class="table-wrap">
              <table>
                <thead><tr><th colspan="9">Resumo por talhão</th></tr>
                  <tr><th>Talhão</th><th>Local</th><th>Área (ha)</th><th>Área colhida</th><th>Sacas</th><th>Prod (sc/ha)</th><th>Prod ajust.</th><th>Peso limpo/seco</th><th>Frete</th></tr></thead>
                <tbody id="rtalhao"><tr><td colspan="9">Carregando...</td></tr></tbody>
              </table>
            </div>
          </div>

          <div class="span12">
            <div class="table-wrap">
              <table>
                <thead><tr><th colspan="5">Entregas por destino</th></tr>
                  <tr><th>Destino</th><th>Trava (sacas)</th><th>Entrega (sacas)</th><th>Peso limpo/seco</th><th>Status</th></tr></thead>
                <tbody id="rdest"><tr><td colspan="5">Carregando...</td></tr></tbody>
              </table>
            </div>
          </div>

          <div class="span12">
            <div class="table-wrap">
              <table>
                <thead><tr><th colspan="4">Pagamento de motoristas (por data_saida)</th></tr>
                  <tr><th>Motorista</th><th>Quantidade</th><th>Valor</th><th>Placa</th></tr></thead>
                <tbody id="rpay"><tr><td colspan="4">Carregando...</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  `)

  const btn = view.querySelector('#btnRun')
  const btnExpTal = view.querySelector('#btnExpTal')
  const btnExpDes = view.querySelector('#btnExpDes')
  const btnExpPay = view.querySelector('#btnExpPay')
  const btnExpRaw = view.querySelector('#btnExpRaw')
  const form = view.querySelector('#rFilters')
  const rTal = view.querySelector('#rtalhao')
  const rDes = view.querySelector('#rdest')
  const rPay = view.querySelector('#rpay')

  async function run() {
    const fd = new FormData(form)
    const safra_id = Number(fd.get('safra_id'))
    const de = fd.get('de') || null
    const ate = fd.get('ate') || null

    const [tal, des, pay] = await Promise.all([
      api(`/api/relatorios/resumo-talhao?safra_id=${safra_id}`),
      api(`/api/relatorios/entregas-por-destino?safra_id=${safra_id}`),
      api(`/api/relatorios/pagamento-motoristas?${new URLSearchParams({ ...(de ? { de } : {}), ...(ate ? { ate } : {}) })}`),
    ])

    rTal.innerHTML = tal
      .map((t) => {
        const pct = Number(t.pct_area_colhida ?? 0) * 100
        const areaColhidaHa = Number(t.hectares || 0) * Number(t.pct_area_colhida ?? 0)
        return `<tr>
          <td data-sort="${escapeHtml(`${t.talhao_nome || ''} ${t.talhao_local || ''}`.trim())}">${escapeHtml(t.talhao_nome || '')}</td>
          <td data-sort="${escapeHtml(`${t.talhao_local || ''} ${t.talhao_nome || ''}`.trim())}">${escapeHtml(t.talhao_local || '')}</td>
          <td>${fmtNum(t.hectares, 2)}</td>
          <td>${fmtNum(areaColhidaHa, 2)} ha (${fmtNum(pct, 0)}%)</td>
          <td>${fmtNum(t.sacas, 2)}</td>
          <td>${fmtNum(t.produtividade_sacas_ha, 2)}</td>
          <td>${fmtNum(t.produtividade_ajustada_sacas_ha, 2)}</td>
          <td>${fmtKg(t.peso_limpo_seco_kg)}</td>
          <td>${fmtMoney(t.sub_total_frete)}</td>
        </tr>`
      })
      .join('')

    rDes.innerHTML = des
      .map((d) => {
        const trava = d.trava_sacas
        const entrega = Number(d.entrega_sacas || 0)
        let status = `<span class="pill"><span class="dot"></span><span>OK</span></span>`
        if (trava && trava > 0) {
          const ratio = entrega / trava
          if (ratio >= 1) status = `<span class="pill"><span class="dot bad"></span><span>Trava atingida</span></span>`
          else if (ratio >= 0.85) status = `<span class="pill"><span class="dot warn"></span><span>Perto da trava</span></span>`
        }
        return `<tr>
          <td>${escapeHtml(d.destino_local)}</td>
          <td>${trava === null ? '-' : fmtNum(trava, 2)}</td>
          <td>${fmtNum(d.entrega_sacas, 2)}</td>
          <td>${fmtKg(d.peso_limpo_seco_kg)}</td>
          <td>${status}</td>
        </tr>`
      })
      .join('')

    rPay.innerHTML = pay
      .map((p) => `<tr>
        <td>${escapeHtml(p.motorista_nome)}</td>
        <td>${p.quantidade}</td>
        <td>${fmtMoney(p.valor)}</td>
        <td>${escapeHtml(p.placa || '')}</td>
      </tr>`)
      .join('')
  }

  btn.onclick = run

  btnExpTal.onclick = async () => {
    const fd = new FormData(form)
    const safra_id = Number(fd.get('safra_id'))
    const tal = await api(`/api/relatorios/resumo-talhao?safra_id=${safra_id}`)
    downloadCsv(
      `resumo-talhao-safra-${safra_id}.csv`,
      [
        'Talhão',
        'Local',
        'Área (ha)',
        'Area colhida (%)',
        'Area colhida (ha)',
        'Sacas',
        'Prod (sc/ha)',
        'Prod ajust. (sc/ha)',
        'Peso limpo/seco (kg)',
        'Frete (R$)',
      ],
      (tal || []).map((t) => {
        const pct = Number(t.pct_area_colhida ?? 0)
        const hectares = Number(t.hectares || 0)
        const areaHa = hectares * pct
        return [
          `${t.talhao_nome || ''}`.trim(),
          t.talhao_local || '',
          csvNumber(hectares, 2),
          csvNumber(pct * 100, 2),
          csvNumber(areaHa, 2),
          csvNumber(t.sacas, 2),
          csvNumber(t.produtividade_sacas_ha, 2),
          csvNumber(t.produtividade_ajustada_sacas_ha, 2),
          csvNumber(t.peso_limpo_seco_kg, 0),
          csvNumber(t.sub_total_frete, 2),
        ]
      }),
    )
  }

  btnExpDes.onclick = async () => {
    const fd = new FormData(form)
    const safra_id = Number(fd.get('safra_id'))
    const des = await api(`/api/relatorios/entregas-por-destino?safra_id=${safra_id}`)
    downloadCsv(
      `entregas-por-destino-safra-${safra_id}.csv`,
      ['Destino', 'Trava (sacas)', 'Entrega (sacas)', 'Peso limpo/seco (kg)', 'Status'],
      (des || []).map((d) => {
        const trava = d.trava_sacas
        const entrega = Number(d.entrega_sacas || 0)
        let status = 'OK'
        if (trava && trava > 0) {
          const ratio = entrega / trava
          if (ratio >= 1) status = 'Trava atingida'
          else if (ratio >= 0.85) status = 'Perto da trava'
        }
        return [
          d.destino_local,
          trava === null ? '' : csvNumber(trava, 2),
          csvNumber(d.entrega_sacas, 2),
          csvNumber(d.peso_limpo_seco_kg, 0),
          status,
        ]
      }),
    )
  }

  btnExpPay.onclick = async () => {
    const fd = new FormData(form)
    const de = fd.get('de') || null
    const ate = fd.get('ate') || null
    const pay = await api(
      `/api/relatorios/pagamento-motoristas?${new URLSearchParams({
        ...(de ? { de } : {}),
        ...(ate ? { ate } : {}),
      })}`,
    )
    downloadCsv(
      `pagamento-motoristas${de ? `-${de}` : ''}${ate ? `-${ate}` : ''}.csv`,
      ['Motorista', 'Quantidade', 'Valor (R$)', 'Placa'],
      (pay || []).map((p) => [
        p.motorista_nome,
        String(p.quantidade || 0),
        csvNumber(p.valor, 2),
        p.placa || '',
      ]),
    )
  }

  btnExpRaw.onclick = async () => {
    const fd = new FormData(form)
    const safra_id = fd.get('safra_id')
    const de = fd.get('de') || null
    const ate = fd.get('ate') || null
    const qs = new URLSearchParams({
      ...(safra_id ? { safra_id } : {}),
      ...(de ? { de } : {}),
      ...(ate ? { ate } : {}),
    })
    const r = await api(`/api/viagens?${qs}`)
    const items = r.items || []
    downloadCsv(
      `viagens-bruto${safra_id ? `-safra-${safra_id}` : ''}${de ? `-${de}` : ''}${ate ? `-${ate}` : ''}.csv`,
       [
         'ID',
         'Ficha',
         'Safra',
         'Talhão',
         'Local',
         'Destino',
         'Motorista',
         'Data saida',
        'Carga (kg)',
        'Tara (kg)',
        'Peso bruto (kg)',
        'Sacas',
        'Frete tabela (R$/sc)',
        'Frete (R$)',
      ],
      items.map((v) => [
        String(v.id),
        v.ficha,
        v.safra_nome,
        `${v.talhao_nome || ''}`.trim(),
        v.talhao_local || '',
        v.destino_local,
        v.motorista_nome,
        v.data_saida || '',
        csvNumber(v.carga_total_kg, 0),
        csvNumber(v.tara_kg, 0),
        csvNumber(v.peso_bruto_kg, 0),
        csvNumber(v.sacas, 2),
        csvNumber(v.frete_tabela, 2),
        csvNumber(v.sub_total_frete, 2),
      ]),
    )
  }

  await run()
}

async function renderAreaColhida() {
  activeNav('area-colhida')
  await loadLookups()

  const safraOpts = cache.safras.map((s) => ({ value: s.id, label: s.safra }))
  const safraId = safraOpts[0]?.value

  setView(`
    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Area colhida</div>
          <div class="panel-sub">Lançamento por safra e talhão (usado para produtividade ajustada).</div>
        </div>
      </div>
      <div class="panel-body">
        <div class="grid">
          <div class="span12">
            <div class="toolbar">
              <form class="filters" id="acFilters">
                ${selectField({ label: 'Safra', name: 'safra_id', options: safraOpts, value: safraId, span: 'field' }).replace('field field', 'field')}
              </form>
              <div>
                <button class="btn ghost" id="btnAcRun" type="button">Atualizar</button>
              </div>
            </div>
          </div>

          <div class="span12">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>Nome</th><th>Local</th><th>Area (ha)</th><th>Area colhida (%)</th><th>Area colhida (ha)</th><th></th></tr>
                </thead>
                <tbody id="acBody"><tr><td colspan="6">Carregando...</td></tr></tbody>
              </table>
            </div>
            <div class="hint">Se ainda nao foi informado, a area colhida inicia em 0%.</div>
          </div>
        </div>
      </div>
    </section>
  `)

  const form = view.querySelector('#acFilters')
  const btn = view.querySelector('#btnAcRun')
  const body = view.querySelector('#acBody')

  async function run() {
    const fd = new FormData(form)
    const safra_id = Number(fd.get('safra_id'))
    const items = await api(`/api/relatorios/resumo-talhao?safra_id=${safra_id}`)

    body.innerHTML = items
      .map((t) => {
        const hectares = Number(t.hectares || 0)
        const pct = Number(t.pct_area_colhida ?? 0)
        const areaColhidaHa = hectares * pct
        return `<tr>
          <td data-sort="${escapeHtml(String(t.talhao_nome || '').trim())}">${escapeHtml(t.talhao_nome || '')}</td>
          <td data-sort="${escapeHtml(String(t.talhao_local || '').trim())}">${escapeHtml(t.talhao_local || '')}</td>
          <td>${fmtNum(hectares, 2)}</td>
          <td>
            <div class="pct-row">
              <input
                class="pct-read"
                type="text"
                value="${fmtNum(pct * 100, 1)}%"
                data-act="pct-read"
                readonly
              />
              <input
                class="pct-range"
                type="range"
                min="0"
                max="100"
                step="0.1"
                value="${(pct * 100).toFixed(1)}"
                data-act="pct-range"
                data-talhao="${t.talhao_id}"
                data-hectares="${escapeHtml(String(hectares))}"
              />
            </div>
          </td>
          <td><span data-act="area-ha">${fmtNum(areaColhidaHa, 2)}</span> ha</td>
          <td></td>
        </tr>`
      })
      .join('')

    function updateRowUi(rangeEl) {
      const tr = rangeEl.closest('tr')
      if (!tr) return
      const read = tr.querySelector('input[data-act="pct-read"]')
      const area = tr.querySelector('[data-act="area-ha"]')
      const pct100 = Number(rangeEl.value)
      const hectares = Number(rangeEl.dataset.hectares || 0)
      const pct2 = Number.isFinite(pct100) ? Math.min(1, Math.max(0, pct100 / 100)) : 0
      if (read) read.value = `${fmtNum(pct2 * 100, 1)}%`
      if (area) area.textContent = fmtNum(hectares * pct2, 2)

      // color fill from red -> green as % increases
      const t = Math.max(0, Math.min(1, pct2))
      const c0 = { r: 180, g: 35, b: 24 } // #b42318
      const c1 = { r: 2, g: 122, b: 72 } // #027a48
      const r = Math.round(c0.r + (c1.r - c0.r) * t)
      const g = Math.round(c0.g + (c1.g - c0.g) * t)
      const b = Math.round(c0.b + (c1.b - c0.b) * t)
      rangeEl.style.setProperty('--pct', `${pct2 * 100}%`)
      rangeEl.style.setProperty('--fill', `rgb(${r}, ${g}, ${b})`)
    }

    body.querySelectorAll('input[data-act="pct-range"]').forEach((el) => {
      el.oninput = () => updateRowUi(el)
      el.onchange = debounce(async () => {
        const talhao_id = Number(el.dataset.talhao)
        const pct100 = Number(el.value)
        if (!Number.isFinite(pct100) || pct100 < 0 || pct100 > 100) return
        const pct2 = Math.min(1, Math.max(0, pct100 / 100))
        await api('/api/talhao-safra', {
          method: 'POST',
          body: { safra_id, talhao_id, pct_area_colhida: pct2 },
        })
        toast('Atualizado', 'Area colhida (%) salva.')
      }, 250)

      updateRowUi(el)
    })
  }

  btn.onclick = run
  await run()
}

async function renderColheita() {
  return renderColheitaBase('rev01')
}

async function renderQuitacaoMotoristas() {
  activeNav('quitacao-motoristas')
  await loadLookups()

  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  setView(`
    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Quitação de motoristas</div>
          <div class="panel-sub">Selecione o periodo, veja o total do frete, o valor quitado e o saldo a quitar. Registre a quitacao com data, valor e forma de pagamento.</div>
        </div>
      </div>
      <div class="panel-body">
        <div class="grid">
          <div class="span12">
            <div class="toolbar">
              <form class="filters" id="qFilters">
                <div class="field"><div class="label">De</div><input name="de" type="date" value="${escapeHtml(firstOfMonth)}" /></div>
                <div class="field"><div class="label">Até</div><input name="ate" type="date" value="${escapeHtml(today)}" /></div>
              </form>
              <div>
                <button class="btn ghost" id="btnQRun" type="button">Atualizar</button>
              </div>
            </div>
          </div>

          <div class="stat span4">
            <div class="stat-k">Total frete (periodo)</div>
            <div class="stat-v" id="qTotFrete">-</div>
            <div class="stat-h">Soma de sub_total_frete por data_saida</div>
          </div>
          <div class="stat span4">
            <div class="stat-k">Total quitado (periodo)</div>
            <div class="stat-v" id="qTotPago">-</div>
            <div class="stat-h">Soma das quitacoes registradas no periodo</div>
          </div>
          <div class="stat span4">
            <div class="stat-k">Saldo a quitar</div>
            <div class="stat-v" id="qTotSaldo">-</div>
            <div class="stat-h">Frete - Quitado</div>
          </div>

          <div class="span12">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>Motorista</th><th>Qtd</th><th>Frete</th><th>Quitado</th><th>Falta</th><th></th></tr>
                </thead>
                <tbody id="qBody"><tr><td colspan="6">Carregando...</td></tr></tbody>
              </table>
            </div>
          </div>

          <div class="span12">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th colspan="6">Lancamentos de quitacao no periodo</th></tr>
                  <tr><th>Data</th><th>Motorista</th><th>Periodo</th><th>Valor</th><th>Forma</th><th>Obs</th><th></th></tr>
                </thead>
                <tbody id="qLanc"><tr><td colspan="7">Carregando...</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  `)

  const form = view.querySelector('#qFilters')
  const btn = view.querySelector('#btnQRun')
  const qBody = view.querySelector('#qBody')
  const qLanc = view.querySelector('#qLanc')
  const qTotFrete = view.querySelector('#qTotFrete')
  const qTotPago = view.querySelector('#qTotPago')
  const qTotSaldo = view.querySelector('#qTotSaldo')

  async function run() {
    const fd = new FormData(form)
    const de = String(fd.get('de') || '')
    const ate = String(fd.get('ate') || '')
    const r = await api(`/api/quitacoes-motoristas/resumo?${new URLSearchParams({ de, ate })}`)

    const totalFrete = r.items.reduce((acc, it) => acc + Number(it.valor_frete || 0), 0)
    const totalPago = r.items.reduce((acc, it) => acc + Number(it.valor_pago || 0), 0)
    const totalSaldo = r.items.reduce((acc, it) => acc + Number(it.saldo || 0), 0)
    qTotFrete.textContent = fmtMoney(totalFrete)
    qTotPago.textContent = fmtMoney(totalPago)
    qTotSaldo.textContent = fmtMoney(totalSaldo)

    qBody.innerHTML = r.items
      .map((it) => {
        const falta = Number(it.saldo || 0)
        const faltaBadge =
          falta <= 0
            ? `<span class="pill"><span class="dot"></span><span>OK</span></span>`
            : `<span class="pill"><span class="dot warn"></span><span>${escapeHtml(fmtMoney(falta))}</span></span>`

        return `<tr>
          <td data-sort="${escapeHtml(String(it.motorista_nome || '').trim())}">${escapeHtml(it.motorista_nome)}${it.motorista_placa ? ` <span class="hint">(${escapeHtml(it.motorista_placa)})</span>` : ''}</td>
          <td>${escapeHtml(String(it.quantidade || 0))}</td>
          <td>${escapeHtml(fmtMoney(it.valor_frete))}</td>
          <td>${escapeHtml(fmtMoney(it.valor_pago))}</td>
          <td>${faltaBadge}</td>
          <td><button class="btn small" data-act="pay" data-id="${it.motorista_id}" data-nome="${escapeHtml(it.motorista_nome)}" data-falta="${escapeHtml(String(falta))}">Registrar</button></td>
        </tr>`
      })
      .join('')

    qLanc.innerHTML = (r.quitacoes || [])
      .map((q) => {
        return `<tr>
          <td>${escapeHtml(q.data_pagamento)}</td>
          <td data-sort="${escapeHtml(String(q.motorista_nome || '').trim())}">${escapeHtml(q.motorista_nome)}${q.motorista_placa ? ` <span class="hint">(${escapeHtml(q.motorista_placa)})</span>` : ''}</td>
          <td>${escapeHtml(q.de)} a ${escapeHtml(q.ate)}</td>
          <td>${escapeHtml(fmtMoney(q.valor))}</td>
          <td>${escapeHtml(q.forma_pagamento || '')}</td>
          <td>${escapeHtml(q.observacoes || '')}</td>
          <td class="actions">
            <button class="btn small ghost" data-act="qedit" data-id="${q.id}">Editar</button>
            <button class="btn small danger" data-act="qdel" data-id="${q.id}">Excluir</button>
          </td>
        </tr>`
      })
      .join('')

    if (!qLanc.innerHTML) {
      qLanc.innerHTML = `<tr><td colspan="7">Nenhuma quitacao registrada neste periodo.</td></tr>`
    }

    qLanc.querySelectorAll('button[data-act="qedit"]').forEach((b) => {
      b.onclick = () => {
        const id = Number(b.dataset.id)
        const q = (r.quitacoes || []).find((x) => Number(x.id) === id)
        if (!q) return
        openDialog({
          title: `Editar quitacao #${id}`,
          submitLabel: 'Salvar',
          bodyHtml: `
            <div class="form-grid">
              ${selectField({
                label: 'Motorista',
                name: 'motorista_id',
                options: cache.motoristas.map((m) => ({ value: m.id, label: `${m.nome} (${m.placa || '-'})` })),
                value: q.motorista_id,
                span: 'col6',
              })}
              ${formField({ label: 'Periodo de', name: 'de', type: 'date', value: q.de, span: 'col3' })}
              ${formField({ label: 'Periodo ate', name: 'ate', type: 'date', value: q.ate, span: 'col3' })}
              ${formField({ label: 'Data pagamento', name: 'data_pagamento', type: 'date', value: q.data_pagamento, span: 'col4' })}
              ${formField({ label: 'Valor', name: 'valor', type: 'number', step: '0.01', value: String(q.valor ?? ''), span: 'col4' })}
              ${selectField({
                label: 'Forma',
                name: 'forma_pagamento',
                options: [
                  { value: 'PIX', label: 'PIX' },
                  { value: 'TED', label: 'TED' },
                  { value: 'DINHEIRO', label: 'Dinheiro' },
                  { value: 'CHEQUE', label: 'Cheque' },
                  { value: 'OUTROS', label: 'Outros' },
                ],
                value: q.forma_pagamento || 'PIX',
                span: 'col4',
              })}
              ${formField({ label: 'Observacoes', name: 'observacoes', value: q.observacoes || '', span: 'col12' })}
            </div>
          `,
          onSubmit: async (obj) => {
            await api(`/api/quitacoes-motoristas/${id}`, {
              method: 'PUT',
              body: {
                motorista_id: Number(obj.motorista_id),
                de: obj.de,
                ate: obj.ate,
                data_pagamento: obj.data_pagamento,
                valor: parseNumberPt(obj.valor),
                forma_pagamento: obj.forma_pagamento || null,
                observacoes: obj.observacoes || null,
              },
            })
            toast('Atualizado', 'Quitação atualizada.')
            run()
          },
        })
      }
    })

    qLanc.querySelectorAll('button[data-act="qdel"]').forEach((b) => {
      b.onclick = async () => {
        const id = Number(b.dataset.id)
        if (!(await confirmDanger(`Excluir a quitacao #${id}?`))) return
        await api(`/api/quitacoes-motoristas/${id}`, { method: 'DELETE' })
        toast('Excluído', 'Quitação removida.')
        run()
      }
    })

    qBody.querySelectorAll('button[data-act="pay"]').forEach((b) => {
      b.onclick = () => {
        const motorista_id = Number(b.dataset.id)
        const nome = b.dataset.nome || ''
        const falta = Number(b.dataset.falta || 0)
        openDialog({
          title: `Quitar motorista: ${nome}`,
          submitLabel: 'Registrar',
          bodyHtml: `
            <div class="form-grid">
              ${formField({ label: 'Data pagamento', name: 'data_pagamento', type: 'date', value: today, span: 'col4' })}
              ${formField({ label: 'Valor', name: 'valor', type: 'number', step: '0.01', value: falta > 0 ? fmtNum(falta, 2).replace('.', '').replace(',', '.') : '', span: 'col4' })}
              ${selectField({ label: 'Forma', name: 'forma_pagamento', options: [
                { value: 'PIX', label: 'PIX' },
                { value: 'TED', label: 'TED' },
                { value: 'DINHEIRO', label: 'Dinheiro' },
                { value: 'CHEQUE', label: 'Cheque' },
                { value: 'OUTROS', label: 'Outros' },
              ], value: 'PIX', span: 'col4' })}
              ${formField({ label: 'Observacoes', name: 'observacoes', value: '', span: 'col12' })}
              <div class="field col12"><div class="hint">Periodo: ${escapeHtml(de)} a ${escapeHtml(ate)}.</div></div>
            </div>
          `,
          onSubmit: async (obj) => {
            await api('/api/quitacoes-motoristas', {
              method: 'POST',
              body: {
                motorista_id,
                de,
                ate,
                data_pagamento: obj.data_pagamento,
                valor: parseNumberPt(obj.valor),
                forma_pagamento: obj.forma_pagamento || null,
                observacoes: obj.observacoes || null,
              },
            })
            toast('Salvo', 'Quitação registrada.')
            run()
          },
        })
      }
    })
  }

  btn.onclick = run
  await run()
}

async function renderFazenda() {
  activeNav('fazenda')
  const f = FAZENDA_NAZCA_PUBLIC
  const mapsEmbed =
    'https://www.google.com/maps/d/embed?mid=1I31t4h-O1Scw04_yJqcTAs8EqUid5IE&ehbc=2E312F'
  const mapsOpen =
    'https://www.google.com/maps/d/edit?mid=1I31t4h-O1Scw04_yJqcTAs8EqUid5IE&ll=-20.193727536387307%2C-45.874922749999996&z=17'
  setView(`
    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">${escapeHtml(f.nome)}</div>
          <div class="panel-sub">Informacoes internas + links publicos (redes sociais e Google Maps).</div>
        </div>
      </div>
      <div class="panel-body">
        <div class="grid">
          <div class="span12" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
            <img src="/logo.png" alt="${escapeHtml(f.nome)}" style="width:140px;height:140px;object-fit:contain;background:rgba(255,255,255,.75);border:1px solid rgba(15,26,22,.14);border-radius:18px;padding:14px" />
            <div>
              <div style="font-family:var(--serif);font-size:22px">NazcaTrack</div>
              <div style="margin-top:6px;color:var(--muted)">Base interna: colheita (safras, talhões, destinos, viagens, descontos e fretes).</div>
              <div style="margin-top:10px" class="pill"><span class="dot warn"></span><span>Fontes publicas: Google Maps / Instagram / Facebook.</span></div>
            </div>
          </div>

          <div class="span6">
            <div class="stat">
              <div class="stat-k">Localizacao (Google Maps)</div>
              <div class="stat-v" style="font-size:16px">${escapeHtml(f.localizacao.endereco)}</div>
              <div class="stat-h">Plus Code: <span class="mono">${escapeHtml(f.localizacao.plus_code)}</span></div>
              <div class="stat-h">Avaliacao: ${escapeHtml(f.localizacao.maps_rating)} (${escapeHtml(f.localizacao.maps_reviews)} avaliacoes)</div>
              <div style="margin-top:10px">
                <a class="btn small ghost" href="${escapeHtml(f.localizacao.maps_url)}" target="_blank" rel="noreferrer">Abrir no Maps</a>
              </div>
            </div>
          </div>

          <div class="span6">
            <div class="stat">
              <div class="stat-k">Redes sociais</div>
              <div class="stat-h"><a href="${escapeHtml(f.links.instagram)}" target="_blank" rel="noreferrer">Instagram: @fazendanazca</a></div>
              <div class="stat-h"><a href="${escapeHtml(f.links.facebook)}" target="_blank" rel="noreferrer">Facebook: /fazendanazca</a></div>
              <div class="stat-h"><a href="${escapeHtml(f.links.reel)}" target="_blank" rel="noreferrer">Reel (Instagram)</a></div>
               <div class="stat-h">Obs: a leitura automática do conteúdo pode falhar por bloqueios das plataformas.</div>
            </div>
          </div>

          <div class="span12">
            <div class="stat">
              <div class="stat-k">Sobre (interno)</div>
              <div class="stat-h">Objetivo: registrar viagens de colheita, aplicar descontos (umidade/qualidade), calcular sacas/fretes/secagem e gerar relatórios por safra.</div>
              <div class="stat-h" style="margin-top:10px"><b>Rotina sugerida</b>: cadastrar fretes/regras do destino no início da safra; lançar colheita na saída; completar entrega no silo quando houver (romaneio, tara/peso, análise).</div>
              <div class="stat-h" style="margin-top:10px"><b>Padrões</b>: percentuais sempre 0..100; umidade/qualidade conforme amostra do silo; revisão semanal do % de área colhida por talhão.</div>
            </div>
          </div>

          <div class="span12">
            <div class="stat">
              <div class="stat-k">Mapa dos talhões (My Maps)</div>
              <div class="mini-map" style="margin-top:10px">
                <iframe title="Mapa dos talhões" loading="lazy" src="${escapeHtml(mapsEmbed)}"></iframe>
              </div>
              <div style="margin-top:10px">
                <a class="btn small ghost" href="${escapeHtml(mapsOpen)}" target="_blank" rel="noreferrer">Abrir mapa</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `)
}

const routes = {
  painel: renderPainel,
  fazenda: renderFazenda,
  safras: renderSafras,
  talhoes: renderTalhoes,
  destinos: renderDestinos,
  'tipos-plantio': renderTiposPlantio,
  motoristas: renderMotoristas,
  fretes: renderFretes,
  'regras-destino': renderRegrasDestino,
  colheita: renderColheita,
  'colheita-rev01': renderColheita,
  'area-colhida': renderAreaColhida,
  'quitacao-motoristas': renderQuitacaoMotoristas,
  viagens: renderColheita,
  relatorios: renderRelatorios,
  usuarios: renderUsuarios,
}

async function applyMenuAccess() {
  try {
    const r = await fetch('/api/auth/me', { method: 'GET' })
    const data = await r.json().catch(() => null)
    const menus = data?.user?.menus
    if (!Array.isArray(menus) || !menus.length) return

    const set = new Set(menus.map((x) => String(x)))
    document
      .querySelectorAll('.nav-item[data-route]')
      .forEach((a) => {
        const k = String(a.dataset.route || '')
        if (!k) return
        if (!set.has(k)) a.style.display = 'none'
      })

    window.__allowedRoutes = set
  } catch {
    // ignore
  }
}

async function navigate() {
  const hash = window.location.hash || '#/painel'
  const route = hash.replace('#/', '').split('?')[0] || 'painel'
  const allowed = window.__allowedRoutes
  if (allowed && allowed.size && !allowed.has(route)) {
    window.location.hash = '#/painel'
    return
  }
  const fn = routes[route] || routes.painel
  try {
    await fn()
  } catch (e) {
    setView(`<section class="panel"><div class="panel-head"><div><div class="panel-title">Erro</div><div class="panel-sub">Falha ao carregar a tela.</div></div></div><div class="panel-body"><code class="mono">${escapeHtml(e.message)}</code></div></section>`)
  }
}

btnRefresh.onclick = () => navigate()
window.addEventListener('hashchange', navigate)

applyMenuAccess().finally(() => navigate())

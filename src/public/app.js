const view = document.querySelector('#view')
const toastEl = document.querySelector('#toast')
const btnRefresh = document.querySelector('#btnRefresh')
const btnToggleNav = document.querySelector('#btnToggleNav')
const btnAuth = document.querySelector('#btnAuth')

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
  readonly,
  disabled,
}) {
  const stepAttr = step ? ` step="${step}"` : ''
  const inputModeAttr = inputmode ? ` inputmode="${escapeHtml(inputmode)}"` : ''
  const patternAttr = pattern ? ` pattern="${escapeHtml(pattern)}"` : ''
  const readonlyAttr = readonly ? ' readonly' : ''
  const disabledAttr = disabled ? ' disabled' : ''
  return `<div class="field ${span}">
    <div class="label">${label}</div>
    <input name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value ?? '')}" placeholder="${escapeHtml(placeholder)}"${stepAttr}${inputModeAttr}${patternAttr}${readonlyAttr}${disabledAttr} />
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

function openDialog({ title, bodyHtml, onSubmit, submitLabel = 'Salvar', size } = {}) {
  dlg.dataset.size = size ? String(size) : ''
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
    try {
      if (onSubmit) await onSubmit(obj)
      dlg.close('default')
    } catch (err) {
      const msg = String(err?.message || err)
      const details = err?.details || null

      // Erros "guiados" (exigem cadastro) -> abre overlay com atalho
      if (msg.includes('Cadastre em Fretes')) {
        const sid = details?.safra_id
        const did = details?.destino_id
        const mid = details?.motorista_id
        const safraNome = (cache?.safras || []).find((s) => Number(s.id) === Number(sid))?.safra
        const destNome = (cache?.destinos || []).find((d) => Number(d.id) === Number(did))?.local
        const motNome = (cache?.motoristas || []).find((m) => Number(m.id) === Number(mid))?.nome
        showDialogOverlay({
          title: 'Nao foi possivel salvar',
          primaryLabel: 'Ir para Fretes',
          onPrimary: () => {
            window.location.hash = '#/fretes'
          },
          bodyHtml: `
            <div>${escapeHtml(msg)}</div>
            <div class="hint" style="margin-top:10px">Chave: Safra <b>${escapeHtml(String(safraNome || sid || '-'))}</b> | Destino <b>${escapeHtml(String(destNome || did || '-'))}</b> | Motorista <b>${escapeHtml(String(motNome || mid || '-'))}</b></div>
          `.trim(),
        })
        return
      }

      if (msg.includes('Cadastre em Regras do destino')) {
        const sid = details?.safra_id
        const did = details?.destino_id
        const tp = details?.tipo_plantio
        const safraNome = (cache?.safras || []).find((s) => Number(s.id) === Number(sid))?.safra
        const destNome = (cache?.destinos || []).find((d) => Number(d.id) === Number(did))?.local
        showDialogOverlay({
          title: 'Nao foi possivel salvar',
          primaryLabel: 'Ir para Regras do destino',
          onPrimary: () => {
            window.location.hash = '#/regras-destino'
          },
          bodyHtml: `
            <div>${escapeHtml(msg)}</div>
            <div class="hint" style="margin-top:10px">Chave: Safra <b>${escapeHtml(String(safraNome || sid || '-'))}</b> | Destino <b>${escapeHtml(String(destNome || did || '-'))}</b> | Plantio <b>${escapeHtml(String(tp || '-'))}</b></div>
          `.trim(),
        })
        return
      }

      // Erros de rateio (talhoes): mostrar motivo com numeros
      if (
        msg.toLowerCase().includes('rateio') ||
        details?.delta_pct !== undefined ||
        details?.delta_pct_100 !== undefined ||
        details?.delta_kg !== undefined
      ) {
        const somaPct =
          details?.soma_pct_100 !== undefined
            ? Number(details.soma_pct_100)
            : details?.soma_pct !== undefined
              ? Number(details.soma_pct) * 100
              : null
        const deltaPct =
          details?.delta_pct_100 !== undefined
            ? Number(details.delta_pct_100)
            : details?.delta_pct !== undefined
              ? Number(details.delta_pct) * 100
              : null
        const pesoBruto =
          details?.peso_bruto_kg !== undefined ? Number(details.peso_bruto_kg) : null
        const somaKg =
          details?.soma_kg_rateio !== undefined ? Number(details.soma_kg_rateio) : null
        const deltaKg = details?.delta_kg !== undefined ? Number(details.delta_kg) : null

        const pctLine =
          somaPct === null || !Number.isFinite(somaPct)
            ? ''
            : `<div class="hint" style="margin-top:8px">Percentual: soma <b>${escapeHtml(fmtNum(somaPct, 2))}%</b>${Number.isFinite(deltaPct) ? ` | falta/sobra <b>${escapeHtml(fmtNum(deltaPct, 2))}%</b>` : ''}</div>`

        const kgLine =
          !Number.isFinite(pesoBruto) || !Number.isFinite(somaKg) || !Number.isFinite(deltaKg)
            ? ''
            : `<div class="hint" style="margin-top:6px">Peso bruto: <b>${escapeHtml(fmtNum(pesoBruto, 0))} kg</b> | soma kg: <b>${escapeHtml(fmtNum(somaKg, 0))} kg</b> | falta/sobra: <b>${escapeHtml(fmtNum(deltaKg, 0))} kg</b></div>`

        showDialogOverlay({
          title: 'Nao foi possivel salvar',
          primaryLabel: 'OK',
          bodyHtml: `
            <div>${escapeHtml(msg)}</div>
            ${pctLine}
            ${kgLine}
            <div class="hint" style="margin-top:10px">Dica: use o botao <b>Restante</b> no rateio para fechar em 100%.</div>
          `.trim(),
        })
        return
      }

      // fallback
      toast('Erro', msg)
    }
  }

  // ESC should behave like cancel
  dlg.oncancel = (e) => {
    e.preventDefault()
    dlg.close('cancel')
  }

  const clearSize = () => {
    dlg.removeEventListener('close', clearSize)
    if (dlg.dataset.size) dlg.dataset.size = ''
  }
  dlg.addEventListener('close', clearSize)

  dlg.showModal()
}

function confirmDanger(message) {
  return confirmAction(message, { title: 'Confirmar', confirmLabel: 'Excluir' })
}

function confirmAction(message, { title = 'Confirmar', confirmLabel = 'Confirmar' } = {}) {
  return new Promise((resolve) => {
    openDialog({
      title,
      submitLabel: confirmLabel,
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

function showDialogOverlay({
  title = 'Atencao',
  bodyHtml = '',
  primaryLabel = 'OK',
  onPrimary,
} = {}) {
  // Overlay dentro do <dialog> atual (mantem o formulario intacto)
  if (!dlgForm) {
    toast('Erro', String(title || 'Erro'))
    return
  }

  dlgForm.querySelectorAll('.dlg-overlay').forEach((el) => el.remove())

  const wrap = document.createElement('div')
  wrap.className = 'dlg-overlay'
  wrap.innerHTML = `
    <div class="dlg-overlay-card" role="dialog" aria-modal="true">
      <div class="dlg-overlay-title">${escapeHtml(title)}</div>
      <div class="dlg-overlay-body">${bodyHtml}</div>
      <div class="dlg-overlay-actions">
        <button class="btn ghost" type="button" data-act="close">Fechar</button>
        <button class="btn" type="button" data-act="primary">${escapeHtml(primaryLabel)}</button>
      </div>
    </div>
  `.trim()

  const close = () => wrap.remove()

  wrap.addEventListener('click', (e) => {
    const act = e.target?.closest?.('button')?.dataset?.act
    if (act === 'close') return close()
    if (act === 'primary') {
      try {
        if (onPrimary) onPrimary()
      } finally {
        close()
      }
    }
  })

  // click fora fecha
  wrap.addEventListener('mousedown', (e) => {
    if (e.target === wrap) close()
  })

  dlgForm.appendChild(wrap)
  const btn = wrap.querySelector('button[data-act="primary"]')
  if (btn) btn.focus()
}

function asNumberOrNull(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = parseNumberPt(v)
  return Number.isFinite(n) ? n : null
}

function parseNumberPt(v) {
  if (v === null || v === undefined) return NaN
  if (typeof v === 'number') return v

  // Aceita formatos comuns pt-BR:
  // - 7000
  // - 7.000
  // - 7.000,50
  // - 7000,50
  const raw = String(v).trim()
  if (!raw) return NaN
  const s0 = raw.replace(/\s+/g, '')

  // Se tiver ',' e '.', assume '.' como milhar e ',' como decimal.
  if (s0.includes(',') && s0.includes('.')) {
    const s1 = s0.replace(/\./g, '').replace(',', '.')
    return Number(s1)
  }

  // Se tiver so ',', e decimal.
  if (s0.includes(',')) {
    return Number(s0.replace(',', '.'))
  }

  // Se tiver so '.', pode ser decimal (7000.5) ou milhar (7.000).
  // Heuristica: se o ultimo grupo tem 3 digitos e nao ha outro separador, trata como milhar.
  if (s0.includes('.')) {
    const m = s0.match(/\.(\d{3})$/)
    if (m) return Number(s0.replace(/\./g, ''))
  }

  return Number(s0)
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

function talhaoPublicUrl({ id, baseOrigin }) {
  const origin = String(baseOrigin || '').trim().replace(/\/+$/, '')
  const safeOrigin = origin || location.origin
  return `${safeOrigin}/talhao.html?id=${encodeURIComponent(id)}`
}

function qrImageUrlForText(text) {
  const data = encodeURIComponent(String(text || ''))
  // Serviço simples (gera PNG). Mantemos via https e liberado pelo CSP (img-src https:).
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${data}`
}

async function renderPainel() {
  activeNav('painel')
  const p = await api('/api/relatorios/painel')
  const totals = p.totals_geral
  const ultima = p.ultima_safra
  const atual = p.safra_atual || p.safra_painel || ultima
  const totalsUlt = p.totals_ultima_safra
  const safraLabel = atual?.safra ? String(atual.safra) : '-'
  const safraHint = p.safra_painel ? 'Definida em Safras' : 'Ultima safra cadastrada'

  const areaPlantada = Number(p.area_plantada_ha || 0)
  const areaColhida = Number(p.area_colhida_ultima_safra_ha || 0)
  const areaPct = areaPlantada > 0 ? clamp01(areaColhida / areaPlantada) : 0

  const perdasUlt = Number(p.perdas_ultima_safra_pct || 0)
  const perdasGer = Number(p.perdas_geral_pct || 0)
  const umidMedUlt = Number(p.umidade_media_ponderada_ultima_safra || 0)
  const umidMedGer = Number(p.umidade_media_ponderada_geral || 0)
  setView(`
    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Painel</div>
          <div class="panel-sub">Safra selecionada: <b>${escapeHtml(safraLabel)}</b> <span style="opacity:.8">(${escapeHtml(safraHint)})</span></div>
        </div>
        <div class="pill"><span class="dot"></span><span>Online</span></div>
      </div>
      <div class="panel-body">
        <div class="grid">
          <div class="stat span4">
            <div class="stat-k">Safra selecionada</div>
            <div class="stat-v">${escapeHtml(atual?.safra || '-') }</div>
            <div class="stat-h">${escapeHtml(atual?.plantio || '')}</div>
          </div>
          <div class="stat span4">
            <div class="stat-k">Area plantada (ha)</div>
            <div class="stat-v">${fmtNum(areaPlantada, 2)}</div>
            <div class="stat-h">Soma dos talhões ATIVO</div>
          </div>
          <div class="stat span4">
            <div class="stat-k">Area colhida (safra)</div>
            <div class="stat-v">${fmtNum(areaColhida, 2)} ha</div>
            <div class="stat-h">${fmtNum(areaPct * 100, 1)}% da area plantada</div>
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

          <div class="span12">
            <div style="display:grid;grid-template-columns:1fr;gap:12px">
              <div style="border:1px solid rgba(255,255,255,.10);border-radius:16px;padding:12px 12px 2px;background:rgba(15,26,22,.08)">
                ${sectionTitle(`Safra selecionada (${escapeHtml(safraLabel)})`)}
                <div class="grid">
                  <div class="stat span4">
                    <div class="stat-k">Peso bruto</div>
                    <div class="stat-v">${fmtKg(totalsUlt?.peso_bruto_kg || 0)}</div>
                    <div class="stat-h">Soma (carga - tara)</div>
                  </div>
                  <div class="stat span4">
                    <div class="stat-k">Peso limpo e seco</div>
                    <div class="stat-v">${fmtKg(totalsUlt?.peso_limpo_seco_kg || 0)}</div>
                    <div class="stat-h">Apos descontos</div>
                  </div>
                  <div class="stat span4">
                    <div class="stat-k">Perdas</div>
                    <div class="stat-v">${fmtNum(clamp01(perdasUlt) * 100, 2)}%</div>
                    <div class="stat-h">1 - (peso_limpo_seco / peso_bruto)</div>
                  </div>
                  <div class="stat span4">
                    <div class="stat-k">Umidade media</div>
                    <div class="stat-v">${fmtNum(clamp01(umidMedUlt) * 100, 2)}%</div>
                    <div class="stat-h">Σ(peso_bruto * umidade) / Σ(peso_bruto)</div>
                  </div>
                  <div class="stat span4">
                    <div class="stat-k">Sacas</div>
                    <div class="stat-v">${fmtNum(totalsUlt?.sacas || 0, 2)}</div>
                    <div class="stat-h">Peso limpo/seco / 60</div>
                  </div>
                  <div class="stat span4">
                    <div class="stat-k">Produtividade ajustada</div>
                    <div class="stat-v">${fmtNum(p.produtividade_ultima_safra_ajustada_sacas_ha, 2)} sc/ha</div>
                    <div class="stat-h">Sacas / area colhida informada</div>
                  </div>
                </div>
              </div>

              <div style="border:1px solid rgba(255,255,255,.10);border-radius:16px;padding:12px 12px 2px;background:rgba(15,26,22,.04)">
                ${sectionTitle('Total geral (todas as safras)')}
                <div class="grid">
                  <div class="stat span4">
                    <div class="stat-k">Peso bruto</div>
                    <div class="stat-v">${fmtKg(totals.peso_bruto_kg)}</div>
                    <div class="stat-h">Soma (carga - tara)</div>
                  </div>
                  <div class="stat span4">
                    <div class="stat-k">Peso limpo e seco</div>
                    <div class="stat-v">${fmtKg(totals.peso_limpo_seco_kg)}</div>
                    <div class="stat-h">Apos descontos</div>
                  </div>
                  <div class="stat span4">
                    <div class="stat-k">Perdas</div>
                    <div class="stat-v">${fmtNum(clamp01(perdasGer) * 100, 2)}%</div>
                    <div class="stat-h">1 - (peso_limpo_seco / peso_bruto)</div>
                  </div>
                  <div class="stat span4">
                    <div class="stat-k">Umidade media</div>
                    <div class="stat-v">${fmtNum(clamp01(umidMedGer) * 100, 2)}%</div>
                    <div class="stat-h">Σ(peso_bruto * umidade) / Σ(peso_bruto)</div>
                  </div>
                  <div class="stat span4">
                    <div class="stat-k">Sacas</div>
                    <div class="stat-v">${fmtNum(totals.sacas, 2)}</div>
                    <div class="stat-h">Peso limpo/seco / 60</div>
                  </div>
                  <div class="stat span4">
                    <div class="stat-k">Produtividade</div>
                    <div class="stat-v">${fmtNum(p.produtividade_geral_sacas_ha, 2)} sc/ha</div>
                    <div class="stat-h">Sacas / area plantada</div>
                  </div>
                </div>
              </div>
            </div>
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
      const tipoPlantio = String(atual?.plantio || '').trim()
      const qs = new URLSearchParams({ safra_id: String(safra_id) })
      if (tipoPlantio) qs.set('tipo_plantio', tipoPlantio)
      const des = await api(`/api/relatorios/entregas-por-destino?${qs.toString()}`)
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

        // show all destinos; order: with contrato first, then by % desc, then entrega desc
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
                : `${fmtNum(d.entrega, 2)} sc | sem contrato`
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
        <td class="actions">
          ${extraBtns}
          <button class="btn small ghost" data-act="edit" data-id="${it.id}">Editar</button>
          <button class="btn small danger" data-act="del" data-id="${it.id}">Excluir</button>
        </td>
        ${tds}
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
              <tr><th class="actions"></th>${th}</tr>
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
    extraActions: [
      { act: 'view', label: 'Visualizar', className: 'ghost' },
      { act: 'qr', label: 'QR Code', className: 'ghost' },
    ],
    onAction: async (act, it) => {
      if (act === 'view') {
        window.open(
          `/talhao.html?id=${encodeURIComponent(it.id)}`,
          '_blank',
          'noopener',
        )
        return
      }

      if (act !== 'qr') return

      const baseKey = 'qr_base_origin'
      const baseDefault =
        String(localStorage.getItem(baseKey) || '').trim() || location.origin
      const initialUrl = talhaoPublicUrl({ id: it.id, baseOrigin: baseDefault })

      openDialog({
        title: `QR Code - ${it.codigo}`,
        submitLabel: 'Fechar',
        bodyHtml: `
          <div class="hint">Este QR Code abre a visualização pública do talhão.</div>

          <div style="display:grid;grid-template-columns:240px 1fr;gap:14px;align-items:start;margin-top:12px">
            <div style="display:flex;flex-direction:column;gap:10px;align-items:center">
              <img id="qrImg" alt="QR Code" width="240" height="240" style="border-radius:12px;border:1px solid rgba(255,255,255,.18);background:#fff" src="${escapeHtml(qrImageUrlForText(initialUrl))}" />
              <a class="btn ghost" id="qrOpen" href="${escapeHtml(initialUrl)}" target="_blank" rel="noreferrer">Abrir link</a>
            </div>

            <div>
              <div class="form-grid">
                ${formField({ label: 'Base do site', name: 'qr_base', value: baseDefault, placeholder: 'https://seu-dominio.com', span: 'col12', type: 'text' })}
              </div>

              <div class="field" style="margin-top:10px">
                <div class="label">Link</div>
                <div class="hint mono" id="qrLink" style="word-break:break-all">${escapeHtml(initialUrl)}</div>
                <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">
                  <button class="btn ghost" id="qrCopy" type="button">Copiar link</button>
                </div>
                <div class="hint" style="margin-top:8px">Dica: em rede local, troque a base para o IP do PC (ex: <code class="mono">http://192.168.0.10:3000</code>).</div>
              </div>
            </div>
          </div>
        `.trim(),
        onSubmit: async () => {},
      })

      const baseInput = dlgBody.querySelector('input[name="qr_base"]')
      const qrImg = dlgBody.querySelector('#qrImg')
      const qrLink = dlgBody.querySelector('#qrLink')
      const qrOpen = dlgBody.querySelector('#qrOpen')
      const btnCopy = dlgBody.querySelector('#qrCopy')

      const refresh = () => {
        const base = String(baseInput?.value || '').trim()
        if (base) localStorage.setItem(baseKey, base)
        const url = talhaoPublicUrl({ id: it.id, baseOrigin: base })
        if (qrImg) qrImg.src = qrImageUrlForText(url)
        if (qrLink) qrLink.textContent = url
        if (qrOpen) qrOpen.href = url
      }

      if (baseInput) baseInput.addEventListener('input', refresh)
      if (btnCopy) {
        btnCopy.addEventListener('click', async () => {
          const text = String(qrLink?.textContent || '').trim()
          if (!text) return
          await navigator.clipboard.writeText(text)
          btnCopy.textContent = 'Copiado'
          setTimeout(() => (btnCopy.textContent = 'Copiar link'), 1200)
        })
      }
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
            ${formField({ label: 'Hectares', name: 'hectares', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: '0', span: 'col6' })}
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
              hectares: asNumberOrNull(obj.hectares) ?? 0,
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
            ${formField({ label: 'Hectares', name: 'hectares', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: String(it.hectares ?? ''), span: 'col6' })}
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
              hectares: asNumberOrNull(obj.hectares) ?? 0,
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
    subtitle: 'Cadastre destino e distancia (km). O contrato (sacas) fica nas Regras do destino.',
    fetchPath: '/api/destinos',
    columns: [
      { key: 'id', label: 'ID' },
      {
        key: 'local',
        label: 'Destino',
        sort: (_v, it) => `${it.local || ''} ${it.codigo || ''}`.trim(),
      },
      { key: 'codigo', label: 'Codigo' },
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
            ${formField({ label: 'Distancia (km)', name: 'distancia_km', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: '', span: 'col6' })}
            ${textareaField({ label: 'Observacoes', name: 'observacoes' })}
          </div>`,
        onSubmit: async (obj) => {
          await api('/api/destinos', {
            method: 'POST',
            body: {
              codigo: obj.codigo,
              local: obj.local,
              maps_url: obj.maps_url || null,
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
          if (Number.isFinite(km)) distEl.value = fmtNum(km, 1)
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
            ${formField({ label: 'Distancia (km)', name: 'distancia_km', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: String(it.distancia_km ?? ''), span: 'col6' })}
            ${textareaField({ label: 'Observacoes', name: 'observacoes', value: it.observacoes ?? '' })}
          </div>`,
        onSubmit: async (obj) => {
          await api(`/api/destinos/${it.id}`, {
            method: 'PUT',
            body: {
              codigo: obj.codigo,
              local: obj.local,
              maps_url: obj.maps_url || null,
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
          if (Number.isFinite(km)) distEl.value = fmtNum(km, 1)
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
            ${formField({ label: 'Capacidade (kg)', name: 'capacidade_kg', type: 'text', inputmode: 'numeric', pattern: '[0-9.,]*', value: '', span: 'col6' })}
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
            ${formField({ label: 'Capacidade (kg)', name: 'capacidade_kg', type: 'text', inputmode: 'numeric', pattern: '[0-9.,]*', value: String(it.capacidade_kg ?? ''), span: 'col6' })}
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
        <td class="actions">
          <button class="btn small ghost" data-act="uedit" data-id="${u.id}">Editar</button>
          <button class="btn small ghost" data-act="upwd" data-id="${u.id}">Senha</button>
          <button class="btn small danger" data-act="udel" data-id="${u.id}">Excluir</button>
        </td>
        <td>${escapeHtml(u.username)}</td>
        <td>${escapeHtml(u.nome || '')}</td>
        <td>${escapeHtml(u.role)}</td>
        <td>${escapeHtml(String(u.active ? 'SIM' : 'NAO'))}</td>
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
            <thead><tr><th class="actions"></th><th>Usuario</th><th>Nome</th><th>Role</th><th>Ativo</th></tr></thead>
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
        <td class="actions">
          <button class="btn small ghost" data-act="edit" data-id="${it.id}">Editar</button>
          <button class="btn small danger" data-act="del" data-id="${it.id}">Excluir</button>
        </td>
        <td>${it.id}</td>
        <td>${escapeHtml(it.nome)}</td>
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
            <thead><tr><th class="actions"></th><th>ID</th><th>Nome</th></tr></thead>
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
  const destinoOptions = cache.destinos.map((d) => ({
    value: d.id,
    label: `${d.local}`,
  }))

  const rows = items
    .map((it) => {
      return `<tr>
        <td class="actions">
          <button class="btn small ghost" data-act="edit" data-id="${it.id}">Editar</button>
          <button class="btn small danger" data-act="del" data-id="${it.id}">Excluir</button>
        </td>
        <td>${it.id}</td>
        <td>${escapeHtml(it.safra_nome)}</td>
        <td data-sort="${escapeHtml(`${it.motorista_nome || ''} ${it.destino_local || ''} ${it.safra_nome || ''}`.trim())}">${escapeHtml(it.motorista_nome)}</td>
        <td data-sort="${escapeHtml(`${it.destino_local || ''} ${it.motorista_nome || ''} ${it.safra_nome || ''}`.trim())}">${escapeHtml(it.destino_local)}</td>
        <td>${fmtMoney(it.valor_por_saca)}</td>
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
            <thead><tr><th class="actions"></th><th>ID</th><th>Safra</th><th>Motorista</th><th>Destino</th><th>Valor por saca</th></tr></thead>
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
          ${formField({ label: 'Valor por saca (R$)', name: 'valor_por_saca', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: '4,50', span: 'col6' })}
        </div>`,
      onSubmit: async (obj) => {
        const valor = parseNumberPt(obj.valor_por_saca)
        if (!Number.isFinite(valor) || valor < 0) {
          toast('Erro', 'Valor por saca invalido.')
          return
        }
        await api('/api/fretes', {
          method: 'POST',
          body: {
            safra_id: Number(obj.safra_id),
            motorista_id: Number(obj.motorista_id),
            destino_id: Number(obj.destino_id),
            valor_por_saca: valor,
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
              <span style="opacity:.75">(Filtro por contrato removido: contrato fica nas regras do destino)</span>
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

      const rows = (cache.motoristas || []).filter((m) =>
        onlyMot ? motIds.has(Number(m.id)) : true,
      )

      const cols = (cache.destinos || []).filter((d) =>
        onlyDes ? desIds.has(Number(d.id)) : true,
      )

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
    // filtro por contrato foi removido (contrato agora fica nas regras do destino)
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

      const rows = (cache.motoristas || []).filter((m) =>
        onlyHas ? motIds.has(Number(m.id)) : true,
      )
      const cols = (cache.destinos || []).filter((d) =>
        onlyHas ? desIds.has(Number(d.id)) : true,
      )

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
              ${formField({ label: 'Valor por saca (R$)', name: 'valor_por_saca', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: fmtNum(Number(item.valor_por_saca ?? 0), 2), span: 'col6' })}
              <div class="field col12"><div class="hint">Ao salvar, o sistema recalcula o frete nas colheitas ja lancadas que baterem (safra, motorista, destino).</div></div>
            </div>`,
          onSubmit: async (obj) => {
            const valor = parseNumberPt(obj.valor_por_saca)
            if (!Number.isFinite(valor) || valor < 0) {
              toast('Erro', 'Valor por saca invalido.')
              return
            }
            await api('/api/fretes', {
              method: 'POST',
              body: {
                safra_id: Number(obj.safra_id),
                motorista_id: Number(obj.motorista_id),
                destino_id: Number(obj.destino_id),
                valor_por_saca: valor,
              },
            })
            toast('Atualizado', 'Frete atualizado. Use “Recalcular colheitas” para atualizar os calculos.')
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

  const hash = window.location.hash || ''
  const qs = hash.includes('?') ? hash.split('?')[1] : ''
  const params = new URLSearchParams(qs)
  const editId = Number(params.get('edit_id') || '')
  const isNew = String(params.get('new') || '') === '1'

  if (!isNew && !(Number.isFinite(editId) && editId > 0)) {
    const rules = await api('/api/destino-regras/plantio')

    setView(`
      <section class="panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">Regras do destino</div>
            <div class="panel-sub">Regras por safra + destino + plantio. Clique em editar para configurar tabelas.</div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn ghost" id="btnRecalcAll">Recalcular colheitas</button>
            <button class="btn" id="btnNovaRegra">Nova regra</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th class="actions"></th>
                  <th>Item</th>
                  <th>Safra</th>
                  <th>Destino</th>
                  <th>Plantio</th>
                  <th>Alteracao</th>
                  <th>Criacao</th>
                </tr>
              </thead>
              <tbody id="rulesBody">
                ${Array.isArray(rules) && rules.length ? '' : '<tr><td colspan="7">Nenhuma regra cadastrada.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `)

    const body = view.querySelector('#rulesBody')
    if (body && Array.isArray(rules) && rules.length) {
      body.innerHTML = rules
        .map((r) => {
          const id = Number(r.id)
          const safra = String(r.safra_nome || '')
          const destino = String(r.destino_local || '')
          const plantio = String(r.tipo_plantio || '')
          const upd = String(r.updated_at || '')
          const crt = String(r.created_at || '')
          return `<tr>
            <td class="actions">
              <button class="btn small ghost" data-act="edit" data-id="${id}">Editar</button>
              <button class="btn small danger" data-act="del" data-id="${id}">Excluir</button>
            </td>
            <td data-sort="${id}">${escapeHtml(String(id))}</td>
            <td data-sort="${escapeHtml(safra)}">${escapeHtml(safra)}</td>
            <td data-sort="${escapeHtml(destino)}">${escapeHtml(destino)}</td>
            <td data-sort="${escapeHtml(plantio)}"><code class="mono">${escapeHtml(plantio)}</code></td>
            <td data-sort="${escapeHtml(upd)}">${escapeHtml(upd || '-')}</td>
            <td data-sort="${escapeHtml(crt)}">${escapeHtml(crt || '-')}</td>
          </tr>`
        })
        .join('')
    }

    initTableSorting(view)

    const btnNova = view.querySelector('#btnNovaRegra')
    if (btnNova) {
      btnNova.onclick = () => {
        window.location.hash = '#/regras-destino?new=1'
      }
    }

    const btnRecalcAll = view.querySelector('#btnRecalcAll')
    if (btnRecalcAll) {
      btnRecalcAll.onclick = () => {
        const safraOptions2 = [{ value: '', label: 'Todas' }, ...cache.safras.map((s) => ({ value: s.id, label: s.safra }))]
        const destinoOptions2 = [{ value: '', label: 'Todos' }, ...cache.destinos.map((d) => ({ value: d.id, label: d.local }))]
        const plantioOptions2 = [{ value: '', label: 'Todos' }, ...cache.tiposPlantio.map((p) => ({ value: p.nome, label: p.nome }))]

        openDialog({
          title: 'Recalcular colheitas',
          submitLabel: 'Recalcular',
          bodyHtml: `
            <div class="hint">Recalcula todos os lancamentos no banco com base nas regras atuais (umidade/limites/custos/frete/contrato). Pode levar alguns segundos.</div>
            <div class="form-grid" style="margin-top:12px">
              ${selectField({ label: 'Safra', name: 'safra_id', options: safraOptions2, value: '', span: 'col4' })}
              ${selectField({ label: 'Destino', name: 'destino_id', options: destinoOptions2, value: '', span: 'col4' })}
              ${selectField({ label: 'Plantio', name: 'tipo_plantio', options: plantioOptions2, value: '', span: 'col4' })}
            </div>
            <div class="hint">Se houver erros (ex.: frete ou regra faltando), o sistema lista os primeiros 50.</div>
          `,
          onSubmit: async (obj) => {
            if (!(await confirmAction('Recalcular agora? Isto vai atualizar os campos calculados das colheitas.', { title: 'Confirmar', confirmLabel: 'Recalcular' }))) return
            const body = {}
            if (String(obj.safra_id || '').trim()) body.safra_id = Number(obj.safra_id)
            if (String(obj.destino_id || '').trim()) body.destino_id = Number(obj.destino_id)
            if (String(obj.tipo_plantio || '').trim()) body.tipo_plantio = String(obj.tipo_plantio).trim()

            const r = await api('/api/viagens/recalcular-todas', { method: 'POST', body })
            const msg = `Total: ${r.total} | Atualizadas: ${r.updated} | Ignoradas: ${r.skipped}`
            if (Number(r.errors_count || 0) > 0) {
              openDialog({
                title: 'Recalculo concluido (com erros)',
                submitLabel: 'Fechar',
                bodyHtml: `
                  <div>${escapeHtml(msg)}</div>
                  <div class="hint" style="margin-top:10px">Primeiros erros:</div>
                  <div class="table-wrap" style="margin-top:8px">
                    <table>
                      <thead><tr><th>ID</th><th>Ficha</th><th>Safra</th><th>Destino</th><th>Plantio</th><th>Erro</th></tr></thead>
                      <tbody>
                        ${(Array.isArray(r.errors) ? r.errors : [])
                          .map((e) => `<tr>
                            <td>${escapeHtml(String(e.id))}</td>
                            <td>${escapeHtml(String(e.ficha || ''))}</td>
                            <td>${escapeHtml(String(e.safra_id || ''))}</td>
                            <td>${escapeHtml(String(e.destino_id || ''))}</td>
                            <td>${escapeHtml(String(e.tipo_plantio || ''))}</td>
                            <td>${escapeHtml(String(e.message || ''))}</td>
                          </tr>`)
                          .join('')}
                      </tbody>
                    </table>
                  </div>
                `,
                onSubmit: async () => {},
              })
              return
            }
            toast('OK', msg)
          },
        })
      }
    }

    view.querySelectorAll('button[data-act="edit"]').forEach((b) => {
      b.onclick = () => {
        const id = Number(b.dataset.id)
        const r = (rules || []).find((x) => Number(x.id) === id)
        if (!r) return
        const qp = new URLSearchParams({
          edit_id: String(id),
        })
        window.location.hash = `#/regras-destino?${qp.toString()}`
      }
    })

    view.querySelectorAll('button[data-act="del"]').forEach((b) => {
      b.onclick = async () => {
        const id = Number(b.dataset.id)
        const r = (rules || []).find((x) => Number(x.id) === id)
        if (!r) return

        const msg = `Excluir a regra?\n\nSafra: ${r.safra_nome}\nDestino: ${r.destino_local}\nPlantio: ${r.tipo_plantio}`
        if (!(await confirmAction(msg, { title: 'Confirmar', confirmLabel: 'Excluir' }))) return

        try {
          await api(`/api/destino-regras/plantio/${id}`, { method: 'DELETE' })
          toast('Excluído', 'Regra removida.')
          renderRegrasDestino()
        } catch (e) {
          if (e?.details?.used_count) {
            const msg2 = `Esta regra ja foi usada na colheita (${e.details.used_count} registros).\n\nExcluir nao apaga as colheitas, mas pode afetar preview/indicadores.\n\nExcluir mesmo assim?`
            if (!(await confirmAction(msg2, { title: 'Atenção', confirmLabel: 'Excluir mesmo assim' }))) return
            await api(`/api/destino-regras/plantio/${id}?force=1`, { method: 'DELETE' })
            toast('Excluído', 'Regra removida.')
            renderRegrasDestino()
            return
          }
          throw e
        }
      }
    })

    return
  }

  const safraOptions = cache.safras.map((s) => ({ value: s.id, label: s.safra }))
  const destinoOptions = cache.destinos.map((d) => ({
    value: d.id,
    label: `${d.local}`,
  }))
  const plantioOptions = cache.tiposPlantio.map((p) => ({
    value: p.nome,
    label: p.nome,
  }))

  const prefer = cache.safras.find((s) => s.safra === '2025-2026')
  const safraId =
    Number(params.get('safra_id') || '') || prefer?.id || safraOptions[0]?.value
  const destinoId =
    Number(params.get('destino_id') || '') || destinoOptions[0]?.value
  const tipoDefault = String(params.get('tipo_plantio') || '').trim()

  setView(`
    <section class="panel">
      <div class="panel-head">
           <div>
             <div class="panel-title">Regras do destino (por safra)</div>
           <div class="panel-sub">Limites de qualidade e tabela de umidade.</div>
           </div>
           <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn ghost" id="btnBackRules">Voltar</button>
          <button class="btn ghost" id="btnCopyRule">Copiar regras</button>
          <button class="btn" id="btnSalvar">Salvar</button>
        </div>
      </div>
      <div class="panel-body">
        <form class="form-grid rule-form" id="ruleForm">
          ${selectField({ label: 'Safra', name: 'safra_id', options: safraOptions, value: safraId, span: 'col6' })}
          ${selectField({ label: 'Destino', name: 'destino_id', options: destinoOptions, value: destinoId, span: 'col6' })}

           ${selectField({ label: 'Tipo plantio', name: 'tipo_plantio', options: plantioOptions, value: tipoDefault || plantioOptions[0]?.value || '', span: 'col6' })}

           <div class="field col6" style="align-self:end">
             <div class="label">Status</div>
             <div class="hint" id="ruleIdentityHint">${escapeHtml(isNew ? 'Nova regra' : `Editando regra #${editId}`)}</div>
           </div>

           <div class="field col12">
             <div class="label">Contrato(s) com o silo</div>
             <div class="hint">Adicione uma ou mais travas (ex: 10.000 sc a 120 + 5.000 sc a 130). A entrega vai abatendo em ordem.</div>
             <div class="table-wrap rule-wrap" style="margin-top:8px">
               <table>
                 <thead><tr><th class="actions"></th><th>Sacas</th><th>Preco travado (R$/sc)</th></tr></thead>
                 <tbody id="contratoFaixas"></tbody>
               </table>
             </div>
             <div style="margin-top:10px;display:flex;gap:10px;justify-content:flex-end">
               <button class="btn ghost" type="button" id="btnAddContrato">Adicionar contrato</button>
             </div>
           </div>

            <div class="field col12">
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
                <thead><tr><th class="actions"></th><th>Umid (&gt;)</th><th>Umid (&lt;=)</th><th>Desconto (%)</th><th>Secagem (R$/sc)</th></tr></thead>
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
  const contratoEl = view.querySelector('#contratoFaixas')
  const btnSalvar = view.querySelector('#btnSalvar')
  const btnAddFaixa = view.querySelector('#btnAddFaixa')
  const btnAddContrato = view.querySelector('#btnAddContrato')
  const btnCopyRule = view.querySelector('#btnCopyRule')
  const btnBackRules = view.querySelector('#btnBackRules')

  const identityHint = view.querySelector('#ruleIdentityHint')
  let conflictBlock = false
  let currentUsedCount = 0
  const currentId = !isNew && Number.isFinite(editId) && editId > 0 ? editId : null

  if (btnBackRules) {
    btnBackRules.onclick = () => {
      window.location.hash = '#/regras-destino'
    }
  }

  function faixaRow(f = { umid_gt: '', umid_lte: '', desconto_pct: '' }) {
    return `<tr>
      <td class="actions"><button class="btn small danger" type="button" data-act="rm">Remover</button></td>
      <td style="width:90px"><input type="text" inputmode="decimal" pattern="[0-9.,]*" name="umid_gt" value="${escapeHtml(f.umid_gt)}" /></td>
      <td style="width:90px"><input type="text" inputmode="decimal" pattern="[0-9.,]*" name="umid_lte" value="${escapeHtml(f.umid_lte)}" /></td>
      <td style="width:110px"><input type="text" inputmode="decimal" pattern="[0-9.,]*" name="desconto_pct" value="${escapeHtml(f.desconto_pct)}" /></td>
      <td style="width:120px"><input type="text" inputmode="decimal" pattern="[0-9.,]*" name="custo_secagem_por_saca" value="${escapeHtml(f.custo_secagem_por_saca ?? '')}" /></td>
    </tr>`
  }

  function bindFaixaRemove() {
    faixasEl.querySelectorAll('[data-act="rm"]').forEach((b) => {
      b.onclick = () => {
        b.closest('tr')?.remove()
      }
    })
  }

  function contratoRow(f = { sacas: '', preco_por_saca: '' }) {
    return `<tr>
      <td class="actions"><button class="btn small danger" type="button" data-act="rm-contrato">Remover</button></td>
      <td style="width:160px"><input type="text" inputmode="decimal" pattern="[0-9.,]*" name="ct_sacas" value="${escapeHtml(f.sacas)}" /></td>
      <td style="width:160px"><input type="text" inputmode="decimal" pattern="[0-9.,]*" name="ct_preco" value="${escapeHtml(f.preco_por_saca)}" /></td>
    </tr>`
  }

  function bindContratoRemove() {
    contratoEl?.querySelectorAll('[data-act="rm-contrato"]').forEach((b) => {
      b.onclick = () => b.closest('tr')?.remove()
    })
  }

  const checkConflict = debounce(async () => {
    conflictBlock = false
    if (!identityHint) return
    if (!currentId) {
      identityHint.textContent = 'Nova regra'
      if (btnSalvar) btnSalvar.disabled = false
      return
    }
    const fd = new FormData(form)
    const safra_id = Number(fd.get('safra_id'))
    const destino_id = Number(fd.get('destino_id'))
    const tipo_plantio = String(fd.get('tipo_plantio') || '').trim()
    if (!tipo_plantio) {
      identityHint.textContent = `Editando regra #${currentId}`
      if (btnSalvar) btnSalvar.disabled = false
      return
    }
    const qp = new URLSearchParams({
      safra_id: String(safra_id),
      destino_id: String(destino_id),
      tipo_plantio,
    })
    const exists = await api(`/api/destino-regras/one?${qp.toString()}`)
    if (exists && Number(exists.id) !== Number(currentId)) {
      conflictBlock = true
      identityHint.textContent = `Conflito: ja existe regra #${exists.id} para esta combinacao (nao pode duplicar).`
      if (btnSalvar) btnSalvar.disabled = true
      return
    }
    identityHint.textContent = `Editando regra #${currentId}`
    if (btnSalvar) btnSalvar.disabled = false
  }, 250)

  async function load() {
    let regra
    if (currentId) {
      regra = await api(`/api/destino-regras/plantio/${currentId}`)
      // fixar a identidade ao id carregado (nao alternar registro durante edicao)
      form.safra_id.value = String(regra.safra_id)
      form.destino_id.value = String(regra.destino_id)
      form.tipo_plantio.value = String(regra.tipo_plantio || '')

      const used = Number(regra?.used_count || 0)
      currentUsedCount = used
      if (used > 0) {
        if (identityHint) {
          identityHint.textContent = `Bloqueada: regra ja usada em ${used} registro(s) de colheita.`
        }

        // Bloquear edicao da regra, mas permitir alterar o contrato.
        if (btnSalvar) {
          btnSalvar.disabled = false
          btnSalvar.textContent = 'Salvar contrato'
        }
        form.querySelectorAll('input,select,textarea').forEach((el) => {
          const name = String(el.getAttribute('name') || '')
          const isContrato = name === 'ct_sacas' || name === 'ct_preco'
          el.disabled = !isContrato
        })

        // Desabilitar botoes de faixas de umidade; manter contrato
        if (btnAddFaixa) btnAddFaixa.disabled = true
        if (btnAddContrato) btnAddContrato.disabled = false
        toast(
          'Atenção',
          'Esta regra de destino ja esta sendo utilizada em registros de colheita. Alteracoes podem comprometer calculos historicos.',
        )
      } else {
        if (identityHint) identityHint.textContent = `Editando regra #${currentId}`
        if (btnSalvar) {
          btnSalvar.disabled = false
          btnSalvar.textContent = 'Salvar'
        }

        // re-habilitar campos (caso tenha mudado de regra via navegação)
        form.querySelectorAll('input,select,textarea').forEach((el) => {
          el.disabled = false
        })
        if (btnAddFaixa) btnAddFaixa.disabled = false
      }
    } else {
      const fd = new FormData(form)
      const safra_id = Number(fd.get('safra_id'))
      const destino_id = Number(fd.get('destino_id'))
      const tipo_plantio = String(fd.get('tipo_plantio') || '')
      const qp = new URLSearchParams({
        safra_id: String(safra_id),
        destino_id: String(destino_id),
      })
      qp.set('tipo_plantio', tipo_plantio)
      regra = await api(`/api/destino-regras/one?${qp.toString()}`)
      if (identityHint) identityHint.textContent = 'Nova regra'
      currentUsedCount = 0
      if (btnSalvar) btnSalvar.textContent = 'Salvar'
    }

    // contrato e entidade separada (pode ter varias faixas)
    const contrato = await api(
      `/api/contratos-silo/one?${new URLSearchParams({
        safra_id: String(regra?.safra_id ?? Number(new FormData(form).get('safra_id'))),
        destino_id: String(regra?.destino_id ?? Number(new FormData(form).get('destino_id'))),
        tipo_plantio: String(regra?.tipo_plantio ?? String(new FormData(form).get('tipo_plantio') || '')),
      }).toString()}`,
    )

    if (contratoEl) {
      const faixas = Array.isArray(contrato?.faixas) ? contrato.faixas : []
      contratoEl.innerHTML = faixas.length
        ? faixas
            .map((f) =>
              contratoRow({
                sacas: fmtNum(Number(f.sacas || 0), 2),
                preco_por_saca: fmtNum(Number(f.preco_por_saca || 0), 2),
              }),
            )
            .join('')
        : `<tr><td colspan="3" class="hint">Sem contrato cadastrado.</td></tr>`
      bindContratoRemove()
    }

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

  if (currentId) {
    form.safra_id.onchange = () => checkConflict()
    form.destino_id.onchange = () => checkConflict()
    form.tipo_plantio.onchange = () => checkConflict()
  } else {
    form.safra_id.onchange = load
    form.destino_id.onchange = load
    form.tipo_plantio.onchange = load
  }

  btnAddFaixa.onclick = () => {
    if (faixasEl.textContent.includes('Nenhuma faixa')) faixasEl.innerHTML = ''
    faixasEl.insertAdjacentHTML('beforeend', faixaRow())
    bindFaixaRemove()
  }

  if (btnAddContrato) {
    btnAddContrato.onclick = () => {
      if (!contratoEl) return
      if (contratoEl.textContent.includes('Sem contrato')) contratoEl.innerHTML = ''
      contratoEl.insertAdjacentHTML('beforeend', contratoRow())
      bindContratoRemove()
    }
  }

  btnSalvar.onclick = async () => {
    if (conflictBlock) {
      toast('Erro', 'Ja existe regra para esta combinacao (nao pode duplicar).')
      return
    }
    const fd = new FormData(form)
    // Ler identidade direto do form (mesmo se campos estiverem disabled)
    const safra_id = Number(form.querySelector('[name="safra_id"]')?.value)
    const destino_id = Number(form.querySelector('[name="destino_id"]')?.value)
    const tipo_plantio = String(form.querySelector('[name="tipo_plantio"]')?.value || '')

    // contratos (faixas) - sempre permitido
    const contrato_faixas = []
    if (contratoEl) {
      contratoEl.querySelectorAll('tr').forEach((tr) => {
        const inputs = tr.querySelectorAll('input')
        if (inputs.length < 2) return
        const sacas = parseNumberPt(inputs[0].value)
        const preco = parseNumberPt(inputs[1].value)
        if (!Number.isFinite(sacas) || sacas <= 0) return
        if (!Number.isFinite(preco) || preco < 0) return
        contrato_faixas.push({ sacas, preco_por_saca: preco })
      })
    }

    // Se a regra estiver em uso, salvar SOMENTE o contrato.
    if (currentUsedCount > 0) {
      await api('/api/contratos-silo', {
        method: 'POST',
        body: { safra_id, destino_id, tipo_plantio, faixas: contrato_faixas, observacoes: null },
      })

      // Recalcular para refletir o novo contrato nos valores materializados
      try {
        const recalc = await api('/api/viagens/recalcular-todas', {
          method: 'POST',
          body: { safra_id, destino_id, tipo_plantio },
        })
        if (Number(recalc?.errors_count || 0) > 0) {
          openDialog({
            title: 'Recalculo concluido (com erros)',
            submitLabel: 'Fechar',
            bodyHtml: `
              <div>Total: ${escapeHtml(String(recalc.total))} | Atualizadas: ${escapeHtml(String(recalc.updated))} | Ignoradas: ${escapeHtml(String(recalc.skipped))}</div>
              <div class="hint" style="margin-top:10px">Primeiros erros:</div>
              <div class="table-wrap" style="margin-top:8px">
                <table>
                  <thead><tr><th>ID</th><th>Ficha</th><th>Safra</th><th>Destino</th><th>Plantio</th><th>Erro</th></tr></thead>
                  <tbody>
                    ${(Array.isArray(recalc.errors) ? recalc.errors : [])
                      .map((e) => `<tr>
                        <td>${escapeHtml(String(e.id))}</td>
                        <td>${escapeHtml(String(e.ficha || ''))}</td>
                        <td>${escapeHtml(String(e.safra_id || ''))}</td>
                        <td>${escapeHtml(String(e.destino_id || ''))}</td>
                        <td>${escapeHtml(String(e.tipo_plantio || ''))}</td>
                        <td>${escapeHtml(String(e.message || ''))}</td>
                      </tr>`)
                      .join('')}
                  </tbody>
                </table>
              </div>
            `,
            onSubmit: async () => {},
          })
        } else {
          toast('OK', `Contrato salvo e recalculado: ${recalc.updated}/${recalc.total} colheitas.`)
        }
      } catch {
        toast('Salvo', 'Contrato atualizado. (Nao foi possivel recalcular automaticamente.)')
      }

      load()
      return
    }

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

    const payload = {
      safra_id,
      destino_id,
      tipo_plantio,
      custo_silo_por_saca: numOr0(fd.get('custo_silo_por_saca')),
      custo_terceiros_por_saca: numOr0(fd.get('custo_terceiros_por_saca')),
      impureza_limite_pct: numOr0(fd.get('impureza_limite_pct')),
      ardidos_limite_pct: numOr0(fd.get('ardidos_limite_pct')),
      queimados_limite_pct: numOr0(fd.get('queimados_limite_pct')),
      avariados_limite_pct: numOr0(fd.get('avariados_limite_pct')),
      esverdiados_limite_pct: numOr0(fd.get('esverdiados_limite_pct')),
      quebrados_limite_pct: numOr0(fd.get('quebrados_limite_pct')),
      umidade_faixas: faixas,
    }

    try {
      if (currentId) {
        await api(`/api/destino-regras/plantio/${currentId}`, {
          method: 'PUT',
          body: payload,
        })
      } else {
        await api('/api/destino-regras', {
          method: 'POST',
          body: payload,
        })
      }

      await api('/api/contratos-silo', {
        method: 'POST',
        body: {
          safra_id,
          destino_id,
          tipo_plantio,
          faixas: contrato_faixas,
          observacoes: null,
        },
      })

      // Recalcular colheitas para refletir regras/regras de negocio atualizadas
      let recalc
      try {
        recalc = await api('/api/viagens/recalcular-todas', {
          method: 'POST',
          body: { safra_id, destino_id, tipo_plantio },
        })
      } catch {
        toast('Salvo', 'Regras salvas, mas nao foi possivel recalcular as colheitas automaticamente.')
        load()
        return
      }

      if (Number(recalc?.errors_count || 0) > 0) {
        openDialog({
          title: 'Recalculo concluido (com erros)',
          submitLabel: 'Fechar',
          bodyHtml: `
            <div>Total: ${escapeHtml(String(recalc.total))} | Atualizadas: ${escapeHtml(String(recalc.updated))} | Ignoradas: ${escapeHtml(String(recalc.skipped))}</div>
            <div class="hint" style="margin-top:10px">Primeiros erros:</div>
            <div class="table-wrap" style="margin-top:8px">
              <table>
                <thead><tr><th>ID</th><th>Ficha</th><th>Safra</th><th>Destino</th><th>Plantio</th><th>Erro</th></tr></thead>
                <tbody>
                  ${(Array.isArray(recalc.errors) ? recalc.errors : [])
                    .map((e) => `<tr>
                      <td>${escapeHtml(String(e.id))}</td>
                      <td>${escapeHtml(String(e.ficha || ''))}</td>
                      <td>${escapeHtml(String(e.safra_id || ''))}</td>
                      <td>${escapeHtml(String(e.destino_id || ''))}</td>
                      <td>${escapeHtml(String(e.tipo_plantio || ''))}</td>
                      <td>${escapeHtml(String(e.message || ''))}</td>
                    </tr>`)
                    .join('')}
                </tbody>
              </table>
            </div>
          `,
          onSubmit: async () => {},
        })
      } else {
        toast('OK', `Salvo e recalculado: ${recalc.updated}/${recalc.total} colheitas.`)
      }

      load()
    } catch (e) {
      if (e?.details?.code === 'REGRA_DESTINO_EM_USO') {
        openDialog({
          title: 'Edicao bloqueada (regra em uso)',
          submitLabel: 'Entendi',
          bodyHtml: `
            <div>${escapeHtml(String(e.message || 'Edicao bloqueada.')).replace(/\n/g, '<br/>')}</div>
            <div class="hint" style="margin-top:10px">
              Fluxo seguro sugerido:
              <ol style="margin:8px 0 0 18px">
                ${(Array.isArray(e.details.fluxo_seguro) ? e.details.fluxo_seguro : [])
                  .map((s) => `<li>${escapeHtml(String(s))}</li>`)
                  .join('')}
              </ol>
            </div>
          `,
          onSubmit: async () => {},
        })
        return
      }
      toast('Erro', String(e?.message || e))
    }
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
          prev?.querySelectorAll('#copyUmidBody tr').forEach((tr) => {
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
              <tbody id="copyUmidBody">${bodyRows}</tbody>
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

            <div class="field">
              <div class="label">Visualização</div>
              <select name="view">
                <option value="grouped">Agrupada</option>
                <option value="flat">Separada</option>
              </select>
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
                <th class="actions"></th>
                <th>Ficha</th>
                <th>Safra</th>
                <th>Talhão</th>
                <th>Local</th>
                <th>%</th>
                <th>Destino</th>
                <th>Saída</th>
                <th>Motorista</th>
                <th>Umidade %</th>
                <th>Peso bruto</th>
                <th>Peso limpo e seco</th>
                <th>Desconto %</th>
                <th>Sacas</th>
                <th>Frete</th>
                <th>Compra (Silo)</th>
                <th>Silo (líquida)</th>
                <th>Terceiros (ideal)</th>
              </tr>
            </thead>
                <tbody id="tbody"><tr><td colspan="18">Carregando...</td></tr></tbody>
          </table>
        </div>
      </div>
    </section>
  `)

  const tbody = view.querySelector('#tbody')
  const totalsEl = view.querySelector('#totals')
  const filtersEl = view.querySelector('#filtersForm')

  // Persistir visualizacao (rateio)
  const selView = filtersEl?.querySelector('select[name="view"]')
  if (selView) {
    const saved = localStorage.getItem('colheita_view')
    if (saved === 'flat' || saved === 'grouped') selView.value = saved
    selView.onchange = () => {
      localStorage.setItem('colheita_view', selView.value)
      refreshList()
    }
  }

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
    const viewMode = String(data?.view || q.get('view') || 'legacy')

    const t = data.totals

    const rowsCount = Array.isArray(data.items) ? data.items.length : 0
    const uniqueCount = new Set((data.items || []).map((it) => Number(it.id))).size
    const countHint = uniqueCount !== rowsCount ? `Linhas (rateio): ${rowsCount}` : `Linhas: ${rowsCount}`
    totalsEl.innerHTML = `
      <div class="stat span4"><div class="stat-k">Peso bruto</div><div class="stat-v">${fmtKg(t.peso_bruto_kg)}</div><div class="stat-h">Base da pesagem</div></div>
      <div class="stat span4"><div class="stat-k">Peso limpo e seco</div><div class="stat-v">${fmtKg(t.peso_limpo_seco_kg)}</div><div class="stat-h">Liquido apos descontos</div></div>
      <div class="stat span4"><div class="stat-k">Sacas (filtrado)</div><div class="stat-v">${fmtNum(t.sacas, 2)}</div><div class="stat-h">Peso limpo e seco / 60</div></div>
      <div class="stat span4"><div class="stat-k">Frete (filtrado)</div><div class="stat-v">${fmtMoney(t.sub_total_frete)}</div><div class="stat-h">Peso bruto (sacas) x tabela</div></div>
      <div class="stat span4"><div class="stat-k">Registros</div><div class="stat-v">${uniqueCount}</div><div class="stat-h">${escapeHtml(countHint)}</div></div>
    `

    const expanded = new Set()

    const rowHtml = (v, opts = {}) => {
      const isChild = Boolean(opts.isChild)
      const showToggle = Boolean(opts.showToggle)
      const toggled = Boolean(opts.toggled)

      const umidRaw = Number(v.umidade_pct)
      const umid = Number.isFinite(umidRaw) && umidRaw > 1 ? umidRaw / 100 : umidRaw
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

      const saida = String(v.data_saida || '').trim()

      const valorCompraApplied = Number(v.valor_compra_por_saca_aplicado)
      const valorCompraRule =
        v.regra_valor_compra_por_saca === null || v.regra_valor_compra_por_saca === undefined
          ? null
          : Number(v.regra_valor_compra_por_saca)

      const valorCompra = Number.isFinite(valorCompraApplied)
        ? valorCompraApplied
        : Number.isFinite(valorCompraRule)
          ? valorCompraRule
          : null

      const sacas = Number(v.sacas || 0)
      const fretePorSaca = sacas > 0 ? Number(v.sub_total_frete || 0) / sacas : 0
      const secagemPorSaca = Number(v.secagem_custo_por_saca || 0)
      const custoSiloPorSaca = Number(v.custo_silo_por_saca || 0)
      const custoTercPorSaca = Number(v.custo_terceiros_por_saca || 0)

      const compraSilo = valorCompra !== null && Number.isFinite(valorCompra) ? valorCompra : null
      const siloLiquida =
        compraSilo === null
          ? null
          : compraSilo - (fretePorSaca + secagemPorSaca + custoSiloPorSaca)
      const terceirosIdeal = compraSilo === null ? null : compraSilo + custoTercPorSaca

      const fichaDisp = v.display_ficha ? String(v.display_ficha) : String(v.ficha || '')
      const isRateado = Boolean(v.is_rateado)
      const badge = isRateado
        ? `<span class="pill" style="margin-left:8px"><span class="dot warn"></span><span>Rateado</span></span>`
        : ''

      const pct =
        v.pct_rateio_100 === null || v.pct_rateio_100 === undefined
          ? null
          : Number(v.pct_rateio_100)

      const toggleBtn = showToggle
        ? `<button class="btn small ghost" data-act="toggle" data-id="${v.id}">${toggled ? '▼' : '▶'}</button>`
        : ''

      const actionCell = isChild
        ? `<td class="actions">${toggleBtn}<button class="btn small ghost" data-act="edit" data-id="${v.id}" data-rateio-index="${v.rateio_index}">Editar</button></td>`
        : `<td class="actions">${toggleBtn}<button class="btn small ghost" data-act="edit" data-id="${v.id}" ${v.rateio_index !== undefined ? `data-rateio-index="${v.rateio_index}"` : ''}>Editar</button>
            <button class="btn small danger" data-act="del" data-id="${v.id}">Excluir</button>
          </td>`

      const childAttrs = isChild ? ` data-parent="${v.id}" style="${expanded.has(v.id) ? '' : 'display:none'}"` : ''

      return `<tr class="${humClass}${isChild ? ' rateio-child' : ''}"${childAttrs}>
        ${actionCell}
        <td data-sort="${escapeHtml(String(v.ficha_original || v.ficha || ''))}"><code class="mono">${escapeHtml(fichaDisp)}</code>${badge}</td>
        <td>${escapeHtml(v.safra_nome || '')}</td>
        <td>${escapeHtml(v.talhao_nome || '')}</td>
        <td>${escapeHtml(v.talhao_local || '')}</td>
        <td>${pct === null || !Number.isFinite(pct) ? '-' : `${fmtNum(pct, 2)}%`}</td>
        <td>${escapeHtml(v.destino_local || '')}</td>
        <td data-sort="${escapeHtml(saida)}">${escapeHtml(saida || '-')}</td>
        <td>${escapeHtml(v.motorista_nome || '')}</td>
        <td>${Number.isFinite(umid) ? `${fmtNum(umid * 100, 2)}%` : '-'}</td>
        <td>${fmtKg(v.peso_bruto_kg)}</td>
        <td>${fmtKg(v.peso_limpo_seco_kg)}</td>
        <td>${fmtNum(descPct, 2)}%</td>
        <td>${fmtNum(v.sacas, 2)}</td>
        <td>${fmtMoney(v.sub_total_frete)}</td>
        <td>${compraSilo === null ? '-' : fmtMoney(compraSilo)}</td>
        <td>${siloLiquida === null ? '-' : fmtMoney(siloLiquida)}</td>
        <td>${terceirosIdeal === null ? '-' : fmtMoney(terceirosIdeal)}</td>
      </tr>`
    }

    if (viewMode === 'grouped') {
      const parts = []
      for (const g of data.items || []) {
        const isRateado = Boolean(g.is_rateado)
        if (isRateado) expanded.add(g.id)
        const kids = Array.isArray(g.children) ? g.children : []
        const shortTal = kids
          .slice(0, 3)
          .map((x) => x.talhao_nome)
          .filter(Boolean)
          .join(', ')
        const more = kids.length > 3 ? ` +${kids.length - 3}` : ''
        const parent = {
          ...g,
          talhao_nome: isRateado ? `Rateado (${g.rateio_count || kids.length})` : (kids[0]?.talhao_nome || ''),
          talhao_local: isRateado ? `${shortTal}${more}` : (kids[0]?.talhao_local || ''),
          pct_rateio_100: null,
        }
        parts.push(rowHtml(parent, { showToggle: isRateado, toggled: isRateado }))
        if (isRateado) {
          for (const c of kids) {
            parts.push(rowHtml({
              ...c,
              safra_nome: g.safra_nome,
              destino_local: g.destino_local,
              motorista_nome: g.motorista_nome,
            }, { isChild: true }))
          }
        }
      }
      tbody.innerHTML = parts.join('')
    } else if (viewMode === 'flat') {
      tbody.innerHTML = (data.items || []).map((v) => rowHtml(v)).join('')
    } else {
      // legacy
      tbody.innerHTML = (data.items || []).map((v) => rowHtml({
        ...v,
        display_ficha: v.ficha,
        ficha_original: v.ficha,
        pct_rateio_100: null,
        is_rateado: false,
      })).join('')
    }

    if (!data.items.length) tbody.innerHTML = `<tr><td colspan="18">Nenhuma viagem.</td></tr>`

    tbody.querySelectorAll('[data-act]').forEach((btn) => {
      btn.onclick = async () => {
        const id = Number(btn.dataset.id)
        const act = btn.dataset.act
        if (act === 'toggle') {
          if (expanded.has(id)) {
            expanded.delete(id)
            btn.textContent = '▶'
            tbody.querySelectorAll(`tr[data-parent="${id}"]`).forEach((tr) => {
              tr.style.display = 'none'
            })
          } else {
            expanded.add(id)
            btn.textContent = '▼'
            tbody.querySelectorAll(`tr[data-parent="${id}"]`).forEach((tr) => {
              tr.style.display = ''
            })
          }
          return
        }
        if (act === 'del') {
          if (!(await confirmDanger(`Excluir a viagem #${id}?`))) return
          await api(`/api/viagens/${id}`, { method: 'DELETE' })
          toast('Excluída', 'Viagem removida.')
          refreshList()
          return
        }
        if (act === 'edit') {
          const full = await api(`/api/viagens/${id}`)
          const rix = btn.dataset.rateioIndex
          const focusRateioIndex = rix === undefined ? null : Number(rix)
          openViagemDialog({ mode: 'edit', viagem: full, focusRateioIndex })
        }
      }
    })
  }

  view.querySelector('#btnApply').onclick = refreshList
  view.querySelector('#btnAdd').onclick = () => openViagemDialog({ mode: 'create' })
  await refreshList()

  function openViagemDialog({ mode, viagem, focusRateioIndex = null }) {
    dlg.dataset.variant = variant || ''
    if (variant === 'rev01') {
      // evitar "sumir" os calculos entre aberturas do dialog
      dlg.dataset.previewCollapsed = '0'
    }
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

          // Campos calculados (somente visual - nao editar)
          calc_peso_bruto_kg: Number.isFinite(Number(viagem.peso_bruto_kg))
            ? fmtNum(Number(viagem.peso_bruto_kg), 0)
            : '',
          calc_umidade_kg: Number.isFinite(Number(viagem.umidade_kg))
            ? fmtNum(Number(viagem.umidade_kg), 0)
            : '',
          calc_peso_limpo_seco_kg: Number.isFinite(Number(viagem.peso_limpo_seco_kg))
            ? fmtNum(Number(viagem.peso_limpo_seco_kg), 0)
            : '',
          calc_sacas: Number.isFinite(Number(viagem.sacas))
            ? fmtNum(Number(viagem.sacas), 2)
            : '',

          calc_impureza_kg: Number.isFinite(Number(viagem.impureza_kg))
            ? fmtNum(Number(viagem.impureza_kg), 0)
            : '',
          calc_ardidos_kg: Number.isFinite(Number(viagem.ardidos_kg))
            ? fmtNum(Number(viagem.ardidos_kg), 0)
            : '',
          calc_queimados_kg: Number.isFinite(Number(viagem.queimados_kg))
            ? fmtNum(Number(viagem.queimados_kg), 0)
            : '',
          calc_avariados_kg: Number.isFinite(Number(viagem.avariados_kg))
            ? fmtNum(Number(viagem.avariados_kg), 0)
            : '',
          calc_esverdiados_kg: Number.isFinite(Number(viagem.esverdiados_kg))
            ? fmtNum(Number(viagem.esverdiados_kg), 0)
            : '',
          calc_quebrados_kg: Number.isFinite(Number(viagem.quebrados_kg))
            ? fmtNum(Number(viagem.quebrados_kg), 0)
            : '',
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

      // Campos calculados (somente visual - nao editar)
      calc_peso_bruto_kg: '-',
      calc_umidade_kg: '-',
      calc_peso_limpo_seco_kg: '-',
      calc_sacas: '-',

      calc_impureza_kg: '-',
      calc_ardidos_kg: '-',
      calc_queimados_kg: '-',
      calc_avariados_kg: '-',
      calc_esverdiados_kg: '-',
      calc_quebrados_kg: '-',
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
      size: 'wide',
      bodyHtml: `
        ${
          variant === 'rev01'
            ? `<div id="preview"><div class="hint">Preencha os campos para ver o calculo (preview).</div></div>`
            : ''
        }
        <div class="form-grid" id="vForm">
          ${sectionTitle('Identificacao')}
          ${formField({ label: 'Ficha', name: 'ficha', value: base.ficha, placeholder: '001', span: 'col2' })}
          ${selectField({ label: 'Safra', name: 'safra_id', options: safraOpts, value: base.safra_id, span: 'col3' })}
          ${selectField({ label: 'Plantio', name: 'tipo_plantio', options: plantioOpts, value: plantioValue, span: 'col2' })}
          ${formField({ label: 'Local', name: 'local', value: base.local ?? '', placeholder: '', span: 'col2' })}
          ${selectField({ label: 'Destino', name: 'destino_id', options: destinoOpts, value: base.destino_id, span: 'col3' })}

          ${sectionTitle('Rateio de talhoes')}
          <div class="field col12">
            <div class="rateio-card">
              <div class="rateio-head">
                <div>
                  <div class="rateio-title">Rateio de talhoes</div>
                  <div class="rateio-sub">Use % antes do peso bruto; quando houver peso bruto, o sistema calcula/ajusta kg e valida o fechamento.</div>
                </div>
                <div class="rateio-actions">
                  <div class="mini">
                    <div class="label">Ordenar</div>
                    <select name="talhao_sort">
                      <option value="nome" selected>Por nome</option>
                      <option value="local">Por local</option>
                    </select>
                  </div>
                  <button class="btn ghost small" type="button" id="btnAddTalhao">Adicionar</button>
                  <button class="btn ghost small" type="button" id="btnFillRest">Restante</button>
                </div>
              </div>
              <div class="rateio-grid rateio-header">
                <div>Talhão</div>
                <div>%</div>
                <div>kg</div>
                <div></div>
              </div>
              <div id="rateioTalhoes" class="rateio-body"></div>
              <div class="rateio-foot">
                <div id="rateioInfo"></div>
              </div>
            </div>
          </div>

          ${sectionTitle('Motorista')}
          ${selectField({ label: 'Motorista', name: 'motorista_id', options: motoristaOpts, value: base.motorista_id, span: 'col6' })}

          ${sectionTitle('Contrato e regras do destino')}
          <div class="field col12">
            <div class="label">Contrato do destino</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
              <span class="pill"><span class="dot" id="travaDot"></span><span id="travaStatus">Carregando...</span></span>
              <span class="pill"><span class="dot"></span><span>Entregue: <b id="travaEntregue">-</b> sc</span></span>
              <span class="pill"><span class="dot"></span><span>Contrato: <b id="travaLimite">-</b> sc</span></span>
              <span class="pill"><span class="dot"></span><span>Restante: <b id="travaRestante">-</b> sc</span></span>
              <span class="pill"><span class="dot"></span><span>Na carga: <b id="travaDentro">-</b> sc dentro | <b id="travaFora">-</b> sc fora</span></span>
              <span class="pill"><span class="dot" id="regraDot"></span><span id="regraInfo">Carregando regras...</span></span>
            </div>
            <div class="hint">Regras e limites sao carregados por destino + safra. Se voce alterar algum limite, o campo fica amarelo.</div>
          </div>

          ${formField({ label: 'Impureza limite %', name: 'impureza_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.impureza_limite_pct ?? '0.00', span: 'col2' })}
          ${formField({ label: 'Ardidos limite %', name: 'ardidos_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.ardidos_limite_pct ?? '0.00', span: 'col2' })}
          ${formField({ label: 'Queimados limite %', name: 'queimados_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.queimados_limite_pct ?? '0.00', span: 'col2' })}
          ${formField({ label: 'Avariados limite %', name: 'avariados_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.avariados_limite_pct ?? '0.00', span: 'col2' })}
          ${formField({ label: 'Esverdiados limite %', name: 'esverdiados_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.esverdiados_limite_pct ?? '0.00', span: 'col2' })}
          ${formField({ label: 'Quebrados limite %', name: 'quebrados_limite_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.quebrados_limite_pct ?? '0.00', span: 'col2' })}

          ${sectionTitle('Transporte')}
          ${formField({ label: 'Placa', name: 'placa', value: base.placa ?? '', placeholder: 'AAA0A00', span: 'col3' })}
          ${formField({ label: 'Data saida', name: 'data_saida', type: 'date', value: base.data_saida ?? '', span: 'col3' })}
          ${formField({ label: 'Hora saida', name: 'hora_saida', type: 'time', value: base.hora_saida ?? '', span: 'col2' })}
          ${formField({ label: 'Data entrega', name: 'data_entrega', type: 'date', value: base.data_entrega ?? '', span: 'col2' })}
          ${formField({ label: 'Hora entrega', name: 'hora_entrega', type: 'time', value: base.hora_entrega ?? '', span: 'col2' })}

          ${sectionTitle('Pesagem')}
          ${formField({ label: 'Carga total (kg)', name: 'carga_total_kg', type: 'text', inputmode: 'numeric', pattern: '[0-9.,]*', value: base.carga_total_kg, span: 'col4' })}
          ${formField({ label: 'Tara (kg)', name: 'tara_kg', type: 'text', inputmode: 'numeric', pattern: '[0-9.,]*', value: base.tara_kg, span: 'col4' })}
          ${formField({ label: `Peso bruto (kg) ${helpTip('Calculado: carga total - tara.')}`, name: 'calc_peso_bruto_kg', type: 'text', value: base.calc_peso_bruto_kg ?? '', span: 'col4', readonly: true })}

          ${sectionTitle('Umidade')}
          ${formField({ label: `Umidade % ${helpTip('Valor informado pela amostra do silo (laboratorio).')}`, name: 'umidade_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.umidade_pct, span: 'col4' })}
          ${formField({ label: `Desconto umidade % ${helpTip('Sugerido automaticamente pela tabela do destino (por safra) a partir da umidade informada. Voce pode ajustar; se ficar diferente da tabela, o campo fica amarelo.')}`, name: 'umidade_desc_pct_manual', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.umidade_desc_pct_manual ?? '', span: 'col4' })}
          ${formField({ label: `Umidade (kg) ${helpTip('Calculado a partir do peso bruto e desconto de umidade aplicado.')}`, name: 'calc_umidade_kg', type: 'text', value: base.calc_umidade_kg ?? '', span: 'col4', readonly: true })}

          ${sectionTitle('Qualidade (amostra do silo)')}
          <div class="field col12" style="margin-top:-6px">
            <div style="display:flex;justify-content:flex-end">
              <button class="btn ghost small" type="button" id="btnCompareDest">Comparar destinos</button>
            </div>
            <div class="hint" style="margin-top:6px">Simula quantas sacas (limpa/seca) dariam em outros destinos com regras cadastradas para esta safra e plantio. Nao salva nada.</div>
          </div>
          ${formField({ label: 'Impureza %', name: 'impureza_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.impureza_pct, span: 'col2' })}
          ${formField({ label: 'Ardidos %', name: 'ardidos_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.ardidos_pct, span: 'col2' })}
          ${formField({ label: 'Queimados %', name: 'queimados_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.queimados_pct, span: 'col2' })}
          ${formField({ label: 'Avariados %', name: 'avariados_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.avariados_pct, span: 'col2' })}
          ${formField({ label: 'Esverdiados %', name: 'esverdiados_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.esverdiados_pct, span: 'col2' })}
          ${formField({ label: 'Quebrados %', name: 'quebrados_pct', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: base.quebrados_pct, span: 'col2' })}

          ${formField({ label: 'Impureza (kg)', name: 'calc_impureza_kg', type: 'text', value: base.calc_impureza_kg, span: 'col2', readonly: true })}
          ${formField({ label: 'Ardidos (kg)', name: 'calc_ardidos_kg', type: 'text', value: base.calc_ardidos_kg, span: 'col2', readonly: true })}
          ${formField({ label: 'Queimados (kg)', name: 'calc_queimados_kg', type: 'text', value: base.calc_queimados_kg, span: 'col2', readonly: true })}
          ${formField({ label: 'Avariados (kg)', name: 'calc_avariados_kg', type: 'text', value: base.calc_avariados_kg, span: 'col2', readonly: true })}
          ${formField({ label: 'Esverdiados (kg)', name: 'calc_esverdiados_kg', type: 'text', value: base.calc_esverdiados_kg, span: 'col2', readonly: true })}
          ${formField({ label: 'Quebrados (kg)', name: 'calc_quebrados_kg', type: 'text', value: base.calc_quebrados_kg, span: 'col2', readonly: true })}

          ${sectionTitle('Resultado')}
          ${formField({ label: `Peso limpo/seco (kg) ${helpTip('Peso liquido apos descontos (umidade + qualidade).')}`, name: 'calc_peso_limpo_seco_kg', type: 'text', value: base.calc_peso_limpo_seco_kg ?? '', span: 'col6', readonly: true })}
          ${formField({ label: `Sacas (sc) ${helpTip('Calculado: peso limpo/seco / 60.')}`, name: 'calc_sacas', type: 'text', value: base.calc_sacas ?? '', span: 'col6', readonly: true })}
        </div>
        ${
          variant !== 'rev01'
            ? `<div id="preview"><div class="hint">Preencha os campos para ver o calculo (preview).</div></div>`
            : ''
        }
      `,
      onSubmit: async (obj) => {
        if (!obj.data_saida || !obj.hora_saida) {
          throw new Error('Informe data e hora de saída.')
        }

        const talhoesRateio = collectRateioTalhoes()
        const primaryTalhaoId = Number(talhoesRateio?.[0]?.talhao_id)
        if (!Number.isInteger(primaryTalhaoId) || primaryTalhaoId <= 0) {
          throw new Error('Informe ao menos um talhão no rateio.')
        }

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
          talhao_id: primaryTalhaoId,
          talhoes: talhoesRateio,
          local: obj.local || null,
          destino_id: Number(obj.destino_id),
          motorista_id: Number(obj.motorista_id),
          placa: obj.placa || null,
          data_saida: obj.data_saida || null,
          hora_saida: obj.hora_saida || null,
          data_entrega: obj.data_entrega || null,
          hora_entrega: obj.hora_entrega || null,
          carga_total_kg: asNumberOrNull(obj.carga_total_kg) ?? 0,
          tara_kg: asNumberOrNull(obj.tara_kg) ?? 0,
          umidade_pct: parsePercent100OrZero(obj.umidade_pct, 'umidade_pct'),
          // Campo unico: se igual ao sugerido, manda null (usa tabela); se diferente, manda valor.
          umidade_desc_pct_manual: umidManualValue,
          impureza_pct: parsePercent100OrZero(obj.impureza_pct, 'impureza_pct'),
          ardidos_pct: parsePercent100OrZero(obj.ardidos_pct, 'ardidos_pct'),
          queimados_pct: parsePercent100OrZero(obj.queimados_pct, 'queimados_pct'),
          avariados_pct: parsePercent100OrZero(obj.avariados_pct, 'avariados_pct'),
          esverdiados_pct: parsePercent100OrZero(obj.esverdiados_pct, 'esverdiados_pct'),
          quebrados_pct: parsePercent100OrZero(obj.quebrados_pct, 'quebrados_pct'),
        }

        // Limites do destino: atualizar automaticamente ao trocar destino/safra/plantio,
        // mas preservar ajustes manuais (romaneio).
        for (const name of limitFieldNames) {
          const el = dlgForm.querySelector(`input[name="${name}"]`)
          if (!el) continue
          if (el.dataset.userEdited === '1') {
            body[name] = parsePercent100OrZero(obj[name], name)
          }
        }

        // Regra de negocio: contrato de venda futura. Se exceder, bloquear.
        try {
          const prev = await api('/api/viagens/preview', {
            method: 'POST',
            body: {
              ...(isEdit && viagem?.id ? { id: Number(viagem.id) } : {}),
              ...body,
            },
          })
          const fora = Number(prev?.trava?.fora_contrato_sacas || 0)
          if (Number.isFinite(fora) && fora > 0) {
            toast('Erro', `Esta carga excede o contrato em ${fmtNum(fora, 2)} sacas.`)
            return
          }
        } catch {
          // se o preview falhar, o backend provavelmente vai bloquear o salvar tambem.
        }

        if (isEdit) {
          await api(`/api/viagens/${viagem.id}`, { method: 'PUT', body })
          toast('Atualizado', 'Colheita atualizada.')
        } else {
          await api('/api/viagens', { method: 'POST', body })
          toast('Cadastrada', 'Colheita registrada.')
        }
        refreshList()
      },
    })

    const inputFicha = dlgForm.querySelector('input[name="ficha"]')
    const selPlantio = dlgForm.querySelector('select[name="tipo_plantio"]')
    const inputPlaca = dlgForm.querySelector('input[name="placa"]')
    const inputLocal = dlgForm.querySelector('input[name="local"]')
    const selMotorista = dlgForm.querySelector('select[name="motorista_id"]')
    const rateioWrap = dlgForm.querySelector('#rateioTalhoes')
    const rateioInfo = dlgForm.querySelector('#rateioInfo')
    const btnAddTalhao = dlgForm.querySelector('#btnAddTalhao')
    const btnFillRest = dlgForm.querySelector('#btnFillRest')
    const selTalhaoSort = dlgForm.querySelector('select[name="talhao_sort"]')
    const selDestino = dlgForm.querySelector('select[name="destino_id"]')
    const selSafra = dlgForm.querySelector('select[name="safra_id"]')
    const inputUmidDesc = dlgForm.querySelector(
      'input[name="umidade_desc_pct_manual"]',
    )

    function getPesoBaseKg() {
      const carga = asNumberOrNull(dlgForm.querySelector('input[name="carga_total_kg"]')?.value)
      const tara = asNumberOrNull(dlgForm.querySelector('input[name="tara_kg"]')?.value)
      if (!Number.isFinite(carga) || !Number.isFinite(tara)) return null
      const bruto = carga - tara
      if (!Number.isFinite(bruto) || bruto <= 0) return null
      return bruto
    }

    function collectRateioTalhoes() {
      const rows = rateioWrap
        ? Array.from(rateioWrap.querySelectorAll('[data-role="rateio-row"]'))
        : []

      return rows
        .map((row) => {
          const sel = row.querySelector('select[data-role="talhao"]')
          const inPct = row.querySelector('input[data-role="pct"]')
          const inKg = row.querySelector('input[data-role="kg"]')
          const talhao_id = Number(sel?.value)
          const pct = asNumberOrNull(inPct?.value)
          const kg = asNumberOrNull(inKg?.value)
          return {
            talhao_id,
            pct_rateio: pct === null ? null : pct,
            kg_rateio: kg === null ? null : kg,
          }
        })
        .filter((it) => Number.isInteger(it.talhao_id) && it.talhao_id > 0)
    }

    function updateRateioInfo() {
      if (!rateioInfo) return
      const items = collectRateioTalhoes()
      const sumPct = items.reduce((a, it) => a + Number(it.pct_rateio || 0), 0)
      const sumKg = items.reduce((a, it) => a + Number(it.kg_rateio || 0), 0)
      const baseKg = getPesoBaseKg()

      const okPct = Math.abs(sumPct - 100) <= 0.01
      const okKg = baseKg ? Math.abs(sumKg - baseKg) <= 2 : true
      const ok = okPct && okKg

      const dotClass = ok ? '' : 'warn'
      const baseTxt = baseKg ? `${fmtNum(baseKg, 0)} kg` : '-'
      const kgTxt = sumKg > 0 ? `${fmtNum(sumKg, 0)} kg` : '-'
      const note = baseKg
        ? ok
          ? ''
          : ' Ajuste para fechar com o peso bruto.'
        : ' Sem peso bruto: use % como estimativa.'

      rateioInfo.innerHTML = `
        <span class="pill">
          <span class="dot ${dotClass}"></span>
          <span>
            Soma: <b>${fmtNum(sumPct, 2)}%</b>
            <span class="hint" style="margin:0">|</span>
            kg: <b>${kgTxt}</b>
            <span class="hint" style="margin:0">|</span>
            peso bruto: <b>${baseTxt}</b>
            <span style="color:var(--muted)">${escapeHtml(note)}</span>
          </span>
        </span>
      `.trim()
    }

    function buildTalhaoOptionsHtml(by) {
      const opts = buildTalhaoOpts(by)
      return opts
        .map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`)
        .join('')
    }

    function applyTalhaoSort() {
      if (!selTalhaoSort || !rateioWrap) return
      const html = buildTalhaoOptionsHtml(selTalhaoSort.value)
      const sels = Array.from(rateioWrap.querySelectorAll('select[data-role="talhao"]'))
      for (const sel of sels) {
        const current = sel.value
        sel.innerHTML = html
        if (current) sel.value = current
      }
    }

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
      inputUmidDesc.dataset.manual = '0'
      if (!raw) return

      const current = Math.round(parseNumberPt(raw) * 100)
      if (!Number.isFinite(current)) return
      if (current !== suggested) inputUmidDesc.dataset.manual = '1'
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
        const suggestedHundredths = toHundredthsPct(frac * 100) ?? 0
        el.dataset.suggestedHundredths = String(suggestedHundredths)
      }
    }

    function updateLimitHighlight() {
      let anyDiff = false
      for (const name of limitFieldNames) {
        const el = dlgForm.querySelector(`input[name="${name}"]`)
        if (!el) continue

        const suggested = Number(el.dataset.suggestedHundredths ?? '0')
        const raw = String(el.value ?? '').trim()
        const current = raw ? toHundredthsPct(parseNumberPt(raw)) : null

        // limpar estilo legado (quando era setado inline)
        el.style.background = ''

        // manual = diferente do sugerido; se voltar ao sugerido (ou limpar), volta a ser automatico
        const isManual = current !== null && Number.isFinite(current) && current !== suggested
        el.dataset.userEdited = isManual ? '1' : '0'
        el.dataset.manual = isManual ? '1' : '0'
        if (isManual) anyDiff = true
      }
      return anyDiff
    }

    function restoreLimitIfCleared(el) {
      if (!el) return
      const raw = String(el.value ?? '').trim()
      if (raw) return
      const suggested = Number(el.dataset.suggestedHundredths ?? '')
      if (!Number.isFinite(suggested)) return
      el.value = (suggested / 100).toFixed(2)
      el.dataset.userEdited = '0'
      el.dataset.manual = '0'
    }

    function setLocalFromTalhao() {
      const tid = Number(collectRateioTalhoes()?.[0]?.talhao_id)
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

    function setDestinoRegraUi({ regra, contrato, preview, error } = {}) {
      const travaDot = dlgForm.querySelector('#travaDot')
      const travaStatus = dlgForm.querySelector('#travaStatus')
      const travaEntregue = dlgForm.querySelector('#travaEntregue')
      const travaLimite = dlgForm.querySelector('#travaLimite')
      const travaRestante = dlgForm.querySelector('#travaRestante')
      const travaDentro = dlgForm.querySelector('#travaDentro')
      const travaFora = dlgForm.querySelector('#travaFora')
      const regraDot = dlgForm.querySelector('#regraDot')
      const regraInfo = dlgForm.querySelector('#regraInfo')

      // Quando o preview falha (ex: frete nao cadastrado), nao afirmar que "regra nao existe".
      if (error) {
        if (regraInfo) {
          regraInfo.textContent = `Erro: ${String(error?.message || error)}`
        }
        if (regraDot) regraDot.className = 'dot bad'
        // ainda tenta atualizar trava com o que tiver
      }

      const trava = preview?.trava
      const limite =
        trava && Number.isFinite(Number(trava.trava_sacas))
          ? Number(trava.trava_sacas)
          : Number.isFinite(Number(contrato?.sacas_contratadas))
            ? Number(contrato.sacas_contratadas)
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

      let statusText = 'Sem contrato'
      let dotClass = ''
      if (Number.isFinite(limite) && limite > 0) {
        if (!Number.isFinite(entregue)) {
          statusText = 'Contrato definido'
          dotClass = 'warn'
        } else if (ratio >= 1) {
          statusText = 'Contrato excedido'
          dotClass = 'bad'
        } else if (ratio >= 0.85) {
          statusText = 'Perto de completar contrato'
          dotClass = 'warn'
        } else {
          statusText = 'Dentro do contrato'
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

      const dentro = Number(trava?.dentro_contrato_sacas)
      const fora = Number(trava?.fora_contrato_sacas)
      if (travaDentro) travaDentro.textContent = Number.isFinite(dentro) ? fmtSacas(dentro) : '-'
      if (travaFora) travaFora.textContent = Number.isFinite(fora) ? fmtSacas(fora) : '-'

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

      if (!error) {
        if (regraInfo) {
          if (!regraExiste) {
            regraInfo.textContent = 'Regras do destino: NAO CADASTRADO (nao e possivel salvar)'
          } else {
            regraInfo.textContent = `Regras do destino: OK${faixasQtd === null ? '' : ` (${faixasQtd} faixas)`}`
          }
        }
        if (regraDot) regraDot.className = `dot ${regraExiste ? '' : 'bad'}`.trim()
      }
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
        const contrato = await api(`/api/contratos-silo/one?${qp.toString()}`)

        setBaselineLimitsFromRegra(regra)

        // Em edicao: se os valores atuais diferirem do sugerido pela regra,
        // considerar como ajuste manual (preservar).
        if (isEdit) {
          updateLimitHighlight()
        }

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
          // Ao trocar destino/safra/plantio: atualizar apenas campos automaticos.
          // Se o usuario ajustou manualmente (romaneio), preservar.
          if (el.dataset.userEdited !== '1') {
            el.value = ((v ?? 0) * 100).toFixed(2)
          }
        }

        updateLimitHighlight()
        setDestinoRegraUi({ regra, contrato })
      } catch {
        setDestinoRegraUi({ error: { message: 'Nao foi possivel carregar as regras do destino.' } })
      }
    }

    const previewEl = dlgBody.querySelector('#preview')
    const vForm = dlgBody.querySelector('#vForm')

    const btnCompareDest = dlgBody.querySelector('#btnCompareDest')
    if (btnCompareDest) {
      btnCompareDest.onclick = async () => {
        const fd = new FormData(dlgForm)
        const obj = Object.fromEntries(fd.entries())
        if (!obj.carga_total_kg || !obj.tara_kg) {
          toast('Erro', 'Preencha carga total e tara antes de comparar.')
          return
        }

        const talhoesRateio = collectRateioTalhoes()
        const primaryTalhaoId = Number(talhoesRateio?.[0]?.talhao_id)
        const body = {
          ...(isEdit && viagem?.id ? { id: Number(viagem.id) } : {}),
          ficha: obj.ficha || '1',
          safra_id: Number(obj.safra_id),
          tipo_plantio: obj.tipo_plantio || null,
          talhao_id: primaryTalhaoId,
          talhoes: talhoesRateio,
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
          umidade_desc_pct_manual: null,
          impureza_pct: parsePercent100OrZero(obj.impureza_pct, 'impureza_pct'),
          ardidos_pct: parsePercent100OrZero(obj.ardidos_pct, 'ardidos_pct'),
          queimados_pct: parsePercent100OrZero(obj.queimados_pct, 'queimados_pct'),
          avariados_pct: parsePercent100OrZero(obj.avariados_pct, 'avariados_pct'),
          esverdiados_pct: parsePercent100OrZero(obj.esverdiados_pct, 'esverdiados_pct'),
          quebrados_pct: parsePercent100OrZero(obj.quebrados_pct, 'quebrados_pct'),
        }

        const r = await api('/api/viagens/comparar-destinos', { method: 'POST', body })
        const items = Array.isArray(r?.items) ? r.items : []
        if (!items.length) {
          toast('Info', 'Nenhum destino com regras encontradas para esta safra/plantio.')
          return
        }

        const rows = items
          .map((it) => {
            const delta = Number(it.delta_valor_final_total_com_frete)
            const deltaTxt =
              it.delta_valor_final_total_com_frete === null || !Number.isFinite(delta)
                ? '-'
                : `${delta >= 0 ? '+' : ''}${fmtMoney(delta)}`
            const badge = it.is_atual ? ' <span class="hint">(atual)</span>' : ''

            const finalSemFrete = Number(it.valor_final_total_sem_frete)
            const finalComFrete =
              it.valor_final_total_com_frete === null ||
              it.valor_final_total_com_frete === undefined
                ? null
                : Number(it.valor_final_total_com_frete)

            return `<tr>
              <td data-sort="${escapeHtml(String(it.destino_local || ''))}">${escapeHtml(it.destino_local || '')}${badge}</td>
              <td data-sort="${escapeHtml(String(it.sacas || 0))}">${fmtNum(it.sacas || 0, 2)}</td>
              <td>${fmtPctFromFrac(it.umidade_desc_pct || 0, 2)}</td>
              <td data-sort="${escapeHtml(String(it.sub_total_secagem || 0))}">${fmtMoney(Number(it.sub_total_secagem || 0))}</td>
              <td data-sort="${escapeHtml(String(it.sub_total_custo_silo || 0))}">${fmtMoney(Number(it.sub_total_custo_silo || 0))}</td>
              <td data-sort="${escapeHtml(String(it.preco_compra_por_saca || 0))}">${fmtMoney(Number(it.preco_compra_por_saca || 0))}/sc</td>
              <td data-sort="${escapeHtml(String(it.preco_liquido_sem_frete_por_saca || 0))}"><b>${fmtMoney(Number(it.preco_liquido_sem_frete_por_saca || 0))}</b>/sc</td>
              <td data-sort="${escapeHtml(String(finalSemFrete || 0))}"><b>${fmtMoney(finalSemFrete || 0)}</b></td>
              <td data-sort="${escapeHtml(String(finalComFrete || -1e18))}"><b>${finalComFrete === null ? '-' : fmtMoney(finalComFrete)}</b></td>
              <td data-sort="${escapeHtml(String(delta || 0))}">${escapeHtml(deltaTxt)}</td>
            </tr>`
          })
          .join('')

        openDialog({
          title: 'Comparar destinos (sacas)',
          size: 'wide',
          submitLabel: 'Fechar',
          bodyHtml: `
            <div class="hint">Compara quanto sobra no silo por destino (mesma safra/plantio). Sacas = (peso_limpo/seco / 60). “Liquido s/ frete” = compra - secagem - custos do silo. “Total c/ frete” desconta tambem o frete (motorista x destino).</div>
            <div class="table-wrap" style="margin-top:12px">
              <table>
                <thead>
                  <tr>
                    <th>Destino</th>
                    <th>Sacas (sc)</th>
                    <th>Desc. umidade</th>
                    <th>Secagem (R$)</th>
                    <th>Custos silo (R$)</th>
                    <th>Preco compra (R$/sc)</th>
                    <th>Liquido s/ frete (R$/sc)</th>
                    <th>Total s/ frete (R$)</th>
                    <th>Total c/ frete (R$)</th>
                    <th>Delta vs atual (c/ frete)</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          `,
          onSubmit: async () => {},
        })
      }
    }
    const runPreview = debounce(async () => {
      const setCalcFields = (p) => {
        const setVal = (name, value) => {
          const el = dlgForm.querySelector(`input[name="${name}"]`)
          if (!el) return
          el.value = value
        }

        if (!p) {
          setVal('calc_peso_bruto_kg', '-')
          setVal('calc_umidade_kg', '-')
          setVal('calc_peso_limpo_seco_kg', '-')
          setVal('calc_sacas', '-')

          setVal('calc_impureza_kg', '-')
          setVal('calc_ardidos_kg', '-')
          setVal('calc_queimados_kg', '-')
          setVal('calc_avariados_kg', '-')
          setVal('calc_esverdiados_kg', '-')
          setVal('calc_quebrados_kg', '-')
          return
        }

        setVal(
          'calc_peso_bruto_kg',
          Number.isFinite(Number(p.peso_bruto_kg))
            ? fmtNum(Number(p.peso_bruto_kg), 0)
            : '-',
        )
        setVal(
          'calc_umidade_kg',
          Number.isFinite(Number(p.umidade_kg))
            ? fmtNum(Number(p.umidade_kg), 0)
            : '-',
        )
        setVal(
          'calc_peso_limpo_seco_kg',
          Number.isFinite(Number(p.peso_limpo_seco_kg))
            ? fmtNum(Number(p.peso_limpo_seco_kg), 0)
            : '-',
        )
        setVal(
          'calc_sacas',
          Number.isFinite(Number(p.sacas)) ? fmtNum(Number(p.sacas), 2) : '-',
        )

        setVal(
          'calc_impureza_kg',
          Number.isFinite(Number(p.impureza_kg)) ? fmtNum(Number(p.impureza_kg), 0) : '-',
        )
        setVal(
          'calc_ardidos_kg',
          Number.isFinite(Number(p.ardidos_kg)) ? fmtNum(Number(p.ardidos_kg), 0) : '-',
        )
        setVal(
          'calc_queimados_kg',
          Number.isFinite(Number(p.queimados_kg)) ? fmtNum(Number(p.queimados_kg), 0) : '-',
        )
        setVal(
          'calc_avariados_kg',
          Number.isFinite(Number(p.avariados_kg)) ? fmtNum(Number(p.avariados_kg), 0) : '-',
        )
        setVal(
          'calc_esverdiados_kg',
          Number.isFinite(Number(p.esverdiados_kg)) ? fmtNum(Number(p.esverdiados_kg), 0) : '-',
        )
        setVal(
          'calc_quebrados_kg',
          Number.isFinite(Number(p.quebrados_kg)) ? fmtNum(Number(p.quebrados_kg), 0) : '-',
        )
      }

      const renderPreviewShell = (innerHtml) => {
        if (!previewEl) return
        if (variant !== 'rev01') {
          previewEl.innerHTML = innerHtml
          return
        }

        if (!('previewCollapsed' in dlg.dataset)) dlg.dataset.previewCollapsed = '0'
        const collapsed = dlg.dataset.previewCollapsed === '1'
        const btnLabel = collapsed ? 'Exibir cálculos' : 'Recolher cálculos'

        previewEl.innerHTML = `
          <div class="prev-head">
            <div class="prev-title">Cálculos</div>
            <button class="btn ghost small" type="button" id="btnPrevToggle">${escapeHtml(btnLabel)}</button>
          </div>
          <div class="prev-body" style="${collapsed ? 'display:none' : ''}">${innerHtml}</div>
        `.trim()

        const btn = previewEl.querySelector('#btnPrevToggle')
        if (btn) {
          btn.onclick = () => {
            dlg.dataset.previewCollapsed = dlg.dataset.previewCollapsed === '1' ? '0' : '1'
            // re-render to apply collapsed state
            renderPreviewShell(innerHtml)
          }
        }
      }

      try {
        const fd = new FormData(dlgForm)
        const obj = Object.fromEntries(fd.entries())

        // (renderPreviewShell definido acima para ser usado também no catch)

        if (!obj.carga_total_kg || !obj.tara_kg) {
          renderPreviewShell(
            '<div class="hint">Preencha os campos para ver o cálculo (preview).</div>',
          )
          setCalcFields(null)
          return
        }
        const body = {
          ...(isEdit && viagem?.id ? { id: Number(viagem.id) } : {}),
          ficha: obj.ficha || '1',
          safra_id: Number(obj.safra_id),
          tipo_plantio: obj.tipo_plantio || null,
          talhao_id: Number(collectRateioTalhoes()?.[0]?.talhao_id),
          talhoes: collectRateioTalhoes(),
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
        }

        for (const name of limitFieldNames) {
          const el = dlgForm.querySelector(`input[name="${name}"]`)
          if (!el) continue
          if (el.dataset.userEdited === '1') {
            body[name] = parsePercent100OrZero(obj[name], name)
          }
        }
        const p = await api('/api/viagens/preview', { method: 'POST', body })

        // Atualizar campos calculados no bloco "Pesagem e umidade"
        setCalcFields(p)

        // contrato (antiga "trava"): manter calculos, apenas sinalizar
        const trava = p.trava
        if (trava?.excedeu || trava?.atingida) {
          dlg.dataset.trava = '1'
        } else {
          dlg.dataset.trava = ''
        }

        setSuggestedUmidFromPreview(p)
        updateUmidHighlight()

        setDestinoRegraUi({ preview: p })

        updateLimitHighlight()

        const calcHtml = `
          <span class="pill"><span class="dot"></span><span>Peso bruto: <b>${fmtKg(p.peso_bruto_kg)}</b></span></span>
          ${
            p.valor_compra_por_saca !== null && p.valor_compra_por_saca !== undefined
              ? `<span class="pill"><span class="dot"></span><span>Compra (Silo): <b>${fmtMoney(p.valor_compra_por_saca)}</b>/sc</span></span>`
              : ''
          }
          ${
            p.valor_compra_por_saca !== null && p.valor_compra_por_saca !== undefined
              ? `<span class="pill"><span class="dot"></span><span>Compra (Silo) liquida: <b>${fmtMoney(p.valor_compra_silo_liquida_por_saca)}</b>/sc</span></span>`
              : ''
          }
          ${
            p.valor_compra_por_saca !== null && p.valor_compra_por_saca !== undefined
              ? `<span class="pill"><span class="dot"></span><span>Venda (Terceiros) bruto ideal: <b>${fmtMoney(p.valor_venda_terceiros_bruto_ideal_por_saca)}</b>/sc</span></span>`
              : ''
          }
           ${
             Array.isArray(p.valor_compra_detalhes) && p.valor_compra_detalhes.length
               ? `<details class="prev-details" ${p.valor_compra_detalhes.length > 1 ? 'open' : ''}>
                    <summary>
                      Tratativa de precos (acumulado): antes <b>${fmtNum(p.valor_compra_entrega_antes || 0, 2)}</b> sc | depois <b>${fmtNum(p.valor_compra_entrega_depois || 0, 2)}</b> sc
                    </summary>
                    <div style="margin-top:8px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(15,26,22,.10)">
                      <div class="table-wrap" style="margin:0">
                        <table>
                          <thead><tr><th>De (acum.)</th><th>Ate (acum.)</th><th>Sacas</th><th>Preco (R$/sc)</th></tr></thead>
                          <tbody>
                            ${p.valor_compra_detalhes
                              .map((d) => `<tr>
                                <td>${fmtNum(d.de_acumulado || 0, 2)}</td>
                                <td>${fmtNum(d.ate_acumulado || 0, 2)}</td>
                                <td>${fmtNum(d.sacas || 0, 2)}</td>
                                <td>${fmtMoney(d.preco_por_saca || 0)}</td>
                              </tr>`)
                              .join('')}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </details>`
               : ''
           }
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
        `.trim()

        renderPreviewShell(calcHtml)
      } catch (e) {
        dlg.dataset.trava = ''
        setDestinoRegraUi({ error: e })
        setCalcFields(null)
        renderPreviewShell(
          `<span class="pill"><span class="dot bad"></span><span>${escapeHtml(e.message)}</span></span>`,
        )
      }
    }, 160)

    function syncRowFromPct(row) {
      const baseKg = getPesoBaseKg()
      if (!baseKg) return
      const inPct = row.querySelector('input[data-role="pct"]')
      const inKg = row.querySelector('input[data-role="kg"]')
      const pct = asNumberOrNull(inPct?.value)
      if (pct === null) return
      const kg = (baseKg * pct) / 100
      if (inKg) inKg.value = String(Math.round(kg))
    }

    function syncRowFromKg(row) {
      const baseKg = getPesoBaseKg()
      if (!baseKg) return
      const inPct = row.querySelector('input[data-role="pct"]')
      const inKg = row.querySelector('input[data-role="kg"]')
      const kg = asNumberOrNull(inKg?.value)
      if (kg === null) return
      const pct = (kg / baseKg) * 100
      if (inPct) inPct.value = pct.toFixed(2)
    }

    function addRateioRow({ talhao_id, pct_rateio, kg_rateio, index } = {}) {
      if (!rateioWrap) return

      const row = document.createElement('div')
      row.dataset.role = 'rateio-row'
      row.className = 'rateio-grid rateio-item'
      if (index !== null && index !== undefined) row.dataset.index = String(index)

      row.innerHTML = `
        <div class="rateio-cell" data-cell="talhao">
          <select data-role="talhao" aria-label="Talhão"></select>
        </div>
        <div class="rateio-cell" data-cell="pct">
          <input data-role="pct" aria-label="Percentual" type="text" inputmode="decimal" pattern="[0-9.,]*" placeholder="100,00" />
        </div>
        <div class="rateio-cell" data-cell="kg">
          <input data-role="kg" aria-label="Quilos" type="text" inputmode="numeric" pattern="[0-9.,]*" placeholder="0" />
        </div>
        <div class="rateio-cell" data-cell="rm">
          <button class="btn ghost small" type="button" data-role="rm" aria-label="Remover talhão">Remover</button>
        </div>
      `.trim()

      const sel = row.querySelector('select[data-role="talhao"]')
      if (sel) {
        sel.innerHTML = buildTalhaoOptionsHtml(selTalhaoSort?.value || 'nome')
        if (talhao_id) sel.value = String(talhao_id)
      }

      const inPct = row.querySelector('input[data-role="pct"]')
      const inKg = row.querySelector('input[data-role="kg"]')

      if (inPct && pct_rateio !== null && pct_rateio !== undefined) {
        const n = Number(pct_rateio)
        if (Number.isFinite(n)) inPct.value = n.toFixed(2)
      }
      if (inKg && kg_rateio !== null && kg_rateio !== undefined) {
        const n = Number(kg_rateio)
        if (Number.isFinite(n)) inKg.value = String(Math.round(n))
      }

      if (inPct) {
        inPct.addEventListener('input', () => {
          syncRowFromPct(row)
          updateRateioInfo()
          runPreview()
        })
      }
      if (inKg) {
        inKg.addEventListener('input', () => {
          syncRowFromKg(row)
          updateRateioInfo()
          runPreview()
        })
      }

      const btnRm = row.querySelector('button[data-role="rm"]')
      if (btnRm) {
        btnRm.onclick = () => {
          row.remove()
          // manter ao menos 1 linha
          if (rateioWrap.querySelectorAll('[data-role="rateio-row"]').length === 0) {
            addRateioRow({ talhao_id: base.talhao_id, pct_rateio: 100, index: 0 })
          }
          updateRateioInfo()
          setLocalFromTalhao()
          runPreview()
        }
      }

      rateioWrap.appendChild(row)
      updateRateioInfo()
    }

    function fillRestRateio() {
      if (!rateioWrap) return
      const rows = Array.from(rateioWrap.querySelectorAll('[data-role="rateio-row"]'))
      if (!rows.length) return
      const last = rows[rows.length - 1]
      const baseKg = getPesoBaseKg()

      if (baseKg) {
        let usedKg = 0
        for (let i = 0; i < rows.length - 1; i++) {
          const inKg = rows[i].querySelector('input[data-role="kg"]')
          usedKg += Number(asNumberOrNull(inKg?.value) || 0)
        }
        const restKg = Math.max(0, baseKg - usedKg)
        const inKgLast = last.querySelector('input[data-role="kg"]')
        if (inKgLast) inKgLast.value = String(Math.round(restKg))
        syncRowFromKg(last)
      } else {
        let usedPct = 0
        for (let i = 0; i < rows.length - 1; i++) {
          const inPct = rows[i].querySelector('input[data-role="pct"]')
          usedPct += Number(asNumberOrNull(inPct?.value) || 0)
        }
        const restPct = Math.max(0, 100 - usedPct)
        const inPctLast = last.querySelector('input[data-role="pct"]')
        if (inPctLast) inPctLast.value = restPct.toFixed(2)
      }
      updateRateioInfo()
      setLocalFromTalhao()
      runPreview()
    }

    // inicializar rateio (edit: usa itens do backend; create: 100% no talhao selecionado)
    if (rateioWrap) {
      rateioWrap.innerHTML = ''
      const initial = Array.isArray(viagem?.talhoes) && viagem.talhoes.length
        ? viagem.talhoes.map((it) => ({
            talhao_id: it.talhao_id,
            pct_rateio:
              it.pct_rateio === null || it.pct_rateio === undefined
                ? null
                : Number(it.pct_rateio) * 100,
            kg_rateio: it.kg_rateio,
          }))
        : [{ talhao_id: base.talhao_id, pct_rateio: 100, kg_rateio: null }]

      for (let i = 0; i < initial.length; i++) addRateioRow({ ...initial[i], index: i })
      applyTalhaoSort()
      updateRateioInfo()

      if (btnAddTalhao) {
        btnAddTalhao.onclick = () => {
          const used = new Set(collectRateioTalhoes().map((x) => x.talhao_id))
          const next = cache.talhoes.find((t) => !used.has(t.id))?.id || base.talhao_id
          const idx = rateioWrap.querySelectorAll('[data-role="rateio-row"]').length
          addRateioRow({ talhao_id: next, pct_rateio: 0, kg_rateio: null, index: idx })
          runPreview()
        }
      }
      if (btnFillRest) {
        btnFillRest.onclick = fillRestRateio
      }
    }

    // comportamento amigavel: preencher local/placa e puxar limites do destino
    inputLocal.readOnly = true
    setLocalFromTalhao()
    setPlacaFromMotorista()
    suggestPlantioFromSafra()
    suggestNextFicha().finally(() => {
      applyDestinoDefaults().finally(() => {
        runPreview()
        if (
          rateioWrap &&
          focusRateioIndex !== null &&
          focusRateioIndex !== undefined &&
          Number.isFinite(Number(focusRateioIndex))
        ) {
          const idx = String(Number(focusRateioIndex))
          const target = rateioWrap.querySelector(
            `[data-role="rateio-row"][data-index="${idx}"]`,
          )
          if (target) {
            target.classList.add('rateio-focus')
            target.scrollIntoView({ block: 'center' })
            window.setTimeout(() => target.classList.remove('rateio-focus'), 1400)
          }
        }
      })
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
      // se o usuario apagar o valor manual, volta para o sugerido pela regra
      el.addEventListener('blur', () => {
        restoreLimitIfCleared(el)
        updateLimitHighlight()
        runPreview()
      })
    }

    if (rateioWrap) {
      rateioWrap.addEventListener('change', (e) => {
        const target = e.target
        if (!(target instanceof HTMLElement)) return
        if (target.matches('select[data-role="talhao"]')) {
          // apenas o primeiro talhao define o local automaticamente
          const firstSel = rateioWrap.querySelector('select[data-role="talhao"]')
          if (firstSel && target === firstSel) {
            setLocalFromTalhao()
          }
          updateRateioInfo()
          runPreview()
        }
      })
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
      // alguns navegadores/teclados disparam melhor em keyup/paste
      el.addEventListener('keyup', runPreview)
      el.addEventListener('paste', () => window.setTimeout(runPreview, 0))
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
                <button class="btn" id="btnExpViagensAll" type="button">Colheitas completo (Excel)</button>
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
                   <tr><th>Destino</th><th>Contrato (sacas)</th><th>Entrega (sacas)</th><th>Peso limpo/seco</th><th>Status</th></tr></thead>
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
  const btnExpViagensAll = view.querySelector('#btnExpViagensAll')
  const form = view.querySelector('#rFilters')
  const rTal = view.querySelector('#rtalhao')
  const rDes = view.querySelector('#rdest')
  const rPay = view.querySelector('#rpay')

  async function run() {
    try {
      const fd = new FormData(form)
      const safra_id = Number(fd.get('safra_id'))
      const de = fd.get('de') || null
      const ate = fd.get('ate') || null

      const [tal, des, pay] = await Promise.all([
        api(
          `/api/relatorios/resumo-talhao?${new URLSearchParams({
            safra_id: String(safra_id),
            ...(de ? { de } : {}),
            ...(ate ? { ate } : {}),
          })}`,
        ),
        api(
          `/api/relatorios/entregas-por-destino?${new URLSearchParams({
            safra_id: String(safra_id),
            ...(de ? { de } : {}),
            ...(ate ? { ate } : {}),
          })}`,
        ),
        api(
          `/api/relatorios/pagamento-motoristas?${new URLSearchParams({
            safra_id: String(safra_id),
            ...(de ? { de } : {}),
            ...(ate ? { ate } : {}),
          })}`,
        ),
      ])

      const talItems = (tal || []).filter((t) => {
        if (!de && !ate) return true
        return Number(t?.sacas || 0) > 0 || Number(t?.peso_limpo_seco_kg || 0) > 0 || Number(t?.sub_total_frete || 0) > 0
      })

    rTal.innerHTML = talItems
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

      const desItems = (des || []).filter((d) => {
        if (!de && !ate) return true
        return Number(d?.entrega_sacas || 0) > 0 || Number(d?.peso_limpo_seco_kg || 0) > 0
      })

    rDes.innerHTML = desItems
      .map((d) => {
        const trava = d.trava_sacas
        const entrega = Number(d.entrega_sacas || 0)
        let status = `<span class="pill"><span class="dot"></span><span>OK</span></span>`
        if (trava && trava > 0) {
          const ratio = entrega / trava
          if (ratio >= 1) status = `<span class="pill"><span class="dot bad"></span><span>Contrato excedido</span></span>`
          else if (ratio >= 0.85) status = `<span class="pill"><span class="dot warn"></span><span>Perto de completar contrato</span></span>`
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
    } catch (e) {
      toast('Erro', String(e?.message || e))
    }
  }

  btn.onclick = run

  btnExpTal.onclick = async () => {
    const fd = new FormData(form)
    const safra_id = Number(fd.get('safra_id'))
    const de = fd.get('de') || null
    const ate = fd.get('ate') || null
    const tal = await api(
      `/api/relatorios/resumo-talhao?${new URLSearchParams({
        safra_id: String(safra_id),
        ...(de ? { de } : {}),
        ...(ate ? { ate } : {}),
      })}`,
    )
    const tal2 = (tal || []).filter((t) => {
      if (!de && !ate) return true
      return Number(t?.sacas || 0) > 0 || Number(t?.peso_limpo_seco_kg || 0) > 0 || Number(t?.sub_total_frete || 0) > 0
    })

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
      tal2.map((t) => {
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
    const de = fd.get('de') || null
    const ate = fd.get('ate') || null
    const des = await api(
      `/api/relatorios/entregas-por-destino?${new URLSearchParams({
        safra_id: String(safra_id),
        ...(de ? { de } : {}),
        ...(ate ? { ate } : {}),
      })}`,
    )
    const des2 = (des || []).filter((d) => {
      if (!de && !ate) return true
      return Number(d?.entrega_sacas || 0) > 0 || Number(d?.peso_limpo_seco_kg || 0) > 0
    })

    downloadCsv(
      `entregas-por-destino-safra-${safra_id}.csv`,
      ['Destino', 'Contrato (sacas)', 'Entrega (sacas)', 'Peso limpo/seco (kg)', 'Status'],
      des2.map((d) => {
        const trava = d.trava_sacas
        const entrega = Number(d.entrega_sacas || 0)
        let status = 'OK'
        if (trava && trava > 0) {
          const ratio = entrega / trava
          if (ratio >= 1) status = 'Contrato excedido'
          else if (ratio >= 0.85) status = 'Perto de completar contrato'
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
    const safra_id = Number(fd.get('safra_id'))
    const de = fd.get('de') || null
    const ate = fd.get('ate') || null
    const pay = await api(
      `/api/relatorios/pagamento-motoristas?${new URLSearchParams({
        safra_id: String(safra_id),
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

  btnExpViagensAll.onclick = async () => {
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

    const headers = [
      // Identificacao
      'ID',
      'Ficha',
      'Safra',
      'Safra ID',
      'Plantio',
      'Talhao',
      'Talhao codigo',
      'Talhao local',
      'Talhao ID',
      'Destino',
      'Destino codigo',
      'Destino ID',
      'Motorista',
      'Motorista ID',
      'Placa',
      'Local (colheita)',

      // Datas
      'Data saida',
      'Hora saida',
      'Data entrega',
      'Hora entrega',

      // Entradas (amostra)
      'Umidade informada (%)',
      'Impureza (%)',
      'Ardidos (%)',
      'Queimados (%)',
      'Avariados (%)',
      'Esverdiados (%)',
      'Quebrados (%)',

      // Limites usados
      'Limite impureza (%)',
      'Limite ardidos (%)',
      'Limite queimados (%)',
      'Limite avariados (%)',
      'Limite esverdiados (%)',
      'Limite quebrados (%)',

      // Pesagens (entrada)
      'Carga total (kg)',
      'Tara (kg)',

      // Calculados
      'Peso bruto (kg)',
      'Desc. umidade aplicado (%)',
      'Desc. umidade manual (%)',
      'Umidade (kg)',
      'Impureza (kg)',
      'Ardidos (kg)',
      'Queimados (kg)',
      'Avariados (kg)',
      'Esverdiados (kg)',
      'Quebrados (kg)',
      'Peso limpo/seco (kg)',
      'Sacas (sc)',

      // Frete
      'Sacas frete (sc)',
      'Frete tabela (R$/sc)',
      'Frete total (R$)',

      // Secagem / custos
      'Secagem (R$/sc)',
      'Secagem total (R$)',
      'Custos silo (R$/sc)',
      'Custos silo total (R$)',
      'Custos terceiros (R$/sc)',
      'Custos terceiros total (R$)',

      // Compra do silo (persistido)
      'Compra silo aplicada (R$/sc)',
      'Compra silo total (R$)',
      'Compra entregue antes (sc)',
      'Compra entregue depois (sc)',

      // Derivados (nao persistidos diretamente)
      'Frete por saca (R$/sc)',
      'Despesas silo por saca (R$/sc)',
      'Compra liquida silo (R$/sc)',
      'Preco liquido silo (R$/sc)',
      'Total liquido silo (R$)',

      // Meta
      'Criacao',
      'Alteracao',
    ]

    const rows = items.map((v) => {
      const sacas = Number(v.sacas || 0)
      const freteTotal = Number(v.sub_total_frete || 0)
      const fretePorSaca = sacas > 0 ? freteTotal / sacas : 0
      const compraAplicada =
        v.valor_compra_por_saca_aplicado === null || v.valor_compra_por_saca_aplicado === undefined
          ? null
          : Number(v.valor_compra_por_saca_aplicado)

      const secagemPorSaca = Number(v.secagem_custo_por_saca || 0)
      const custoSiloPorSaca = Number(v.custo_silo_por_saca || 0)
      const despesasSiloPorSaca = secagemPorSaca + custoSiloPorSaca + fretePorSaca

      const compraLiquidaSilo = compraAplicada === null ? null : compraAplicada - despesasSiloPorSaca
      const precoLiquidoSilo =
        compraAplicada === null ? null : compraAplicada - Number(v.abatimento_por_saca_silo || 0)
      const totalLiquidoSilo =
        precoLiquidoSilo === null ? null : sacas * Number(precoLiquidoSilo || 0)

      const pct = (x) => (Number.isFinite(Number(x)) ? Number(x) * 100 : null)

      return [
        String(v.id ?? ''),
        String(v.ficha ?? ''),
        String(v.safra_nome ?? ''),
        String(v.safra_id ?? ''),
        String(v.tipo_plantio ?? ''),
        String(v.talhao_nome ?? ''),
        String(v.talhao_codigo ?? ''),
        String(v.talhao_local ?? ''),
        String(v.talhao_id ?? ''),
        String(v.destino_local ?? ''),
        String(v.destino_codigo ?? ''),
        String(v.destino_id ?? ''),
        String(v.motorista_nome ?? ''),
        String(v.motorista_id ?? ''),
        String(v.placa ?? ''),
        String(v.local ?? ''),

        String(v.data_saida ?? ''),
        String(v.hora_saida ?? ''),
        String(v.data_entrega ?? ''),
        String(v.hora_entrega ?? ''),

        csvNumber(pct(v.umidade_pct), 2),
        csvNumber(pct(v.impureza_pct), 2),
        csvNumber(pct(v.ardidos_pct), 2),
        csvNumber(pct(v.queimados_pct), 2),
        csvNumber(pct(v.avariados_pct), 2),
        csvNumber(pct(v.esverdiados_pct), 2),
        csvNumber(pct(v.quebrados_pct), 2),

        csvNumber(pct(v.impureza_limite_pct), 2),
        csvNumber(pct(v.ardidos_limite_pct), 2),
        csvNumber(pct(v.queimados_limite_pct), 2),
        csvNumber(pct(v.avariados_limite_pct), 2),
        csvNumber(pct(v.esverdiados_limite_pct), 2),
        csvNumber(pct(v.quebrados_limite_pct), 2),

        csvNumber(v.carga_total_kg, 0),
        csvNumber(v.tara_kg, 0),

        csvNumber(v.peso_bruto_kg, 0),
        csvNumber(pct(v.umidade_desc_pct), 2),
        csvNumber(pct(v.umidade_desc_pct_manual), 2),
        csvNumber(v.umidade_kg, 0),
        csvNumber(v.impureza_kg, 0),
        csvNumber(v.ardidos_kg, 0),
        csvNumber(v.queimados_kg, 0),
        csvNumber(v.avariados_kg, 0),
        csvNumber(v.esverdiados_kg, 0),
        csvNumber(v.quebrados_kg, 0),
        csvNumber(v.peso_limpo_seco_kg, 0),
        csvNumber(v.sacas, 2),

        csvNumber(v.sacas_frete, 2),
        csvNumber(v.frete_tabela, 2),
        csvNumber(v.sub_total_frete, 2),

        csvNumber(v.secagem_custo_por_saca, 2),
        csvNumber(v.sub_total_secagem, 2),
        csvNumber(v.custo_silo_por_saca, 2),
        csvNumber(v.sub_total_custo_silo, 2),
        csvNumber(v.custo_terceiros_por_saca, 2),
        csvNumber(v.sub_total_custo_terceiros, 2),

        compraAplicada === null ? '' : csvNumber(compraAplicada, 2),
        csvNumber(v.valor_compra_total, 2),
        csvNumber(v.valor_compra_entrega_antes, 2),
        csvNumber(v.valor_compra_entrega_depois, 2),

        csvNumber(fretePorSaca, 6),
        csvNumber(despesasSiloPorSaca, 6),
        compraLiquidaSilo === null ? '' : csvNumber(compraLiquidaSilo, 6),
        precoLiquidoSilo === null ? '' : csvNumber(precoLiquidoSilo, 6),
        totalLiquidoSilo === null ? '' : csvNumber(totalLiquidoSilo, 2),

        String(v.created_at ?? ''),
        String(v.updated_at ?? ''),
      ]
    })

    downloadCsv(
      `colheitas-completo${safra_id ? `-safra-${safra_id}` : ''}${de ? `-${de}` : ''}${ate ? `-${ate}` : ''}.csv`,
      headers,
      rows,
    )
  }

  await run()
}

async function renderAreaColhida() {
  activeNav('area-colhida')
  await loadLookups()

  function parseDateLike(s) {
    const v = String(s || '').trim()
    if (!v) return null
    const t = Date.parse(v.replace(' ', 'T'))
    return Number.isFinite(t) ? t : null
  }

  function pickDefaultSafraId() {
    const key = 'area_colhida_safra_id'
    const remembered = Number(localStorage.getItem(key) || '')
    if (Number.isFinite(remembered) && remembered > 0) {
      if (cache.safras.some((s) => Number(s.id) === remembered)) return remembered
    }

    const painel = cache.safras.find((s) => Number(s.painel) === 1)
    if (painel?.id) return painel.id

    const sorted = [...cache.safras].sort((a, b) => {
      const ad =
        parseDateLike(a.data_referencia) ??
        parseDateLike(a.updated_at) ??
        parseDateLike(a.created_at) ??
        Number(a.id)
      const bd =
        parseDateLike(b.data_referencia) ??
        parseDateLike(b.updated_at) ??
        parseDateLike(b.created_at) ??
        Number(b.id)
      return bd - ad
    })
    return sorted[0]?.id ?? cache.safras[0]?.id
  }

  const safraOpts = cache.safras.map((s) => ({ value: s.id, label: s.safra }))
  const safraId = pickDefaultSafraId()

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
                  <tr>
                    <th>Nome</th>
                    <th>Local</th>
                    <th>Area (ha)</th>
                    <th>Area colhida (%)</th>
                    <th>Area colhida (ha)</th>
                    <th>Sacas colhidas</th>
                    <th>Prod. ajustada</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="acBody"><tr><td colspan="8">Carregando...</td></tr></tbody>
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
    if (Number.isFinite(safra_id) && safra_id > 0) {
      localStorage.setItem('area_colhida_safra_id', String(safra_id))
    }
    const items = await api(`/api/relatorios/resumo-talhao?safra_id=${safra_id}`)

    body.innerHTML = items
      .map((t) => {
        const hectares = Number(t.hectares || 0)
        const pct = Number(t.pct_area_colhida ?? 0)
        const areaColhidaHa = hectares * pct
        const sacas = Number(t.sacas || 0)
        const prodAdj = Number(t.produtividade_ajustada_sacas_ha || 0)
        return `<tr>
          <td data-sort="${escapeHtml(String(t.talhao_nome || '').trim())}">${escapeHtml(t.talhao_nome || '')}</td>
          <td data-sort="${escapeHtml(String(t.talhao_local || '').trim())}">${escapeHtml(t.talhao_local || '')}</td>
          <td>${fmtNum(hectares, 2)}</td>
          <td>
            <div class="pct-row">
              <span class="pct-read" data-act="pct-read">${fmtNum(pct * 100, 1)}%</span>
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
                data-sacas="${escapeHtml(String(sacas))}"
              />
            </div>
          </td>
          <td><span data-act="area-ha">${fmtNum(areaColhidaHa, 2)}</span> ha</td>
          <td data-sort="${escapeHtml(String(sacas))}">${fmtNum(sacas, 2)}</td>
          <td><span data-act="prod-adj">${fmtNum(prodAdj, 2)}</span> sc/ha</td>
          <td></td>
        </tr>`
      })
      .join('')

    function updateRowUi(rangeEl) {
      const tr = rangeEl.closest('tr')
      if (!tr) return
      const read = tr.querySelector('[data-act="pct-read"]')
      const area = tr.querySelector('[data-act="area-ha"]')
      const pct100 = Number(rangeEl.value)
      const hectares = Number(rangeEl.dataset.hectares || 0)
      const sacas = Number(rangeEl.dataset.sacas || 0)
      const pct2 = Number.isFinite(pct100) ? Math.min(1, Math.max(0, pct100 / 100)) : 0
      if (read) read.textContent = `${fmtNum(pct2 * 100, 1)}%`
      if (area) area.textContent = fmtNum(hectares * pct2, 2)

      const prodAdjEl = tr.querySelector('[data-act="prod-adj"]')
      if (prodAdjEl) {
        const denom = hectares * pct2
        const prod = denom > 0 ? sacas / denom : 0
        prodAdjEl.textContent = fmtNum(prod, 2)
      }

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
  if (form?.safra_id) {
    form.safra_id.onchange = () => run()
  }
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
                  <tr><th class="actions"></th><th>Motorista</th><th>Qtd</th><th>Frete</th><th>Quitado</th><th>Falta</th></tr>
                </thead>
                <tbody id="qBody"><tr><td colspan="6">Carregando...</td></tr></tbody>
              </table>
            </div>
          </div>

          <div class="span12">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th colspan="7">Lancamentos de quitacao no periodo</th></tr>
                  <tr><th class="actions"></th><th>Data</th><th>Motorista</th><th>Periodo</th><th>Valor</th><th>Forma</th><th>Obs</th></tr>
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
          <td><button class="btn small" data-act="pay" data-id="${it.motorista_id}" data-nome="${escapeHtml(it.motorista_nome)}" data-falta="${escapeHtml(String(falta))}">Registrar</button></td>
          <td data-sort="${escapeHtml(String(it.motorista_nome || '').trim())}">${escapeHtml(it.motorista_nome)}${it.motorista_placa ? ` <span class="hint">(${escapeHtml(it.motorista_placa)})</span>` : ''}</td>
          <td>${escapeHtml(String(it.quantidade || 0))}</td>
          <td>${escapeHtml(fmtMoney(it.valor_frete))}</td>
          <td>${escapeHtml(fmtMoney(it.valor_pago))}</td>
          <td>${faltaBadge}</td>
        </tr>`
      })
      .join('')

    qLanc.innerHTML = (r.quitacoes || [])
      .map((q) => {
        return `<tr>
          <td class="actions">
            <button class="btn small ghost" data-act="qedit" data-id="${q.id}">Editar</button>
            <button class="btn small danger" data-act="qdel" data-id="${q.id}">Excluir</button>
          </td>
          <td>${escapeHtml(q.data_pagamento)}</td>
          <td data-sort="${escapeHtml(String(q.motorista_nome || '').trim())}">${escapeHtml(q.motorista_nome)}${q.motorista_placa ? ` <span class="hint">(${escapeHtml(q.motorista_placa)})</span>` : ''}</td>
          <td>${escapeHtml(q.de)} a ${escapeHtml(q.ate)}</td>
          <td>${escapeHtml(fmtMoney(q.valor))}</td>
          <td>${escapeHtml(q.forma_pagamento || '')}</td>
          <td>${escapeHtml(q.observacoes || '')}</td>
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
              ${formField({ label: 'Valor', name: 'valor', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: q.valor === null || q.valor === undefined ? '' : fmtNum(Number(q.valor), 2), span: 'col4' })}
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

              <div class="field col12">
                <div class="label">Dados do motorista</div>
                <div class="hint" id="qMotInfo" style="word-break:break-word">-</div>
                <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">
                  <button class="btn small ghost" type="button" id="qCopyPix">Copiar PIX</button>
                  <button class="btn small ghost" type="button" id="qCopyCpf">Copiar CPF</button>
                </div>
              </div>

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

        const selMot = dlgForm.querySelector('select[name="motorista_id"]')
        const infoEl = dlgBody.querySelector('#qMotInfo')
        const btnPix = dlgBody.querySelector('#qCopyPix')
        const btnCpf = dlgBody.querySelector('#qCopyCpf')

        const refreshMot = () => {
          const mid = Number(selMot?.value)
          const m = (cache.motoristas || []).find((x) => Number(x.id) === mid)
          const pix = String(m?.pix_conta || '').trim()
          const cpf = String(m?.cpf || '').trim()
          const banco = String(m?.banco || '').trim()
          const placa = String(m?.placa || '').trim()
          if (infoEl) {
            infoEl.innerHTML = `Banco: <b>${escapeHtml(banco || '-')}</b> | PIX/Conta: <b>${escapeHtml(pix || '-')}</b> | CPF: <b>${escapeHtml(cpf || '-')}</b> | Placa: <b>${escapeHtml(placa || '-')}</b>`
          }
          if (btnPix) btnPix.disabled = !pix
          if (btnCpf) btnCpf.disabled = !cpf
          if (btnPix) {
            btnPix.onclick = async () => {
              if (!pix) return
              await navigator.clipboard.writeText(pix)
              btnPix.textContent = 'Copiado'
              setTimeout(() => (btnPix.textContent = 'Copiar PIX'), 1200)
            }
          }
          if (btnCpf) {
            btnCpf.onclick = async () => {
              if (!cpf) return
              await navigator.clipboard.writeText(cpf)
              btnCpf.textContent = 'Copiado'
              setTimeout(() => (btnCpf.textContent = 'Copiar CPF'), 1200)
            }
          }
        }

        if (selMot) selMot.onchange = refreshMot
        refreshMot()
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

        const m = (cache.motoristas || []).find((x) => Number(x.id) === motorista_id)
        const motInfo = m
          ? {
              placa: m.placa || '',
              cpf: m.cpf || '',
              banco: m.banco || '',
              pix: m.pix_conta || '',
              tipo: m.tipo_veiculo || '',
              cap: m.capacidade_kg || '',
            }
          : null

        openDialog({
          title: `Quitar motorista: ${nome}`,
          submitLabel: 'Registrar',
          bodyHtml: `
            <div class="form-grid">
              ${formField({ label: 'Data pagamento', name: 'data_pagamento', type: 'date', value: today, span: 'col4' })}
              ${formField({ label: 'Valor', name: 'valor', type: 'text', inputmode: 'decimal', pattern: '[0-9.,]*', value: falta > 0 ? fmtNum(falta, 2) : '', span: 'col4' })}
              ${selectField({ label: 'Forma', name: 'forma_pagamento', options: [
                { value: 'PIX', label: 'PIX' },
                { value: 'TED', label: 'TED' },
                { value: 'DINHEIRO', label: 'Dinheiro' },
                { value: 'CHEQUE', label: 'Cheque' },
                { value: 'OUTROS', label: 'Outros' },
              ], value: 'PIX', span: 'col4' })}

              <div class="field col12">
                <div class="label">Dados para pagamento</div>
                <div class="hint" id="motPayHint" style="word-break:break-word">
                  ${
                    motInfo
                      ? `Banco: <b>${escapeHtml(motInfo.banco || '-')}</b> | PIX/Conta: <b>${escapeHtml(motInfo.pix || '-')}</b> | CPF: <b>${escapeHtml(motInfo.cpf || '-')}</b> | Placa: <b>${escapeHtml(motInfo.placa || '-')}</b>`
                      : 'Motorista nao encontrado no cadastro.'
                  }
                </div>
                ${
                  motInfo
                    ? `<div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">
                         <button class="btn small ghost" type="button" id="btnCopyPix" ${motInfo.pix ? '' : 'disabled'}>Copiar PIX</button>
                         <button class="btn small ghost" type="button" id="btnCopyCpf" ${motInfo.cpf ? '' : 'disabled'}>Copiar CPF</button>
                       </div>`
                    : ''
                }
                ${
                  motInfo && (motInfo.tipo || motInfo.cap)
                    ? `<div class="hint" style="margin-top:8px">Veiculo: ${escapeHtml(motInfo.tipo || '-')}${motInfo.cap ? ` | Capacidade: ${escapeHtml(String(motInfo.cap))} kg` : ''}</div>`
                    : ''
                }
              </div>

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

        const btnCopyPix = dlgBody.querySelector('#btnCopyPix')
        const btnCopyCpf = dlgBody.querySelector('#btnCopyCpf')
        if (btnCopyPix && motInfo?.pix) {
          btnCopyPix.onclick = async () => {
            await navigator.clipboard.writeText(String(motInfo.pix))
            btnCopyPix.textContent = 'Copiado'
            setTimeout(() => (btnCopyPix.textContent = 'Copiar PIX'), 1200)
          }
        }
        if (btnCopyCpf && motInfo?.cpf) {
          btnCopyCpf.onclick = async () => {
            await navigator.clipboard.writeText(String(motInfo.cpf))
            btnCopyCpf.textContent = 'Copiado'
            setTimeout(() => (btnCopyCpf.textContent = 'Copiar CPF'), 1200)
          }
        }
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
              <div style="font-family:var(--serif);font-size:22px">NazcaTraker</div>
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
    const user = data?.user || null
    window.__me = user

    const menus = user?.menus
    const allowed =
      Array.isArray(menus) && menus.length
        ? new Set(menus.map((x) => String(x)))
        : new Set(['fazenda'])

    // nav
    document.querySelectorAll('.nav-item[data-route]').forEach((a) => {
      const k = String(a.dataset.route || '')
      if (!k) return
      a.style.display = allowed.has(k) ? '' : 'none'
    })
    // esconder secoes vazias
    document.querySelectorAll('.nav-section').forEach((sec) => {
      const nav = sec.closest('nav')
      if (!nav) return
      // se nao existe nenhum nav-item visivel ate a proxima secao, esconde o titulo
      let el = sec.nextElementSibling
      let hasVisible = false
      while (el && !el.classList.contains('nav-section')) {
        if (el.classList.contains('nav-item') && el.style.display !== 'none') {
          hasVisible = true
          break
        }
        el = el.nextElementSibling
      }
      sec.style.display = hasVisible ? '' : 'none'
    })

    window.__allowedRoutes = allowed

    // topbar auth button
    if (btnAuth) {
      if (!user) {
        btnAuth.textContent = 'Entrar'
        btnAuth.setAttribute('href', '/login')
        btnAuth.onclick = null
      } else {
        btnAuth.textContent = 'Sair'
        btnAuth.setAttribute('href', '#')
        btnAuth.onclick = async (e) => {
          e.preventDefault()
          try {
            await fetch('/api/auth/logout', { method: 'POST' })
          } catch {
            // ignore
          }
          location.href = '/login'
        }
      }
    }
  } catch {
    // ignore
  }
}

async function navigate() {
  const hash = window.location.hash || '#/fazenda'
  const route = hash.replace('#/', '').split('?')[0] || 'fazenda'
  const allowed = window.__allowedRoutes
  if (allowed && allowed.size && !allowed.has(route)) {
    window.location.hash = allowed.has('fazenda') ? '#/fazenda' : `#/${Array.from(allowed)[0] || 'fazenda'}`
    return
  }
  const fn = routes[route] || routes.fazenda
  try {
    await fn()
  } catch (e) {
    setView(`<section class="panel"><div class="panel-head"><div><div class="panel-title">Erro</div><div class="panel-sub">Falha ao carregar a tela.</div></div></div><div class="panel-body"><code class="mono">${escapeHtml(e.message)}</code></div></section>`)
  }
}

btnRefresh.onclick = () => navigate()

function setNavCollapsed(collapsed) {
  document.body.classList.toggle('nav-collapsed', collapsed)
  try {
    localStorage.setItem('nav_collapsed', collapsed ? '1' : '0')
  } catch {
    // ignore
  }
  if (btnToggleNav) {
    btnToggleNav.textContent = collapsed ? 'Menu' : 'Recolher'
    btnToggleNav.title = collapsed ? 'Expandir menu' : 'Recolher menu'
  }
}

if (btnToggleNav) {
  btnToggleNav.onclick = () => {
    const collapsed = document.body.classList.contains('nav-collapsed')
    setNavCollapsed(!collapsed)
  }
  let initial = false
  try {
    initial = localStorage.getItem('nav_collapsed') === '1'
  } catch {
    // ignore
  }
  setNavCollapsed(initial)
}
window.addEventListener('hashchange', navigate)

applyMenuAccess().finally(() => {
  // se nao tiver sessao, inicia sempre em Sobre
  if (!window.__me) {
    if (!window.location.hash || window.location.hash === '#/painel') {
      window.location.hash = '#/fazenda'
      return
    }
  }
  navigate()
})

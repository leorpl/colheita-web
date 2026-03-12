function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

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

function safeHttpUrl(url) {
  const u = String(url || '').trim()
  if (!u) return ''
  if (u.startsWith('http://') || u.startsWith('https://')) return u
  return ''
}

let _leafletReady = null
async function ensureLeaflet() {
  if (window.L) return window.L
  if (_leafletReady) return _leafletReady
  _leafletReady = new Promise((resolve, reject) => {
    const cssHref = '/vendor/leaflet/leaflet.css'
    if (!document.querySelector(`link[href="${cssHref}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = cssHref
      document.head.appendChild(link)
    }
    const src = '/vendor/leaflet/leaflet.js'
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve(window.L)
    script.onerror = () => reject(new Error('Nao foi possivel carregar o mapa.'))
    document.head.appendChild(script)
  })
  return _leafletReady
}

async function renderGeometryMap(el, feature) {
  if (!el || !feature?.geometry) return false
  if (el._leafletMap) {
    try {
      el._leafletMap.remove()
    } catch {
      // ignore
    }
    el._leafletMap = null
  }
  const L = await ensureLeaflet()
  const map = L.map(el, { zoomControl: true })
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri',
    maxZoom: 20,
  }).addTo(map)
  const layer = L.geoJSON(feature, {
    style: { color: '#d19a2b', weight: 3, opacity: 0.95, fillColor: '#d19a2b', fillOpacity: 0.18 },
  }).addTo(map)
  const bounds = layer.getBounds()
  if (bounds?.isValid?.()) map.fitBounds(bounds.pad(0.18))
  setTimeout(() => map.invalidateSize(), 60)
  el._leafletMap = map
  return true
}

async function api(path) {
  const res = await fetch(path)
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    const msg = data?.message || `Erro ${res.status}`
    throw new Error(msg)
  }
  return data
}

const DEFAULT_MAPS_EMBED_URL =
  'https://www.google.com/maps/d/embed?mid=1I31t4h-O1Scw04_yJqcTAs8EqUid5IE&ehbc=2E312F'

// embed alternativo removido (UI simplificada)

// embed agora usa URL padrao publico (DEFAULT_MAPS_EMBED_URL)

const qs = new URLSearchParams(location.search)
const id = Number(qs.get('id'))
if (!Number.isFinite(id) || id <= 0) {
  document.querySelector('#root').innerHTML = `<div class="panel"><div class="panel-body"><code class="mono">Talhão inválido.</code></div></div>`
  throw new Error('invalid id')
}

const tTitle = document.querySelector('#tTitle')
const tSub = document.querySelector('#tSub')
const tLink = document.querySelector('#tLink')
const btnCopy = document.querySelector('#btnCopy')
const btnPrint = document.querySelector('#btnPrint')
const infoEl = document.querySelector('#info')
const mediaEl = document.querySelector('#media')

const fullLink = `${location.origin}${location.pathname}?id=${id}`
tLink.textContent = fullLink
btnCopy.onclick = async () => {
  await navigator.clipboard.writeText(fullLink)
  btnCopy.textContent = 'Copiado'
  setTimeout(() => (btnCopy.textContent = 'Copiar link'), 1200)
}
btnPrint.onclick = () => window.print()

async function loadHeader() {
  const talhao = await api(`/api/public/talhoes/${id}`)
  const fotoUrl = safeHttpUrl(talhao.foto_url)
  const internalMapUrl = `${location.origin}/talhao-mapa.html?focus_id=${encodeURIComponent(id)}`
  const mapsUrl = talhao.geometry_geojson || talhao.maps_url ? internalMapUrl : ''
  const mapsEmbed = talhao.geometry_geojson ? '' : DEFAULT_MAPS_EMBED_URL
  tTitle.textContent = `${talhao.codigo} - ${talhao.nome || ''}`.trim()
  tSub.textContent = `${talhao.local || ''}${talhao.situacao ? ` | ${talhao.situacao}` : ''}${talhao.hectares ? ` | ${fmtNum(talhao.hectares, 2)} ha` : ''}`

  infoEl.innerHTML = `
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div style="font-family:var(--serif);font-size:16px;color:rgba(255,255,255,.94)">Talhão</div>
      <div class="badge">Safra: <code id="usedSafra">-</code></div>
    </div>

    <div class="kv">
      <div class="k">Codigo</div><div class="v">${escapeHtml(talhao.codigo)}</div>
      <div class="k">Nome</div><div class="v">${escapeHtml(talhao.nome || '')}</div>
      <div class="k">Local</div><div class="v">${escapeHtml(talhao.local || '')}</div>
      <div class="k">Situacao</div><div class="v">${escapeHtml(talhao.situacao || '')}</div>
      <div class="k">Hectares</div><div class="v">${escapeHtml(fmtNum(talhao.hectares, 2))}</div>
    </div>

    <div class="mstat-grid">
      <div class="mstat"><div class="mstat-k">Peso bruto (periodo)</div><div class="mstat-v" id="mPeso">-</div></div>
      <div class="mstat"><div class="mstat-k">Sacas (periodo)</div><div class="mstat-v" id="mSacas">-</div></div>
      <div class="mstat"><div class="mstat-k">Area colhida (%)</div><div class="mstat-v" id="mPct">-</div></div>
      <div class="mstat"><div class="mstat-k">Hectares colhidos</div><div class="mstat-v" id="mHa">-</div></div>
      <div class="mstat"><div class="mstat-k">Produtividade</div><div class="mstat-v" id="mProd">-</div></div>
      <div class="mstat"><div class="mstat-k">Produtividade ajustada</div><div class="mstat-v" id="mProdAdj">-</div></div>
      <div class="mstat"><div class="mstat-k">Produtividade</div><div class="mstat-v" id="mProd">-</div></div>
      <div class="mstat"><div class="mstat-k">Produtividade ajustada</div><div class="mstat-v" id="mProdAdj">-</div></div>
    </div>

 
  `

  mediaEl.innerHTML = `
    ${
      fotoUrl
        ? `
          <div style="font-family:var(--serif);font-size:16px;color:rgba(255,255,255,.94)">Foto do talhao</div>
          <div style="margin-top:10px">
            <img class="photo" src="${escapeHtml(fotoUrl)}" alt="Foto do talhao" loading="lazy" />
          </div>
        `.trim()
        : ''
    }

    <div id="mapa" style="${fotoUrl ? 'margin-top:14px' : ''};font-family:var(--serif);font-size:16px;color:rgba(255,255,255,.94)">Mapa do talhao</div>
    <div style="margin-top:10px">
      ${
        talhao.geometry_geojson
          ? `<div class="map-wrap"><div class="photo" id="talhaoGeomMap"></div></div>`
          : mapsEmbed
            ? `<div class="map-wrap">
              <iframe class="photo" data-role="map-frame" src="${escapeHtml(mapsEmbed)}" loading="lazy" width="640" height="480"></iframe>
              <div class="map-ph" data-role="map-ph">Carregando mapa...</div>
             </div>`
            : `<div class="photo" style="display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.65);font-size:12px">Mapa indisponivel</div>`
      }
    </div>
    <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">
      ${mapsUrl ? `<a class="btn ghost" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noreferrer">Abrir mapa</a>` : ''}
    </div>

    <div class="hint" style="margin-top:10px">Atualizado em: ${escapeHtml(talhao.updated_at || talhao.created_at || '')}</div>
  `.trim()

  if (fotoUrl) {
    const img = mediaEl.querySelector('img.photo')
    if (img) {
      img.addEventListener('error', () => {
        img.replaceWith(
          Object.assign(document.createElement('div'), {
            className: 'photo',
            style:
              'display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.65);font-size:12px',
            textContent: 'Foto indisponivel',
          }),
        )
      })
    }
  }

  const geomMap = mediaEl.querySelector('#talhaoGeomMap')
  if (geomMap && talhao.geometry_geojson) {
    try {
      await renderGeometryMap(geomMap, talhao.geometry_geojson)
    } catch {
      geomMap.replaceWith(
        Object.assign(document.createElement('div'), {
          className: 'photo',
          style: 'display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.65);font-size:12px',
          textContent: 'Nao foi possivel renderizar o poligono do talhao.',
        }),
      )
    }
  }

  const frame = mediaEl.querySelector('iframe[data-role="map-frame"]')
  const ph = mediaEl.querySelector('[data-role="map-ph"]')
  let loaded = false

  function markLoaded() {
    loaded = true
    if (ph) ph.classList.add('hidden')
  }

  if (frame && ph) {
    frame.addEventListener('load', markLoaded, { once: true })
    setTimeout(() => {
      if (loaded) return
      ph.classList.remove('hidden')
      ph.textContent = 'Nao foi possivel carregar o mapa aqui. Clique em Abrir mapa.'
    }, 6500)
  }

}

async function run() {
  const qs = new URLSearchParams({})

  const r = await api(`/api/public/talhoes/${id}/resumo?${qs}`)
  const totals = r?.totals || {}
  const usedSafra = infoEl.querySelector('#usedSafra')
  if (usedSafra) usedSafra.textContent = r?.safra?.safra || '-'

  const mPeso = infoEl.querySelector('#mPeso')
  const mSacas = infoEl.querySelector('#mSacas')
  if (mPeso) mPeso.textContent = fmtKg(totals.peso_bruto_kg)
  if (mSacas) mSacas.textContent = `${fmtNum(totals.sacas, 2)} sc`

  const area = r?.area || {}
  const pct = Number.isFinite(Number(area.pct_area_colhida))
    ? Number(area.pct_area_colhida)
    : null
  const haColhida = Number.isFinite(Number(area.hectares_colhidos))
    ? Number(area.hectares_colhidos)
    : null

  const mPct = infoEl.querySelector('#mPct')
  const mHa = infoEl.querySelector('#mHa')
  const mProd = infoEl.querySelector('#mProd')
  const mProdAdj = infoEl.querySelector('#mProdAdj')
  if (mPct) mPct.textContent = pct === null ? '-' : `${fmtNum(pct * 100, 2)}%`
  if (mHa) mHa.textContent = haColhida === null ? '-' : `${fmtNum(haColhida, 2)} ha`
  if (mProd) mProd.textContent = `${fmtNum(Number(r?.produtividade?.sacas_ha || 0), 2)} sc/ha`
  if (mProdAdj) mProdAdj.textContent = `${fmtNum(Number(r?.produtividade?.sacas_ha_ajustada || 0), 2)} sc/ha`

}

await loadHeader()
await run()

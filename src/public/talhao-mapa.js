function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

async function api(path) {
  const res = await fetch(path)
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(data?.message || `Erro ${res.status}`)
  return data
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
    const script = document.createElement('script')
    script.src = '/vendor/leaflet/leaflet.js'
    script.async = true
    script.onload = () => resolve(window.L)
    script.onerror = () => reject(new Error('Nao foi possivel carregar o mapa.'))
    document.head.appendChild(script)
  })
  return _leafletReady
}

async function run() {
  const qs = new URLSearchParams(location.search)
  const focusId = Number(qs.get('focus_id'))
  const talhoes = await api('/api/public/talhoes-geometrias')
  if (!Array.isArray(talhoes) || !talhoes.length) throw new Error('Nenhum talhão com geometria salva.')
  const focused = talhoes.find((t) => Number(t.id) === focusId) || null
  document.querySelector('#mapTitle').textContent = focused
    ? `Mapa dos talhões - foco em ${focused.codigo}`
    : 'Mapa dos talhões'
  document.querySelector('#mapSub').textContent = 'Clique em um polígono para abrir o registro de referência do talhão.'
  const root = document.querySelector('#mapRoot')
  const L = await ensureLeaflet()
  const map = L.map(root, { zoomControl: true })
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri',
    maxZoom: 20,
  }).addTo(map)
  const layer = L.geoJSON(
    {
      type: 'FeatureCollection',
      features: talhoes.map((t) => ({
        type: 'Feature',
        properties: {
          id: t.id,
          codigo: t.codigo,
          nome: t.nome,
          local: t.local,
          focused: Number(t.id) === Number(focusId),
        },
        geometry: t.geometry_geojson.geometry,
      })),
    },
    {
      style: (f) => {
        const focused2 = Boolean(f?.properties?.focused)
        return {
          color: focused2 ? '#ffb703' : '#d19a2b',
          weight: focused2 ? 4 : 2,
          opacity: 0.98,
          fillColor: focused2 ? '#ffb703' : '#d19a2b',
          fillOpacity: focused2 ? 0.28 : 0.14,
        }
      },
      onEachFeature: (feature, lyr) => {
        const title = `${feature.properties.codigo}${feature.properties.nome ? ` - ${feature.properties.nome}` : ''}`
        lyr.bindTooltip(title)
        lyr.on('click', () => {
          location.href = `/talhao.html?id=${encodeURIComponent(feature.properties.id)}`
        })
      },
    },
  ).addTo(map)
  const bounds = layer.getBounds()
  if (bounds?.isValid?.()) map.fitBounds(bounds.pad(0.18))
  setTimeout(() => map.invalidateSize(), 60)
}

const btnCloseMap = document.querySelector('#btnCloseMap')
if (btnCloseMap) {
  btnCloseMap.addEventListener('click', () => {
    try {
      if (window.opener && !window.opener.closed) {
        window.close()
        return
      }
    } catch {
      // ignore
    }
    if (history.length > 1) {
      history.back()
      return
    }
    location.href = '/#/talhoes'
  })
}

run().catch((e) => {
  document.querySelector('#mapRoot').innerHTML = `<div class="map-empty">${escapeHtml(String(e?.message || e))}</div>`
})

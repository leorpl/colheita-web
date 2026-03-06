const SITE_DEFAULT = {
  name: 'Fazenda Nazca',
  tagline: 'Agro premium. Precisao no campo. Disciplina na entrega.',
  contact: {
    email: 'contato@fazendanazca.com.br',
    phone: '+55 00 00000-0000',
    whatsapp: 'https://wa.me/5500000000000',
    instagram: 'https://instagram.com/fazendanazca',
    facebook: 'https://facebook.com/fazendanazca',
  },
  address: {
    line1: 'Formiga/MG (ajustar)',
    mapsUrl: 'https://www.google.com/maps',
    mapsEmbedUrl: '',
  },
  social: {
    instagramLabel: '@fazendanazca',
    facebookLabel: '/fazendanazca',
  },
}

let SITE = { ...SITE_DEFAULT }

function $(sel, root = document) {
  return root.querySelector(sel)
}

function $all(sel, root = document) {
  return Array.from(root.querySelectorAll(sel))
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function deepMerge(a, b) {
  const out = { ...(a || {}) }
  for (const [k, v] of Object.entries(b || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = deepMerge(out[k] || {}, v)
    else out[k] = v
  }
  return out
}

function tryLoadImage(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(false)
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.decoding = 'async'
    img.src = url
  })
}

async function pickFirstAvailable(urls) {
  const list = (urls || []).map((u) => String(u || '').trim()).filter(Boolean)
  for (const u of list) {
    const ok = await tryLoadImage(u)
    if (ok) return u
  }
  return null
}

async function loadSiteConfig() {
  try {
    const r = await fetch('/institucional/site.config.json', { method: 'GET', cache: 'no-cache' })
    if (!r.ok) return
    const cfg = await r.json()
    SITE = deepMerge(SITE_DEFAULT, cfg)
  } catch {
    // ignore
  }
}

function pageKeyFromPath() {
  const p = String(location.pathname || '')
  if (p.includes('/institucional/sobre')) return 'sobre'
  if (p.includes('/institucional/producao')) return 'producao'
  if (p.includes('/institucional/tecnologia')) return 'tecnologia'
  if (p.includes('/institucional/galeria')) return 'galeria'
  if (p.includes('/institucional/contato')) return 'contato'
  if (p.includes('/institucional')) return 'home'
  return 'home'
}

function headerHtml(activeKey) {
  const links = [
    { key: 'home', href: '/institucional', label: 'Home' },
    { key: 'sobre', href: '/institucional/sobre', label: 'Sobre' },
    { key: 'producao', href: '/institucional/producao', label: 'Producao' },
    { key: 'tecnologia', href: '/institucional/tecnologia', label: 'Tecnologia' },
    { key: 'galeria', href: '/institucional/galeria', label: 'Galeria' },
    { key: 'contato', href: '/institucional/contato', label: 'Contato' },
  ]
  const nav = links
    .map(
      (l) =>
        `<a href="${escapeHtml(l.href)}" data-active="${l.key === activeKey ? '1' : '0'}">${escapeHtml(l.label)}</a>`,
    )
    .join('')

  return `
    <div class="bg" aria-hidden="true"><div class="grain"></div><div class="glow"></div></div>
    <header class="topbar">
      <div class="wrap">
        <div class="topbar-inner">
          <a class="brand" href="/institucional" aria-label="${escapeHtml(SITE.name)}">
            <img src="/logo.png" alt="${escapeHtml(SITE.name)}" />
            <div>
              <div class="t">${escapeHtml(SITE.name)}</div>
              <div class="s">Institucional</div>
            </div>
          </a>
          <nav class="nav" id="siteNav" aria-label="Navegacao">
            ${nav}
          </nav>
          <div class="cta-row">
            <a class="btn ghost" href="/login">Area interna</a>
            <button class="btn iconbtn hamb" type="button" id="btnNav" aria-label="Abrir menu">
              <span style="font-family:var(--mono)">≡</span>
            </button>
            <a class="btn primary" href="/institucional/contato">Fale conosco</a>
          </div>
        </div>
      </div>
    </header>
  `.trim()
}

function footerHtml() {
  return `
    <footer class="footer">
      <div class="wrap">
        <div class="footer-grid">
          <div>
            <div class="foot-k">Institucional</div>
            <div class="foot-p">${escapeHtml(SITE.tagline)}</div>
            <div class="pillrow">
              <span class="pill">Saca padrao: <code>60kg</code></span>
              <span class="pill">Rastreabilidade e disciplina</span>
              <span class="pill">Preparado para evoluir</span>
            </div>
          </div>
          <div>
            <div class="foot-k">Contato</div>
            <div class="foot-links">
              <a href="mailto:${escapeHtml(SITE.contact.email)}">${escapeHtml(SITE.contact.email)}</a>
              <a href="${escapeHtml(SITE.contact.whatsapp)}" target="_blank" rel="noreferrer">WhatsApp</a>
              <a href="${escapeHtml(SITE.address.mapsUrl)}" target="_blank" rel="noreferrer">Localizacao</a>
            </div>
          </div>
          <div>
            <div class="foot-k">Redes</div>
            <div class="foot-links">
              <a href="${escapeHtml(SITE.contact.instagram)}" target="_blank" rel="noreferrer">Instagram ${escapeHtml(SITE.social?.instagramLabel || '')}</a>
              <a href="${escapeHtml(SITE.contact.facebook)}" target="_blank" rel="noreferrer">Facebook ${escapeHtml(SITE.social?.facebookLabel || '')}</a>
            </div>
          </div>
        </div>
        <div class="subfoot">
          <div>(c) ${new Date().getFullYear()} ${escapeHtml(SITE.name)}. Todos os direitos reservados.</div>
          <div>Site inicial em HTML/CSS/JS (sem framework).</div>
        </div>
      </div>
    </footer>
  `.trim()
}

function mountShell() {
  const active = pageKeyFromPath()
  const head = $('#siteHeader')
  const foot = $('#siteFooter')
  if (head) head.innerHTML = headerHtml(active)
  if (foot) foot.innerHTML = footerHtml()

  const btn = $('#btnNav')
  const nav = $('#siteNav')
  if (btn && nav) {
    btn.onclick = () => {
      const open = nav.getAttribute('data-open') === '1'
      nav.setAttribute('data-open', open ? '0' : '1')
      btn.setAttribute('aria-label', open ? 'Abrir menu' : 'Fechar menu')
    }
  }
}

function bindGallery() {
  const lb = $('#lightbox')
  if (!lb) return
  const img = $('#lbImg')
  const title = $('#lbTitle')
  const btnClose = $('#lbClose')

  function open({ src, caption }) {
    if (img) img.src = src
    if (title) title.textContent = caption || 'Foto'
    lb.setAttribute('data-open', '1')
    document.body.style.overflow = 'hidden'
  }

  function close() {
    lb.setAttribute('data-open', '0')
    document.body.style.overflow = ''
  }

  btnClose && (btnClose.onclick = close)
  lb.addEventListener('click', (e) => {
    if (e.target === lb) close()
  })
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close()
  })

  document.querySelectorAll('[data-gallery-tile]').forEach((el) => {
    el.addEventListener('click', () => {
      const src = String(el.getAttribute('data-src') || '')
      const caption = String(el.getAttribute('data-caption') || '')
      if (!src) return
      open({ src, caption })
    })
  })
}

async function applyPhotoBindings() {
  const map = SITE.photos || {}
  const imgs = $all('img[data-photo]')
  for (const el of imgs) {
    const key = String(el.getAttribute('data-photo') || '').trim()
    if (!key) continue
    const target = String(map[key] || '').trim()
    if (!target) continue
    const src = await pickFirstAvailable([target])
    if (src) {
      el.src = src
    }
  }
}

async function loadAndRenderGallery() {
  const grid = $('#galleryGrid')
  if (!grid) return

  let cfg
  try {
    const r = await fetch('/institucional/gallery.json', { method: 'GET', cache: 'no-cache' })
    if (!r.ok) throw new Error('gallery.json not found')
    cfg = await r.json()
  } catch {
    cfg = null
  }

  const defaults = cfg?.defaults || {}
  const basePath = String(defaults.basePath || '/institucional/assets/photos/')
  const ext = String(defaults.ext || 'webp')
  const placeholder = String(defaults.placeholder || '/institucional/assets/placeholder-wide.svg')
  const items = Array.isArray(cfg?.items) ? cfg.items : []

  if (!items.length) {
    grid.innerHTML = `
      <div class="card" style="grid-column:1/-1">
        <h3 style="margin:0">Galeria vazia</h3>
        <p style="margin:8px 0 0;color:rgba(255,255,255,.76);line-height:1.55">Adicione itens em <code style="font-family:var(--mono)">src/public/institucional/gallery.json</code> e coloque as fotos em <code style="font-family:var(--mono)">assets/photos/</code>.</p>
      </div>
    `.trim()
    return
  }

  const tilesHtml = items
    .map((it) => {
      const key = String(it?.key || '').trim()
      const cap = String(it?.caption || '').trim()
      const desired = key ? `${basePath}${key}.${ext}` : ''
      return `
        <div class="tile" role="button" tabindex="0" data-gallery-tile data-src="${escapeHtml(desired)}" data-fallback="${escapeHtml(placeholder)}" data-caption="${escapeHtml(cap)}">
          <img src="${escapeHtml(placeholder)}" alt="${escapeHtml(cap || 'Foto')}" loading="lazy" decoding="async" />
          <div class="cap">${escapeHtml(cap || 'Foto')}</div>
        </div>
      `.trim()
    })
    .join('')

  grid.innerHTML = tilesHtml

  // Resolve real thumbnails when available
  const tiles = $all('[data-gallery-tile]', grid)
  for (const el of tiles) {
    const desired = String(el.getAttribute('data-src') || '').trim()
    const fb = String(el.getAttribute('data-fallback') || '').trim()
    const picked = await pickFirstAvailable([desired, fb])
    const img = $('img', el)
    if (picked && img) img.src = picked

    // keyboard support
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        el.click()
      }
    })
  }

  // Bind lightbox on the newly created nodes
  bindGallery()
}

function bindContactForm() {
  const form = $('#contactForm')
  if (!form) return
  const out = $('#contactMsg')

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const fd = new FormData(form)
    const nome = String(fd.get('nome') || '').trim()
    const email = String(fd.get('email') || '').trim()
    const fone = String(fd.get('fone') || '').trim()
    const msg = String(fd.get('mensagem') || '').trim()

    const subject = `[Site] Contato - ${nome || 'Sem nome'}`
    const body =
      `Nome: ${nome}\n` +
      `Email: ${email}\n` +
      `Telefone: ${fone}\n\n` +
      `Mensagem:\n${msg}`

    const url = `mailto:${encodeURIComponent(SITE.contact.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    location.href = url
    if (out) out.textContent = 'Abrindo seu e-mail para enviar a mensagem...'
  })
}

function bindLazyMap() {
  const holder = $('#mapHolder')
  if (!holder) return
  const iframe = holder.querySelector('iframe[data-src]')
  const ph = holder.querySelector('.ph')
  const src = String(SITE.address?.mapsEmbedUrl || '').trim()
  if (iframe) {
    if (src) {
      iframe.setAttribute('data-src', src)
      if (ph) ph.style.display = 'none'
    } else {
      // no embed configured
      if (ph) ph.textContent = 'Mapa (configure mapsEmbedUrl)'
      return
    }
  }
  if (!iframe) return

  const load = () => {
    const src = iframe.getAttribute('data-src')
    if (!src) return
    iframe.setAttribute('src', src)
    iframe.removeAttribute('data-src')
  }

  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.some((en) => en.isIntersecting)
        if (vis) {
          load()
          obs.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    obs.observe(holder)
    return
  }
  load()
}

document.addEventListener('DOMContentLoaded', () => {
  loadSiteConfig().finally(() => {
    mountShell()
    applyPhotoBindings().catch(() => {})
    loadAndRenderGallery().catch(() => {})
    bindGallery()
    bindContactForm()
    bindLazyMap()
  })
})

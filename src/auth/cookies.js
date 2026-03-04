import crypto from 'node:crypto'

export function parseCookies(header) {
  const out = {}
  const h = String(header || '')
  if (!h) return out
  const parts = h.split(';')
  for (const p of parts) {
    const idx = p.indexOf('=')
    if (idx < 0) continue
    const k = p.slice(0, idx).trim()
    const v = p.slice(idx + 1).trim()
    if (!k) continue
    try {
      out[k] = decodeURIComponent(v)
    } catch {
      // cookie malformado: ignore
    }
  }
  return out
}

export function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s || '')).digest('hex')
}

export function newToken() {
  return crypto.randomBytes(32).toString('hex')
}

export function buildCookie({ name, value, maxAgeSeconds, secure, sameSite }) {
  const v = encodeURIComponent(String(value || ''))
  const ss = sameSite ? String(sameSite) : 'Lax'
  const parts = [`${name}=${v}`, 'Path=/', 'HttpOnly', `SameSite=${ss}`]
  if (secure) parts.push('Secure')
  if (maxAgeSeconds !== undefined) parts.push(`Max-Age=${Math.floor(maxAgeSeconds)}`)
  return parts.join('; ')
}

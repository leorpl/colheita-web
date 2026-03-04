import { forbidden } from '../errors.js'

// Defensive same-origin enforcement for state-changing requests.
// Allows requests without Origin (e.g. curl, server-to-server).

export function enforceSameOrigin({ allowedOrigins = [] } = {}) {
  const allow = new Set(
    (Array.isArray(allowedOrigins) ? allowedOrigins : [])
      .map((s) => String(s || '').trim())
      .filter(Boolean),
  )

  return (req, _res, next) => {
    const method = String(req.method || 'GET').toUpperCase()
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next()

    const origin = String(req.headers.origin || '').trim()
    if (!origin) return next()

    if (!allow.has(origin)) {
      throw forbidden('Origin nao permitido')
    }
    next()
  }
}

import { tooManyRequests } from '../errors.js'

// Simple in-memory rate limiter (per-process).
// Good for single instance; for multi-instance use a shared store.

export function rateLimit({
  id = 'default',
  windowMs = 60_000,
  max = 60,
  message = 'Muitas requisicoes, tente novamente mais tarde.',
  keyFn,
  skip,
} = {}) {
  const hits = new Map()

  const getKey =
    keyFn ||
    ((req) => {
      const ip = String(req.ip || req.connection?.remoteAddress || 'unknown')
      return `${id}:${ip}`
    })

  const shouldSkip = skip || (() => false)

  function sweep(now) {
    // Opportunistic cleanup: remove expired entries.
    // Keeps memory bounded without a timer.
    if (hits.size < 5000) return
    for (const [k, v] of hits.entries()) {
      if (!v || v.resetAt <= now) hits.delete(k)
    }
  }

  return (req, _res, next) => {
    try {
      if (shouldSkip(req)) return next()
    } catch {
      // if skip throws, be safe: do not block
      return next()
    }

    const now = Date.now()
    sweep(now)

    const key = String(getKey(req) || '')
    if (!key) return next()

    const cur = hits.get(key)
    if (!cur || cur.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }

    cur.count += 1
    if (cur.count > max) {
      throw tooManyRequests(message, {
        retry_after_ms: Math.max(0, cur.resetAt - now),
      })
    }
    return next()
  }
}

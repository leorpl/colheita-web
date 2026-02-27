import { env } from '../config/env.js'
import { unauthorized, forbidden } from '../errors.js'
import { parseCookies, sha256Hex } from '../auth/cookies.js'
import { usuarioSessaoRepo } from '../repositories/usuarioSessaoRepo.js'
import { hasPerm, permsForRole, menusForRole } from '../auth/permissions.js'

function getUserFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie)
  const token = cookies[env.SESSION_COOKIE_NAME]
  if (!token) return null

  usuarioSessaoRepo.purgeExpired()
  const token_hash = sha256Hex(token)
  const sess = usuarioSessaoRepo.getByTokenHash(token_hash)
  if (!sess) return null
  if (Number(sess.active) !== 1) return null

  const menus = (() => {
    try {
      const raw = sess.menus_json ? JSON.parse(sess.menus_json) : null
      if (Array.isArray(raw)) return raw.map((x) => String(x))
    } catch {
      // ignore
    }
    return menusForRole(sess.role)
  })()

  return {
    id: sess.usuario_id,
    username: sess.username,
    nome: sess.nome,
    role: sess.role,
    motorista_id: sess.motorista_id,
    perms: permsForRole(sess.role),
    menus,
  }
}

export function optionalAuth(req, _res, next) {
  if (Number(env.AUTH_ENABLED) !== 1) return next()
  const u = getUserFromRequest(req)
  if (u) req.user = u
  next()
}

export function authGate(req, res, next) {
  if (Number(env.AUTH_ENABLED) !== 1) return next()

  const p = String(req.path || '')
  if (p.startsWith('/health')) return next()
  if (p.startsWith('/public')) return next()

  // auth endpoints: allow without session, but attach user if present
  if (p.startsWith('/auth/')) {
    const u = getUserFromRequest(req)
    if (u) req.user = u
    return next()
  }

  const u = getUserFromRequest(req)
  if (!u) throw unauthorized('Nao autenticado')
  req.user = u

  next()
}

export function requirePerm(perm) {
  return (req, _res, next) => {
    if (Number(env.AUTH_ENABLED) !== 1) return next()
    if (!req.user) throw unauthorized('Nao autenticado')
    if (!hasPerm(req.user.role, perm)) throw forbidden('Sem permissao')
    next()
  }
}

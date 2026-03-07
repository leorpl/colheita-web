import { env } from '../config/env.js'
import { unauthorized, forbidden } from '../errors.js'
import { parseCookies, sha256Hex } from '../auth/cookies.js'
import { usuarioSessaoRepo } from '../repositories/usuarioSessaoRepo.js'
import { hasPerm, permsForRole, menusForRole } from '../auth/permissions.js'
import { can } from '../auth/acl.js'

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
    email: sess.email || null,
    nome: sess.nome,
    role: sess.role,
    motorista_id: sess.motorista_id,
    perms: permsForRole(sess.role),
    menus,
    must_change_password: Number(sess.must_change_password) === 1,
  }
}

// Blocks access to most endpoints when the user must change their password.
export function enforcePasswordChange(req, _res, next) {
  if (Number(env.AUTH_ENABLED) !== 1) return next()
  if (!req.user) return next()
  if (!req.user.must_change_password) return next()

  const p = String(req.path || '')
  // Allow minimal auth endpoints so the user can fix their password.
  if (p === '/auth/me') return next()
  if (p === '/auth/logout') return next()
  if (p === '/auth/change-password') return next()
  if (p === '/auth/login') return next()
  if (p === '/auth/forgot') return next()
  if (p === '/auth/reset') return next()
  if (p.startsWith('/health')) return next()

  throw forbidden('Troque sua senha para continuar', { code: 'PASSWORD_CHANGE_REQUIRED' })
}

// Attach req.user when session is valid.
// Does NOT block when not logged in (use requireAuth/requirePerm for that).
export function authenticate(req, _res, next) {
  if (Number(env.AUTH_ENABLED) !== 1) return next()
  const u = getUserFromRequest(req)
  if (u) req.user = u
  next()
}

export function requireAuth(req, _res, next) {
  if (Number(env.AUTH_ENABLED) !== 1) return next()
  if (!req.user) throw unauthorized('Nao autenticado')
  next()
}

export function optionalAuth(req, _res, next) {
  if (Number(env.AUTH_ENABLED) !== 1) return next()
  const u = getUserFromRequest(req)
  if (u) req.user = u
  next()
}

// Backwards-compat: old behavior (kept for now).
export function authGate(req, _res, next) {
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

export function requirePerm(...args) {
  // Overload:
  // - requirePerm(Permissions.CONFIG_READ)  -> legacy perm gate
  // - requirePerm(Modules.COLHEITA, Actions.VIEW) -> ACL gate (can)
  const [permOrModuleKey, action] = args
  if (args.length >= 2) {
    const moduleKey = permOrModuleKey
    return (req, _res, next) => {
      if (Number(env.AUTH_ENABLED) !== 1) return next()
      if (!req.user) throw unauthorized('Nao autenticado')
      if (!can(req.user, moduleKey, action)) throw forbidden('Sem permissao')
      next()
    }
  }

  return (req, _res, next) => {
    if (Number(env.AUTH_ENABLED) !== 1) return next()
    if (!req.user) throw unauthorized('Nao autenticado')
    if (!hasPerm(req.user.role, permOrModuleKey)) throw forbidden('Sem permissao')
    next()
  }
}

export function requireCan(moduleKey, action) {
  return (req, _res, next) => {
    if (Number(env.AUTH_ENABLED) !== 1) return next()
    if (!req.user) throw unauthorized('Nao autenticado')
    if (!can(req.user, moduleKey, action)) throw forbidden('Sem permissao')
    next()
  }
}

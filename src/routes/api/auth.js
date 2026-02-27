import { Router } from 'express'
import { z } from 'zod'

import { env } from '../../config/env.js'
import { validateBody } from '../../middleware/validate.js'
import { usuarioRepo } from '../../repositories/usuarioRepo.js'
import { usuarioSessaoRepo } from '../../repositories/usuarioSessaoRepo.js'
import { buildCookie, newToken, sha256Hex } from '../../auth/cookies.js'
import { verifyPassword } from '../../auth/password.js'
import { unauthorized } from '../../errors.js'
import { permsForRole } from '../../auth/permissions.js'

export const authRouter = Router()

const LoginBody = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
})

authRouter.post('/login', validateBody(LoginBody), (req, res) => {
  if (Number(env.AUTH_ENABLED) !== 1) {
    // Se auth nao estiver habilitado, ainda permite login para teste.
  }

  const { username, password } = req.body
  const u = usuarioRepo.getAuthByUsername(username)
  if (!u || Number(u.active) !== 1) throw unauthorized('Usuario/senha invalidos')

  const ok = verifyPassword(password, u.password_salt, u.password_hash)
  if (!ok) throw unauthorized('Usuario/senha invalidos')

  const token = newToken()
  const token_hash = sha256Hex(token)

  const ttlDays = Number(env.SESSION_TTL_DAYS || 30)
  const expires = new Date(Date.now() + ttlDays * 86400 * 1000)
  const expires_at = expires.toISOString().slice(0, 19).replace('T', ' ')
  usuarioSessaoRepo.create({ usuario_id: u.id, token_hash, expires_at })

  res.setHeader(
    'Set-Cookie',
    buildCookie({
      name: env.SESSION_COOKIE_NAME,
      value: token,
      maxAgeSeconds: ttlDays * 86400,
    }),
  )

  res.json({
    ok: true,
    user: {
      id: u.id,
      username: u.username,
      nome: u.nome,
      role: u.role,
      motorista_id: u.motorista_id,
      perms: permsForRole(u.role),
    },
  })
})

authRouter.post('/logout', (req, res) => {
  const cookie = String(req.headers.cookie || '')
  const m = cookie.match(new RegExp(`${env.SESSION_COOKIE_NAME}=([^;]+)`))
  const token = m ? decodeURIComponent(m[1]) : ''
  if (token) {
    usuarioSessaoRepo.deleteByTokenHash(sha256Hex(token))
  }
  res.setHeader(
    'Set-Cookie',
    buildCookie({ name: env.SESSION_COOKIE_NAME, value: '', maxAgeSeconds: 0 }),
  )
  res.json({ ok: true })
})

authRouter.get('/me', (req, res) => {
  // authGate injeta req.user quando habilitado
  if (!req.user) return res.json({ user: null })
  res.json({ user: req.user })
})

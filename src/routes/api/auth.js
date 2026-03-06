import { Router } from 'express'

import { env } from '../../config/env.js'
import { validateBody } from '../../middleware/validate.js'
import { usuarioRepo } from '../../repositories/usuarioRepo.js'
import { usuarioSessaoRepo } from '../../repositories/usuarioSessaoRepo.js'
import { buildCookie, newToken, sha256Hex } from '../../auth/cookies.js'
import { verifyPassword, hashPassword } from '../../auth/password.js'
import { unauthorized } from '../../errors.js'
import { permsForRole } from '../../auth/permissions.js'
import { AuthSchemas } from '../../validation/apiSchemas.js'
import crypto from 'node:crypto'
import { passwordResetRepo } from '../../repositories/passwordResetRepo.js'
import { sendPasswordResetEmail } from '../../services/mailer.js'
import { auditService } from '../../services/auditService.js'

export const authRouter = Router()

const LoginBody = AuthSchemas.LoginBody
const ForgotBody = AuthSchemas.ForgotBody
const ResetBody = AuthSchemas.ResetBody

authRouter.post('/login', validateBody(LoginBody), (req, res) => {
  if (Number(env.AUTH_ENABLED) !== 1) {
    // Se auth nao estiver habilitado, ainda permite login para teste.
  }

  const { username, password } = req.body
  const u = usuarioRepo.getAuthByUsername(username)
  if (!u || Number(u.active) !== 1) {
    auditService.log(req, { module_name: 'auth', record_id: null, action_type: 'login_failed', notes: `username=${username}` })
    throw unauthorized('Usuario/senha invalidos')
  }

  const ok = verifyPassword(password, u.password_salt, u.password_hash)
  if (!ok) {
    auditService.log(req, { module_name: 'auth', record_id: u.id, action_type: 'login_failed', notes: `username=${username}` })
    throw unauthorized('Usuario/senha invalidos')
  }

  const token = newToken()
  const token_hash = sha256Hex(token)

  const ttlDays = Number(env.SESSION_TTL_DAYS || 30)
  const expires = new Date(Date.now() + ttlDays * 86400 * 1000)
  const expires_at = expires.toISOString().slice(0, 19).replace('T', ' ')
  usuarioSessaoRepo.create({ usuario_id: u.id, token_hash, expires_at })

  // Attach req.user for audit context.
  req.user = {
    id: u.id,
    username: u.username,
    nome: u.nome,
    role: u.role,
    motorista_id: u.motorista_id,
  }
  auditService.log(req, { module_name: 'auth', record_id: u.id, action_type: 'login', notes: 'login ok' })

  res.setHeader(
    'Set-Cookie',
    buildCookie({
      name: env.SESSION_COOKIE_NAME,
      value: token,
      maxAgeSeconds: ttlDays * 86400,
      secure: Number(env.COOKIE_SECURE) === 1,
      sameSite: env.COOKIE_SAMESITE,
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

authRouter.post('/forgot', validateBody(ForgotBody), async (req, res) => {
  // Always return ok to avoid leaking whether the email exists.
  const email = String(req.body.email || '').trim()

  try {
    passwordResetRepo.purgeExpired()
    const u = usuarioRepo.getAuthByUsername(email)
    if (u && Number(u.active) === 1) {
      const token = crypto.randomBytes(32).toString('hex')
      const token_hash = sha256Hex(token)
      const ttlMin = 45
      const expires = new Date(Date.now() + ttlMin * 60 * 1000)
      const expires_at = expires.toISOString().slice(0, 19).replace('T', ' ')
      passwordResetRepo.create({ user_id: u.id, token_hash, expires_at })

      const base = String(env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '') || `${req.protocol}://${req.get('host')}`
      const resetUrl = `${base}/reset?token=${encodeURIComponent(token)}`
      await sendPasswordResetEmail({ to: email, resetUrl })

      req.user = { id: u.id, username: u.username, nome: u.nome, role: u.role, motorista_id: u.motorista_id }
      auditService.log(req, { module_name: 'auth', record_id: u.id, action_type: 'password_reset', notes: 'solicitou redefinicao (forgot)' })
    }
  } catch {
    // Swallow errors; keep generic response.
  }

  res.json({ ok: true })
})

authRouter.post('/reset', validateBody(ResetBody), (req, res) => {
  const token = String(req.body.token || '').trim()
  const password = String(req.body.password || '')

  const token_hash = sha256Hex(token)
  const row = passwordResetRepo.getValidByHash(token_hash)
  if (!row) {
    // Generic message
    throw unauthorized('Token invalido ou expirado')
  }

  const u = usuarioRepo.get(row.user_id)
  if (!u || Number(u.active) !== 1) {
    throw unauthorized('Token invalido ou expirado')
  }

  const { salt, hash } = hashPassword(password)
  usuarioRepo.setPassword(row.user_id, { password_hash: hash, password_salt: salt }, { user_id: row.user_id })
  passwordResetRepo.markUsed(row.id)
  usuarioSessaoRepo.deleteByUserId(row.user_id)

  req.user = { id: u.id, username: u.username, nome: u.nome, role: u.role, motorista_id: u.motorista_id }
  auditService.log(req, { module_name: 'auth', record_id: u.id, action_type: 'password_reset', notes: 'redefiniu senha (token)' })

  res.json({ ok: true })
})

authRouter.post('/logout', (req, res) => {
  const cookie = String(req.headers.cookie || '')
  const m = cookie.match(new RegExp(`${env.SESSION_COOKIE_NAME}=([^;]+)`))
  const token = m ? decodeURIComponent(m[1]) : ''
  if (token) {
    usuarioSessaoRepo.deleteByTokenHash(sha256Hex(token))
  }

  if (req.user?.id) {
    auditService.log(req, { module_name: 'auth', record_id: req.user.id, action_type: 'logout' })
  }
  res.setHeader(
    'Set-Cookie',
    buildCookie({
      name: env.SESSION_COOKIE_NAME,
      value: '',
      maxAgeSeconds: 0,
      secure: Number(env.COOKIE_SECURE) === 1,
      sameSite: env.COOKIE_SAMESITE,
    }),
  )
  res.json({ ok: true })
})

authRouter.get('/me', (req, res) => {
  // authGate injeta req.user quando habilitado
  if (!req.user) return res.json({ user: null })
  res.json({ user: req.user })
})

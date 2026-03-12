import { env } from '../config/env.js'
import { logger } from '../logger.js'
import nodemailer from 'nodemailer'

function hasSmtp() {
  return Boolean(String(env.SMTP_HOST || '').trim())
}

let cached = null

function getTransporter() {
  if (cached) return cached
  const host = String(env.SMTP_HOST || '').trim()
  if (!host) return null

  const port = Number(env.SMTP_PORT || 587)
  const secure = port === 465
  const user = String(env.SMTP_USER || '').trim()
  const pass = String(env.SMTP_PASS || '').trim()

  cached = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  })
  return cached
}

export async function sendSystemEmail({ to, subject, text, html }) {
  const email = String(to || '').trim()
  const subj = String(subject || '').trim()
  if (!email || !subj) return { ok: false, skipped: true, reason: 'missing_to_or_subject' }

  if (!hasSmtp()) {
    if (env.NODE_ENV === 'development') {
      logger.warn({ to: email, subject: subj, text }, 'DEV email (SMTP not configured)')
      return { ok: true, dev: true }
    }
    logger.warn({ to: email, subject: subj }, 'SMTP not configured; email not sent')
    return { ok: false, skipped: true, reason: 'smtp_not_configured' }
  }

  const transporter = getTransporter()
  if (!transporter) return { ok: false, skipped: true, reason: 'no_transporter' }

  const from = String(env.SMTP_FROM || '').trim() || String(env.SMTP_USER || '').trim() || 'no-reply@localhost'
  try {
    await transporter.sendMail({
      from,
      to: email,
      subject: subj.slice(0, 200),
      text: String(text || '').slice(0, 150_000),
      html: html ? String(html).slice(0, 350_000) : undefined,
    })
    return { ok: true }
  } catch (e) {
    logger.warn({ to: email, err: String(e?.message || e) }, 'SMTP failed; email not sent')
    return { ok: false, error: String(e?.message || e) }
  }
}

export async function sendPasswordResetEmail({ to, resetUrl }) {
  const email = String(to || '').trim()
  const url = String(resetUrl || '').trim()

  if (!email || !url) return

  // SMTP not configured yet.
  if (!hasSmtp()) {
    if (env.NODE_ENV === 'development') {
      logger.warn({ to: email, resetUrl: url }, 'DEV password reset link')
    } else {
      logger.warn({ to: email }, 'SMTP not configured; password reset email not sent')
    }
    return
  }

  const transporter = getTransporter()
  if (!transporter) return

  const from = String(env.SMTP_FROM || '').trim() || String(env.SMTP_USER || '').trim() || 'no-reply@localhost'

  try {
    await transporter.sendMail({
      from,
      to: email,
      subject: 'Redefinir senha - NazcaTracker',
      text: `Para redefinir sua senha, acesse o link:\n\n${url}\n\nSe voce nao solicitou, ignore este e-mail.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.4">
          <h2 style="margin:0 0 10px">Redefinir senha</h2>
          <p>Clique no link para definir uma nova senha:</p>
          <p><a href="${url}">${url}</a></p>
          <p style="color:#666">Se voce nao solicitou, ignore este e-mail.</p>
        </div>
      `.trim(),
    })
  } catch (e) {
    logger.warn({ to: email, err: String(e?.message || e) }, 'SMTP failed; password reset email not sent')
  }
}

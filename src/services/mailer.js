import { env } from '../config/env.js'
import { logger } from '../logger.js'

function hasSmtp() {
  return Boolean(String(env.SMTP_HOST || '').trim())
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

  // TODO: implement SMTP send when mailbox is available.
  // We intentionally avoid a half-baked SMTP client here.
  logger.warn({ to: email }, 'SMTP configured but mailer not implemented')
}

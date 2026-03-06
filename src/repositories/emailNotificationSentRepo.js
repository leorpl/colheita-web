import { db } from '../db/db.js'

export const emailNotificationSentRepo = {
  has({ user_id, audit_log_id }) {
    const row = db
      .prepare(
        `SELECT 1 as ok
         FROM email_notification_sent
         WHERE user_id=@user_id AND audit_log_id=@audit_log_id
         LIMIT 1`,
      )
      .get({ user_id: Number(user_id), audit_log_id: Number(audit_log_id) })
    return Boolean(row?.ok)
  },

  mark({ user_id, audit_log_id, status = 'sent', error = null }) {
    const st = String(status || 'sent').trim().toLowerCase()
    const safeSt = ['sent', 'skipped', 'failed'].includes(st) ? st : 'sent'
    db.prepare(
      `INSERT INTO email_notification_sent (user_id, audit_log_id, status, error)
       VALUES (@user_id, @audit_log_id, @status, @error)
       ON CONFLICT(user_id, audit_log_id) DO UPDATE SET
         status=excluded.status,
         error=excluded.error`,
    ).run({
      user_id: Number(user_id),
      audit_log_id: Number(audit_log_id),
      status: safeSt,
      error: error ? String(error).slice(0, 1500) : null,
    })
  },
}

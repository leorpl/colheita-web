import { db } from '../db/db.js'

function normModule(mod) {
  return String(mod || '').trim().toLowerCase()
}

export const userNotificationPrefRepo = {
  listByUser(user_id) {
    return db
      .prepare(
        `SELECT *
         FROM user_notification_preferences
         WHERE user_id=@user_id
         ORDER BY CASE WHEN module='*' THEN 0 ELSE 1 END, module ASC`,
      )
      .all({ user_id: Number(user_id) })
  },

  replaceForUser(user_id, prefs = []) {
    const uid = Number(user_id)
    const list = Array.isArray(prefs) ? prefs : []

    const norm = list
      .map((p) => ({
        module: normModule(p.module),
        notify_create: p.notify_create ? 1 : 0,
        notify_update: p.notify_update ? 1 : 0,
        notify_delete: p.notify_delete ? 1 : 0,
        notify_status_change: p.notify_status_change ? 1 : 0,
        notify_security_events: p.notify_security_events ? 1 : 0,
        delivery_mode: String(p.delivery_mode || 'immediate').trim().toLowerCase(),
      }))
      .filter((p) => p.module)
      .map((p) => ({
        ...p,
        delivery_mode: p.delivery_mode === 'daily' ? 'daily' : 'immediate',
      }))

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM user_notification_preferences WHERE user_id=?').run(uid)
      const ins = db.prepare(
        `INSERT INTO user_notification_preferences (
           user_id, module,
           notify_create, notify_update, notify_delete, notify_status_change, notify_security_events,
           delivery_mode, updated_at
         ) VALUES (
           @user_id, @module,
           @notify_create, @notify_update, @notify_delete, @notify_status_change, @notify_security_events,
           @delivery_mode, datetime('now')
         )`,
      )
      for (const p of norm) {
        ins.run({ user_id: uid, ...p })
      }
    })
    tx()
    return this.listByUser(uid)
  },
}

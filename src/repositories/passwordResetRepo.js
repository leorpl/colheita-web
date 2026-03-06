import { db } from '../db/db.js'

export const passwordResetRepo = {
  create({ user_id, token_hash, expires_at }) {
    const info = db
      .prepare(
        `INSERT INTO password_reset_token (user_id, token_hash, expires_at)
         VALUES (@user_id, @token_hash, @expires_at)`,
      )
      .run({ user_id, token_hash, expires_at })
    return this.get(info.lastInsertRowid)
  },

  get(id) {
    return db
      .prepare(
        `SELECT * FROM password_reset_token WHERE id=?`,
      )
      .get(id)
  },

  getValidByHash(token_hash) {
    return db
      .prepare(
        `SELECT *
         FROM password_reset_token
         WHERE token_hash=?
           AND used_at IS NULL
           AND expires_at > datetime('now')
         LIMIT 1`,
      )
      .get(token_hash)
  },

  markUsed(id) {
    db.prepare(
      `UPDATE password_reset_token
       SET used_at=datetime('now')
       WHERE id=?`,
    ).run(id)
  },

  purgeExpired() {
    db.prepare(
      `DELETE FROM password_reset_token
       WHERE expires_at <= datetime('now')`,
    ).run()
  },
}

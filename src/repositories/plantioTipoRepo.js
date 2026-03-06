import { db } from '../db/db.js'

export const plantioTipoRepo = {
  list() {
    return db.prepare('SELECT * FROM plantio_tipo ORDER BY nome').all()
  },
  get(id) {
    return db.prepare('SELECT * FROM plantio_tipo WHERE id=?').get(id)
  },
  create({ nome }, { user_id } = {}) {
    const info = db
      .prepare(
        `INSERT INTO plantio_tipo (nome, created_by_user_id, updated_by_user_id, updated_at)
         VALUES (@nome, @created_by_user_id, @updated_by_user_id, datetime('now'))`,
      )
      .run({ nome, created_by_user_id: user_id ?? null, updated_by_user_id: user_id ?? null })
    return this.get(info.lastInsertRowid)
  },
  update(id, { nome }, { user_id } = {}) {
    db.prepare(
      `UPDATE plantio_tipo
       SET nome=@nome, updated_by_user_id=@updated_by_user_id, updated_at=datetime('now')
       WHERE id=@id`,
    ).run({ id, nome, updated_by_user_id: user_id ?? null })
    return this.get(id)
  },
  remove(id) {
    return db.prepare('DELETE FROM plantio_tipo WHERE id=?').run(id)
  },
}

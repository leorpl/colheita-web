import { db } from '../db/db.js'

export const plantioTipoRepo = {
  list() {
    return db.prepare('SELECT * FROM plantio_tipo WHERE deleted_at IS NULL ORDER BY nome').all()
  },
  get(id) {
    return db.prepare('SELECT * FROM plantio_tipo WHERE id=? AND deleted_at IS NULL').get(id)
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
       WHERE id=@id AND deleted_at IS NULL`,
    ).run({ id, nome, updated_by_user_id: user_id ?? null })
    return this.get(id)
  },
  remove(id, { user_id } = {}) {
    return db
      .prepare(
        `UPDATE plantio_tipo
         SET deleted_at=datetime('now'), deleted_by_user_id=@deleted_by_user_id,
             updated_by_user_id=@updated_by_user_id, updated_at=datetime('now')
         WHERE id=@id AND deleted_at IS NULL`,
      )
      .run({ id, deleted_by_user_id: user_id ?? null, updated_by_user_id: user_id ?? null })
  },
}

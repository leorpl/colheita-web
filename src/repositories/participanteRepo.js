import { db } from '../db/db.js'

export const participanteRepo = {
  list({ include_inactive = false } = {}) {
    const whereActive = include_inactive ? '' : 'AND active = 1'
    return db
      .prepare(
        `SELECT * FROM participante
         WHERE deleted_at IS NULL ${whereActive}
         ORDER BY nome ASC, id DESC`,
      )
      .all()
  },

  get(id) {
    return db
      .prepare('SELECT * FROM participante WHERE id = ? AND deleted_at IS NULL')
      .get(id)
  },

  create(data, { user_id } = {}) {
    const info = db
      .prepare(
        `INSERT INTO participante (nome, tipo, documento, active, created_by_user_id, updated_by_user_id, updated_at)
         VALUES (@nome, @tipo, @documento, @active, @created_by_user_id, @updated_by_user_id, datetime('now'))`,
      )
      .run({
        ...data,
        active: data.active ? 1 : 0,
        created_by_user_id: user_id ?? null,
        updated_by_user_id: user_id ?? null,
      })
    return this.get(info.lastInsertRowid)
  },

  update(id, data, { user_id } = {}) {
    db.prepare(
      `UPDATE participante
       SET nome=@nome,
           tipo=@tipo,
           documento=@documento,
           active=@active,
           updated_by_user_id=@updated_by_user_id,
           updated_at=datetime('now')
       WHERE id=@id AND deleted_at IS NULL`,
    ).run({
      ...data,
      id,
      active: data.active ? 1 : 0,
      updated_by_user_id: user_id ?? null,
    })
    return this.get(id)
  },

  remove(id, { user_id } = {}) {
    return db
      .prepare(
        `UPDATE participante
         SET deleted_at=datetime('now'),
             deleted_by_user_id=@deleted_by_user_id,
             updated_by_user_id=@updated_by_user_id,
             updated_at=datetime('now')
         WHERE id=@id AND deleted_at IS NULL`,
      )
      .run({
        id,
        deleted_by_user_id: user_id ?? null,
        updated_by_user_id: user_id ?? null,
      })
  },
}

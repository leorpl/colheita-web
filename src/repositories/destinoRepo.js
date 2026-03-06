import { db } from '../db/db.js'

export const destinoRepo = {
  list() {
    return db.prepare('SELECT * FROM destino ORDER BY id DESC').all()
  },
  get(id) {
    return db.prepare('SELECT * FROM destino WHERE id = ?').get(id)
  },
  create(data, { user_id } = {}) {
    const info = db
      .prepare(
        `INSERT INTO destino (codigo, local, maps_url, distancia_km, observacoes, created_by_user_id, updated_by_user_id, updated_at)
         VALUES (@codigo, @local, @maps_url, @distancia_km, @observacoes, @created_by_user_id, @updated_by_user_id, datetime('now'))`,
      )
      .run({
        ...data,
        created_by_user_id: user_id ?? null,
        updated_by_user_id: user_id ?? null,
      })
    return this.get(info.lastInsertRowid)
  },
  update(id, data, { user_id } = {}) {
    db.prepare(
      `UPDATE destino
       SET codigo=@codigo, local=@local, maps_url=@maps_url, distancia_km=@distancia_km,
           observacoes=@observacoes, updated_by_user_id=@updated_by_user_id, updated_at=datetime('now')
       WHERE id=@id`,
    ).run({ ...data, id, updated_by_user_id: user_id ?? null })
    return this.get(id)
  },
  remove(id) {
    return db.prepare('DELETE FROM destino WHERE id=?').run(id)
  },
}

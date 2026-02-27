import { db } from '../db/db.js'

export const destinoRepo = {
  list() {
    return db.prepare('SELECT * FROM destino ORDER BY id DESC').all()
  },
  get(id) {
    return db.prepare('SELECT * FROM destino WHERE id = ?').get(id)
  },
  create(data) {
    const info = db
      .prepare(
        `INSERT INTO destino (codigo, local, maps_url, trava_sacas, distancia_km, observacoes, updated_at)
         VALUES (@codigo, @local, @maps_url, @trava_sacas, @distancia_km, @observacoes, datetime('now'))`,
      )
      .run(data)
    return this.get(info.lastInsertRowid)
  },
  update(id, data) {
    db.prepare(
      `UPDATE destino
       SET codigo=@codigo, local=@local, maps_url=@maps_url, trava_sacas=@trava_sacas, distancia_km=@distancia_km,
           observacoes=@observacoes, updated_at=datetime('now')
       WHERE id=@id`,
    ).run({ ...data, id })
    return this.get(id)
  },
  remove(id) {
    return db.prepare('DELETE FROM destino WHERE id=?').run(id)
  },
}

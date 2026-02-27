import { db } from '../db/db.js'

export const safraRepo = {
  list() {
    return db
      .prepare(
        `SELECT * FROM safra
         ORDER BY
           CASE WHEN data_referencia IS NULL OR data_referencia='' THEN 1 ELSE 0 END,
           data_referencia DESC,
           id DESC`,
      )
      .all()
  },
  get(id) {
    return db.prepare('SELECT * FROM safra WHERE id = ?').get(id)
  },
  create(data) {
    const stmt = db.prepare(
      `INSERT INTO safra (safra, plantio, data_referencia, area_ha, updated_at)
       VALUES (@safra, @plantio, @data_referencia, @area_ha, datetime('now'))`,
    )
    const info = stmt.run(data)
    return this.get(info.lastInsertRowid)
  },
  update(id, data) {
    db.prepare(
      `UPDATE safra
       SET safra=@safra, plantio=@plantio, data_referencia=@data_referencia, area_ha=@area_ha, updated_at=datetime('now')
       WHERE id=@id`,
    ).run({ ...data, id })
    return this.get(id)
  },
  remove(id) {
    return db.prepare('DELETE FROM safra WHERE id=?').run(id)
  },

  setPainel(id) {
    db.exec('BEGIN')
    try {
      db.prepare('UPDATE safra SET painel=0').run()
      db.prepare('UPDATE safra SET painel=1, updated_at=datetime(\'now\') WHERE id=?').run(id)
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
    return this.get(id)
  },
}

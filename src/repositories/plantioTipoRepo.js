import { db } from '../db/db.js'

export const plantioTipoRepo = {
  list() {
    return db.prepare('SELECT * FROM plantio_tipo ORDER BY nome').all()
  },
  get(id) {
    return db.prepare('SELECT * FROM plantio_tipo WHERE id=?').get(id)
  },
  create({ nome }) {
    const info = db
      .prepare(
        `INSERT INTO plantio_tipo (nome, updated_at) VALUES (@nome, datetime('now'))`,
      )
      .run({ nome })
    return this.get(info.lastInsertRowid)
  },
  update(id, { nome }) {
    db.prepare(
      `UPDATE plantio_tipo SET nome=@nome, updated_at=datetime('now') WHERE id=@id`,
    ).run({ id, nome })
    return this.get(id)
  },
  remove(id) {
    return db.prepare('DELETE FROM plantio_tipo WHERE id=?').run(id)
  },
}

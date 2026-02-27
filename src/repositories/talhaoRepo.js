import { db } from '../db/db.js'

export const talhaoRepo = {
  list() {
    return db.prepare('SELECT * FROM talhao ORDER BY id DESC').all()
  },
  get(id) {
    return db.prepare('SELECT * FROM talhao WHERE id = ?').get(id)
  },
  create(data) {
    const info = db
      .prepare(
        `INSERT INTO talhao (codigo, local, nome, situacao, hectares, posse, contrato, observacoes,
                             irrigacao, foto_url, maps_url, tipo_solo, calagem, gessagem, fosforo_corretivo, updated_at)
         VALUES (@codigo, @local, @nome, @situacao, @hectares, @posse, @contrato, @observacoes,
                 @irrigacao, @foto_url, @maps_url, @tipo_solo, @calagem, @gessagem, @fosforo_corretivo, datetime('now'))`,
      )
      .run(data)
    return this.get(info.lastInsertRowid)
  },
  update(id, data) {
    db.prepare(
      `UPDATE talhao
       SET codigo=@codigo, local=@local, nome=@nome, situacao=@situacao, hectares=@hectares,
            posse=@posse, contrato=@contrato, observacoes=@observacoes,
            irrigacao=@irrigacao, foto_url=@foto_url, maps_url=@maps_url, tipo_solo=@tipo_solo, calagem=@calagem, gessagem=@gessagem, fosforo_corretivo=@fosforo_corretivo,
            updated_at=datetime('now')
       WHERE id=@id`,
    ).run({ ...data, id })
    return this.get(id)
  },
  remove(id) {
    return db.prepare('DELETE FROM talhao WHERE id=?').run(id)
  },
}

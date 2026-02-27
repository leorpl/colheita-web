import { db } from '../db/db.js'

export const motoristaQuitacaoRepo = {
  list({ de, ate, motorista_id } = {}) {
    const where = []
    const params = {}

    if (motorista_id) {
      where.push('q.motorista_id = @motorista_id')
      params.motorista_id = motorista_id
    }
    // por padrao, filtra quitacoes contidas no periodo
    if (de) {
      where.push('q.de >= @de')
      params.de = de
    }
    if (ate) {
      where.push('q.ate <= @ate')
      params.ate = ate
    }

    const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : ''

    return db
      .prepare(
        `SELECT q.*, m.nome as motorista_nome, m.placa as motorista_placa
         FROM motorista_quitacao q
         JOIN motorista m ON m.id = q.motorista_id
         ${sqlWhere}
         ORDER BY q.data_pagamento DESC, q.id DESC`,
      )
      .all(params)
  },

  create(data) {
    const info = db
      .prepare(
        `INSERT INTO motorista_quitacao (
          motorista_id, de, ate, data_pagamento, valor, forma_pagamento, observacoes, updated_at
        ) VALUES (
          @motorista_id, @de, @ate, @data_pagamento, @valor, @forma_pagamento, @observacoes, datetime('now')
        )`,
      )
      .run(data)

    return db
      .prepare(
        `SELECT q.*, m.nome as motorista_nome, m.placa as motorista_placa
         FROM motorista_quitacao q
         JOIN motorista m ON m.id = q.motorista_id
         WHERE q.id = ?`,
      )
      .get(info.lastInsertRowid)
  },

  get(id) {
    return db
      .prepare(
        `SELECT q.*, m.nome as motorista_nome, m.placa as motorista_placa
         FROM motorista_quitacao q
         JOIN motorista m ON m.id = q.motorista_id
         WHERE q.id = ?`,
      )
      .get(id)
  },

  update(id, data) {
    db.prepare(
      `UPDATE motorista_quitacao
       SET motorista_id=@motorista_id,
           de=@de,
           ate=@ate,
           data_pagamento=@data_pagamento,
           valor=@valor,
           forma_pagamento=@forma_pagamento,
           observacoes=@observacoes,
           updated_at=datetime('now')
       WHERE id=@id`,
    ).run({ ...data, id })
    return this.get(id)
  },

  remove(id) {
    return db.prepare('DELETE FROM motorista_quitacao WHERE id=?').run(id)
  },
}

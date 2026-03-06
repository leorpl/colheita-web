import { db } from '../db/db.js'

export const motoristaQuitacaoRepo = {
  list({ de, ate, motorista_id } = {}) {
    const params = {
      motorista_id: motorista_id ?? null,
      de: de ?? null,
      ate: ate ?? null,
    }
    return db
      .prepare(
        `SELECT q.*, m.nome as motorista_nome, m.placa as motorista_placa
         FROM motorista_quitacao q
         JOIN motorista m ON m.id = q.motorista_id
         WHERE (@motorista_id IS NULL OR q.motorista_id = @motorista_id)
           AND (@de IS NULL OR q.de >= @de)
           AND (@ate IS NULL OR q.ate <= @ate)
           AND q.deleted_at IS NULL
         ORDER BY q.data_pagamento DESC, q.id DESC`,
      )
      .all(params)
  },

  create(data, { user_id } = {}) {
    const info = db
      .prepare(
        `INSERT INTO motorista_quitacao (
          motorista_id, de, ate, data_pagamento, valor, forma_pagamento, observacoes,
          created_by_user_id, updated_by_user_id, updated_at
        ) VALUES (
          @motorista_id, @de, @ate, @data_pagamento, @valor, @forma_pagamento, @observacoes,
          @created_by_user_id, @updated_by_user_id, datetime('now')
        )`,
      )
      .run({ ...data, created_by_user_id: user_id ?? null, updated_by_user_id: user_id ?? null })

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
         WHERE q.id = ? AND q.deleted_at IS NULL`,
      )
      .get(id)
  },

  update(id, data, { user_id } = {}) {
    db.prepare(
      `UPDATE motorista_quitacao
       SET motorista_id=@motorista_id,
           de=@de,
           ate=@ate,
           data_pagamento=@data_pagamento,
           valor=@valor,
           forma_pagamento=@forma_pagamento,
           observacoes=@observacoes,
           updated_by_user_id=@updated_by_user_id,
           updated_at=datetime('now')
       WHERE id=@id AND deleted_at IS NULL`,
    ).run({ ...data, id, updated_by_user_id: user_id ?? null })
    return this.get(id)
  },

  remove(id, { user_id } = {}) {
    return db
      .prepare(
        `UPDATE motorista_quitacao
         SET deleted_at=datetime('now'), deleted_by_user_id=@deleted_by_user_id,
             updated_by_user_id=@updated_by_user_id, updated_at=datetime('now')
         WHERE id=@id AND deleted_at IS NULL`,
      )
      .run({ id, deleted_by_user_id: user_id ?? null, updated_by_user_id: user_id ?? null })
  },
}

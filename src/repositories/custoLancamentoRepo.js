import { db } from '../db/db.js'

export const custoLancamentoRepo = {
  list({ safra_id, talhao_id } = {}) {
    const sid = Number(safra_id || 0)
    const tid = Number(talhao_id || 0)
    const where = []
    const params = {}
    if (sid) {
      where.push('c.safra_id=@safra_id')
      params.safra_id = sid
    }
    if (tid) {
      where.push('c.talhao_id=@talhao_id')
      params.talhao_id = tid
    }
    const w = where.length ? `AND ${where.join(' AND ')}` : ''
    return db
      .prepare(
        `SELECT c.*, s.safra as safra_nome, t.nome as talhao_nome, t.local as talhao_local
         FROM custo_lancamento c
         JOIN safra s ON s.id = c.safra_id
         JOIN talhao t ON t.id = c.talhao_id
         WHERE c.deleted_at IS NULL ${w}
         ORDER BY COALESCE(c.data_ref, c.created_at) DESC, c.id DESC`,
      )
      .all(params)
  },

  get(id) {
    return db
      .prepare('SELECT * FROM custo_lancamento WHERE id = ? AND deleted_at IS NULL')
      .get(id)
  },

  create(data, { user_id } = {}) {
    const info = db
      .prepare(
        `INSERT INTO custo_lancamento (
           safra_id, talhao_id, data_ref, custo_tipo, valor_rs, valor_sacas, observacoes,
           created_by_user_id, updated_by_user_id, updated_at
         ) VALUES (
           @safra_id, @talhao_id, @data_ref, @custo_tipo, @valor_rs, @valor_sacas, @observacoes,
           @created_by_user_id, @updated_by_user_id, datetime('now')
         )`,
      )
      .run({
        ...data,
        safra_id: Number(data.safra_id),
        talhao_id: Number(data.talhao_id),
        valor_rs: data.valor_rs === null || data.valor_rs === undefined ? null : Number(data.valor_rs),
        valor_sacas: data.valor_sacas === null || data.valor_sacas === undefined ? null : Number(data.valor_sacas),
        created_by_user_id: user_id ?? null,
        updated_by_user_id: user_id ?? null,
      })
    return this.get(info.lastInsertRowid)
  },

  update(id, data, { user_id } = {}) {
    db.prepare(
      `UPDATE custo_lancamento
       SET safra_id=@safra_id,
           talhao_id=@talhao_id,
           data_ref=@data_ref,
           custo_tipo=@custo_tipo,
           valor_rs=@valor_rs,
           valor_sacas=@valor_sacas,
           observacoes=@observacoes,
           updated_by_user_id=@updated_by_user_id,
           updated_at=datetime('now')
       WHERE id=@id AND deleted_at IS NULL`,
    ).run({
      ...data,
      id: Number(id),
      safra_id: Number(data.safra_id),
      talhao_id: Number(data.talhao_id),
      valor_rs: data.valor_rs === null || data.valor_rs === undefined ? null : Number(data.valor_rs),
      valor_sacas: data.valor_sacas === null || data.valor_sacas === undefined ? null : Number(data.valor_sacas),
      updated_by_user_id: user_id ?? null,
    })
    return this.get(id)
  },

  remove(id, { user_id } = {}) {
    return db
      .prepare(
        `UPDATE custo_lancamento
         SET deleted_at=datetime('now'), deleted_by_user_id=@deleted_by_user_id,
             updated_by_user_id=@updated_by_user_id, updated_at=datetime('now')
         WHERE id=@id AND deleted_at IS NULL`,
      )
      .run({ id, deleted_by_user_id: user_id ?? null, updated_by_user_id: user_id ?? null })
  },
}

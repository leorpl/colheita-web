import { db } from '../db/db.js'

function computeValorTotal(sacas, preco) {
  const s = Number(sacas)
  const p = Number(preco)
  if (!Number.isFinite(s) || !Number.isFinite(p)) return null
  return s * p
}

export const vendaSacaRepo = {
  list({ safra_id } = {}) {
    const sid = Number(safra_id || 0)
    const whereSafra = sid ? 'AND v.safra_id = @safra_id' : ''
    return db
      .prepare(
        `SELECT v.*, s.safra as safra_nome, p.nome as participante_nome,
                d.local as destino_local, t.nome as talhao_nome, t.local as talhao_local
         FROM venda_saca v
         JOIN safra s ON s.id = v.safra_id
         JOIN participante p ON p.id = v.participante_id
         LEFT JOIN destino d ON d.id = v.destino_id
         LEFT JOIN talhao t ON t.id = v.talhao_id
         WHERE v.deleted_at IS NULL ${whereSafra}
         ORDER BY v.data_venda DESC, v.id DESC`,
      )
      .all({ safra_id: sid })
  },

  get(id) {
    return db
      .prepare('SELECT * FROM venda_saca WHERE id = ? AND deleted_at IS NULL')
      .get(id)
  },

  create(data, { user_id } = {}) {
    const info = db
      .prepare(
        `INSERT INTO venda_saca (
           safra_id, data_venda, participante_id, comprador_tipo, destino_id, terceiro_nome,
           tipo_plantio, talhao_id, sacas, preco_por_saca, valor_total, observacoes,
           created_by_user_id, updated_by_user_id, updated_at
         ) VALUES (
           @safra_id, @data_venda, @participante_id, @comprador_tipo, @destino_id, @terceiro_nome,
           @tipo_plantio, @talhao_id, @sacas, @preco_por_saca, @valor_total, @observacoes,
           @created_by_user_id, @updated_by_user_id, datetime('now')
         )`,
      )
      .run({
        ...data,
        safra_id: Number(data.safra_id),
        participante_id: Number(data.participante_id),
        destino_id: data.destino_id ? Number(data.destino_id) : null,
        talhao_id: data.talhao_id ? Number(data.talhao_id) : null,
        sacas: Number(data.sacas),
        preco_por_saca: Number(data.preco_por_saca),
        valor_total: computeValorTotal(data.sacas, data.preco_por_saca),
        created_by_user_id: user_id ?? null,
        updated_by_user_id: user_id ?? null,
      })
    return this.get(info.lastInsertRowid)
  },

  update(id, data, { user_id } = {}) {
    db.prepare(
      `UPDATE venda_saca
       SET safra_id=@safra_id,
           data_venda=@data_venda,
           participante_id=@participante_id,
           comprador_tipo=@comprador_tipo,
           destino_id=@destino_id,
           terceiro_nome=@terceiro_nome,
           tipo_plantio=@tipo_plantio,
           talhao_id=@talhao_id,
           sacas=@sacas,
           preco_por_saca=@preco_por_saca,
           valor_total=@valor_total,
           observacoes=@observacoes,
           updated_by_user_id=@updated_by_user_id,
           updated_at=datetime('now')
       WHERE id=@id AND deleted_at IS NULL`,
    ).run({
      ...data,
      id: Number(id),
      safra_id: Number(data.safra_id),
      participante_id: Number(data.participante_id),
      destino_id: data.destino_id ? Number(data.destino_id) : null,
      talhao_id: data.talhao_id ? Number(data.talhao_id) : null,
      sacas: Number(data.sacas),
      preco_por_saca: Number(data.preco_por_saca),
      valor_total: computeValorTotal(data.sacas, data.preco_por_saca),
      updated_by_user_id: user_id ?? null,
    })
    return this.get(id)
  },

  remove(id, { user_id } = {}) {
    return db
      .prepare(
        `UPDATE venda_saca
         SET deleted_at=datetime('now'), deleted_by_user_id=@deleted_by_user_id,
             updated_by_user_id=@updated_by_user_id, updated_at=datetime('now')
         WHERE id=@id AND deleted_at IS NULL`,
      )
      .run({ id, deleted_by_user_id: user_id ?? null, updated_by_user_id: user_id ?? null })
  },
}

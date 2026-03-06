import { db } from '../db/db.js'

function normRules(rules) {
  const out = []
  for (const r of rules || []) {
    if (!r) continue
    out.push({
      custo_tipo: String(r.custo_tipo || '').trim(),
      modo_rateio: String(r.modo_rateio || '').trim(),
      momento: String(r.momento || '').trim(),
      custom_json: r.custom_json ? String(r.custom_json) : null,
    })
  }
  return out
}

export const politicaCustosRepo = {
  list() {
    return db
      .prepare('SELECT * FROM politica_custos WHERE deleted_at IS NULL ORDER BY nome ASC, id DESC')
      .all()
  },

  get(id) {
    return db
      .prepare('SELECT * FROM politica_custos WHERE id = ? AND deleted_at IS NULL')
      .get(id)
  },

  listRegras(politica_custos_id) {
    return db
      .prepare(
        `SELECT * FROM politica_custos_regra
         WHERE politica_custos_id = ? AND deleted_at IS NULL
         ORDER BY custo_tipo ASC, id ASC`,
      )
      .all(politica_custos_id)
  },

  create(data, { user_id } = {}) {
    const info = db
      .prepare(
        `INSERT INTO politica_custos (nome, descricao, created_by_user_id, updated_by_user_id, updated_at)
         VALUES (@nome, @descricao, @created_by_user_id, @updated_by_user_id, datetime('now'))`,
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
      `UPDATE politica_custos
       SET nome=@nome,
           descricao=@descricao,
           updated_by_user_id=@updated_by_user_id,
           updated_at=datetime('now')
       WHERE id=@id AND deleted_at IS NULL`,
    ).run({ ...data, id, updated_by_user_id: user_id ?? null })
    return this.get(id)
  },

  replaceRegras(politica_custos_id, rules, { user_id } = {}) {
    const normalized = normRules(rules)

    const tx = db.transaction(() => {
      // clean existing (physical delete keeps schema simple)
      db.prepare('DELETE FROM politica_custos_regra WHERE politica_custos_id = ?').run(politica_custos_id)
      const ins = db.prepare(
        `INSERT INTO politica_custos_regra (
           politica_custos_id, custo_tipo, modo_rateio, momento, custom_json,
           created_by_user_id, updated_by_user_id, updated_at
         ) VALUES (
           @politica_custos_id, @custo_tipo, @modo_rateio, @momento, @custom_json,
           @created_by_user_id, @updated_by_user_id, datetime('now')
         )`,
      )
      for (const r of normalized) {
        ins.run({
          politica_custos_id,
          ...r,
          created_by_user_id: user_id ?? null,
          updated_by_user_id: user_id ?? null,
        })
      }
    })
    tx()

    return this.listRegras(politica_custos_id)
  },

  remove(id, { user_id } = {}) {
    return db
      .prepare(
        `UPDATE politica_custos
         SET deleted_at=datetime('now'), deleted_by_user_id=@deleted_by_user_id,
             updated_by_user_id=@updated_by_user_id, updated_at=datetime('now')
         WHERE id=@id AND deleted_at IS NULL`,
      )
      .run({ id, deleted_by_user_id: user_id ?? null, updated_by_user_id: user_id ?? null })
  },
}

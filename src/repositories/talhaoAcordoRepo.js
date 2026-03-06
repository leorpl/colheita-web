import { db } from '../db/db.js'

function normTipoPlantio(tp) {
  const s = String(tp ?? '').trim()
  return s
}

export const talhaoAcordoRepo = {
  list({ safra_id } = {}) {
    const sid = Number(safra_id || 0)
    const whereSafra = sid ? 'AND a.safra_id = @safra_id' : ''
    return db
      .prepare(
        `SELECT a.*, t.nome as talhao_nome, t.local as talhao_local, t.codigo as talhao_codigo,
                s.safra as safra_nome,
                p.nome as politica_nome
         FROM talhao_acordo a
         JOIN talhao t ON t.id = a.talhao_id
         JOIN safra s ON s.id = a.safra_id
         LEFT JOIN politica_custos p ON p.id = a.politica_custos_id
         WHERE a.deleted_at IS NULL ${whereSafra}
         ORDER BY a.safra_id DESC, t.local ASC, t.nome ASC, a.tipo_plantio ASC, a.id DESC`,
      )
      .all({ safra_id: sid })
  },

  get(id) {
    const a = db
      .prepare('SELECT * FROM talhao_acordo WHERE id = ? AND deleted_at IS NULL')
      .get(id)
    if (!a) return null
    const parts = db
      .prepare(
        `SELECT ap.*, pr.nome as participante_nome, pr.tipo as participante_tipo
         FROM talhao_acordo_participante ap
         JOIN participante pr ON pr.id = ap.participante_id
         WHERE ap.talhao_acordo_id = ? AND ap.deleted_at IS NULL
         ORDER BY ap.percentual_producao DESC, pr.nome ASC`,
      )
      .all(id)
    return { ...a, participantes: parts }
  },

  create(data, { user_id } = {}) {
    const tx = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO talhao_acordo (
             talhao_id, safra_id, tipo_plantio, vigencia_de, vigencia_ate, politica_custos_id, observacoes,
             created_by_user_id, updated_by_user_id, updated_at
           ) VALUES (
             @talhao_id, @safra_id, @tipo_plantio, @vigencia_de, @vigencia_ate, @politica_custos_id, @observacoes,
             @created_by_user_id, @updated_by_user_id, datetime('now')
           )`,
        )
        .run({
          talhao_id: Number(data.talhao_id),
          safra_id: Number(data.safra_id),
          tipo_plantio: normTipoPlantio(data.tipo_plantio),
          vigencia_de: data.vigencia_de || null,
          vigencia_ate: data.vigencia_ate || null,
          politica_custos_id: data.politica_custos_id ? Number(data.politica_custos_id) : null,
          observacoes: data.observacoes || null,
          created_by_user_id: user_id ?? null,
          updated_by_user_id: user_id ?? null,
        })

      const acordo_id = info.lastInsertRowid
      const ins = db.prepare(
        `INSERT INTO talhao_acordo_participante (
           talhao_acordo_id, participante_id, papel, percentual_producao,
           created_by_user_id, updated_by_user_id, updated_at
         ) VALUES (
           @talhao_acordo_id, @participante_id, @papel, @percentual_producao,
           @created_by_user_id, @updated_by_user_id, datetime('now')
         )`,
      )
      for (const p of data.participantes || []) {
        ins.run({
          talhao_acordo_id: acordo_id,
          participante_id: Number(p.participante_id),
          papel: String(p.papel || 'parceiro'),
          percentual_producao: Number(p.percentual_producao),
          created_by_user_id: user_id ?? null,
          updated_by_user_id: user_id ?? null,
        })
      }
      return acordo_id
    })

    const id = tx()
    return this.get(id)
  },

  update(id, data, { user_id } = {}) {
    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE talhao_acordo
         SET talhao_id=@talhao_id,
             safra_id=@safra_id,
             tipo_plantio=@tipo_plantio,
             vigencia_de=@vigencia_de,
             vigencia_ate=@vigencia_ate,
             politica_custos_id=@politica_custos_id,
             observacoes=@observacoes,
             updated_by_user_id=@updated_by_user_id,
             updated_at=datetime('now')
         WHERE id=@id AND deleted_at IS NULL`,
      ).run({
        id: Number(id),
        talhao_id: Number(data.talhao_id),
        safra_id: Number(data.safra_id),
        tipo_plantio: normTipoPlantio(data.tipo_plantio),
        vigencia_de: data.vigencia_de || null,
        vigencia_ate: data.vigencia_ate || null,
        politica_custos_id: data.politica_custos_id ? Number(data.politica_custos_id) : null,
        observacoes: data.observacoes || null,
        updated_by_user_id: user_id ?? null,
      })

      // replace participantes (physical delete is fine; audit logs cover the change)
      db.prepare('DELETE FROM talhao_acordo_participante WHERE talhao_acordo_id = ?').run(Number(id))
      const ins = db.prepare(
        `INSERT INTO talhao_acordo_participante (
           talhao_acordo_id, participante_id, papel, percentual_producao,
           created_by_user_id, updated_by_user_id, updated_at
         ) VALUES (
           @talhao_acordo_id, @participante_id, @papel, @percentual_producao,
           @created_by_user_id, @updated_by_user_id, datetime('now')
         )`,
      )
      for (const p of data.participantes || []) {
        ins.run({
          talhao_acordo_id: Number(id),
          participante_id: Number(p.participante_id),
          papel: String(p.papel || 'parceiro'),
          percentual_producao: Number(p.percentual_producao),
          created_by_user_id: user_id ?? null,
          updated_by_user_id: user_id ?? null,
        })
      }
    })
    tx()
    return this.get(id)
  },

  remove(id, { user_id } = {}) {
    return db
      .prepare(
        `UPDATE talhao_acordo
         SET deleted_at=datetime('now'), deleted_by_user_id=@deleted_by_user_id,
             updated_by_user_id=@updated_by_user_id, updated_at=datetime('now')
         WHERE id=@id AND deleted_at IS NULL`,
      )
      .run({ id, deleted_by_user_id: user_id ?? null, updated_by_user_id: user_id ?? null })
  },
}

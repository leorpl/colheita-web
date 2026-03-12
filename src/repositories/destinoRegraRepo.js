import { db } from '../db/db.js'

export const destinoRegraRepo = {
  getBySafraDestinoPlantio({ safra_id, destino_id, tipo_plantio }) {
    if (!tipo_plantio) return null
    const row = db
      .prepare(
        `SELECT * FROM destino_regra_plantio WHERE safra_id=? AND destino_id=? AND tipo_plantio=?`,
      )
      .get(safra_id, destino_id, tipo_plantio)
    return row ? { ...row, _kind: 'plantio' } : null
  },

  getBySafraDestino({ safra_id, destino_id }) {
    return db
      .prepare(
        `SELECT * FROM destino_regra WHERE safra_id=? AND destino_id=?`,
      )
      .get(safra_id, destino_id)
  },

  upsert(data, { user_id } = {}) {
    db.prepare(
       `INSERT INTO destino_regra (
           safra_id, destino_id, trava_sacas,
          custo_silo_por_saca, custo_terceiros_por_saca,
          cobrar_secagem_no_silo,
          impureza_limite_pct, ardidos_limite_pct, queimados_limite_pct,
           avariados_limite_pct, esverdiados_limite_pct, quebrados_limite_pct,
           created_by_user_id, updated_by_user_id, updated_at
         ) VALUES (
           @safra_id, @destino_id, @trava_sacas,
           @custo_silo_por_saca, @custo_terceiros_por_saca,
           @impureza_limite_pct, @ardidos_limite_pct, @queimados_limite_pct,
           @avariados_limite_pct, @esverdiados_limite_pct, @quebrados_limite_pct,
           @created_by_user_id, @updated_by_user_id, datetime('now')
         )
         ON CONFLICT(safra_id, destino_id) DO UPDATE SET
           trava_sacas=excluded.trava_sacas,
           custo_silo_por_saca=excluded.custo_silo_por_saca,
           custo_terceiros_por_saca=excluded.custo_terceiros_por_saca,
           impureza_limite_pct=excluded.impureza_limite_pct,
           ardidos_limite_pct=excluded.ardidos_limite_pct,
           queimados_limite_pct=excluded.queimados_limite_pct,
           avariados_limite_pct=excluded.avariados_limite_pct,
           esverdiados_limite_pct=excluded.esverdiados_limite_pct,
           quebrados_limite_pct=excluded.quebrados_limite_pct,
           updated_by_user_id=@updated_by_user_id,
           updated_at=datetime('now')`,
    ).run({ ...data, created_by_user_id: user_id ?? null, updated_by_user_id: user_id ?? null })

    return this.getBySafraDestino({
      safra_id: data.safra_id,
      destino_id: data.destino_id,
    })
  },

  upsertPlantio(data, { user_id } = {}) {
    db.prepare(
      `INSERT INTO destino_regra_plantio (
         safra_id, destino_id, tipo_plantio,
         custo_silo_por_saca, custo_terceiros_por_saca,
         impureza_limite_pct, ardidos_limite_pct, queimados_limite_pct,
         avariados_limite_pct, esverdiados_limite_pct, quebrados_limite_pct,
         created_by_user_id, updated_by_user_id, updated_at
       ) VALUES (
          @safra_id, @destino_id, @tipo_plantio,
          @custo_silo_por_saca, @custo_terceiros_por_saca,
          @cobrar_secagem_no_silo,
          @impureza_limite_pct, @ardidos_limite_pct, @queimados_limite_pct,
         @avariados_limite_pct, @esverdiados_limite_pct, @quebrados_limite_pct,
         @created_by_user_id, @updated_by_user_id, datetime('now')
       )
       ON CONFLICT(safra_id, destino_id, tipo_plantio) DO UPDATE SET
          custo_silo_por_saca=excluded.custo_silo_por_saca,
          custo_terceiros_por_saca=excluded.custo_terceiros_por_saca,
          cobrar_secagem_no_silo=excluded.cobrar_secagem_no_silo,
         impureza_limite_pct=excluded.impureza_limite_pct,
         ardidos_limite_pct=excluded.ardidos_limite_pct,
         queimados_limite_pct=excluded.queimados_limite_pct,
         avariados_limite_pct=excluded.avariados_limite_pct,
         esverdiados_limite_pct=excluded.esverdiados_limite_pct,
         quebrados_limite_pct=excluded.quebrados_limite_pct,
         updated_by_user_id=@updated_by_user_id,
         updated_at=datetime('now')`,
    ).run({ ...data, created_by_user_id: user_id ?? null, updated_by_user_id: user_id ?? null })

    return this.getBySafraDestinoPlantio({
      safra_id: data.safra_id,
      destino_id: data.destino_id,
      tipo_plantio: data.tipo_plantio,
    })
  },

  updatePlantioById(id, data, { user_id } = {}) {
    db.prepare(
      `UPDATE destino_regra_plantio
       SET safra_id=@safra_id,
           destino_id=@destino_id,
           tipo_plantio=@tipo_plantio,
            custo_silo_por_saca=@custo_silo_por_saca,
            custo_terceiros_por_saca=@custo_terceiros_por_saca,
            cobrar_secagem_no_silo=@cobrar_secagem_no_silo,
           impureza_limite_pct=@impureza_limite_pct,
           ardidos_limite_pct=@ardidos_limite_pct,
           queimados_limite_pct=@queimados_limite_pct,
           avariados_limite_pct=@avariados_limite_pct,
           esverdiados_limite_pct=@esverdiados_limite_pct,
           quebrados_limite_pct=@quebrados_limite_pct,
           updated_by_user_id=@updated_by_user_id,
           updated_at=datetime('now')
       WHERE id=@id`,
    ).run({ ...data, id, updated_by_user_id: user_id ?? null })

    return this.getPlantioById(id)
  },

  listBySafra({ safra_id }) {
    return db
      .prepare(
        `SELECT r.*, d.local as destino_local, d.codigo as destino_codigo
         FROM destino_regra r
         JOIN destino d ON d.id = r.destino_id
         WHERE r.safra_id=?
         ORDER BY d.local`,
      )
      .all(safra_id)
  },

  listPlantio({ safra_id } = {}) {
    return db
      .prepare(
        `SELECT * FROM (
           SELECT
             rp.id,
             rp.safra_id,
             rp.destino_id,
             rp.tipo_plantio,
             rp.custo_silo_por_saca,
             rp.custo_terceiros_por_saca,
             rp.impureza_limite_pct,
             rp.ardidos_limite_pct,
             rp.queimados_limite_pct,
             rp.avariados_limite_pct,
             rp.esverdiados_limite_pct,
             rp.quebrados_limite_pct,
             rp.created_at,
             rp.updated_at,
             rp.created_by_user_id,
             rp.updated_by_user_id,
             s.safra as safra_nome,
             d.local as destino_local,
             d.codigo as destino_codigo,
             0 as orphan_contract,
             c.id as contrato_silo_id,
             (SELECT COUNT(*) FROM contrato_silo_faixa cf WHERE cf.contrato_silo_id = c.id) as contrato_faixas_count
           FROM destino_regra_plantio rp
           JOIN safra s ON s.id = rp.safra_id
           JOIN destino d ON d.id = rp.destino_id
           LEFT JOIN contrato_silo c
             ON c.safra_id = rp.safra_id
            AND c.destino_id = rp.destino_id
            AND UPPER(c.tipo_plantio) = UPPER(rp.tipo_plantio)
           WHERE (@safra_id IS NULL OR rp.safra_id = @safra_id)

           UNION ALL

           SELECT
             -c.id as id,
             c.safra_id,
             c.destino_id,
             c.tipo_plantio,
             NULL as custo_silo_por_saca,
             NULL as custo_terceiros_por_saca,
             NULL as impureza_limite_pct,
             NULL as ardidos_limite_pct,
             NULL as queimados_limite_pct,
             NULL as avariados_limite_pct,
             NULL as esverdiados_limite_pct,
             NULL as quebrados_limite_pct,
             c.created_at,
             c.updated_at,
             NULL as created_by_user_id,
             NULL as updated_by_user_id,
             s.safra as safra_nome,
             d.local as destino_local,
             d.codigo as destino_codigo,
             1 as orphan_contract,
             c.id as contrato_silo_id,
             (SELECT COUNT(*) FROM contrato_silo_faixa cf WHERE cf.contrato_silo_id = c.id) as contrato_faixas_count
           FROM contrato_silo c
           JOIN safra s ON s.id = c.safra_id
           JOIN destino d ON d.id = c.destino_id
           LEFT JOIN destino_regra_plantio rp
             ON rp.safra_id = c.safra_id
            AND rp.destino_id = c.destino_id
            AND UPPER(rp.tipo_plantio) = UPPER(c.tipo_plantio)
           WHERE rp.id IS NULL
             AND (@safra_id IS NULL OR c.safra_id = @safra_id)
         ) x
         ORDER BY
           CASE WHEN x.updated_at IS NULL OR x.updated_at='' THEN 1 ELSE 0 END,
           x.updated_at DESC,
           x.id DESC`,
      )
      .all({ safra_id: safra_id ?? null })
  },

  listPlantioBySafraTipo({ safra_id, tipo_plantio }) {
    const sid = Number(safra_id)
    const tp = String(tipo_plantio || '').trim().toUpperCase()
    if (!Number.isInteger(sid) || sid <= 0) return []
    if (!tp) return []

    return db
      .prepare(
        `SELECT
           rp.*, s.safra as safra_nome,
           d.local as destino_local, d.codigo as destino_codigo
         FROM destino_regra_plantio rp
         JOIN safra s ON s.id = rp.safra_id
         JOIN destino d ON d.id = rp.destino_id
         WHERE rp.safra_id = @safra_id
           AND UPPER(rp.tipo_plantio) = @tipo_plantio
         ORDER BY d.local`,
      )
      .all({ safra_id: sid, tipo_plantio: tp })
  },

  getPlantioById(id) {
    return db
      .prepare(
        `SELECT rp.*, s.safra as safra_nome, d.local as destino_local, d.codigo as destino_codigo
         FROM destino_regra_plantio rp
         JOIN safra s ON s.id = rp.safra_id
         JOIN destino d ON d.id = rp.destino_id
         WHERE rp.id=?`,
      )
      .get(id)
  },

  removePlantio(id) {
    return db.prepare('DELETE FROM destino_regra_plantio WHERE id=?').run(id)
  },

  getUmidadeFaixas(destino_regra_id) {
    return db
      .prepare(
        `SELECT * FROM umidade_faixa WHERE destino_regra_id=? ORDER BY umid_gt, umid_lte`,
      )
      .all(destino_regra_id)
  },

  getUmidadeFaixasPlantio(destino_regra_plantio_id) {
    return db
      .prepare(
        `SELECT * FROM umidade_faixa_plantio WHERE destino_regra_plantio_id=? ORDER BY umid_gt, umid_lte`,
      )
      .all(destino_regra_plantio_id)
  },

  replaceUmidadeFaixas(destino_regra_id, faixas, { user_id } = {}) {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM umidade_faixa WHERE destino_regra_id=?').run(
        destino_regra_id,
      )
      const stmt = db.prepare(
        `INSERT INTO umidade_faixa (
           destino_regra_id, umid_gt, umid_lte, desconto_pct, custo_secagem_por_saca,
           created_by_user_id, updated_by_user_id, updated_at
          ) VALUES (
           @destino_regra_id, @umid_gt, @umid_lte, @desconto_pct, @custo_secagem_por_saca,
           @created_by_user_id, @updated_by_user_id, datetime('now')
          )`,
      )
      for (const f of faixas) {
        stmt.run({ destino_regra_id, ...f, created_by_user_id: user_id ?? null, updated_by_user_id: user_id ?? null })
      }
    })

    tx()
    return this.getUmidadeFaixas(destino_regra_id)
  },

  replaceUmidadeFaixasPlantio(destino_regra_plantio_id, faixas, { user_id } = {}) {
    const tx = db.transaction(() => {
      db.prepare(
        'DELETE FROM umidade_faixa_plantio WHERE destino_regra_plantio_id=?',
      ).run(destino_regra_plantio_id)
      const stmt = db.prepare(
        `INSERT INTO umidade_faixa_plantio (
           destino_regra_plantio_id, umid_gt, umid_lte, desconto_pct, custo_secagem_por_saca,
           created_by_user_id, updated_by_user_id, updated_at
          ) VALUES (
           @destino_regra_plantio_id, @umid_gt, @umid_lte, @desconto_pct, @custo_secagem_por_saca,
           @created_by_user_id, @updated_by_user_id, datetime('now')
          )`,
      )
      for (const f of faixas) {
        stmt.run({ destino_regra_plantio_id, ...f, created_by_user_id: user_id ?? null, updated_by_user_id: user_id ?? null })
      }
    })

    tx()
    return this.getUmidadeFaixasPlantio(destino_regra_plantio_id)
  },

  // compra por faixas foi removida (somente contrato)
}

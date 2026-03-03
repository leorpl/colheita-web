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

  upsert(data) {
    db.prepare(
       `INSERT INTO destino_regra (
          safra_id, destino_id, trava_sacas,
          custo_silo_por_saca, custo_terceiros_por_saca,
          impureza_limite_pct, ardidos_limite_pct, queimados_limite_pct,
          avariados_limite_pct, esverdiados_limite_pct, quebrados_limite_pct,
          updated_at
        ) VALUES (
          @safra_id, @destino_id, @trava_sacas,
          @custo_silo_por_saca, @custo_terceiros_por_saca,
          @impureza_limite_pct, @ardidos_limite_pct, @queimados_limite_pct,
          @avariados_limite_pct, @esverdiados_limite_pct, @quebrados_limite_pct,
          datetime('now')
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
          updated_at=datetime('now')`,
    ).run(data)

    return this.getBySafraDestino({
      safra_id: data.safra_id,
      destino_id: data.destino_id,
    })
  },

  upsertPlantio(data) {
    db.prepare(
      `INSERT INTO destino_regra_plantio (
         safra_id, destino_id, tipo_plantio, trava_sacas, valor_compra_por_saca,
         custo_silo_por_saca, custo_terceiros_por_saca,
         impureza_limite_pct, ardidos_limite_pct, queimados_limite_pct,
         avariados_limite_pct, esverdiados_limite_pct, quebrados_limite_pct,
         updated_at
       ) VALUES (
         @safra_id, @destino_id, @tipo_plantio, @trava_sacas, @valor_compra_por_saca,
         @custo_silo_por_saca, @custo_terceiros_por_saca,
         @impureza_limite_pct, @ardidos_limite_pct, @queimados_limite_pct,
         @avariados_limite_pct, @esverdiados_limite_pct, @quebrados_limite_pct,
         datetime('now')
       )
       ON CONFLICT(safra_id, destino_id, tipo_plantio) DO UPDATE SET
         trava_sacas=excluded.trava_sacas,
         valor_compra_por_saca=excluded.valor_compra_por_saca,
         custo_silo_por_saca=excluded.custo_silo_por_saca,
         custo_terceiros_por_saca=excluded.custo_terceiros_por_saca,
         impureza_limite_pct=excluded.impureza_limite_pct,
         ardidos_limite_pct=excluded.ardidos_limite_pct,
         queimados_limite_pct=excluded.queimados_limite_pct,
         avariados_limite_pct=excluded.avariados_limite_pct,
         esverdiados_limite_pct=excluded.esverdiados_limite_pct,
         quebrados_limite_pct=excluded.quebrados_limite_pct,
         updated_at=datetime('now')`,
    ).run(data)

    return this.getBySafraDestinoPlantio({
      safra_id: data.safra_id,
      destino_id: data.destino_id,
      tipo_plantio: data.tipo_plantio,
    })
  },

  updatePlantioById(id, data) {
    db.prepare(
      `UPDATE destino_regra_plantio
       SET safra_id=@safra_id,
           destino_id=@destino_id,
           tipo_plantio=@tipo_plantio,
           trava_sacas=@trava_sacas,
           valor_compra_por_saca=@valor_compra_por_saca,
           custo_silo_por_saca=@custo_silo_por_saca,
           custo_terceiros_por_saca=@custo_terceiros_por_saca,
           impureza_limite_pct=@impureza_limite_pct,
           ardidos_limite_pct=@ardidos_limite_pct,
           queimados_limite_pct=@queimados_limite_pct,
           avariados_limite_pct=@avariados_limite_pct,
           esverdiados_limite_pct=@esverdiados_limite_pct,
           quebrados_limite_pct=@quebrados_limite_pct,
           updated_at=datetime('now')
       WHERE id=@id`,
    ).run({ ...data, id })

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
        `SELECT
           rp.*, s.safra as safra_nome,
           d.local as destino_local, d.codigo as destino_codigo
         FROM destino_regra_plantio rp
         JOIN safra s ON s.id = rp.safra_id
         JOIN destino d ON d.id = rp.destino_id
          WHERE (@safra_id IS NULL OR rp.safra_id = @safra_id)
          ORDER BY
            CASE WHEN rp.updated_at IS NULL OR rp.updated_at='' THEN 1 ELSE 0 END,
            rp.updated_at DESC,
            rp.id DESC`,
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

  replaceUmidadeFaixas(destino_regra_id, faixas) {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM umidade_faixa WHERE destino_regra_id=?').run(
        destino_regra_id,
      )
      const stmt = db.prepare(
        `INSERT INTO umidade_faixa (
           destino_regra_id, umid_gt, umid_lte, desconto_pct, custo_secagem_por_saca, updated_at
         ) VALUES (
           @destino_regra_id, @umid_gt, @umid_lte, @desconto_pct, @custo_secagem_por_saca, datetime('now')
         )`,
      )
      for (const f of faixas) {
        stmt.run({ destino_regra_id, ...f })
      }
    })

    tx()
    return this.getUmidadeFaixas(destino_regra_id)
  },

  replaceUmidadeFaixasPlantio(destino_regra_plantio_id, faixas) {
    const tx = db.transaction(() => {
      db.prepare(
        'DELETE FROM umidade_faixa_plantio WHERE destino_regra_plantio_id=?',
      ).run(destino_regra_plantio_id)
      const stmt = db.prepare(
        `INSERT INTO umidade_faixa_plantio (
           destino_regra_plantio_id, umid_gt, umid_lte, desconto_pct, custo_secagem_por_saca, updated_at
         ) VALUES (
           @destino_regra_plantio_id, @umid_gt, @umid_lte, @desconto_pct, @custo_secagem_por_saca, datetime('now')
         )`,
      )
      for (const f of faixas) {
        stmt.run({ destino_regra_plantio_id, ...f })
      }
    })

    tx()
    return this.getUmidadeFaixasPlantio(destino_regra_plantio_id)
  },

  getCompraFaixasPlantio(destino_regra_plantio_id) {
    return db
      .prepare(
        `SELECT * FROM destino_compra_faixa_plantio
         WHERE destino_regra_plantio_id=?
         ORDER BY sacas_gt, COALESCE(sacas_lte, 1e18)`,
      )
      .all(destino_regra_plantio_id)
  },

  replaceCompraFaixasPlantio(destino_regra_plantio_id, faixas) {
    const tx = db.transaction(() => {
      db.prepare(
        'DELETE FROM destino_compra_faixa_plantio WHERE destino_regra_plantio_id=?',
      ).run(destino_regra_plantio_id)

      const stmt = db.prepare(
        `INSERT INTO destino_compra_faixa_plantio (
           destino_regra_plantio_id, sacas_gt, sacas_lte, preco_por_saca, updated_at
         ) VALUES (
           @destino_regra_plantio_id, @sacas_gt, @sacas_lte, @preco_por_saca, datetime('now')
         )`,
      )
      for (const f of faixas) {
        stmt.run({ destino_regra_plantio_id, ...f })
      }
    })

    tx()
    return this.getCompraFaixasPlantio(destino_regra_plantio_id)
  },
}

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
         safra_id, destino_id, tipo_plantio, trava_sacas,
         custo_silo_por_saca, custo_terceiros_por_saca,
         impureza_limite_pct, ardidos_limite_pct, queimados_limite_pct,
         avariados_limite_pct, esverdiados_limite_pct, quebrados_limite_pct,
         updated_at
       ) VALUES (
         @safra_id, @destino_id, @tipo_plantio, @trava_sacas,
         @custo_silo_por_saca, @custo_terceiros_por_saca,
         @impureza_limite_pct, @ardidos_limite_pct, @queimados_limite_pct,
         @avariados_limite_pct, @esverdiados_limite_pct, @quebrados_limite_pct,
         datetime('now')
       )
       ON CONFLICT(safra_id, destino_id, tipo_plantio) DO UPDATE SET
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

    return this.getBySafraDestinoPlantio({
      safra_id: data.safra_id,
      destino_id: data.destino_id,
      tipo_plantio: data.tipo_plantio,
    })
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
}

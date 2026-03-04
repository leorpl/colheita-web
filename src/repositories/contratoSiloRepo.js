import { db } from '../db/db.js'

export const contratoSiloRepo = {
  getById(id) {
    return db.prepare('SELECT * FROM contrato_silo WHERE id=?').get(id)
  },

  getOne({ safra_id, destino_id, tipo_plantio }) {
    const tp = String(tipo_plantio || '').trim().toUpperCase()
    if (!tp) return null
    const hdr = db
      .prepare(
        `SELECT *
         FROM contrato_silo
         WHERE safra_id=@safra_id
           AND destino_id=@destino_id
           AND tipo_plantio=@tipo_plantio`,
      )
      .get({ safra_id, destino_id, tipo_plantio: tp })
    if (!hdr) return null
    const faixas = db
      .prepare(
        `SELECT ordem, sacas, preco_por_saca
         FROM contrato_silo_faixa
         WHERE contrato_silo_id=?
         ORDER BY ordem ASC`,
      )
      .all(hdr.id)
    return { ...hdr, tipo_plantio: tp, faixas }
  },

  list({ safra_id } = {}) {
    return db
      .prepare(
        `SELECT c.*, s.safra as safra_nome, d.local as destino_local
         FROM contrato_silo c
         JOIN safra s ON s.id = c.safra_id
         JOIN destino d ON d.id = c.destino_id
         WHERE (@safra_id IS NULL OR c.safra_id=@safra_id)
         ORDER BY s.id DESC, d.local, c.tipo_plantio`,
      )
      .all({ safra_id: safra_id ?? null })
  },

  // Replace faixas por chave natural. Se faixas vazio, remove contrato.
  replaceFaixas({ safra_id, destino_id, tipo_plantio, faixas, observacoes }) {
    const tp = String(tipo_plantio || '').trim().toUpperCase()
    if (!tp) throw new Error('tipo_plantio obrigatorio')

    const list = Array.isArray(faixas) ? faixas : []
    const norm = list
      .map((f, i) => ({
        ordem: i + 1,
        sacas: Number(f?.sacas || 0),
        preco_por_saca: Number(f?.preco_por_saca || 0),
      }))
      .filter((f) => Number.isFinite(f.sacas) && f.sacas > 0 && Number.isFinite(f.preco_por_saca) && f.preco_por_saca >= 0)

    const tx = db.transaction(() => {
      if (!norm.length) {
        const cur = db
          .prepare(
            `SELECT id FROM contrato_silo
             WHERE safra_id=@safra_id AND destino_id=@destino_id AND tipo_plantio=@tipo_plantio`,
          )
          .get({ safra_id, destino_id, tipo_plantio: tp })
        if (cur?.id) {
          db.prepare('DELETE FROM contrato_silo_faixa WHERE contrato_silo_id=?').run(cur.id)
          db.prepare('DELETE FROM contrato_silo WHERE id=?').run(cur.id)
        }
        return null
      }

      // mantem colunas legadas coerentes (soma e preco da 1a faixa)
      const sacas_total = norm.reduce((a, x) => a + x.sacas, 0)
      const preco_first = norm[0]?.preco_por_saca ?? 0

      db.prepare(
        `INSERT INTO contrato_silo (
           safra_id, destino_id, tipo_plantio,
           sacas_contratadas, preco_travado_por_saca,
           observacoes, updated_at
         ) VALUES (
           @safra_id, @destino_id, @tipo_plantio,
           @sacas_contratadas, @preco_travado_por_saca,
           @observacoes, datetime('now')
         )
         ON CONFLICT(safra_id, destino_id, tipo_plantio) DO UPDATE SET
           sacas_contratadas=excluded.sacas_contratadas,
           preco_travado_por_saca=excluded.preco_travado_por_saca,
           observacoes=excluded.observacoes,
           updated_at=datetime('now')`,
      ).run({
        safra_id,
        destino_id,
        tipo_plantio: tp,
        sacas_contratadas: sacas_total,
        preco_travado_por_saca: preco_first,
        observacoes: observacoes ?? null,
      })

      const hdr = db
        .prepare(
          `SELECT id
           FROM contrato_silo
           WHERE safra_id=@safra_id AND destino_id=@destino_id AND tipo_plantio=@tipo_plantio`,
        )
        .get({ safra_id, destino_id, tipo_plantio: tp })

      db.prepare('DELETE FROM contrato_silo_faixa WHERE contrato_silo_id=?').run(hdr.id)
      const ins = db.prepare(
        `INSERT INTO contrato_silo_faixa (
           contrato_silo_id, ordem, sacas, preco_por_saca, updated_at
         ) VALUES (
           @contrato_silo_id, @ordem, @sacas, @preco_por_saca, datetime('now')
         )`,
      )
      for (const f of norm) {
        ins.run({ contrato_silo_id: hdr.id, ...f })
      }

      return this.getOne({ safra_id, destino_id, tipo_plantio: tp })
    })

    return tx()
  },
}

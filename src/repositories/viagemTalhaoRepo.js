import { db } from '../db/db.js'

export const viagemTalhaoRepo = {
  listByViagem({ viagem_id }) {
    return db
      .prepare(
        `SELECT vt.*, t.codigo as talhao_codigo, t.local as talhao_local, t.nome as talhao_nome
         FROM viagem_talhao vt
         JOIN talhao t ON t.id = vt.talhao_id
         WHERE vt.viagem_id = @viagem_id
         ORDER BY vt.id ASC`,
      )
      .all({ viagem_id })
  },

  replaceForViagem({ viagem_id, items }) {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM viagem_talhao WHERE viagem_id = ?').run(viagem_id)
      if (!items || !items.length) return

      const ins = db.prepare(
        `INSERT INTO viagem_talhao (viagem_id, talhao_id, pct_rateio, kg_rateio, updated_at)
         VALUES (@viagem_id, @talhao_id, @pct_rateio, @kg_rateio, datetime('now'))`,
      )
      for (const it of items) {
        ins.run({
          viagem_id,
          talhao_id: it.talhao_id,
          pct_rateio: it.pct_rateio ?? null,
          kg_rateio: it.kg_rateio ?? null,
        })
      }
    })

    tx()
  },
}

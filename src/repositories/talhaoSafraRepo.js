import { db } from '../db/db.js'

export const talhaoSafraRepo = {
  get({ safra_id, talhao_id }) {
    return db
      .prepare('SELECT * FROM talhao_safra WHERE safra_id=? AND talhao_id=?')
      .get(safra_id, talhao_id)
  },

  upsert({ safra_id, talhao_id, pct_area_colhida }) {
    db.prepare(
      `INSERT INTO talhao_safra (safra_id, talhao_id, pct_area_colhida, updated_at)
       VALUES (@safra_id, @talhao_id, @pct_area_colhida, datetime('now'))
       ON CONFLICT(safra_id, talhao_id) DO UPDATE SET
         pct_area_colhida=excluded.pct_area_colhida,
         updated_at=datetime('now')`,
    ).run({ safra_id, talhao_id, pct_area_colhida })

    return this.get({ safra_id, talhao_id })
  },

  listBySafra({ safra_id }) {
    return db
      .prepare(
        `SELECT ts.*, t.codigo as talhao_codigo, t.local as talhao_local, t.nome as talhao_nome
         FROM talhao_safra ts
         JOIN talhao t ON t.id = ts.talhao_id
         WHERE ts.safra_id=?
         ORDER BY t.local, t.codigo`,
      )
      .all(safra_id)
  },
}

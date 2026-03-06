import { db } from '../db/db.js'

export const freteRepo = {
  list() {
    return db
      .prepare(
        `SELECT f.*, s.safra as safra_nome, m.nome as motorista_nome, d.codigo as destino_codigo, d.local as destino_local
         FROM frete f
         JOIN safra s ON s.id = f.safra_id
         JOIN motorista m ON m.id = f.motorista_id
         JOIN destino d ON d.id = f.destino_id
         ORDER BY f.id DESC`,
      )
      .all()
  },
  get(id) {
    return db.prepare('SELECT * FROM frete WHERE id = ?').get(id)
  },
  getValor({ safra_id, motorista_id, destino_id }) {
    const row = db
      .prepare(
        'SELECT valor_por_saca FROM frete WHERE safra_id=? AND motorista_id=? AND destino_id=?',
      )
      .get(safra_id, motorista_id, destino_id)
    return row?.valor_por_saca ?? null
  },
  upsert({ safra_id, motorista_id, destino_id, valor_por_saca }, { user_id } = {}) {
    // tabela frete agora e (safra_id, motorista_id, destino_id)
    db.prepare(
      `INSERT INTO frete (safra_id, motorista_id, destino_id, valor_por_saca, created_by_user_id, updated_by_user_id, updated_at)
       VALUES (@safra_id, @motorista_id, @destino_id, @valor_por_saca, @created_by_user_id, @updated_by_user_id, datetime('now'))
       ON CONFLICT(safra_id, motorista_id, destino_id)
       DO UPDATE SET valor_por_saca=excluded.valor_por_saca, updated_by_user_id=@updated_by_user_id, updated_at=datetime('now')`,
    ).run({
      safra_id,
      motorista_id,
      destino_id,
      valor_por_saca,
      created_by_user_id: user_id ?? null,
      updated_by_user_id: user_id ?? null,
    })

    // Se o frete mudou, atualizar os valores calculados nas viagens ja lancadas
    db.prepare(
      `UPDATE viagem
       SET frete_tabela = @valor,
           sacas_frete = (COALESCE(peso_bruto_kg, 0) / 60.0),
           sub_total_frete = (COALESCE(peso_bruto_kg, 0) / 60.0) * @valor,
           updated_at = datetime('now'),
           updated_by_user_id = COALESCE(@updated_by_user_id, updated_by_user_id)
       WHERE safra_id = @safra_id
         AND motorista_id = @motorista_id
         AND destino_id = @destino_id
         AND deleted_at IS NULL`,
    ).run({ safra_id, motorista_id, destino_id, valor: Number(valor_por_saca), updated_by_user_id: user_id ?? null })

    return db
      .prepare(
        'SELECT * FROM frete WHERE safra_id=? AND motorista_id=? AND destino_id=?',
      )
      .get(safra_id, motorista_id, destino_id)
  },
  remove(id) {
    return db.prepare('DELETE FROM frete WHERE id=?').run(id)
  },

  copySafra({ from_safra_id, to_safra_id }) {
    const rows = db
      .prepare(
        'SELECT motorista_id, destino_id, valor_por_saca FROM frete WHERE safra_id=?',
      )
      .all(from_safra_id)

    db.exec('BEGIN')
    try {
      for (const r of rows) {
          this.upsert({
            safra_id: to_safra_id,
            motorista_id: r.motorista_id,
            destino_id: r.destino_id,
            valor_por_saca: r.valor_por_saca,
          })
        }
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }

    return { copied: rows.length }
  },

  bulkUpsert({ safra_id, items }) {
    const rows = Array.isArray(items) ? items : []
    db.exec('BEGIN')
    try {
      for (const r of rows) {
        this.upsert({
          safra_id,
          motorista_id: r.motorista_id,
          destino_id: r.destino_id,
          valor_por_saca: r.valor_por_saca,
        })
      }
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }

    return { upserted: rows.length }
  },
}

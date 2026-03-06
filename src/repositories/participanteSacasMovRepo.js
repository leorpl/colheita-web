import { db } from '../db/db.js'

export const participanteSacasMovRepo = {
  deleteByOrigem({ origem_tipo, origem_id }) {
    return db
      .prepare('DELETE FROM participante_sacas_mov WHERE origem_tipo=@origem_tipo AND origem_id=@origem_id')
      .run({ origem_tipo: String(origem_tipo || ''), origem_id: Number(origem_id) })
  },

  deleteBySafra(safra_id) {
    return db
      .prepare('DELETE FROM participante_sacas_mov WHERE safra_id = ?')
      .run(Number(safra_id))
  },

  insertMany(rows, { user_id } = {}) {
    if (!rows || !rows.length) return { inserted: 0 }
    const ins = db.prepare(
      `INSERT INTO participante_sacas_mov (
         safra_id, participante_id, talhao_id, destino_id, data_ref,
         mov_tipo, origem_tipo, origem_id, custo_tipo,
         sacas_credito, sacas_debito, valor_rs, preco_ref_rs_sc, pendente_preco, notes,
         created_by_user_id, updated_by_user_id, updated_at
       ) VALUES (
         @safra_id, @participante_id, @talhao_id, @destino_id, @data_ref,
         @mov_tipo, @origem_tipo, @origem_id, @custo_tipo,
         @sacas_credito, @sacas_debito, @valor_rs, @preco_ref_rs_sc, @pendente_preco, @notes,
         @created_by_user_id, @updated_by_user_id, datetime('now')
       )`,
    )

    for (const r of rows) {
      ins.run({
        ...r,
        talhao_id: r.talhao_id ? Number(r.talhao_id) : null,
        destino_id: r.destino_id ? Number(r.destino_id) : null,
        origem_id: r.origem_id ? Number(r.origem_id) : null,
        sacas_credito: Number(r.sacas_credito || 0),
        sacas_debito: Number(r.sacas_debito || 0),
        valor_rs: r.valor_rs === null || r.valor_rs === undefined ? null : Number(r.valor_rs),
        preco_ref_rs_sc: r.preco_ref_rs_sc === null || r.preco_ref_rs_sc === undefined ? null : Number(r.preco_ref_rs_sc),
        pendente_preco: r.pendente_preco ? 1 : 0,
        created_by_user_id: user_id ?? null,
        updated_by_user_id: user_id ?? null,
      })
    }
    return { inserted: rows.length }
  },

  saldoPorParticipante({ safra_id } = {}) {
    return db
      .prepare(
        `SELECT m.participante_id,
                p.nome as participante_nome,
                SUM(m.sacas_credito) as sacas_credito,
                SUM(m.sacas_debito) as sacas_debito,
                SUM(m.sacas_credito - m.sacas_debito) as saldo_sacas,
                SUM(CASE WHEN m.pendente_preco=1 THEN COALESCE(m.valor_rs,0) ELSE 0 END) as custos_pendentes_rs
         FROM participante_sacas_mov m
         JOIN participante p ON p.id = m.participante_id
         WHERE m.safra_id = @safra_id
         GROUP BY m.participante_id
         ORDER BY p.nome ASC`,
      )
      .all({ safra_id: Number(safra_id) })
  },

  saldoPorTalhao({ safra_id } = {}) {
    return db
      .prepare(
        `SELECT m.talhao_id,
                t.nome as talhao_nome,
                t.local as talhao_local,
                SUM(m.sacas_credito) as sacas_credito,
                SUM(m.sacas_debito) as sacas_debito,
                SUM(m.sacas_credito - m.sacas_debito) as saldo_sacas,
                SUM(CASE WHEN m.pendente_preco=1 THEN COALESCE(m.valor_rs,0) ELSE 0 END) as custos_pendentes_rs
         FROM participante_sacas_mov m
         LEFT JOIN talhao t ON t.id = m.talhao_id
         WHERE m.safra_id = @safra_id
           AND m.talhao_id IS NOT NULL
         GROUP BY m.talhao_id
         ORDER BY t.local ASC, t.nome ASC`,
      )
      .all({ safra_id: Number(safra_id) })
  },

  saldoPorDestino({ safra_id } = {}) {
    return db
      .prepare(
        `SELECT m.destino_id,
                d.local as destino_local,
                SUM(m.sacas_credito) as sacas_credito,
                SUM(m.sacas_debito) as sacas_debito,
                SUM(m.sacas_credito - m.sacas_debito) as saldo_sacas,
                SUM(CASE WHEN m.pendente_preco=1 THEN COALESCE(m.valor_rs,0) ELSE 0 END) as custos_pendentes_rs
         FROM participante_sacas_mov m
         LEFT JOIN destino d ON d.id = m.destino_id
         WHERE m.safra_id = @safra_id
           AND m.destino_id IS NOT NULL
         GROUP BY m.destino_id
         ORDER BY d.local ASC`,
      )
      .all({ safra_id: Number(safra_id) })
  },

  extrato({ safra_id, participante_id, talhao_id } = {}) {
    const where = ['m.safra_id=@safra_id']
    const params = { safra_id: Number(safra_id) }
    if (participante_id) {
      where.push('m.participante_id=@participante_id')
      params.participante_id = Number(participante_id)
    }
    if (talhao_id) {
      where.push('m.talhao_id=@talhao_id')
      params.talhao_id = Number(talhao_id)
    }
    return db
      .prepare(
        `SELECT m.*,
                p.nome as participante_nome,
                t.nome as talhao_nome,
                t.local as talhao_local,
                d.local as destino_local
         FROM participante_sacas_mov m
         JOIN participante p ON p.id = m.participante_id
         LEFT JOIN talhao t ON t.id = m.talhao_id
         LEFT JOIN destino d ON d.id = m.destino_id
         WHERE ${where.join(' AND ')}
         ORDER BY COALESCE(m.data_ref, m.created_at) DESC, m.id DESC
         LIMIT 5000`,
      )
      .all(params)
  },

  custosPorViagem({ safra_id, talhao_id, destino_id } = {}) {
    const where = ['m.safra_id=@safra_id', "m.origem_tipo='viagem'", "m.mov_tipo='custo_debito'"]
    const params = { safra_id: Number(safra_id) }
    if (talhao_id) {
      where.push('m.talhao_id=@talhao_id')
      params.talhao_id = Number(talhao_id)
    }
    if (destino_id) {
      where.push('m.destino_id=@destino_id')
      params.destino_id = Number(destino_id)
    }
    return db
      .prepare(
        `SELECT m.origem_id as viagem_id,
                m.talhao_id,
                t.nome as talhao_nome,
                t.local as talhao_local,
                m.destino_id,
                d.local as destino_local,
                SUM(m.sacas_debito) as sacas_custo_total,
                SUM(CASE WHEN m.custo_tipo='frete' THEN m.sacas_debito ELSE 0 END) as sacas_frete,
                SUM(CASE WHEN m.custo_tipo='secagem' THEN m.sacas_debito ELSE 0 END) as sacas_secagem,
                SUM(CASE WHEN m.custo_tipo='silo' THEN m.sacas_debito ELSE 0 END) as sacas_silo,
                SUM(CASE WHEN m.custo_tipo='terceiros' THEN m.sacas_debito ELSE 0 END) as sacas_terceiros,
                SUM(CASE WHEN m.custo_tipo='outros' THEN m.sacas_debito ELSE 0 END) as sacas_outros
         FROM participante_sacas_mov m
         LEFT JOIN talhao t ON t.id = m.talhao_id
         LEFT JOIN destino d ON d.id = m.destino_id
         WHERE ${where.join(' AND ')}
         GROUP BY m.origem_id, m.talhao_id, m.destino_id
         ORDER BY m.origem_id DESC, t.local ASC, t.nome ASC
         LIMIT 5000`,
      )
      .all(params)
  },

  pendenciasPreco({ safra_id } = {}) {
    return db
      .prepare(
        `SELECT m.custo_tipo,
                SUM(COALESCE(m.valor_rs,0)) as valor_rs,
                COUNT(*) as qtd
         FROM participante_sacas_mov m
         WHERE m.safra_id=@safra_id
           AND m.pendente_preco=1
         GROUP BY m.custo_tipo
         ORDER BY m.custo_tipo ASC`,
      )
      .all({ safra_id: Number(safra_id) })
  },
}

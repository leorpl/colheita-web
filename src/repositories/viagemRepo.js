import { db } from '../db/db.js'

function recalcDerived(v) {
  if (!v) return v
  const sacas = Number(v.sacas || 0)
  const frete = Number(v.sub_total_frete || 0)
  const custoSilo = Number(v.sub_total_custo_silo || 0)
  const custoTerc = Number(v.sub_total_custo_terceiros || 0)
  const secagemPorSaca = Number(v.secagem_custo_por_saca || 0)

  // Secagem deve acompanhar a base de sacas (limpa/seca)
  const sub_total_secagem = sacas > 0 ? secagemPorSaca * sacas : 0

  const abatimento_total_silo = frete + sub_total_secagem + custoSilo
  const abatimento_total_terceiros = frete + sub_total_secagem + custoTerc

  const abatimento_por_saca_silo = sacas > 0 ? abatimento_total_silo / sacas : 0
  const abatimento_por_saca_terceiros = sacas > 0 ? abatimento_total_terceiros / sacas : 0

  return {
    ...v,
    sub_total_secagem,
    abatimento_total_silo,
    abatimento_por_saca_silo,
    abatimento_total_terceiros,
    abatimento_por_saca_terceiros,
  }
}

export const viagemRepo = {
  get(id) {
    const row = db
      .prepare(
        `SELECT v.*, s.safra as safra_nome, t.codigo as talhao_codigo, t.local as talhao_local, t.nome as talhao_nome,
                d.codigo as destino_codigo, d.local as destino_local, m.nome as motorista_nome,
                rp.trava_sacas as regra_trava_sacas,
                rp.valor_compra_por_saca as regra_valor_compra_por_saca
         FROM viagem v
         JOIN safra s ON s.id = v.safra_id
         JOIN talhao t ON t.id = v.talhao_id
         JOIN destino d ON d.id = v.destino_id
         JOIN motorista m ON m.id = v.motorista_id
         LEFT JOIN destino_regra_plantio rp
           ON rp.safra_id = v.safra_id
          AND rp.destino_id = v.destino_id
          AND rp.tipo_plantio = UPPER(COALESCE(NULLIF(v.tipo_plantio, ''), NULLIF(s.plantio, '')))
         WHERE v.id = ?`,
      )
      .get(id)
    return recalcDerived(row)
  },

  list(filters) {
    const where = []
    const params = {}

    if (filters.safra_id) {
      where.push('v.safra_id = @safra_id')
      params.safra_id = filters.safra_id
    }
    if (filters.talhao_id) {
      where.push('v.talhao_id = @talhao_id')
      params.talhao_id = filters.talhao_id
    }
    if (filters.destino_id) {
      where.push('v.destino_id = @destino_id')
      params.destino_id = filters.destino_id
    }
    if (filters.motorista_id) {
      where.push('v.motorista_id = @motorista_id')
      params.motorista_id = filters.motorista_id
    }
    if (filters.de) {
      where.push('v.data_saida >= @de')
      params.de = filters.de
    }
    if (filters.ate) {
      where.push('v.data_saida <= @ate')
      params.ate = filters.ate
    }

    const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const rows = db
      .prepare(
        `SELECT v.*, s.safra as safra_nome, t.codigo as talhao_codigo, t.local as talhao_local, t.nome as talhao_nome,
                d.codigo as destino_codigo, d.local as destino_local, m.nome as motorista_nome,
                rp.trava_sacas as regra_trava_sacas,
                rp.valor_compra_por_saca as regra_valor_compra_por_saca,
                (
                  SELECT COALESCE(SUM(v2.sacas), 0)
                  FROM viagem v2
                  WHERE v2.safra_id = v.safra_id
                    AND v2.destino_id = v.destino_id
                    AND UPPER(COALESCE(NULLIF(v2.tipo_plantio, ''), NULLIF(s.plantio, ''))) = UPPER(COALESCE(NULLIF(v.tipo_plantio, ''), NULLIF(s.plantio, '')))
                    AND v2.id <> v.id
                ) as entrega_atual_sacas
         FROM viagem v
         JOIN safra s ON s.id = v.safra_id
         JOIN talhao t ON t.id = v.talhao_id
         JOIN destino d ON d.id = v.destino_id
         JOIN motorista m ON m.id = v.motorista_id
         LEFT JOIN destino_regra_plantio rp
           ON rp.safra_id = v.safra_id
          AND rp.destino_id = v.destino_id
          AND rp.tipo_plantio = UPPER(COALESCE(NULLIF(v.tipo_plantio, ''), NULLIF(s.plantio, '')))
         ${sqlWhere}
         ORDER BY v.id DESC`,
      )
      .all(params)

    return rows.map(recalcDerived)
  },

  totals(filters) {
    const where = []
    const params = {}

    if (filters.safra_id) {
      where.push('safra_id = @safra_id')
      params.safra_id = filters.safra_id
    }
    if (filters.talhao_id) {
      where.push('talhao_id = @talhao_id')
      params.talhao_id = filters.talhao_id
    }
    if (filters.destino_id) {
      where.push('destino_id = @destino_id')
      params.destino_id = filters.destino_id
    }
    if (filters.motorista_id) {
      where.push('motorista_id = @motorista_id')
      params.motorista_id = filters.motorista_id
    }
    if (filters.de) {
      where.push('data_saida >= @de')
      params.de = filters.de
    }
    if (filters.ate) {
      where.push('data_saida <= @ate')
      params.ate = filters.ate
    }

    const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : ''

    return db
      .prepare(
        `SELECT
           COALESCE(SUM(carga_total_kg), 0) as carga_total_kg,
           COALESCE(SUM(tara_kg), 0) as tara_kg,
           COALESCE(SUM(peso_bruto_kg), 0) as peso_bruto_kg,
           COALESCE(SUM(umidade_kg), 0) as umidade_kg,
           COALESCE(SUM(impureza_kg), 0) as impureza_kg,
           COALESCE(SUM(ardidos_kg), 0) as ardidos_kg,
           COALESCE(SUM(queimados_kg), 0) as queimados_kg,
           COALESCE(SUM(avariados_kg), 0) as avariados_kg,
           COALESCE(SUM(esverdiados_kg), 0) as esverdiados_kg,
           COALESCE(SUM(quebrados_kg), 0) as quebrados_kg,
           COALESCE(SUM(peso_limpo_seco_kg), 0) as peso_limpo_seco_kg,
           COALESCE(SUM(sub_total_frete), 0) as sub_total_frete,
           COALESCE(SUM(sacas), 0) as sacas
         FROM viagem
         ${sqlWhere}`,
      )
      .get(params)
  },

  create(data) {
    const info = db
      .prepare(
        `INSERT INTO viagem (
          ficha, safra_id, tipo_plantio, talhao_id, local, destino_id, motorista_id, placa,
          data_saida, hora_saida, data_entrega, hora_entrega,
          carga_total_kg, tara_kg,
          umidade_pct,
          impureza_pct, ardidos_pct, queimados_pct, avariados_pct, esverdiados_pct, quebrados_pct,
          impureza_limite_pct, ardidos_limite_pct, queimados_limite_pct, avariados_limite_pct, esverdiados_limite_pct, quebrados_limite_pct,
          peso_bruto_kg, umidade_desc_pct, umidade_desc_pct_manual, umidade_kg,
          impureza_kg, ardidos_kg, queimados_kg, avariados_kg, esverdiados_kg, quebrados_kg,
          peso_limpo_seco_kg, sacas,
           sacas_frete, frete_tabela, sub_total_frete,
           secagem_custo_por_saca, sub_total_secagem,

           valor_compra_por_saca_aplicado, valor_compra_total, valor_compra_detalhe_json,
           valor_compra_entrega_antes, valor_compra_entrega_depois,
           custo_silo_por_saca, sub_total_custo_silo, abatimento_total_silo, abatimento_por_saca_silo,
           custo_terceiros_por_saca, sub_total_custo_terceiros, abatimento_total_terceiros, abatimento_por_saca_terceiros,
           updated_at
         ) VALUES (
          @ficha, @safra_id, @tipo_plantio, @talhao_id, @local, @destino_id, @motorista_id, @placa,
          @data_saida, @hora_saida, @data_entrega, @hora_entrega,
          @carga_total_kg, @tara_kg,
          @umidade_pct,
          @impureza_pct, @ardidos_pct, @queimados_pct, @avariados_pct, @esverdiados_pct, @quebrados_pct,
          @impureza_limite_pct, @ardidos_limite_pct, @queimados_limite_pct, @avariados_limite_pct, @esverdiados_limite_pct, @quebrados_limite_pct,
          @peso_bruto_kg, @umidade_desc_pct, @umidade_desc_pct_manual, @umidade_kg,
          @impureza_kg, @ardidos_kg, @queimados_kg, @avariados_kg, @esverdiados_kg, @quebrados_kg,
          @peso_limpo_seco_kg, @sacas,
           @sacas_frete, @frete_tabela, @sub_total_frete,
           @secagem_custo_por_saca, @sub_total_secagem,
           @valor_compra_por_saca_aplicado, @valor_compra_total, @valor_compra_detalhe_json,
           @valor_compra_entrega_antes, @valor_compra_entrega_depois,
           @custo_silo_por_saca, @sub_total_custo_silo, @abatimento_total_silo, @abatimento_por_saca_silo,
           @custo_terceiros_por_saca, @sub_total_custo_terceiros, @abatimento_total_terceiros, @abatimento_por_saca_terceiros,
           datetime('now')
         )`,
      )
      .run(data)
    return this.get(info.lastInsertRowid)
  },

  update(id, data) {
    db.prepare(
      `UPDATE viagem SET
          ficha=@ficha, safra_id=@safra_id, tipo_plantio=@tipo_plantio, talhao_id=@talhao_id, local=@local,
          destino_id=@destino_id, motorista_id=@motorista_id, placa=@placa,
          data_saida=@data_saida, hora_saida=@hora_saida, data_entrega=@data_entrega, hora_entrega=@hora_entrega,
          carga_total_kg=@carga_total_kg, tara_kg=@tara_kg,
          umidade_pct=@umidade_pct,
          impureza_pct=@impureza_pct, ardidos_pct=@ardidos_pct, queimados_pct=@queimados_pct, avariados_pct=@avariados_pct,
          esverdiados_pct=@esverdiados_pct, quebrados_pct=@quebrados_pct,
          impureza_limite_pct=@impureza_limite_pct, ardidos_limite_pct=@ardidos_limite_pct, queimados_limite_pct=@queimados_limite_pct,
          avariados_limite_pct=@avariados_limite_pct, esverdiados_limite_pct=@esverdiados_limite_pct, quebrados_limite_pct=@quebrados_limite_pct,
          peso_bruto_kg=@peso_bruto_kg, umidade_desc_pct=@umidade_desc_pct, umidade_kg=@umidade_kg,
          umidade_desc_pct_manual=@umidade_desc_pct_manual,
          impureza_kg=@impureza_kg, ardidos_kg=@ardidos_kg, queimados_kg=@queimados_kg, avariados_kg=@avariados_kg,
          esverdiados_kg=@esverdiados_kg, quebrados_kg=@quebrados_kg,
          peso_limpo_seco_kg=@peso_limpo_seco_kg, sacas=@sacas,
          sacas_frete=@sacas_frete, frete_tabela=@frete_tabela, sub_total_frete=@sub_total_frete,
          secagem_custo_por_saca=@secagem_custo_por_saca, sub_total_secagem=@sub_total_secagem,

          valor_compra_por_saca_aplicado=@valor_compra_por_saca_aplicado,
          valor_compra_total=@valor_compra_total,
          valor_compra_detalhe_json=@valor_compra_detalhe_json,
          valor_compra_entrega_antes=@valor_compra_entrega_antes,
          valor_compra_entrega_depois=@valor_compra_entrega_depois,
          custo_silo_por_saca=@custo_silo_por_saca, sub_total_custo_silo=@sub_total_custo_silo, abatimento_total_silo=@abatimento_total_silo, abatimento_por_saca_silo=@abatimento_por_saca_silo,
          custo_terceiros_por_saca=@custo_terceiros_por_saca, sub_total_custo_terceiros=@sub_total_custo_terceiros, abatimento_total_terceiros=@abatimento_total_terceiros, abatimento_por_saca_terceiros=@abatimento_por_saca_terceiros,
          updated_at=datetime('now')
       WHERE id=@id`,
    ).run({ ...data, id })

    return this.get(id)
  },

  remove(id) {
    return db.prepare('DELETE FROM viagem WHERE id=?').run(id)
  },

  fichaStatsBySafra({ safra_id, exclude_id } = {}) {
    const where = ['safra_id = @safra_id']
    const params = { safra_id }
    if (exclude_id) {
      where.push('id <> @exclude_id')
      params.exclude_id = exclude_id
    }

    const rows = db
      .prepare(`SELECT ficha FROM viagem WHERE ${where.join(' AND ')}`)
      .all(params)

    let maxNum = 0
    let maxLen = 0

    for (const r of rows) {
      const f = String(r.ficha ?? '').trim()
      if (!/^[0-9]+$/.test(f)) continue
      const n = Number.parseInt(f, 10)
      if (!Number.isFinite(n) || n <= 0) continue
      if (n > maxNum) maxNum = n
      if (f.length > maxLen) maxLen = f.length
    }

    return { maxNum, maxLen }
  },
}

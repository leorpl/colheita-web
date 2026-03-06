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
    const v = recalcDerived(row)
    if (!v) return v
    const talhoes = db
      .prepare(
        `SELECT vt.*, t.codigo as talhao_codigo, t.local as talhao_local, t.nome as talhao_nome
         FROM viagem_talhao vt
         JOIN talhao t ON t.id = vt.talhao_id
         WHERE vt.viagem_id = ?
         ORDER BY vt.id ASC`,
      )
      .all(id)
    return { ...v, talhoes }
  },

  list(filters) {
    // Query fixa (sem concatenacao de filtros) - todos os valores via parametros.
    const params = {
      safra_id: filters.safra_id ?? null,
      talhao_id: filters.talhao_id ?? null,
      destino_id: filters.destino_id ?? null,
      motorista_id: filters.motorista_id ?? null,
      de: filters.de ?? null,
      ate: filters.ate ?? null,
    }

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
          WHERE (@safra_id IS NULL OR v.safra_id = @safra_id)
            AND (@talhao_id IS NULL OR EXISTS (
              SELECT 1 FROM viagem_talhao vt
              WHERE vt.viagem_id = v.id AND vt.talhao_id = @talhao_id
            ))
            AND (@destino_id IS NULL OR v.destino_id = @destino_id)
            AND (@motorista_id IS NULL OR v.motorista_id = @motorista_id)
            AND (@de IS NULL OR v.data_saida >= @de)
            AND (@ate IS NULL OR v.data_saida <= @ate)
          ORDER BY v.id DESC`,
      )
      .all(params)

    return rows.map(recalcDerived)
  },

  totals(filters) {
    // Query fixa (sem concatenacao de filtros) - todos os valores via parametros.
    const talhao_id = filters.talhao_id ? Number(filters.talhao_id) : null
    const params = {
      safra_id: filters.safra_id ?? null,
      destino_id: filters.destino_id ?? null,
      motorista_id: filters.motorista_id ?? null,
      de: filters.de ?? null,
      ate: filters.ate ?? null,
      talhao_id: talhao_id || null,
    }

    if (talhao_id) {
      return db
        .prepare(
          `SELECT
             COALESCE(SUM(v.carga_total_kg * (
               CASE WHEN COALESCE(v.peso_bruto_kg, 0) > 0
                 THEN COALESCE(vt.kg_rateio, v.peso_bruto_kg * vt.pct_rateio, 0) / v.peso_bruto_kg
                 ELSE 0
               END
             )), 0) as carga_total_kg,
             COALESCE(SUM(v.tara_kg * (
               CASE WHEN COALESCE(v.peso_bruto_kg, 0) > 0
                 THEN COALESCE(vt.kg_rateio, v.peso_bruto_kg * vt.pct_rateio, 0) / v.peso_bruto_kg
                 ELSE 0
               END
             )), 0) as tara_kg,
              COALESCE(SUM(COALESCE(vt.kg_rateio, v.peso_bruto_kg * vt.pct_rateio, 0)), 0) as peso_bruto_kg,
              COALESCE(SUM(COALESCE(vt.kg_rateio, v.peso_bruto_kg * vt.pct_rateio, 0) * COALESCE(v.umidade_pct, 0)), 0) as peso_bruto_x_umidade,
              COALESCE(SUM(v.umidade_kg * (
                CASE WHEN COALESCE(v.peso_bruto_kg, 0) > 0
                  THEN COALESCE(vt.kg_rateio, v.peso_bruto_kg * vt.pct_rateio, 0) / v.peso_bruto_kg
                  ELSE 0
                END
              )), 0) as umidade_kg,
             COALESCE(SUM(v.impureza_kg * (
               CASE WHEN COALESCE(v.peso_bruto_kg, 0) > 0
                 THEN COALESCE(vt.kg_rateio, v.peso_bruto_kg * vt.pct_rateio, 0) / v.peso_bruto_kg
                 ELSE 0
               END
             )), 0) as impureza_kg,
             COALESCE(SUM(v.ardidos_kg * (
               CASE WHEN COALESCE(v.peso_bruto_kg, 0) > 0
                 THEN COALESCE(vt.kg_rateio, v.peso_bruto_kg * vt.pct_rateio, 0) / v.peso_bruto_kg
                 ELSE 0
               END
             )), 0) as ardidos_kg,
             COALESCE(SUM(v.queimados_kg * (
               CASE WHEN COALESCE(v.peso_bruto_kg, 0) > 0
                 THEN COALESCE(vt.kg_rateio, v.peso_bruto_kg * vt.pct_rateio, 0) / v.peso_bruto_kg
                 ELSE 0
               END
             )), 0) as queimados_kg,
             COALESCE(SUM(v.avariados_kg * (
               CASE WHEN COALESCE(v.peso_bruto_kg, 0) > 0
                 THEN COALESCE(vt.kg_rateio, v.peso_bruto_kg * vt.pct_rateio, 0) / v.peso_bruto_kg
                 ELSE 0
               END
             )), 0) as avariados_kg,
             COALESCE(SUM(v.esverdiados_kg * (
               CASE WHEN COALESCE(v.peso_bruto_kg, 0) > 0
                 THEN COALESCE(vt.kg_rateio, v.peso_bruto_kg * vt.pct_rateio, 0) / v.peso_bruto_kg
                 ELSE 0
               END
             )), 0) as esverdiados_kg,
             COALESCE(SUM(v.quebrados_kg * (
               CASE WHEN COALESCE(v.peso_bruto_kg, 0) > 0
                 THEN COALESCE(vt.kg_rateio, v.peso_bruto_kg * vt.pct_rateio, 0) / v.peso_bruto_kg
                 ELSE 0
               END
             )), 0) as quebrados_kg,
             COALESCE(SUM(v.peso_limpo_seco_kg * (
               CASE WHEN COALESCE(v.peso_bruto_kg, 0) > 0
                 THEN COALESCE(vt.kg_rateio, v.peso_bruto_kg * vt.pct_rateio, 0) / v.peso_bruto_kg
                 ELSE 0
               END
             )), 0) as peso_limpo_seco_kg,
             COALESCE(SUM(v.sub_total_frete * (
               CASE WHEN COALESCE(v.peso_bruto_kg, 0) > 0
                 THEN COALESCE(vt.kg_rateio, v.peso_bruto_kg * vt.pct_rateio, 0) / v.peso_bruto_kg
                 ELSE 0
               END
             )), 0) as sub_total_frete,
              COALESCE(SUM(v.sacas * (
                CASE WHEN COALESCE(v.peso_bruto_kg, 0) > 0
                  THEN COALESCE(vt.kg_rateio, v.peso_bruto_kg * vt.pct_rateio, 0) / v.peso_bruto_kg
                  ELSE 0
                END
              )), 0) as sacas
            FROM viagem v
            JOIN viagem_talhao vt ON vt.viagem_id = v.id AND vt.talhao_id = @talhao_id
            WHERE (@safra_id IS NULL OR v.safra_id = @safra_id)
              AND (@destino_id IS NULL OR v.destino_id = @destino_id)
              AND (@motorista_id IS NULL OR v.motorista_id = @motorista_id)
              AND (@de IS NULL OR v.data_saida >= @de)
              AND (@ate IS NULL OR v.data_saida <= @ate)`,
          )
         .get(params)
    }

    return db
      .prepare(
        `SELECT
           COALESCE(SUM(carga_total_kg), 0) as carga_total_kg,
           COALESCE(SUM(tara_kg), 0) as tara_kg,
           COALESCE(SUM(peso_bruto_kg), 0) as peso_bruto_kg,
           COALESCE(SUM(peso_bruto_kg * COALESCE(umidade_pct, 0)), 0) as peso_bruto_x_umidade,
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
         WHERE (@safra_id IS NULL OR safra_id = @safra_id)
           AND (@destino_id IS NULL OR destino_id = @destino_id)
           AND (@motorista_id IS NULL OR motorista_id = @motorista_id)
           AND (@de IS NULL OR data_saida >= @de)
           AND (@ate IS NULL OR data_saida <= @ate)`,
      )
      .get(params)
  },

  create(data, { user_id } = {}) {
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
            created_by_user_id, updated_by_user_id, updated_at
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
            @created_by_user_id, @updated_by_user_id, datetime('now')
          )`,
      )
      .run({ ...data, created_by_user_id: user_id ?? null, updated_by_user_id: user_id ?? null })
    return this.get(info.lastInsertRowid)
  },

  update(id, data, { user_id } = {}) {
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
          updated_by_user_id=@updated_by_user_id,
          updated_at=datetime('now')
       WHERE id=@id`,
    ).run({ ...data, id, updated_by_user_id: user_id ?? null })

    return this.get(id)
  },

  remove(id) {
    return db.prepare('DELETE FROM viagem WHERE id=?').run(id)
  },

  fichaStatsBySafra({ safra_id, exclude_id } = {}) {
    const rows = db
      .prepare(
        `SELECT ficha
         FROM viagem
         WHERE safra_id = @safra_id
           AND (@exclude_id IS NULL OR id <> @exclude_id)`,
      )
      .all({ safra_id, exclude_id: exclude_id ?? null })

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

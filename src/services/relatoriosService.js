import { db } from '../db/db.js'
import { viagemRepo } from '../repositories/viagemRepo.js'

export const relatoriosService = {
  painel() {
    const totalsGeral = viagemRepo.totals({})

    const umidadeMediaPonderadaGeral = db
      .prepare(
        `SELECT
           CASE WHEN COALESCE(SUM(peso_bruto_kg), 0) > 0
             THEN COALESCE(SUM(peso_bruto_kg * umidade_pct), 0) / SUM(peso_bruto_kg)
             ELSE 0
           END as umidade_media
         FROM viagem`,
      )
      .get().umidade_media

    const safraPainel = db
      .prepare(
        `SELECT * FROM safra
         WHERE painel=1
         ORDER BY
           CASE WHEN data_referencia IS NULL OR data_referencia='' THEN 1 ELSE 0 END,
           data_referencia DESC,
           id DESC
         LIMIT 1`,
      )
      .get()

    const ultimaSafra = db
      .prepare(
        `SELECT * FROM safra
         ORDER BY
           CASE WHEN data_referencia IS NULL OR data_referencia='' THEN 1 ELSE 0 END,
           data_referencia DESC,
           id DESC
         LIMIT 1`,
      )
      .get()

    const safraAtual = safraPainel || ultimaSafra

    const areaPlantada = db
      .prepare(
        `SELECT COALESCE(SUM(hectares), 0) as area_ha
         FROM talhao
         WHERE UPPER(COALESCE(situacao, '')) = 'ATIVO'`,
      )
      .get().area_ha

    const totalsUltimaSafra = safraAtual
      ? viagemRepo.totals({ safra_id: safraAtual.id })
      : viagemRepo.totals({})

    const umidadeMediaPonderadaUltimaSafra = safraAtual
      ? db
          .prepare(
            `SELECT
               CASE WHEN COALESCE(SUM(peso_bruto_kg), 0) > 0
                 THEN COALESCE(SUM(peso_bruto_kg * umidade_pct), 0) / SUM(peso_bruto_kg)
                 ELSE 0
               END as umidade_media
             FROM viagem
             WHERE safra_id = @safra_id`,
          )
          .get({ safra_id: safraAtual.id }).umidade_media
      : 0

    const areaColhidaUltimaSafra = safraAtual
      ? db
           .prepare(
             `SELECT
                COALESCE(SUM(t.hectares * COALESCE(ts.pct_area_colhida, 0)), 0) as area_colhida_ha
              FROM talhao t
              LEFT JOIN talhao_safra ts ON ts.talhao_id = t.id AND ts.safra_id = @safra_id
              WHERE UPPER(COALESCE(t.situacao, '')) = 'ATIVO'`,
           )
           .get({ safra_id: safraAtual.id }).area_colhida_ha
      : 0

    const produtividadeGeral = areaPlantada > 0 ? totalsGeral.sacas / areaPlantada : 0
    const produtividadeUltimaSafra =
      areaPlantada > 0 ? totalsUltimaSafra.sacas / areaPlantada : 0
    const produtividadeUltimaSafraAjustada =
      areaColhidaUltimaSafra > 0
        ? totalsUltimaSafra.sacas / areaColhidaUltimaSafra
        : 0

    const perdasGeralPct =
      totalsGeral.peso_bruto_kg > 0
        ? 1 - totalsGeral.peso_limpo_seco_kg / totalsGeral.peso_bruto_kg
        : 0

    const perdasUltimaSafraPct =
      (totalsUltimaSafra?.peso_bruto_kg || 0) > 0
        ? 1 -
          (totalsUltimaSafra?.peso_limpo_seco_kg || 0) /
            totalsUltimaSafra.peso_bruto_kg
        : 0

    return {
      totals_geral: totalsGeral,
      umidade_media_ponderada_geral: umidadeMediaPonderadaGeral,
      perdas_geral_pct: perdasGeralPct,
      area_plantada_ha: areaPlantada,
      produtividade_geral_sacas_ha: produtividadeGeral,
      ultima_safra: ultimaSafra
        ? {
            id: ultimaSafra.id,
            safra: ultimaSafra.safra,
            plantio: ultimaSafra.plantio,
          }
        : null,
      safra_painel: safraPainel
        ? {
            id: safraPainel.id,
            safra: safraPainel.safra,
            plantio: safraPainel.plantio,
          }
        : null,
      safra_atual: safraAtual
        ? {
            id: safraAtual.id,
            safra: safraAtual.safra,
            plantio: safraAtual.plantio,
          }
        : null,
      totals_ultima_safra: totalsUltimaSafra,
      umidade_media_ponderada_ultima_safra: umidadeMediaPonderadaUltimaSafra,
      perdas_ultima_safra_pct: perdasUltimaSafraPct,
      area_colhida_ultima_safra_ha: areaColhidaUltimaSafra,
      produtividade_ultima_safra_sacas_ha: produtividadeUltimaSafra,
      produtividade_ultima_safra_ajustada_sacas_ha: produtividadeUltimaSafraAjustada,
    }
  },
  colheita(filters) {
    const items = viagemRepo.list(filters)
    const totals = viagemRepo.totals(filters)
    return { items, totals }
  },

  resumoTalhao({ safra_id }) {
    return db
      .prepare(
        `SELECT
           t.id as talhao_id,
           t.codigo as talhao_codigo,
           t.local as talhao_local,
           t.nome as talhao_nome,
           t.situacao as talhao_situacao,
           t.hectares as hectares,
           COALESCE(ts.pct_area_colhida, 0) as pct_area_colhida,
           COALESCE(SUM(
             CASE WHEN v.id IS NULL THEN 0 ELSE COALESCE(
               vt.kg_rateio,
               v.peso_bruto_kg * vt.pct_rateio,
               0
             ) END
           ), 0) as peso_liquido_kg,
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
           COALESCE(SUM(v.peso_limpo_seco_kg * (
             CASE WHEN COALESCE(v.peso_bruto_kg, 0) > 0
               THEN COALESCE(vt.kg_rateio, v.peso_bruto_kg * vt.pct_rateio, 0) / v.peso_bruto_kg
               ELSE 0
             END
           )), 0) as peso_limpo_seco_kg,
           COALESCE(SUM(v.sacas * (
             CASE WHEN COALESCE(v.peso_bruto_kg, 0) > 0
               THEN COALESCE(vt.kg_rateio, v.peso_bruto_kg * vt.pct_rateio, 0) / v.peso_bruto_kg
               ELSE 0
             END
           )), 0) as sacas,
           CASE WHEN t.hectares > 0 THEN (COALESCE(SUM(v.sacas * (
             CASE WHEN COALESCE(v.peso_bruto_kg, 0) > 0
               THEN COALESCE(vt.kg_rateio, v.peso_bruto_kg * vt.pct_rateio, 0) / v.peso_bruto_kg
               ELSE 0
             END
           )), 0) / t.hectares) ELSE 0 END as produtividade_sacas_ha,
           CASE WHEN t.hectares > 0 AND COALESCE(ts.pct_area_colhida, 0) > 0 THEN (COALESCE(SUM(v.sacas * (
             CASE WHEN COALESCE(v.peso_bruto_kg, 0) > 0
               THEN COALESCE(vt.kg_rateio, v.peso_bruto_kg * vt.pct_rateio, 0) / v.peso_bruto_kg
               ELSE 0
             END
           )), 0) / (t.hectares * COALESCE(ts.pct_area_colhida, 0))) ELSE 0 END as produtividade_ajustada_sacas_ha,
           COALESCE(SUM(v.sub_total_frete * (
             CASE WHEN COALESCE(v.peso_bruto_kg, 0) > 0
               THEN COALESCE(vt.kg_rateio, v.peso_bruto_kg * vt.pct_rateio, 0) / v.peso_bruto_kg
               ELSE 0
             END
           )), 0) as sub_total_frete
          FROM talhao t
          LEFT JOIN viagem_talhao vt ON vt.talhao_id = t.id
          LEFT JOIN viagem v ON v.id = vt.viagem_id AND v.safra_id = @safra_id
          LEFT JOIN talhao_safra ts ON ts.talhao_id = t.id AND ts.safra_id = @safra_id
          GROUP BY t.id
          ORDER BY t.local, t.codigo`,
      )
      .all({ safra_id })
  },

  pagamentoMotoristas({ de, ate }) {
    return db
      .prepare(
        `SELECT
           m.id as motorista_id,
           m.nome as motorista_nome,
           m.placa as placa,
           COUNT(v.id) as quantidade,
           COALESCE(SUM(v.sub_total_frete), 0) as valor
         FROM motorista m
         LEFT JOIN viagem v ON v.motorista_id = m.id
         WHERE (@de IS NULL OR v.data_saida >= @de)
           AND (@ate IS NULL OR v.data_saida <= @ate)
         GROUP BY m.id
         ORDER BY m.nome`,
      )
      .all({ de: de ?? null, ate: ate ?? null })
  },

  entregasPorDestino({ safra_id, tipo_plantio }) {
    const tp = String(tipo_plantio || '').trim().toUpperCase()
    return db
      .prepare(
        `SELECT
           d.id as destino_id,
           d.codigo as destino_codigo,
           d.local as destino_local,
           c.sacas_contratadas as trava_sacas,
           d.distancia_km as distancia_km,
           COALESCE(SUM(v.sacas), 0) as entrega_sacas,
           COALESCE(SUM(v.peso_limpo_seco_kg), 0) as peso_limpo_seco_kg
         FROM destino d
         LEFT JOIN (
           SELECT
             c.destino_id,
             c.safra_id,
             c.tipo_plantio,
             SUM(f.sacas) as sacas_contratadas
           FROM contrato_silo c
           JOIN contrato_silo_faixa f ON f.contrato_silo_id = c.id
           GROUP BY c.destino_id, c.safra_id, c.tipo_plantio
         ) c
           ON c.destino_id = d.id
          AND c.safra_id = @safra_id
          AND (@tipo_plantio = '' OR c.tipo_plantio = @tipo_plantio)
         LEFT JOIN viagem v ON v.destino_id = d.id AND v.safra_id = @safra_id
         GROUP BY d.id, c.sacas_contratadas
         ORDER BY d.local`,
      )
      .all({ safra_id, tipo_plantio: tp })
  },
}

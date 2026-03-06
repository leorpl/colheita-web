import { db } from '../db/db.js'
import { viagemRepo } from '../repositories/viagemRepo.js'
import { viagemService } from './viagemService.js'
import { xlsxExportService } from './xlsxExportService.js'

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

  colheitasCompletoXlsx(filters = {}) {
    const items = viagemRepo.list(filters)

    const headers = [
      'ID',
      'Ficha',
      'Safra',
      'Safra ID',
      'Plantio',
      'Talhao',
      'Talhao codigo',
      'Talhao local',
      'Talhao ID',
      'Destino',
      'Destino codigo',
      'Destino ID',
      'Motorista',
      'Motorista ID',
      'Placa',
      'Local (colheita)',

      'Data saida',
      'Hora saida',
      'Data entrega',
      'Hora entrega',

      'Umidade informada (%)',
      'Impureza (%)',
      'Ardidos (%)',
      'Queimados (%)',
      'Avariados (%)',
      'Esverdiados (%)',
      'Quebrados (%)',

      'Limite impureza (%)',
      'Limite ardidos (%)',
      'Limite queimados (%)',
      'Limite avariados (%)',
      'Limite esverdiados (%)',
      'Limite quebrados (%)',

      'Carga total (kg)',
      'Tara (kg)',
      'Peso bruto (kg)',
      'Desc. umidade aplicado (%)',
      'Desc. umidade manual (%)',
      'Umidade (kg)',
      'Impureza (kg)',
      'Ardidos (kg)',
      'Queimados (kg)',
      'Avariados (kg)',
      'Esverdiados (kg)',
      'Quebrados (kg)',
      'Peso limpo/seco (kg)',
      'Sacas (sc)',

      'Sacas frete (sc)',
      'Frete tabela (R$/sc)',
      'Frete total (R$)',

      'Secagem (R$/sc)',
      'Secagem total (R$)',
      'Custos silo (R$/sc)',
      'Custos silo total (R$)',
      'Custos terceiros (R$/sc)',
      'Custos terceiros total (R$)',

      'Compra silo aplicada (R$/sc)',
      'Compra silo total (R$)',
      'Compra entregue antes (sc)',
      'Compra entregue depois (sc)',

      'Frete por saca (R$/sc)',
      'Despesas silo por saca (R$/sc)',
      'Compra liquida silo (R$/sc)',
      'Preco liquido silo (R$/sc)',
      'Total liquido silo (R$)',

      'Criacao',
      'Alteracao',
    ]

    const pct100 = (x) => (Number.isFinite(Number(x)) ? Number(x) * 100 : null)

    const rows = (items || []).map((v) => {
      const sacas = Number(v.sacas || 0)
      const freteTotal = Number(v.sub_total_frete || 0)
      const fretePorSaca = sacas > 0 ? freteTotal / sacas : 0

      const compraAplicada =
        v.valor_compra_por_saca_aplicado === null || v.valor_compra_por_saca_aplicado === undefined
          ? null
          : Number(v.valor_compra_por_saca_aplicado)

      const secagemPorSaca = Number(v.secagem_custo_por_saca || 0)
      const custoSiloPorSaca = Number(v.custo_silo_por_saca || 0)
      const despesasSiloPorSaca = secagemPorSaca + custoSiloPorSaca + fretePorSaca

      const compraLiquidaSilo = compraAplicada === null ? null : compraAplicada - despesasSiloPorSaca
      const precoLiquidoSilo =
        compraAplicada === null ? null : compraAplicada - Number(v.abatimento_por_saca_silo || 0)
      const totalLiquidoSilo = precoLiquidoSilo === null ? null : sacas * Number(precoLiquidoSilo || 0)

      return [
        Number(v.id ?? 0) || '',
        String(v.ficha ?? ''),
        String(v.safra_nome ?? ''),
        Number(v.safra_id ?? 0) || '',
        String(v.tipo_plantio ?? ''),
        String(v.talhao_nome ?? ''),
        String(v.talhao_codigo ?? ''),
        String(v.talhao_local ?? ''),
        Number(v.talhao_id ?? 0) || '',
        String(v.destino_local ?? ''),
        String(v.destino_codigo ?? ''),
        Number(v.destino_id ?? 0) || '',
        String(v.motorista_nome ?? ''),
        Number(v.motorista_id ?? 0) || '',
        String(v.placa ?? ''),
        String(v.local ?? ''),

        String(v.data_saida ?? ''),
        String(v.hora_saida ?? ''),
        String(v.data_entrega ?? ''),
        String(v.hora_entrega ?? ''),

        pct100(v.umidade_pct),
        pct100(v.impureza_pct),
        pct100(v.ardidos_pct),
        pct100(v.queimados_pct),
        pct100(v.avariados_pct),
        pct100(v.esverdiados_pct),
        pct100(v.quebrados_pct),

        pct100(v.impureza_limite_pct),
        pct100(v.ardidos_limite_pct),
        pct100(v.queimados_limite_pct),
        pct100(v.avariados_limite_pct),
        pct100(v.esverdiados_limite_pct),
        pct100(v.quebrados_limite_pct),

        Number(v.carga_total_kg ?? 0),
        Number(v.tara_kg ?? 0),
        Number(v.peso_bruto_kg ?? 0),
        pct100(v.umidade_desc_pct),
        pct100(v.umidade_desc_pct_manual),
        Number(v.umidade_kg ?? 0),
        Number(v.impureza_kg ?? 0),
        Number(v.ardidos_kg ?? 0),
        Number(v.queimados_kg ?? 0),
        Number(v.avariados_kg ?? 0),
        Number(v.esverdiados_kg ?? 0),
        Number(v.quebrados_kg ?? 0),
        Number(v.peso_limpo_seco_kg ?? 0),
        Number(v.sacas ?? 0),

        Number(v.sacas_frete ?? 0),
        Number(v.frete_tabela ?? 0),
        Number(v.sub_total_frete ?? 0),

        Number(v.secagem_custo_por_saca ?? 0),
        Number(v.sub_total_secagem ?? 0),
        Number(v.custo_silo_por_saca ?? 0),
        Number(v.sub_total_custo_silo ?? 0),
        Number(v.custo_terceiros_por_saca ?? 0),
        Number(v.sub_total_custo_terceiros ?? 0),

        compraAplicada === null ? '' : compraAplicada,
        Number(v.valor_compra_total ?? 0),
        Number(v.valor_compra_entrega_antes ?? 0),
        Number(v.valor_compra_entrega_depois ?? 0),

        fretePorSaca,
        despesasSiloPorSaca,
        compraLiquidaSilo === null ? '' : compraLiquidaSilo,
        precoLiquidoSilo === null ? '' : precoLiquidoSilo,
        totalLiquidoSilo === null ? '' : totalLiquidoSilo,

        String(v.created_at ?? ''),
        String(v.updated_at ?? ''),
      ]
    })

    const aoa = [headers].concat(rows)
    return xlsxExportService.aoaToXlsxBuffer({ sheetName: 'Colheitas', aoa })
  },

  viagensBrutoXlsx(filters = {}) {
    const items = viagemService.listView({ ...filters, view: 'flat' })

    const headers = [
      'ID',
      'Ficha',
      'Safra',
      'Talhao',
      'Local',
      '%',
      'Destino',
      'Data saida',
      'Motorista',
      'Umidade %',
      'Carga (kg)',
      'Tara (kg)',
      'Peso bruto (kg)',
      'Peso limpo e seco (kg)',
      'Desconto %',
      'Sacas',
      'Frete tabela (R$/sc)',
      'Frete (R$)',
      'Compra (Silo) (R$/sc)',
      'Silo (liquida) (R$/sc)',
      'Terceiros (ideal) (R$/sc)',
    ]

    const rows = (items || []).map((v) => {
      const umidRaw = Number(v.umidade_pct)
      const umidFrac = Number.isFinite(umidRaw) && umidRaw > 1 ? umidRaw / 100 : umidRaw

      const pb = Number(v.peso_bruto_kg)
      const pls = Number(v.peso_limpo_seco_kg)
      const descPct =
        Number.isFinite(pb) && pb > 0 && Number.isFinite(pls)
          ? Math.max(0, Math.min(1, 1 - pls / pb)) * 100
          : 0

      const sacas = Number(v.sacas || 0)
      const freteTotal = Number(v.sub_total_frete || 0)
      const fretePorSaca = sacas > 0 ? freteTotal / sacas : 0
      const secagemPorSaca = Number(v.secagem_custo_por_saca || 0)
      const custoSiloPorSaca = Number(v.custo_silo_por_saca || 0)
      const custoTercPorSaca = Number(v.custo_terceiros_por_saca || 0)

      const valorCompraApplied = Number(v.valor_compra_por_saca_aplicado)
      const valorCompraRule =
        v.regra_valor_compra_por_saca === null || v.regra_valor_compra_por_saca === undefined
          ? null
          : Number(v.regra_valor_compra_por_saca)
      const valorCompra = Number.isFinite(valorCompraApplied)
        ? valorCompraApplied
        : Number.isFinite(valorCompraRule)
          ? valorCompraRule
          : null

      const compraSilo = valorCompra !== null && Number.isFinite(valorCompra) ? valorCompra : null
      const siloLiquida =
        compraSilo === null ? null : compraSilo - (fretePorSaca + secagemPorSaca + custoSiloPorSaca)
      const terceirosIdeal = compraSilo === null ? null : compraSilo + custoTercPorSaca

      return [
        Number(v.id ?? 0) || '',
        String(v.display_ficha ?? v.ficha ?? ''),
        String(v.safra_nome ?? ''),
        String(v.talhao_nome ?? ''),
        String(v.talhao_local ?? ''),
        v.pct_rateio_100 === null || v.pct_rateio_100 === undefined ? null : Number(v.pct_rateio_100),
        String(v.destino_local ?? ''),
        String(v.data_saida ?? ''),
        String(v.motorista_nome ?? ''),
        Number.isFinite(umidFrac) ? umidFrac * 100 : null,
        Number(v.carga_total_kg ?? 0),
        Number(v.tara_kg ?? 0),
        Number(v.peso_bruto_kg ?? 0),
        Number(v.peso_limpo_seco_kg ?? 0),
        descPct,
        Number(v.sacas ?? 0),
        Number(v.frete_tabela ?? 0),
        Number(v.sub_total_frete ?? 0),
        compraSilo,
        siloLiquida,
        terceirosIdeal,
      ]
    })

    const aoa = [headers].concat(rows)
    return xlsxExportService.aoaToXlsxBuffer({ sheetName: 'Dados brutos', aoa })
  },

  resumoTalhao({ safra_id, de, ate }) {
    const hasPeriod = Boolean(de || ate)
    const params = { safra_id, de: de ?? null, ate: ate ?? null }

    // Sem periodo: lista todos os talhoes (mesmo sem movimento).
    if (!hasPeriod) {
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
            LEFT JOIN viagem v
              ON v.id = vt.viagem_id
             AND v.safra_id = @safra_id
            LEFT JOIN talhao_safra ts ON ts.talhao_id = t.id AND ts.safra_id = @safra_id
            GROUP BY t.id
            ORDER BY t.local, t.codigo`,
        )
        .all({ safra_id })
    }

    // Com periodo: retorna apenas talhoes com movimento no periodo.
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
           COALESCE(SUM(COALESCE(
             vt.kg_rateio,
             v.peso_bruto_kg * vt.pct_rateio,
             0
           )), 0) as peso_liquido_kg,
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
          JOIN viagem_talhao vt ON vt.talhao_id = t.id
          JOIN viagem v ON v.id = vt.viagem_id AND v.safra_id = @safra_id
          LEFT JOIN talhao_safra ts ON ts.talhao_id = t.id AND ts.safra_id = @safra_id
          WHERE (@de IS NULL OR v.data_saida >= @de)
            AND (@ate IS NULL OR v.data_saida <= @ate)
          GROUP BY t.id
          ORDER BY t.local, t.codigo`,
      )
      .all(params)
  },

  pagamentoMotoristas({ safra_id, de, ate }) {
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
         WHERE (@safra_id IS NULL OR v.safra_id = @safra_id)
           AND (@de IS NULL OR v.data_saida >= @de)
           AND (@ate IS NULL OR v.data_saida <= @ate)
         GROUP BY m.id
         ORDER BY m.nome`,
      )
      .all({ safra_id: safra_id ?? null, de: de ?? null, ate: ate ?? null })
  },

  entregasPorDestino({ safra_id, tipo_plantio, de, ate }) {
    const tp = String(tipo_plantio || '').trim().toUpperCase()
    const hasPeriod = Boolean(de || ate)
    const params = { safra_id, tipo_plantio: tp, de: de ?? null, ate: ate ?? null }

    // Com periodo: retornar apenas destinos com entregas no periodo.
    if (hasPeriod) {
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
           JOIN viagem v
             ON v.destino_id = d.id
            AND v.safra_id = @safra_id
            AND (@de IS NULL OR v.data_saida >= @de)
            AND (@ate IS NULL OR v.data_saida <= @ate)
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
           GROUP BY d.id, c.sacas_contratadas
           ORDER BY d.local`,
        )
        .all(params)
    }

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
          LEFT JOIN viagem v
            ON v.destino_id = d.id
           AND v.safra_id = @safra_id
           AND (@de IS NULL OR v.data_saida >= @de)
           AND (@ate IS NULL OR v.data_saida <= @ate)
          GROUP BY d.id, c.sacas_contratadas
          ORDER BY d.local`,
      )
      .all(params)
  },
}

import { viagemRepo } from '../repositories/viagemRepo.js'
import { prismaClient } from '../db/prisma.js'

export const relatoriosService = {
  async painel() {
    const prisma = prismaClient()
    const totalsGeral = await viagemRepo.totals({})

    const safraPainel = await prisma.safra.findFirst({
      where: { painel: 1 },
      orderBy: [
        { data_referencia: { sort: 'desc', nulls: 'last' } },
        { id: 'desc' },
      ],
    })

    const ultimaSafra = await prisma.safra.findFirst({
      orderBy: [
        { data_referencia: { sort: 'desc', nulls: 'last' } },
        { id: 'desc' },
      ],
    })

    const safraAtual = safraPainel || ultimaSafra

    const areaPlantada = Number(
      (
        await prisma.talhao.aggregate({
          where: { situacao: { equals: 'ATIVO', mode: 'insensitive' } },
          _sum: { hectares: true },
        })
      )._sum?.hectares || 0,
    )

    const totalsUltimaSafra = safraAtual
      ? await viagemRepo.totals({ safra_id: safraAtual.id })
      : await viagemRepo.totals({})

    const areaColhidaUltimaSafra = safraAtual
      ? Number(
          (
            await prisma.$queryRaw`
              SELECT
                COALESCE(SUM(t.hectares * COALESCE(ts.pct_area_colhida, 0)), 0)::double precision as area_colhida_ha
              FROM "talhao" t
              LEFT JOIN "talhao_safra" ts
                ON ts.talhao_id = t.id
               AND ts.safra_id = ${safraAtual.id}
              WHERE UPPER(COALESCE(t.situacao, '')) = 'ATIVO'
            `
          )?.[0]?.area_colhida_ha || 0,
        )
      : 0

    const produtividadeGeral = areaPlantada > 0 ? totalsGeral.sacas / areaPlantada : 0
    const produtividadeUltimaSafra =
      areaPlantada > 0 ? totalsUltimaSafra.sacas / areaPlantada : 0
    const produtividadeUltimaSafraAjustada =
      areaColhidaUltimaSafra > 0
        ? totalsUltimaSafra.sacas / areaColhidaUltimaSafra
        : 0

    return {
      totals_geral: totalsGeral,
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
      area_colhida_ultima_safra_ha: areaColhidaUltimaSafra,
      produtividade_ultima_safra_sacas_ha: produtividadeUltimaSafra,
      produtividade_ultima_safra_ajustada_sacas_ha: produtividadeUltimaSafraAjustada,
    }
  },
  async colheita(filters) {
    const items = await viagemRepo.list(filters)
    const totals = await viagemRepo.totals(filters)
    return { items, totals }
  },

  async resumoTalhao({ safra_id }) {
    const prisma = prismaClient()
    return prisma.$queryRaw`
      SELECT
        t.id as talhao_id,
        t.codigo as talhao_codigo,
        t.local as talhao_local,
        t.nome as talhao_nome,
        t.situacao as talhao_situacao,
        t.hectares::double precision as hectares,
        COALESCE(ts.pct_area_colhida, 0)::double precision as pct_area_colhida,
        COALESCE(SUM(v.peso_bruto_kg), 0)::double precision as peso_liquido_kg,
        COALESCE(SUM(v.umidade_kg), 0)::double precision as umidade_kg,
        COALESCE(SUM(v.impureza_kg), 0)::double precision as impureza_kg,
        COALESCE(SUM(v.peso_limpo_seco_kg), 0)::double precision as peso_limpo_seco_kg,
        COALESCE(SUM(v.sacas), 0)::double precision as sacas,
        CASE WHEN t.hectares > 0 THEN (COALESCE(SUM(v.sacas), 0) / t.hectares) ELSE 0 END::double precision as produtividade_sacas_ha,
        CASE WHEN t.hectares > 0 AND COALESCE(ts.pct_area_colhida, 0) > 0 THEN (COALESCE(SUM(v.sacas), 0) / (t.hectares * COALESCE(ts.pct_area_colhida, 0))) ELSE 0 END::double precision as produtividade_ajustada_sacas_ha,
        COALESCE(SUM(v.sub_total_frete), 0)::double precision as sub_total_frete
      FROM "talhao" t
      LEFT JOIN "viagem" v ON v.talhao_id = t.id AND v.safra_id = ${safra_id}
      LEFT JOIN "talhao_safra" ts ON ts.talhao_id = t.id AND ts.safra_id = ${safra_id}
      GROUP BY t.id, ts.pct_area_colhida
      ORDER BY t.local, t.codigo
    `
  },

  async pagamentoMotoristas({ de, ate }) {
    const prisma = prismaClient()
    const deParam = de ?? null
    const ateParam = ate ?? null
    return prisma.$queryRaw`
      SELECT
        m.id as motorista_id,
        m.nome as motorista_nome,
        m.placa as placa,
        COUNT(v.id)::int as quantidade,
        COALESCE(SUM(v.sub_total_frete), 0)::double precision as valor
      FROM "motorista" m
      LEFT JOIN "viagem" v ON v.motorista_id = m.id
      WHERE (${deParam}::text IS NULL OR v.data_saida >= ${deParam})
        AND (${ateParam}::text IS NULL OR v.data_saida <= ${ateParam})
      GROUP BY m.id
      ORDER BY m.nome
    `
  },

  async entregasPorDestino({ safra_id }) {
    const prisma = prismaClient()
    return prisma.$queryRaw`
      SELECT
        d.id as destino_id,
        d.codigo as destino_codigo,
        d.local as destino_local,
        d.trava_sacas::double precision as trava_sacas,
        d.distancia_km::double precision as distancia_km,
        COALESCE(SUM(v.sacas), 0)::double precision as entrega_sacas,
        COALESCE(SUM(v.peso_limpo_seco_kg), 0)::double precision as peso_limpo_seco_kg
      FROM "destino" d
      LEFT JOIN "viagem" v ON v.destino_id = d.id AND v.safra_id = ${safra_id}
      GROUP BY d.id
      ORDER BY d.local
    `
  },
}

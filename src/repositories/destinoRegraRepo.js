import { prismaClient } from '../db/prisma.js'
import { nowDbText } from '../util/time.js'

function prisma(p) {
  return p ?? prismaClient()
}

export const destinoRegraRepo = {
  async getBySafraDestinoPlantio({ safra_id, destino_id, tipo_plantio }) {
    if (!tipo_plantio) return null
    const row = await prisma().destinoRegraPlantio.findUnique({
      where: {
        safra_id_destino_id_tipo_plantio: { safra_id, destino_id, tipo_plantio },
      },
    })
    return row ? { ...row, _kind: 'plantio' } : null
  },

  async getBySafraDestino({ safra_id, destino_id }) {
    return prisma().destinoRegra.findUnique({
      where: { safra_id_destino_id: { safra_id, destino_id } },
    })
  },

  async upsert(data) {
    await prisma().destinoRegra.upsert({
      where: { safra_id_destino_id: { safra_id: data.safra_id, destino_id: data.destino_id } },
      create: {
        safra_id: data.safra_id,
        destino_id: data.destino_id,
        trava_sacas: data.trava_sacas ?? null,
        custo_silo_por_saca: Number(data.custo_silo_por_saca ?? 0),
        custo_terceiros_por_saca: Number(data.custo_terceiros_por_saca ?? 0),
        impureza_limite_pct: Number(data.impureza_limite_pct ?? 0),
        ardidos_limite_pct: Number(data.ardidos_limite_pct ?? 0),
        queimados_limite_pct: Number(data.queimados_limite_pct ?? 0),
        avariados_limite_pct: Number(data.avariados_limite_pct ?? 0),
        esverdiados_limite_pct: Number(data.esverdiados_limite_pct ?? 0),
        quebrados_limite_pct: Number(data.quebrados_limite_pct ?? 0),
        updated_at: nowDbText(),
      },
      update: {
        trava_sacas: data.trava_sacas ?? null,
        custo_silo_por_saca: Number(data.custo_silo_por_saca ?? 0),
        custo_terceiros_por_saca: Number(data.custo_terceiros_por_saca ?? 0),
        impureza_limite_pct: Number(data.impureza_limite_pct ?? 0),
        ardidos_limite_pct: Number(data.ardidos_limite_pct ?? 0),
        queimados_limite_pct: Number(data.queimados_limite_pct ?? 0),
        avariados_limite_pct: Number(data.avariados_limite_pct ?? 0),
        esverdiados_limite_pct: Number(data.esverdiados_limite_pct ?? 0),
        quebrados_limite_pct: Number(data.quebrados_limite_pct ?? 0),
        updated_at: nowDbText(),
      },
    })
    return this.getBySafraDestino({ safra_id: data.safra_id, destino_id: data.destino_id })
  },

  async upsertPlantio(data) {
    await prisma().destinoRegraPlantio.upsert({
      where: {
        safra_id_destino_id_tipo_plantio: {
          safra_id: data.safra_id,
          destino_id: data.destino_id,
          tipo_plantio: data.tipo_plantio,
        },
      },
      create: {
        safra_id: data.safra_id,
        destino_id: data.destino_id,
        tipo_plantio: data.tipo_plantio,
        trava_sacas: data.trava_sacas ?? null,
        custo_silo_por_saca: Number(data.custo_silo_por_saca ?? 0),
        custo_terceiros_por_saca: Number(data.custo_terceiros_por_saca ?? 0),
        impureza_limite_pct: Number(data.impureza_limite_pct ?? 0),
        ardidos_limite_pct: Number(data.ardidos_limite_pct ?? 0),
        queimados_limite_pct: Number(data.queimados_limite_pct ?? 0),
        avariados_limite_pct: Number(data.avariados_limite_pct ?? 0),
        esverdiados_limite_pct: Number(data.esverdiados_limite_pct ?? 0),
        quebrados_limite_pct: Number(data.quebrados_limite_pct ?? 0),
        updated_at: nowDbText(),
      },
      update: {
        trava_sacas: data.trava_sacas ?? null,
        custo_silo_por_saca: Number(data.custo_silo_por_saca ?? 0),
        custo_terceiros_por_saca: Number(data.custo_terceiros_por_saca ?? 0),
        impureza_limite_pct: Number(data.impureza_limite_pct ?? 0),
        ardidos_limite_pct: Number(data.ardidos_limite_pct ?? 0),
        queimados_limite_pct: Number(data.queimados_limite_pct ?? 0),
        avariados_limite_pct: Number(data.avariados_limite_pct ?? 0),
        esverdiados_limite_pct: Number(data.esverdiados_limite_pct ?? 0),
        quebrados_limite_pct: Number(data.quebrados_limite_pct ?? 0),
        updated_at: nowDbText(),
      },
    })
    return this.getBySafraDestinoPlantio({
      safra_id: data.safra_id,
      destino_id: data.destino_id,
      tipo_plantio: data.tipo_plantio,
    })
  },

  async listBySafra({ safra_id }) {
    const rows = await prisma().destinoRegra.findMany({
      where: { safra_id },
      include: { destino: true },
      orderBy: [{ destino: { local: 'asc' } }],
    })
    return rows.map((r) => ({
      ...r,
      destino_local: r.destino?.local ?? null,
      destino_codigo: r.destino?.codigo ?? null,
    }))
  },

  async getUmidadeFaixas(destino_regra_id) {
    return prisma().umidadeFaixa.findMany({
      where: { destino_regra_id },
      orderBy: [{ umid_gt: 'asc' }, { umid_lte: 'asc' }],
    })
  },

  async getUmidadeFaixasPlantio(destino_regra_plantio_id) {
    return prisma().umidadeFaixaPlantio.findMany({
      where: { destino_regra_plantio_id },
      orderBy: [{ umid_gt: 'asc' }, { umid_lte: 'asc' }],
    })
  },

  async replaceUmidadeFaixas(destino_regra_id, faixas) {
    await prisma().$transaction(async (tx) => {
      await tx.umidadeFaixa.deleteMany({ where: { destino_regra_id } })
      if (faixas.length) {
        await tx.umidadeFaixa.createMany({
          data: faixas.map((f) => ({
            destino_regra_id,
            umid_gt: Number(f.umid_gt),
            umid_lte: Number(f.umid_lte),
            desconto_pct: Number(f.desconto_pct),
            custo_secagem_por_saca: Number(f.custo_secagem_por_saca ?? 0),
            updated_at: nowDbText(),
          })),
        })
      }
    })

    return this.getUmidadeFaixas(destino_regra_id)
  },

  async replaceUmidadeFaixasPlantio(destino_regra_plantio_id, faixas) {
    await prisma().$transaction(async (tx) => {
      await tx.umidadeFaixaPlantio.deleteMany({ where: { destino_regra_plantio_id } })
      if (faixas.length) {
        await tx.umidadeFaixaPlantio.createMany({
          data: faixas.map((f) => ({
            destino_regra_plantio_id,
            umid_gt: Number(f.umid_gt),
            umid_lte: Number(f.umid_lte),
            desconto_pct: Number(f.desconto_pct),
            custo_secagem_por_saca: Number(f.custo_secagem_por_saca ?? 0),
            updated_at: nowDbText(),
          })),
        })
      }
    })

    return this.getUmidadeFaixasPlantio(destino_regra_plantio_id)
  },
}

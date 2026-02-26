import { prismaClient } from '../db/prisma.js'
import { nowDbText } from '../util/time.js'

function prisma(p) {
  return p ?? prismaClient()
}

export const talhaoSafraRepo = {
  async get({ safra_id, talhao_id }) {
    return prisma().talhaoSafra.findUnique({
      where: { safra_id_talhao_id: { safra_id, talhao_id } },
    })
  },

  async upsert({ safra_id, talhao_id, pct_area_colhida }) {
    await prisma().talhaoSafra.upsert({
      where: { safra_id_talhao_id: { safra_id, talhao_id } },
      create: {
        safra_id,
        talhao_id,
        pct_area_colhida: Number(pct_area_colhida ?? 0),
        updated_at: nowDbText(),
      },
      update: {
        pct_area_colhida: Number(pct_area_colhida ?? 0),
        updated_at: nowDbText(),
      },
    })

    return this.get({ safra_id, talhao_id })
  },

  async listBySafra({ safra_id }) {
    const rows = await prisma().talhaoSafra.findMany({
      where: { safra_id },
      include: { talhao: true },
      orderBy: [{ talhao: { local: 'asc' } }, { talhao: { codigo: 'asc' } }],
    })
    return rows.map((r) => ({
      ...r,
      talhao_codigo: r.talhao?.codigo ?? null,
      talhao_local: r.talhao?.local ?? null,
      talhao_nome: r.talhao?.nome ?? null,
    }))
  },
}

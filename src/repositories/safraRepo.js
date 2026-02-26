import { prismaClient } from '../db/prisma.js'
import { nowDbText } from '../util/time.js'

function prisma(p) {
  return p ?? prismaClient()
}

export const safraRepo = {
  async list() {
    return prisma().safra.findMany({
      orderBy: [
        { data_referencia: { sort: 'desc', nulls: 'last' } },
        { id: 'desc' },
      ],
    })
  },
  async get(id) {
    return prisma().safra.findUnique({ where: { id } })
  },
  async create(data) {
    return prisma().safra.create({
      data: {
        safra: data.safra,
        plantio: data.plantio ?? null,
        data_referencia: data.data_referencia ?? null,
        area_ha: Number(data.area_ha ?? 0),
        updated_at: nowDbText(),
      },
    })
  },
  async update(id, data) {
    return prisma().safra.update({
      where: { id },
      data: {
        safra: data.safra,
        plantio: data.plantio ?? null,
        data_referencia: data.data_referencia ?? null,
        area_ha: Number(data.area_ha ?? 0),
        updated_at: nowDbText(),
      },
    })
  },
  async remove(id) {
    return prisma().safra.delete({ where: { id } })
  },

  async setPainel(id) {
    await prisma().$transaction(async (tx) => {
      await tx.safra.updateMany({ data: { painel: 0 } })
      await tx.safra.update({ where: { id }, data: { painel: 1, updated_at: nowDbText() } })
    })
    return this.get(id)
  },
}

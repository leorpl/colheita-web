import { prismaClient } from '../db/prisma.js'
import { nowDbText } from '../util/time.js'

function prisma(p) {
  return p ?? prismaClient()
}

export const destinoRepo = {
  async list() {
    return prisma().destino.findMany({ orderBy: [{ id: 'desc' }] })
  },
  async get(id) {
    return prisma().destino.findUnique({ where: { id } })
  },
  async create(data) {
    return prisma().destino.create({
      data: {
        codigo: data.codigo,
        local: data.local,
        maps_url: data.maps_url ?? null,
        trava_sacas: data.trava_sacas === '' ? null : (data.trava_sacas ?? null),
        distancia_km: data.distancia_km === '' ? null : (data.distancia_km ?? null),
        observacoes: data.observacoes ?? null,
        updated_at: nowDbText(),
      },
    })
  },
  async update(id, data) {
    return prisma().destino.update({
      where: { id },
      data: {
        codigo: data.codigo,
        local: data.local,
        maps_url: data.maps_url ?? null,
        trava_sacas: data.trava_sacas === '' ? null : (data.trava_sacas ?? null),
        distancia_km: data.distancia_km === '' ? null : (data.distancia_km ?? null),
        observacoes: data.observacoes ?? null,
        updated_at: nowDbText(),
      },
    })
  },
  async remove(id) {
    return prisma().destino.delete({ where: { id } })
  },
}

import { prismaClient } from '../db/prisma.js'
import { nowDbText } from '../util/time.js'

function prisma(p) {
  return p ?? prismaClient()
}

export const talhaoRepo = {
  async list() {
    return prisma().talhao.findMany({ orderBy: [{ id: 'desc' }] })
  },
  async get(id) {
    return prisma().talhao.findUnique({ where: { id } })
  },
  async create(data) {
    return prisma().talhao.create({
      data: {
        codigo: data.codigo,
        local: data.local ?? null,
        nome: data.nome ?? null,
        situacao: data.situacao ?? null,
        hectares: Number(data.hectares ?? 0),
        posse: data.posse ?? null,
        contrato: data.contrato ?? null,
        observacoes: data.observacoes ?? null,
        irrigacao: data.irrigacao ?? null,
        foto_url: data.foto_url ?? null,
        maps_url: data.maps_url ?? null,
        tipo_solo: data.tipo_solo ?? null,
        calagem: data.calagem ?? null,
        gessagem: data.gessagem ?? null,
        fosforo_corretivo: data.fosforo_corretivo ?? null,
        updated_at: nowDbText(),
      },
    })
  },
  async update(id, data) {
    return prisma().talhao.update({
      where: { id },
      data: {
        codigo: data.codigo,
        local: data.local ?? null,
        nome: data.nome ?? null,
        situacao: data.situacao ?? null,
        hectares: Number(data.hectares ?? 0),
        posse: data.posse ?? null,
        contrato: data.contrato ?? null,
        observacoes: data.observacoes ?? null,
        irrigacao: data.irrigacao ?? null,
        foto_url: data.foto_url ?? null,
        maps_url: data.maps_url ?? null,
        tipo_solo: data.tipo_solo ?? null,
        calagem: data.calagem ?? null,
        gessagem: data.gessagem ?? null,
        fosforo_corretivo: data.fosforo_corretivo ?? null,
        updated_at: nowDbText(),
      },
    })
  },
  async remove(id) {
    return prisma().talhao.delete({ where: { id } })
  },
}

import { prismaClient } from '../db/prisma.js'
import { nowDbText } from '../util/time.js'

function prisma(p) {
  return p ?? prismaClient()
}

export const motoristaRepo = {
  async list() {
    return prisma().motorista.findMany({ orderBy: [{ id: 'desc' }] })
  },
  async get(id) {
    return prisma().motorista.findUnique({ where: { id } })
  },
  async create(data) {
    return prisma().motorista.create({
      data: {
        nome: data.nome,
        placa: data.placa ?? null,
        cpf: data.cpf ?? null,
        banco: data.banco ?? null,
        pix_conta: data.pix_conta ?? null,
        tipo_veiculo: data.tipo_veiculo ?? null,
        capacidade_kg: data.capacidade_kg === '' ? null : (data.capacidade_kg ?? null),
        updated_at: nowDbText(),
      },
    })
  },
  async update(id, data) {
    return prisma().motorista.update({
      where: { id },
      data: {
        nome: data.nome,
        placa: data.placa ?? null,
        cpf: data.cpf ?? null,
        banco: data.banco ?? null,
        pix_conta: data.pix_conta ?? null,
        tipo_veiculo: data.tipo_veiculo ?? null,
        capacidade_kg: data.capacidade_kg === '' ? null : (data.capacidade_kg ?? null),
        updated_at: nowDbText(),
      },
    })
  },
  async remove(id) {
    return prisma().motorista.delete({ where: { id } })
  },
}

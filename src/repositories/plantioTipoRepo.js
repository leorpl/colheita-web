import { prismaClient } from '../db/prisma.js'
import { nowDbText } from '../util/time.js'

function prisma(p) {
  return p ?? prismaClient()
}

export const plantioTipoRepo = {
  async list() {
    return prisma().plantioTipo.findMany({ orderBy: [{ nome: 'asc' }] })
  },
  async get(id) {
    return prisma().plantioTipo.findUnique({ where: { id } })
  },
  async create({ nome }) {
    return prisma().plantioTipo.create({
      data: { nome, updated_at: nowDbText() },
    })
  },
  async update(id, { nome }) {
    return prisma().plantioTipo.update({
      where: { id },
      data: { nome, updated_at: nowDbText() },
    })
  },
  async remove(id) {
    return prisma().plantioTipo.delete({ where: { id } })
  },
}

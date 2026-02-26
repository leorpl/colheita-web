import { prismaClient } from '../db/prisma.js'
import { nowDbText } from '../util/time.js'

function prisma(p) {
  return p ?? prismaClient()
}

export const motoristaQuitacaoRepo = {
  async list({ de, ate, motorista_id } = {}) {
    const where = {}
    if (motorista_id) where.motorista_id = motorista_id
    if (de) where.de = { gte: de }
    if (ate) where.ate = { lte: ate }

    const rows = await prisma().motoristaQuitacao.findMany({
      where,
      include: { motorista: true },
      orderBy: [{ data_pagamento: 'desc' }, { id: 'desc' }],
    })
    return rows.map((q) => ({
      ...q,
      motorista_nome: q.motorista?.nome ?? null,
      motorista_placa: q.motorista?.placa ?? null,
    }))
  },

  async create(data) {
    const row = await prisma().motoristaQuitacao.create({
      data: {
        motorista_id: data.motorista_id,
        de: data.de,
        ate: data.ate,
        data_pagamento: data.data_pagamento,
        valor: Number(data.valor),
        forma_pagamento: data.forma_pagamento ?? null,
        observacoes: data.observacoes ?? null,
        updated_at: nowDbText(),
      },
      include: { motorista: true },
    })
    return {
      ...row,
      motorista_nome: row.motorista?.nome ?? null,
      motorista_placa: row.motorista?.placa ?? null,
    }
  },

  async get(id) {
    const row = await prisma().motoristaQuitacao.findUnique({
      where: { id },
      include: { motorista: true },
    })
    if (!row) return null
    return {
      ...row,
      motorista_nome: row.motorista?.nome ?? null,
      motorista_placa: row.motorista?.placa ?? null,
    }
  },

  async update(id, data) {
    await prisma().motoristaQuitacao.update({
      where: { id },
      data: {
        motorista_id: data.motorista_id,
        de: data.de,
        ate: data.ate,
        data_pagamento: data.data_pagamento,
        valor: Number(data.valor),
        forma_pagamento: data.forma_pagamento ?? null,
        observacoes: data.observacoes ?? null,
        updated_at: nowDbText(),
      },
    })
    return this.get(id)
  },

  async remove(id) {
    return prisma().motoristaQuitacao.delete({ where: { id } })
  },
}

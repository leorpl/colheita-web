import { prismaClient } from '../db/prisma.js'
import { nowDbText } from '../util/time.js'

function prisma(p) {
  return p ?? prismaClient()
}

function withJoins(v) {
  if (!v) return null
  return {
    ...v,
    safra_nome: v.safra?.safra ?? null,
    talhao_codigo: v.talhao?.codigo ?? null,
    talhao_local: v.talhao?.local ?? null,
    talhao_nome: v.talhao?.nome ?? null,
    destino_codigo: v.destino?.codigo ?? null,
    destino_local: v.destino?.local ?? null,
    motorista_nome: v.motorista?.nome ?? null,
  }
}

export const viagemRepo = {
  async get(id) {
    const row = await prisma().viagem.findUnique({
      where: { id },
      include: { safra: true, talhao: true, destino: true, motorista: true },
    })
    return withJoins(row)
  },

  async list(filters) {
    const where = {}

    if (filters.safra_id) where.safra_id = Number(filters.safra_id)
    if (filters.talhao_id) where.talhao_id = Number(filters.talhao_id)
    if (filters.destino_id) where.destino_id = Number(filters.destino_id)
    if (filters.motorista_id) where.motorista_id = Number(filters.motorista_id)
    if (filters.de || filters.ate) {
      where.data_saida = {
        ...(filters.de ? { gte: String(filters.de) } : {}),
        ...(filters.ate ? { lte: String(filters.ate) } : {}),
      }
    }

    const rows = await prisma().viagem.findMany({
      where,
      include: { safra: true, talhao: true, destino: true, motorista: true },
      orderBy: [{ id: 'desc' }],
    })
    return rows.map(withJoins)
  },

  async totals(filters) {
    const where = {}

    if (filters.safra_id) where.safra_id = Number(filters.safra_id)
    if (filters.talhao_id) where.talhao_id = Number(filters.talhao_id)
    if (filters.destino_id) where.destino_id = Number(filters.destino_id)
    if (filters.motorista_id) where.motorista_id = Number(filters.motorista_id)
    if (filters.de || filters.ate) {
      where.data_saida = {
        ...(filters.de ? { gte: String(filters.de) } : {}),
        ...(filters.ate ? { lte: String(filters.ate) } : {}),
      }
    }

    const agg = await prisma().viagem.aggregate({
      where,
      _sum: {
        carga_total_kg: true,
        tara_kg: true,
        peso_bruto_kg: true,
        umidade_kg: true,
        impureza_kg: true,
        ardidos_kg: true,
        queimados_kg: true,
        avariados_kg: true,
        esverdiados_kg: true,
        quebrados_kg: true,
        peso_limpo_seco_kg: true,
        sub_total_frete: true,
        sacas: true,
      },
    })

    const s = agg._sum || {}
    return {
      carga_total_kg: Number(s.carga_total_kg || 0),
      tara_kg: Number(s.tara_kg || 0),
      peso_bruto_kg: Number(s.peso_bruto_kg || 0),
      umidade_kg: Number(s.umidade_kg || 0),
      impureza_kg: Number(s.impureza_kg || 0),
      ardidos_kg: Number(s.ardidos_kg || 0),
      queimados_kg: Number(s.queimados_kg || 0),
      avariados_kg: Number(s.avariados_kg || 0),
      esverdiados_kg: Number(s.esverdiados_kg || 0),
      quebrados_kg: Number(s.quebrados_kg || 0),
      peso_limpo_seco_kg: Number(s.peso_limpo_seco_kg || 0),
      sub_total_frete: Number(s.sub_total_frete || 0),
      sacas: Number(s.sacas || 0),
    }
  },

  async create(data) {
    const row = await prisma().viagem.create({
      data: { ...data, updated_at: nowDbText() },
      include: { safra: true, talhao: true, destino: true, motorista: true },
    })
    return withJoins(row)
  },

  async update(id, data) {
    const row = await prisma().viagem.update({
      where: { id },
      data: { ...data, updated_at: nowDbText() },
      include: { safra: true, talhao: true, destino: true, motorista: true },
    })
    return withJoins(row)
  },

  async remove(id) {
    return prisma().viagem.delete({ where: { id } })
  },

  async fichaStatsBySafra({ safra_id, exclude_id } = {}) {
    const rows = await prisma().viagem.findMany({
      where: {
        safra_id,
        ...(exclude_id ? { id: { not: exclude_id } } : {}),
      },
      select: { ficha: true },
    })

    let maxNum = 0
    let maxLen = 0

    for (const r of rows) {
      const f = String(r.ficha ?? '').trim()
      if (!/^[0-9]+$/.test(f)) continue
      const n = Number.parseInt(f, 10)
      if (!Number.isFinite(n) || n <= 0) continue
      if (n > maxNum) maxNum = n
      if (f.length > maxLen) maxLen = f.length
    }

    return { maxNum, maxLen }
  },
}

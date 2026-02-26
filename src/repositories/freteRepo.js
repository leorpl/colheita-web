import { prismaClient } from '../db/prisma.js'
import { nowDbText } from '../util/time.js'

function prisma(p) {
  return p ?? prismaClient()
}

async function upsertWithClient(p, { safra_id, motorista_id, destino_id, valor_por_saca }) {
  const row = await p.frete.upsert({
    where: { safra_id_motorista_id_destino_id: { safra_id, motorista_id, destino_id } },
    create: {
      safra_id,
      motorista_id,
      destino_id,
      valor_por_saca: Number(valor_por_saca),
      updated_at: nowDbText(),
    },
    update: {
      valor_por_saca: Number(valor_por_saca),
      updated_at: nowDbText(),
    },
  })

  // Se o frete mudou, atualizar os valores calculados nas viagens ja lancadas
  // (mesma logica do SQLite: calcula a partir de peso_bruto_kg)
  await p.$executeRaw`
    UPDATE "viagem"
    SET
      frete_tabela = ${Number(valor_por_saca)},
      sacas_frete = (COALESCE(peso_bruto_kg, 0) / 60.0),
      sub_total_frete = (COALESCE(peso_bruto_kg, 0) / 60.0) * ${Number(valor_por_saca)},
      updated_at = ${nowDbText()}
    WHERE safra_id = ${safra_id}
      AND motorista_id = ${motorista_id}
      AND destino_id = ${destino_id}
  `

  return row
}

export const freteRepo = {
  async list() {
    const rows = await prisma().frete.findMany({
      include: { safra: true, motorista: true, destino: true },
      orderBy: [{ id: 'desc' }],
    })
    return rows.map((f) => ({
      ...f,
      safra_nome: f.safra?.safra ?? null,
      motorista_nome: f.motorista?.nome ?? null,
      destino_codigo: f.destino?.codigo ?? null,
      destino_local: f.destino?.local ?? null,
    }))
  },
  async get(id) {
    return prisma().frete.findUnique({ where: { id } })
  },
  async getValor({ safra_id, motorista_id, destino_id }) {
    const row = await prisma().frete.findUnique({
      where: { safra_id_motorista_id_destino_id: { safra_id, motorista_id, destino_id } },
      select: { valor_por_saca: true },
    })
    return row?.valor_por_saca ?? null
  },
  async upsert({ safra_id, motorista_id, destino_id, valor_por_saca }) {
    return upsertWithClient(prisma(), { safra_id, motorista_id, destino_id, valor_por_saca })
  },
  async remove(id) {
    return prisma().frete.delete({ where: { id } })
  },

  async copySafra({ from_safra_id, to_safra_id }) {
    const rows = await prisma().frete.findMany({
      where: { safra_id: from_safra_id },
      select: { motorista_id: true, destino_id: true, valor_por_saca: true },
    })

    await prisma().$transaction(async (tx) => {
      for (const r of rows) {
        await upsertWithClient(tx, {
          safra_id: to_safra_id,
          motorista_id: r.motorista_id,
          destino_id: r.destino_id,
          valor_por_saca: r.valor_por_saca,
        })
      }
    })

    return { copied: rows.length }
  },

  async bulkUpsert({ safra_id, items }) {
    const rows = Array.isArray(items) ? items : []

    await prisma().$transaction(async (tx) => {
      for (const r of rows) {
        await upsertWithClient(tx, {
          safra_id,
          motorista_id: r.motorista_id,
          destino_id: r.destino_id,
          valor_por_saca: r.valor_por_saca,
        })
      }
    })

    return { upserted: rows.length }
  },
}

import { prismaClient } from '../db/prisma.js'
import { nowDbText } from '../util/time.js'

function prisma(p) {
  return p ?? prismaClient()
}

export const usuarioSessaoRepo = {
  async create({ usuario_id, token_hash, expires_at }) {
    await prisma().usuarioSessao.create({
      data: { usuario_id, token_hash, expires_at },
    })
  },

  async getByTokenHash(token_hash) {
    const row = await prisma().usuarioSessao.findFirst({
      where: { token_hash },
      include: { usuario: true },
      take: 1,
    })
    if (!row) return null
    return {
      id: row.id,
      usuario_id: row.usuario_id,
      token_hash: row.token_hash,
      expires_at: row.expires_at,
      created_at: row.created_at,
      username: row.usuario?.username ?? null,
      nome: row.usuario?.nome ?? null,
      role: row.usuario?.role ?? null,
      motorista_id: row.usuario?.motorista_id ?? null,
      active: row.usuario?.active ?? null,
      menus_json: row.usuario?.menus_json ?? null,
    }
  },

  async deleteByTokenHash(token_hash) {
    return prisma().usuarioSessao.deleteMany({ where: { token_hash } })
  },

  async purgeExpired() {
    const now = nowDbText()
    return prisma().usuarioSessao.deleteMany({
      where: { expires_at: { lte: now } },
    })
  },
}

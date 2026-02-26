import { prismaClient } from '../db/prisma.js'
import { nowDbText } from '../util/time.js'

function prisma(p) {
  return p ?? prismaClient()
}

export const usuarioRepo = {
  async list() {
    return prisma().usuario.findMany({
      select: {
        id: true,
        username: true,
        nome: true,
        role: true,
        motorista_id: true,
        menus_json: true,
        active: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: [{ id: 'desc' }],
    })
  },

  async get(id) {
    return prisma().usuario.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        nome: true,
        role: true,
        motorista_id: true,
        menus_json: true,
        active: true,
        created_at: true,
        updated_at: true,
      },
    })
  },

  async getAuthByUsername(username) {
    return prisma().usuario.findFirst({ where: { username }, take: 1 })
  },

  async create({ username, nome, role, motorista_id, password_hash, password_salt }) {
    const row = await prisma().usuario.create({
      data: {
        username,
        nome: nome ?? null,
        role,
        motorista_id: motorista_id || null,
        menus_json: null,
        password_hash,
        password_salt,
        active: 1,
        updated_at: nowDbText(),
      },
    })
    return this.get(row.id)
  },

  async update(id, { username, nome, role, motorista_id, active, menus_json }) {
    await prisma().usuario.update({
      where: { id },
      data: {
        username,
        nome: nome ?? null,
        role,
        motorista_id: motorista_id || null,
        active: active ? 1 : 0,
        menus_json: menus_json ?? null,
        updated_at: nowDbText(),
      },
    })
    return this.get(id)
  },

  async setPassword(id, { password_hash, password_salt }) {
    await prisma().usuario.update({
      where: { id },
      data: { password_hash, password_salt, updated_at: nowDbText() },
    })
    return this.get(id)
  },

  async remove(id) {
    return prisma().usuario.delete({ where: { id } })
  },
}

import { Router } from 'express'
import { z } from 'zod'

import { validateBody } from '../../middleware/validate.js'
import { usuarioRepo } from '../../repositories/usuarioRepo.js'
import { hashPassword } from '../../auth/password.js'
import { requirePerm } from '../../middleware/auth.js'
import { Permissions } from '../../auth/permissions.js'
import { notFound } from '../../errors.js'

export const usersRouter = Router()

usersRouter.use(requirePerm(Permissions.USERS_MANAGE))

usersRouter.get('/', (_req, res) => {
  res.json(usuarioRepo.list())
})

const CreateBody = z.object({
  username: z.string().trim().min(3),
  nome: z.string().trim().optional().nullable(),
  role: z.string().trim().min(1),
  motorista_id: z.coerce.number().int().positive().optional().nullable(),
  menus: z.array(z.string().trim().min(1)).optional().nullable(),
  password: z.string().min(8),
})

usersRouter.post('/', validateBody(CreateBody), (req, res) => {
  const { salt, hash } = hashPassword(req.body.password)
  const row = usuarioRepo.create({
    username: req.body.username,
    nome: req.body.nome || null,
    role: req.body.role,
    motorista_id: req.body.motorista_id || null,
    password_hash: hash,
    password_salt: salt,
  })

  if (req.body.menus && Array.isArray(req.body.menus)) {
    usuarioRepo.update(row.id, {
      username: row.username,
      nome: row.nome,
      role: row.role,
      motorista_id: row.motorista_id,
      active: row.active,
      menus_json: JSON.stringify(req.body.menus),
    })
  }
  res.status(201).json(row)
})

const UpdateBody = z.object({
  username: z.string().trim().min(3),
  nome: z.string().trim().optional().nullable(),
  role: z.string().trim().min(1),
  motorista_id: z.coerce.number().int().positive().optional().nullable(),
  menus: z.array(z.string().trim().min(1)).optional().nullable(),
  active: z.coerce.boolean().optional().default(true),
})

usersRouter.put('/:id', validateBody(UpdateBody), (req, res) => {
  const id = Number(req.params.id)
  const exists = usuarioRepo.get(id)
  if (!exists) throw notFound('Usuario nao encontrado')
  const row = usuarioRepo.update(id, {
    username: req.body.username,
    nome: req.body.nome || null,
    role: req.body.role,
    motorista_id: req.body.motorista_id || null,
    active: req.body.active,
    menus_json: req.body.menus ? JSON.stringify(req.body.menus) : null,
  })
  res.json(row)
})

const PasswordBody = z.object({
  password: z.string().min(8),
})

usersRouter.put('/:id/password', validateBody(PasswordBody), (req, res) => {
  const id = Number(req.params.id)
  const exists = usuarioRepo.get(id)
  if (!exists) throw notFound('Usuario nao encontrado')
  const { salt, hash } = hashPassword(req.body.password)
  const row = usuarioRepo.setPassword(id, { password_hash: hash, password_salt: salt })
  res.json(row)
})

usersRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  const exists = usuarioRepo.get(id)
  if (!exists) throw notFound('Usuario nao encontrado')
  usuarioRepo.remove(id)
  res.status(204).send()
})

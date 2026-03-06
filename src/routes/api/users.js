import { Router } from 'express'

import { validateBody, validateParams } from '../../middleware/validate.js'
import { usuarioRepo } from '../../repositories/usuarioRepo.js'
import { hashPassword } from '../../auth/password.js'
import { requireCan } from '../../middleware/auth.js'
import { Actions, Modules } from '../../auth/acl.js'
import { notFound } from '../../errors.js'
import { S, UsersSchemas } from '../../validation/apiSchemas.js'
import { auditService } from '../../services/auditService.js'

export const usersRouter = Router()

usersRouter.use(requireCan(Modules.USUARIOS, Actions.VIEW))

usersRouter.get('/', requireCan(Modules.USUARIOS, Actions.VIEW), (_req, res) => {
  res.json(usuarioRepo.list())
})

const CreateBody = UsersSchemas.CreateBody

usersRouter.post('/', requireCan(Modules.USUARIOS, Actions.CREATE), validateBody(CreateBody), (req, res) => {
  // create
  const { salt, hash } = hashPassword(req.body.password)
  const row = usuarioRepo.create({
    username: req.body.username,
    email: req.body.email || null,
    nome: req.body.nome || null,
    role: req.body.role,
    motorista_id: req.body.motorista_id || null,
    password_hash: hash,
    password_salt: salt,
  }, { user_id: req.user?.id })

  if (req.body.menus && Array.isArray(req.body.menus)) {
    usuarioRepo.update(row.id, {
      username: row.username,
      nome: row.nome,
      role: row.role,
      motorista_id: row.motorista_id,
      active: row.active,
      menus_json: JSON.stringify(req.body.menus),
    }, { user_id: req.user?.id })
  }

  auditService.log(req, { module_name: 'usuarios', record_id: row.id, action_type: 'create', new_values: row })
  res.status(201).json(row)
})

const UpdateBody = UsersSchemas.UpdateBody

usersRouter.put('/:id', requireCan(Modules.USUARIOS, Actions.UPDATE), validateParams(S.IdParam), validateBody(UpdateBody), (req, res) => {
  // update
  const id = req.params.id
  const exists = usuarioRepo.get(id)
  if (!exists) throw notFound('Usuario nao encontrado')
  const row = usuarioRepo.update(id, {
    username: req.body.username,
    email: req.body.email || null,
    nome: req.body.nome || null,
    role: req.body.role,
    motorista_id: req.body.motorista_id || null,
    active: req.body.active,
    menus_json: req.body.menus ? JSON.stringify(req.body.menus) : null,
  }, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'usuarios', record_id: id, action_type: 'update', old_values: exists, new_values: row })
  res.json(row)
})

const PasswordBody = UsersSchemas.PasswordBody

usersRouter.put(
  '/:id/password',
  requireCan(Modules.USUARIOS, Actions.UPDATE),
  validateParams(S.IdParam),
  validateBody(PasswordBody),
  (req, res) => {
  // update password
  const id = req.params.id
  const exists = usuarioRepo.get(id)
  if (!exists) throw notFound('Usuario nao encontrado')
  const { salt, hash } = hashPassword(req.body.password)
  const row = usuarioRepo.setPassword(id, { password_hash: hash, password_salt: salt }, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'usuarios', record_id: id, action_type: 'password_reset', notes: 'senha alterada via admin' })
  res.json(row)
  },
)

usersRouter.delete('/:id', requireCan(Modules.USUARIOS, Actions.DELETE), validateParams(S.IdParam), (req, res) => {
  // delete
  const id = req.params.id
  const exists = usuarioRepo.get(id)
  if (!exists) throw notFound('Usuario nao encontrado')
  usuarioRepo.remove(id, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'usuarios', record_id: id, action_type: 'delete', old_values: exists })
  res.status(204).send()
})

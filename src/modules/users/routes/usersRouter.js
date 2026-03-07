import { Router } from 'express'

import { validateBody, validateParams } from '../../../middleware/validate.js'
import { usuarioRepo } from '../../../repositories/usuarioRepo.js'
import { hashPassword } from '../../../auth/password.js'
import { usuarioSessaoRepo } from '../../../repositories/usuarioSessaoRepo.js'
import { requireCan } from '../../../middleware/auth.js'
import { Actions, Modules } from '../../../auth/acl.js'
import { notFound } from '../../../errors.js'
import { auditService } from '../../../services/auditService.js'
import { S, CreateBody, UpdateBody, PasswordBody } from '../validators/usersSchemas.js'

export const usersRouter = Router()

usersRouter.use(requireCan(Modules.USUARIOS, Actions.VIEW))

usersRouter.get('/', requireCan(Modules.USUARIOS, Actions.VIEW), (_req, res) => {
  res.json(usuarioRepo.list())
})

usersRouter.post('/', requireCan(Modules.USUARIOS, Actions.CREATE), validateBody(CreateBody), (req, res) => {
  // create
  const { salt, hash } = hashPassword(req.body.password)
  const row = usuarioRepo.create(
    {
      username: req.body.username,
      email: req.body.email || null,
      nome: req.body.nome || null,
      role: req.body.role,
      motorista_id: req.body.motorista_id || null,
      password_hash: hash,
      password_salt: salt,
      must_change_password: 1,
    },
    { user_id: req.user?.id },
  )

  if (req.body.menus && Array.isArray(req.body.menus)) {
    usuarioRepo.update(
      row.id,
      {
        username: row.username,
        nome: row.nome,
        role: row.role,
        motorista_id: row.motorista_id,
        active: row.active,
        menus_json: JSON.stringify(req.body.menus),
      },
      { user_id: req.user?.id },
    )
  }

  auditService.log(req, { module_name: 'usuarios', record_id: row.id, action_type: 'create', new_values: row })
  res.status(201).json(row)
})

usersRouter.put(
  '/:id',
  requireCan(Modules.USUARIOS, Actions.UPDATE),
  validateParams(S.IdParam),
  validateBody(UpdateBody),
  (req, res) => {
    // update
    const id = req.params.id
    const exists = usuarioRepo.get(id)
    if (!exists) throw notFound('Usuario nao encontrado')
    const row = usuarioRepo.update(
      id,
      {
        username: req.body.username,
        email: req.body.email || null,
        nome: req.body.nome || null,
        role: req.body.role,
        motorista_id: req.body.motorista_id || null,
        active: req.body.active,
        menus_json: req.body.menus ? JSON.stringify(req.body.menus) : null,
      },
      { user_id: req.user?.id },
    )

    // Always log full diff
    auditService.log(req, { module_name: 'usuarios', record_id: id, action_type: 'update', old_values: exists, new_values: row })

    // Extra breadcrumbs for sensitive changes (easier to filter in Auditoria)
    if (String(exists.role || '') !== String(row.role || '')) {
      auditService.log(req, {
        module_name: 'usuarios',
        record_id: id,
        action_type: 'permission_change',
        old_values: { role: exists.role },
        new_values: { role: row.role },
        notes: 'role change',
      })
    }
    if (Number(exists.active) !== Number(row.active)) {
      auditService.log(req, {
        module_name: 'usuarios',
        record_id: id,
        action_type: 'status_change',
        old_values: { active: exists.active },
        new_values: { active: row.active },
        notes: 'active toggle',
      })
    }
    if (Number(exists.motorista_id || 0) !== Number(row.motorista_id || 0)) {
      auditService.log(req, {
        module_name: 'usuarios',
        record_id: id,
        action_type: 'update',
        old_values: { motorista_id: exists.motorista_id || null },
        new_values: { motorista_id: row.motorista_id || null },
        notes: 'motorista link change',
        ignoreKeys: ['motorista_id'],
      })
    }
    res.json(row)
  },
)

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
    const row = usuarioRepo.setPassword(
      id,
      { password_hash: hash, password_salt: salt, must_change_password: 1 },
      { user_id: req.user?.id },
    )
    usuarioSessaoRepo.deleteByUserId(Number(id))
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

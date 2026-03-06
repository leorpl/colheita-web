import { Router } from 'express'
import { motoristaRepo } from '../../repositories/motoristaRepo.js'
import { notFound } from '../../errors.js'
import { validateBody, validateParams } from '../../middleware/validate.js'
import { requirePerm } from '../../middleware/auth.js'
import { Permissions } from '../../auth/permissions.js'
import { S, MotoristaSchemas } from '../../validation/apiSchemas.js'
import { auditService } from '../../services/auditService.js'

export const motoristasRouter = Router()

const MotoristaBody = MotoristaSchemas.Body

motoristasRouter.get('/', requirePerm(Permissions.CADASTROS_READ), (_req, res) => {
  res.json(motoristaRepo.list())
})

motoristasRouter.post(
  '/',
  requirePerm(Permissions.CADASTROS_WRITE),
  validateBody(MotoristaBody),
  (req, res) => {
  const row = motoristaRepo.create(req.body, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'motoristas', record_id: row.id, action_type: 'create', new_values: row })
  res.status(201).json(row)
  },
)

motoristasRouter.get(
  '/:id',
  requirePerm(Permissions.CADASTROS_READ),
  validateParams(S.IdParam),
  (req, res) => {
  const row = motoristaRepo.get(req.params.id)
  if (!row) throw notFound('Motorista nao encontrado')
  res.json(row)
  },
)

motoristasRouter.put(
  '/:id',
  requirePerm(Permissions.CADASTROS_WRITE),
  validateParams(S.IdParam),
  validateBody(MotoristaBody),
  (req, res) => {
  const id = req.params.id
  const exists = motoristaRepo.get(id)
  if (!exists) throw notFound('Motorista nao encontrado')
  const row = motoristaRepo.update(id, req.body, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'motoristas', record_id: id, action_type: 'update', old_values: exists, new_values: row })
  res.json(row)
  },
)

motoristasRouter.delete(
  '/:id',
  requirePerm(Permissions.CADASTROS_WRITE),
  validateParams(S.IdParam),
  (req, res) => {
  const id = req.params.id
  const exists = motoristaRepo.get(id)
  if (!exists) throw notFound('Motorista nao encontrado')
  auditService.log(req, { module_name: 'motoristas', record_id: id, action_type: 'delete', old_values: exists })
  motoristaRepo.remove(id)
  res.status(204).send()
  },
)

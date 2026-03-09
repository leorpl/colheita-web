import { Router } from 'express'
import { motoristaRepo } from '../../repositories/motoristaRepo.js'
import { notFound } from '../../errors.js'
import { validateBody, validateParams } from '../../middleware/validate.js'
import { requirePerm } from '../../middleware/auth.js'
import { Actions, Modules } from '../../auth/acl.js'
import { S, MotoristaSchemas } from '../../validation/apiSchemas.js'
import { auditService } from '../../services/auditService.js'
import { deleteDependencyService } from '../../services/deleteDependencyService.js'

export const motoristasRouter = Router()

const MotoristaBody = MotoristaSchemas.Body

motoristasRouter.get('/', requirePerm(Modules.MOTORISTAS, Actions.VIEW), (_req, res) => {
  res.json(motoristaRepo.list())
})

motoristasRouter.post(
  '/',
  requirePerm(Modules.MOTORISTAS, Actions.CREATE),
  validateBody(MotoristaBody),
  (req, res) => {
  const row = motoristaRepo.create(req.body, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'motoristas', record_id: row.id, action_type: 'create', new_values: row })
  res.status(201).json(row)
  },
)

motoristasRouter.get(
  '/:id',
  requirePerm(Modules.MOTORISTAS, Actions.VIEW),
  validateParams(S.IdParam),
  (req, res) => {
  const row = motoristaRepo.get(req.params.id)
  if (!row) throw notFound('Motorista nao encontrado')
  res.json(row)
  },
)

motoristasRouter.put(
  '/:id',
  requirePerm(Modules.MOTORISTAS, Actions.UPDATE),
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
  requirePerm(Modules.MOTORISTAS, Actions.DELETE),
  validateParams(S.IdParam),
  (req, res) => {
  const id = req.params.id
  const exists = motoristaRepo.get(id)
  if (!exists) throw notFound('Motorista nao encontrado')
  deleteDependencyService.assertCanDeleteMotorista(Number(id))
  auditService.log(req, { module_name: 'motoristas', record_id: id, action_type: 'delete', old_values: exists })
  motoristaRepo.remove(id, { user_id: req.user?.id })
  res.status(204).send()
  },
)

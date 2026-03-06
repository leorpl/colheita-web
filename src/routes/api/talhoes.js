import { Router } from 'express'
import { talhaoRepo } from '../../repositories/talhaoRepo.js'
import { notFound } from '../../errors.js'
import { validateBody, validateParams } from '../../middleware/validate.js'
import { requirePerm } from '../../middleware/auth.js'
import { Permissions } from '../../auth/permissions.js'
import { S, TalhaoSchemas } from '../../validation/apiSchemas.js'
import { auditService } from '../../services/auditService.js'

export const talhoesRouter = Router()

const TalhaoBody = TalhaoSchemas.Body

talhoesRouter.get('/', requirePerm(Permissions.CADASTROS_READ), (_req, res) => {
  res.json(talhaoRepo.list())
})

talhoesRouter.post(
  '/',
  requirePerm(Permissions.CADASTROS_WRITE),
  validateBody(TalhaoBody),
  (req, res) => {
  const row = talhaoRepo.create(req.body, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'talhoes', record_id: row.id, action_type: 'create', new_values: row })
  res.status(201).json(row)
  },
)

talhoesRouter.get(
  '/:id',
  requirePerm(Permissions.CADASTROS_READ),
  validateParams(S.IdParam),
  (req, res) => {
  const row = talhaoRepo.get(req.params.id)
  if (!row) throw notFound('Talhao nao encontrado')
  res.json(row)
  },
)

talhoesRouter.put(
  '/:id',
  requirePerm(Permissions.CADASTROS_WRITE),
  validateParams(S.IdParam),
  validateBody(TalhaoBody),
  (req, res) => {
  const id = req.params.id
  const exists = talhaoRepo.get(id)
  if (!exists) throw notFound('Talhao nao encontrado')
  const row = talhaoRepo.update(id, req.body, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'talhoes', record_id: id, action_type: 'update', old_values: exists, new_values: row })
  res.json(row)
  },
)

talhoesRouter.delete(
  '/:id',
  requirePerm(Permissions.CADASTROS_WRITE),
  validateParams(S.IdParam),
  (req, res) => {
  const id = req.params.id
  const exists = talhaoRepo.get(id)
  if (!exists) throw notFound('Talhao nao encontrado')
  auditService.log(req, { module_name: 'talhoes', record_id: id, action_type: 'delete', old_values: exists })
  talhaoRepo.remove(id)
  res.status(204).send()
  },
)

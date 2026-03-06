import { Router } from 'express'
import { destinoRepo } from '../../repositories/destinoRepo.js'
import { notFound } from '../../errors.js'
import { validateBody, validateParams } from '../../middleware/validate.js'
import { requirePerm } from '../../middleware/auth.js'
import { Permissions } from '../../auth/permissions.js'
import { S, DestinoSchemas } from '../../validation/apiSchemas.js'
import { auditService } from '../../services/auditService.js'

export const destinosRouter = Router()

const DestinoBody = DestinoSchemas.Body

destinosRouter.get('/', requirePerm(Permissions.CADASTROS_READ), (_req, res) => {
  res.json(destinoRepo.list())
})

destinosRouter.post(
  '/',
  requirePerm(Permissions.CADASTROS_WRITE),
  validateBody(DestinoBody),
  (req, res) => {
  const row = destinoRepo.create(req.body, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'destinos', record_id: row.id, action_type: 'create', new_values: row })
  res.status(201).json(row)
  },
)

destinosRouter.get(
  '/:id',
  requirePerm(Permissions.CADASTROS_READ),
  validateParams(S.IdParam),
  (req, res) => {
  const row = destinoRepo.get(req.params.id)
  if (!row) throw notFound('Destino nao encontrado')
  res.json(row)
  },
)

destinosRouter.put(
  '/:id',
  requirePerm(Permissions.CADASTROS_WRITE),
  validateParams(S.IdParam),
  validateBody(DestinoBody),
  (req, res) => {
  const id = req.params.id
  const exists = destinoRepo.get(id)
  if (!exists) throw notFound('Destino nao encontrado')
  const row = destinoRepo.update(id, req.body, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'destinos', record_id: id, action_type: 'update', old_values: exists, new_values: row })
  res.json(row)
  },
)

destinosRouter.delete(
  '/:id',
  requirePerm(Permissions.CADASTROS_WRITE),
  validateParams(S.IdParam),
  (req, res) => {
  const id = req.params.id
  const exists = destinoRepo.get(id)
  if (!exists) throw notFound('Destino nao encontrado')
  auditService.log(req, { module_name: 'destinos', record_id: id, action_type: 'delete', old_values: exists })
  destinoRepo.remove(id)
  res.status(204).send()
  },
)

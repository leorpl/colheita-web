import { Router } from 'express'
import { plantioTipoRepo } from '../../repositories/plantioTipoRepo.js'
import { notFound } from '../../errors.js'
import { validateBody, validateParams } from '../../middleware/validate.js'
import { requirePerm } from '../../middleware/auth.js'
import { Actions, Modules } from '../../auth/acl.js'
import { S, TiposPlantioSchemas } from '../../validation/apiSchemas.js'
import { auditService } from '../../services/auditService.js'

export const tiposPlantioRouter = Router()

const Body = TiposPlantioSchemas.Body

tiposPlantioRouter.get('/', requirePerm(Modules.TIPOS_PLANTIO, Actions.VIEW), (_req, res) => {
  res.json(plantioTipoRepo.list())
})

tiposPlantioRouter.post(
  '/',
  requirePerm(Modules.TIPOS_PLANTIO, Actions.CREATE),
  validateBody(Body),
  (req, res) => {
  const row = plantioTipoRepo.create(req.body, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'tipos-plantio', record_id: row.id, action_type: 'create', new_values: row })
  res.status(201).json(row)
  },
)

tiposPlantioRouter.put(
  '/:id',
  requirePerm(Modules.TIPOS_PLANTIO, Actions.UPDATE),
  validateParams(S.IdParam),
  validateBody(Body),
  (req, res) => {
  const id = req.params.id
  const exists = plantioTipoRepo.get(id)
  if (!exists) throw notFound('Tipo de plantio nao encontrado')
  const row = plantioTipoRepo.update(id, req.body, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'tipos-plantio', record_id: id, action_type: 'update', old_values: exists, new_values: row })
  res.json(row)
  },
)

tiposPlantioRouter.delete(
  '/:id',
  requirePerm(Modules.TIPOS_PLANTIO, Actions.DELETE),
  validateParams(S.IdParam),
  (req, res) => {
  const id = req.params.id
  const exists = plantioTipoRepo.get(id)
  if (!exists) throw notFound('Tipo de plantio nao encontrado')
  auditService.log(req, { module_name: 'tipos-plantio', record_id: id, action_type: 'delete', old_values: exists })
  plantioTipoRepo.remove(id)
  res.status(204).send()
  },
)

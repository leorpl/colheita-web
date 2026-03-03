import { Router } from 'express'
import { plantioTipoRepo } from '../../repositories/plantioTipoRepo.js'
import { notFound } from '../../errors.js'
import { validateBody, validateParams } from '../../middleware/validate.js'
import { requirePerm } from '../../middleware/auth.js'
import { Permissions } from '../../auth/permissions.js'
import { S, TiposPlantioSchemas } from '../../validation/apiSchemas.js'

export const tiposPlantioRouter = Router()

const Body = TiposPlantioSchemas.Body

tiposPlantioRouter.get('/', requirePerm(Permissions.CONFIG_READ), (_req, res) => {
  res.json(plantioTipoRepo.list())
})

tiposPlantioRouter.post(
  '/',
  requirePerm(Permissions.CONFIG_WRITE),
  validateBody(Body),
  (req, res) => {
  const row = plantioTipoRepo.create(req.body)
  res.status(201).json(row)
  },
)

tiposPlantioRouter.put(
  '/:id',
  requirePerm(Permissions.CONFIG_WRITE),
  validateParams(S.IdParam),
  validateBody(Body),
  (req, res) => {
  const id = req.params.id
  const exists = plantioTipoRepo.get(id)
  if (!exists) throw notFound('Tipo de plantio nao encontrado')
  res.json(plantioTipoRepo.update(id, req.body))
  },
)

tiposPlantioRouter.delete(
  '/:id',
  requirePerm(Permissions.CONFIG_WRITE),
  validateParams(S.IdParam),
  (req, res) => {
  const id = req.params.id
  const exists = plantioTipoRepo.get(id)
  if (!exists) throw notFound('Tipo de plantio nao encontrado')
  plantioTipoRepo.remove(id)
  res.status(204).send()
  },
)

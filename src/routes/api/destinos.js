import { Router } from 'express'
import { destinoRepo } from '../../repositories/destinoRepo.js'
import { notFound } from '../../errors.js'
import { validateBody, validateParams } from '../../middleware/validate.js'
import { requirePerm } from '../../middleware/auth.js'
import { Permissions } from '../../auth/permissions.js'
import { S, DestinoSchemas } from '../../validation/apiSchemas.js'

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
  const row = destinoRepo.create(req.body)
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
  res.json(destinoRepo.update(id, req.body))
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
  destinoRepo.remove(id)
  res.status(204).send()
  },
)

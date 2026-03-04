import { Router } from 'express'
import { talhaoRepo } from '../../repositories/talhaoRepo.js'
import { notFound } from '../../errors.js'
import { validateBody, validateParams } from '../../middleware/validate.js'
import { requirePerm } from '../../middleware/auth.js'
import { Permissions } from '../../auth/permissions.js'
import { S, TalhaoSchemas } from '../../validation/apiSchemas.js'

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
  const row = talhaoRepo.create(req.body)
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
  res.json(talhaoRepo.update(id, req.body))
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
  talhaoRepo.remove(id)
  res.status(204).send()
  },
)

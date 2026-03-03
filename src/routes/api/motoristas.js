import { Router } from 'express'
import { motoristaRepo } from '../../repositories/motoristaRepo.js'
import { notFound } from '../../errors.js'
import { validateBody, validateParams } from '../../middleware/validate.js'
import { requirePerm } from '../../middleware/auth.js'
import { Permissions } from '../../auth/permissions.js'
import { S, MotoristaSchemas } from '../../validation/apiSchemas.js'

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
  const row = motoristaRepo.create(req.body)
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
  res.json(motoristaRepo.update(id, req.body))
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
  motoristaRepo.remove(id)
  res.status(204).send()
  },
)

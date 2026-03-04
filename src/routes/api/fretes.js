import { Router } from 'express'
import { freteRepo } from '../../repositories/freteRepo.js'
import { validateBody, validateParams } from '../../middleware/validate.js'
import { notFound } from '../../errors.js'
import { requirePerm } from '../../middleware/auth.js'
import { Permissions } from '../../auth/permissions.js'
import { S, FreteSchemas } from '../../validation/apiSchemas.js'

export const fretesRouter = Router()

const FreteUpsertBody = FreteSchemas.UpsertBody

fretesRouter.get('/', requirePerm(Permissions.CONFIG_READ), (_req, res) => {
  res.json(freteRepo.list())
})

fretesRouter.post(
  '/',
  requirePerm(Permissions.CONFIG_WRITE),
  validateBody(FreteUpsertBody),
  (req, res) => {
  const row = freteRepo.upsert(req.body)
  res.status(201).json(row)
  },
)

const CopySafraBody = FreteSchemas.CopySafraBody

fretesRouter.post(
  '/copiar-safra',
  requirePerm(Permissions.CONFIG_WRITE),
  validateBody(CopySafraBody),
  (req, res) => {
  const { from_safra_id, to_safra_id } = req.body
  const r = freteRepo.copySafra({ from_safra_id, to_safra_id })
  res.status(201).json(r)
  },
)

const BulkUpsertBody = FreteSchemas.BulkUpsertBody

fretesRouter.post(
  '/bulk-upsert',
  requirePerm(Permissions.CONFIG_WRITE),
  validateBody(BulkUpsertBody),
  (req, res) => {
  const { safra_id, items } = req.body
  const r = freteRepo.bulkUpsert({ safra_id, items })
  res.status(201).json(r)
  },
)

fretesRouter.delete(
  '/:id',
  requirePerm(Permissions.CONFIG_WRITE),
  validateParams(S.IdParam),
  (req, res) => {
  const id = req.params.id
  const exists = freteRepo.get(id)
  if (!exists) throw notFound('Frete nao encontrado')
  freteRepo.remove(id)
  res.status(204).send()
  },
)

import { Router } from 'express'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { talhaoSafraRepo } from '../../repositories/talhaoSafraRepo.js'
import { requirePerm } from '../../middleware/auth.js'
import { Permissions } from '../../auth/permissions.js'
import { TalhaoSafraSchemas } from '../../validation/apiSchemas.js'

export const talhaoSafraRouter = Router()

const ListQuery = TalhaoSafraSchemas.ListQuery

talhaoSafraRouter.get(
  '/',
  requirePerm(Permissions.COLHEITA_READ),
  validateQuery(ListQuery),
  (req, res) => {
  res.json(talhaoSafraRepo.listBySafra({ safra_id: req.query.safra_id }))
  },
)

const UpsertBody = TalhaoSafraSchemas.UpsertBody

talhaoSafraRouter.post(
  '/',
  requirePerm(Permissions.COLHEITA_WRITE),
  validateBody(UpsertBody),
  (req, res) => {
  const row = talhaoSafraRepo.upsert(req.body)
  res.status(201).json(row)
  },
)

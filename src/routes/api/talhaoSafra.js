import { Router } from 'express'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { talhaoSafraRepo } from '../../repositories/talhaoSafraRepo.js'
import { requirePerm } from '../../middleware/auth.js'
import { Actions, Modules } from '../../auth/acl.js'
import { TalhaoSafraSchemas } from '../../validation/apiSchemas.js'
import { auditService } from '../../services/auditService.js'

export const talhaoSafraRouter = Router()

const ListQuery = TalhaoSafraSchemas.ListQuery

talhaoSafraRouter.get(
  '/',
  requirePerm(Modules.AREA_COLHIDA, Actions.VIEW),
  validateQuery(ListQuery),
  (req, res) => {
  res.json(talhaoSafraRepo.listBySafra({ safra_id: req.query.safra_id }))
  },
)

const UpsertBody = TalhaoSafraSchemas.UpsertBody

talhaoSafraRouter.post(
  '/',
  requirePerm(Modules.AREA_COLHIDA, Actions.UPDATE),
  validateBody(UpsertBody),
  (req, res) => {
  const oldRow = talhaoSafraRepo.get({ safra_id: req.body.safra_id, talhao_id: req.body.talhao_id })
  const row = talhaoSafraRepo.upsert(req.body, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'area-colhida', record_id: row?.id ?? null, action_type: oldRow ? 'update' : 'create', old_values: oldRow, new_values: row })
  res.status(201).json(row)
  },
)

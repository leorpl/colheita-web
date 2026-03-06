import { Router } from 'express'

import { validateParams, validateQuery } from '../../middleware/validate.js'
import { requireCan } from '../../middleware/auth.js'
import { Actions, Modules } from '../../auth/acl.js'
import { notFound } from '../../errors.js'
import { auditLogRepo } from '../../repositories/auditLogRepo.js'
import { S } from '../../validation/apiSchemas.js'
import { z } from 'zod'

export const auditLogsRouter = Router()

auditLogsRouter.use(requireCan(Modules.AUDITORIA, Actions.VIEW))

const ListQuery = z.object({
  module_name: z.string().trim().max(60).optional(),
  action_type: z.string().trim().max(60).optional(),
  user_id: z.coerce.number().int().positive().optional(),
  record_id: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(120).optional(),
  de: z.string().trim().max(30).optional(),
  ate: z.string().trim().max(30).optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
})

auditLogsRouter.get('/', validateQuery(ListQuery), (req, res) => {
  res.json(auditLogRepo.list(req.query))
})

auditLogsRouter.get('/:id', validateParams(S.IdParam), (req, res) => {
  const row = auditLogRepo.get(req.params.id)
  if (!row) throw notFound('Log nao encontrado')
  res.json(row)
})

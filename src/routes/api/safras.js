import { Router } from 'express'
import { validateBody, validateParams } from '../../middleware/validate.js'
import { safraRepo } from '../../repositories/safraRepo.js'
import { notFound } from '../../errors.js'
import { requirePerm } from '../../middleware/auth.js'
import { Permissions } from '../../auth/permissions.js'
import { S, SafraSchemas } from '../../validation/apiSchemas.js'
import { auditService } from '../../services/auditService.js'

export const safrasRouter = Router()

const SafraBody = SafraSchemas.Body

safrasRouter.get('/', requirePerm(Permissions.CONFIG_READ), (_req, res) => {
  res.json(safraRepo.list())
})

safrasRouter.post(
  '/',
  requirePerm(Permissions.CONFIG_WRITE),
  validateBody(SafraBody),
  (req, res) => {
  const row = safraRepo.create(req.body, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'safras', record_id: row.id, action_type: 'create', new_values: row })
  res.status(201).json(row)
  },
)

safrasRouter.get(
  '/:id',
  requirePerm(Permissions.CONFIG_READ),
  validateParams(S.IdParam),
  (req, res) => {
  const row = safraRepo.get(req.params.id)
  if (!row) throw notFound('Safra nao encontrada')
  res.json(row)
  },
)

safrasRouter.put(
  '/:id',
  requirePerm(Permissions.CONFIG_WRITE),
  validateParams(S.IdParam),
  validateBody(SafraBody),
  (req, res) => {
  const id = req.params.id
  const exists = safraRepo.get(id)
  if (!exists) throw notFound('Safra nao encontrada')
  const row = safraRepo.update(id, req.body, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'safras', record_id: id, action_type: 'update', old_values: exists, new_values: row })
  res.json(row)
  },
)

const PainelBody = SafraSchemas.PainelBody

// define qual safra aparece no Painel
// obs: somente uma safra pode ficar marcada
safrasRouter.put(
  '/:id/painel',
  requirePerm(Permissions.CONFIG_WRITE),
  validateParams(S.IdParam),
  validateBody(PainelBody),
  (req, res) => {
  const id = req.params.id
  const exists = safraRepo.get(id)
  if (!exists) throw notFound('Safra nao encontrada')
  if (!req.body.painel) return res.json(exists)
  const row = safraRepo.setPainel(id)
  auditService.log(req, { module_name: 'safras', record_id: id, action_type: 'status_change', old_values: exists, new_values: row, notes: 'definiu painel=1' })
  res.json(row)
  },
)

safrasRouter.delete(
  '/:id',
  requirePerm(Permissions.CONFIG_WRITE),
  validateParams(S.IdParam),
  (req, res) => {
  const id = req.params.id
  const exists = safraRepo.get(id)
  if (!exists) throw notFound('Safra nao encontrada')
  auditService.log(req, { module_name: 'safras', record_id: id, action_type: 'delete', old_values: exists })
  safraRepo.remove(id)
  res.status(204).send()
  },
)

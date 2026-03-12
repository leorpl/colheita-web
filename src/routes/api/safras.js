import { Router } from 'express'
import { validateBody, validateParams } from '../../middleware/validate.js'
import { safraRepo } from '../../repositories/safraRepo.js'
import { conflict, notFound } from '../../errors.js'
import { requirePerm } from '../../middleware/auth.js'
import { Actions, Modules } from '../../auth/acl.js'
import { S, SafraSchemas } from '../../validation/apiSchemas.js'
import { auditService } from '../../services/auditService.js'
import { deleteDependencyService } from '../../services/deleteDependencyService.js'
import { talhaoSafraRepo } from '../../repositories/talhaoSafraRepo.js'

export const safrasRouter = Router()

const SafraBody = SafraSchemas.Body

safrasRouter.get('/', requirePerm(Modules.SAFRAS, Actions.VIEW), (_req, res) => {
  res.json(safraRepo.list())
})

safrasRouter.post(
  '/',
  requirePerm(Modules.SAFRAS, Actions.CREATE),
  validateBody(SafraBody),
  (req, res) => {
  const row = safraRepo.create(req.body, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'safras', record_id: row.id, action_type: 'create', new_values: row })
  res.status(201).json(row)
  },
)

safrasRouter.get(
  '/:id',
  requirePerm(Modules.SAFRAS, Actions.VIEW),
  validateParams(S.IdParam),
  (req, res) => {
  const row = safraRepo.get(req.params.id)
  if (!row) throw notFound('Safra nao encontrada')
  res.json(row)
  },
)

safrasRouter.put(
  '/:id',
  requirePerm(Modules.SAFRAS, Actions.UPDATE),
  validateParams(S.IdParam),
  validateBody(SafraBody),
  (req, res) => {
  const id = req.params.id
  const exists = safraRepo.get(id)
  if (!exists) throw notFound('Safra nao encontrada')
  if (req.body.expected_updated_at && String(exists.updated_at || '') !== String(req.body.expected_updated_at || '')) {
    throw conflict('Esta safra foi alterada por outra pessoa. Reabra o cadastro antes de salvar novamente.', { code: 'STALE_RECORD', current_updated_at: exists.updated_at || null })
  }
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
  requirePerm(Modules.SAFRAS, Actions.UPDATE),
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
  requirePerm(Modules.SAFRAS, Actions.DELETE),
  validateParams(S.IdParam),
  (req, res) => {
  const id = req.params.id
  const exists = safraRepo.get(id)
  if (!exists) throw notFound('Safra nao encontrada')
  deleteDependencyService.assertCanDeleteSafra(Number(id))
  talhaoSafraRepo.removeBySafra({ safra_id: Number(id) })
  auditService.log(req, { module_name: 'safras', record_id: id, action_type: 'delete', old_values: exists })
  safraRepo.remove(id, { user_id: req.user?.id })
  res.status(204).send()
  },
)

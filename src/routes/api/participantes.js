import { Router } from 'express'

import { participanteRepo } from '../../repositories/participanteRepo.js'
import { notFound } from '../../errors.js'
import { validateBody, validateParams } from '../../middleware/validate.js'
import { requirePerm } from '../../middleware/auth.js'
import { Actions, Modules } from '../../auth/acl.js'
import { S, ProducaoSchemas } from '../../validation/apiSchemas.js'
import { auditService } from '../../services/auditService.js'

export const participantesRouter = Router()

participantesRouter.get(
  '/',
  requirePerm(Modules.PRODUCAO, Actions.VIEW),
  (req, res) => {
    const include_inactive = String(req.query.include_inactive || '') === '1'
    res.json(participanteRepo.list({ include_inactive }))
  },
)

const Body = ProducaoSchemas.ParticipanteBody

participantesRouter.post('/', requirePerm(Modules.PRODUCAO, Actions.CREATE), validateBody(Body), (req, res) => {
  const row = participanteRepo.create(req.body, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'participantes', record_id: row.id, action_type: 'create', new_values: row })
  res.status(201).json(row)
})

participantesRouter.get('/:id', requirePerm(Modules.PRODUCAO, Actions.VIEW), validateParams(S.IdParam), (req, res) => {
  const row = participanteRepo.get(req.params.id)
  if (!row) throw notFound('Participante nao encontrado')
  res.json(row)
})

participantesRouter.put(
  '/:id',
  requirePerm(Modules.PRODUCAO, Actions.UPDATE),
  validateParams(S.IdParam),
  validateBody(Body),
  (req, res) => {
    const id = req.params.id
    const exists = participanteRepo.get(id)
    if (!exists) throw notFound('Participante nao encontrado')
    const row = participanteRepo.update(id, req.body, { user_id: req.user?.id })
    auditService.log(req, { module_name: 'participantes', record_id: id, action_type: 'update', old_values: exists, new_values: row })
    res.json(row)
  },
)

participantesRouter.delete(
  '/:id',
  requirePerm(Modules.PRODUCAO, Actions.DELETE),
  validateParams(S.IdParam),
  (req, res) => {
    const id = req.params.id
    const exists = participanteRepo.get(id)
    if (!exists) throw notFound('Participante nao encontrado')
    auditService.log(req, { module_name: 'participantes', record_id: id, action_type: 'delete', old_values: exists })
    participanteRepo.remove(id, { user_id: req.user?.id })
    res.status(204).send()
  },
)

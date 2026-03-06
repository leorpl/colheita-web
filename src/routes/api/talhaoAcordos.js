import { Router } from 'express'

import { talhaoAcordoRepo } from '../../repositories/talhaoAcordoRepo.js'
import { notFound } from '../../errors.js'
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js'
import { requirePerm } from '../../middleware/auth.js'
import { Actions, Modules } from '../../auth/acl.js'
import { S, ProducaoSchemas } from '../../validation/apiSchemas.js'
import { auditService } from '../../services/auditService.js'

export const talhaoAcordosRouter = Router()

talhaoAcordosRouter.get(
  '/',
  requirePerm(Modules.PRODUCAO, Actions.VIEW),
  validateQuery(ProducaoSchemas.ApuracaoQuery.partial()),
  (req, res) => {
    const safra_id = req.query.safra_id ? Number(req.query.safra_id) : null
    res.json(talhaoAcordoRepo.list({ safra_id }))
  },
)

talhaoAcordosRouter.get(
  '/:id',
  requirePerm(Modules.PRODUCAO, Actions.VIEW),
  validateParams(S.IdParam),
  (req, res) => {
    const row = talhaoAcordoRepo.get(req.params.id)
    if (!row) throw notFound('Acordo nao encontrado')
    res.json(row)
  },
)

const Body = ProducaoSchemas.TalhaoAcordoBody

function toFracBody(body) {
  return {
    ...body,
    tipo_plantio: body.tipo_plantio || '',
    participantes: (body.participantes || []).map((p) => ({
      ...p,
      percentual_producao: Number(p.percentual_producao) / 100,
    })),
  }
}

talhaoAcordosRouter.post('/', requirePerm(Modules.PRODUCAO, Actions.CREATE), validateBody(Body), (req, res) => {
  const payload = toFracBody(req.body)
  const row = talhaoAcordoRepo.create(payload, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'talhao-acordos', record_id: row.id, action_type: 'create', new_values: row })
  res.status(201).json(row)
})

talhaoAcordosRouter.put(
  '/:id',
  requirePerm(Modules.PRODUCAO, Actions.UPDATE),
  validateParams(S.IdParam),
  validateBody(Body),
  (req, res) => {
    const id = req.params.id
    const exists = talhaoAcordoRepo.get(id)
    if (!exists) throw notFound('Acordo nao encontrado')
    const payload = toFracBody(req.body)
    const row = talhaoAcordoRepo.update(id, payload, { user_id: req.user?.id })
    auditService.log(req, { module_name: 'talhao-acordos', record_id: id, action_type: 'update', old_values: exists, new_values: row })
    res.json(row)
  },
)

talhaoAcordosRouter.delete(
  '/:id',
  requirePerm(Modules.PRODUCAO, Actions.DELETE),
  validateParams(S.IdParam),
  (req, res) => {
    const id = req.params.id
    const exists = talhaoAcordoRepo.get(id)
    if (!exists) throw notFound('Acordo nao encontrado')
    auditService.log(req, { module_name: 'talhao-acordos', record_id: id, action_type: 'delete', old_values: exists })
    talhaoAcordoRepo.remove(id, { user_id: req.user?.id })
    res.status(204).send()
  },
)

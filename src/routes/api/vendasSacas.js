import { Router } from 'express'

import { vendaSacaRepo } from '../../repositories/vendaSacaRepo.js'
import { notFound } from '../../errors.js'
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js'
import { requirePerm } from '../../middleware/auth.js'
import { Actions, Modules } from '../../auth/acl.js'
import { S, ProducaoSchemas } from '../../validation/apiSchemas.js'
import { auditService } from '../../services/auditService.js'
import { producaoService } from '../../services/producaoService.js'

export const vendasSacasRouter = Router()

vendasSacasRouter.get(
  '/',
  requirePerm(Modules.PRODUCAO, Actions.VIEW),
  validateQuery(ProducaoSchemas.ApuracaoQuery.partial()),
  (req, res) => {
    const safra_id = req.query.safra_id ? Number(req.query.safra_id) : null
    res.json(vendaSacaRepo.list({ safra_id }))
  },
)

vendasSacasRouter.get(
  '/:id',
  requirePerm(Modules.PRODUCAO, Actions.VIEW),
  validateParams(S.IdParam),
  (req, res) => {
    const row = vendaSacaRepo.get(req.params.id)
    if (!row) throw notFound('Venda nao encontrada')
    res.json(row)
  },
)

const Body = ProducaoSchemas.VendaSacaBody

vendasSacasRouter.post('/', requirePerm(Modules.PRODUCAO, Actions.CREATE), validateBody(Body), (req, res) => {
  const row = vendaSacaRepo.create(req.body, { user_id: req.user?.id })
  producaoService.syncVendaMov({ venda: row, user_id: req.user?.id })
  auditService.log(req, { module_name: 'vendas-sacas', record_id: row.id, action_type: 'create', new_values: row })
  res.status(201).json(row)
})

vendasSacasRouter.put(
  '/:id',
  requirePerm(Modules.PRODUCAO, Actions.UPDATE),
  validateParams(S.IdParam),
  validateBody(Body),
  (req, res) => {
    const id = req.params.id
    const exists = vendaSacaRepo.get(id)
    if (!exists) throw notFound('Venda nao encontrada')
    const row = vendaSacaRepo.update(id, req.body, { user_id: req.user?.id })
    producaoService.syncVendaMov({ venda: row, user_id: req.user?.id })
    auditService.log(req, { module_name: 'vendas-sacas', record_id: id, action_type: 'update', old_values: exists, new_values: row })
    res.json(row)
  },
)

vendasSacasRouter.delete(
  '/:id',
  requirePerm(Modules.PRODUCAO, Actions.DELETE),
  validateParams(S.IdParam),
  (req, res) => {
    const id = req.params.id
    const exists = vendaSacaRepo.get(id)
    if (!exists) throw notFound('Venda nao encontrada')
    auditService.log(req, { module_name: 'vendas-sacas', record_id: id, action_type: 'delete', old_values: exists })
    vendaSacaRepo.remove(id, { user_id: req.user?.id })
    // remove ledger row
    producaoService.syncVendaMov({ venda: { ...exists, deleted_at: '1' }, user_id: req.user?.id })
    res.status(204).send()
  },
)

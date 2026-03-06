import { Router } from 'express'

import { custoLancamentoRepo } from '../../repositories/custoLancamentoRepo.js'
import { notFound } from '../../errors.js'
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js'
import { requirePerm } from '../../middleware/auth.js'
import { Actions, Modules } from '../../auth/acl.js'
import { S, ProducaoSchemas } from '../../validation/apiSchemas.js'
import { auditService } from '../../services/auditService.js'

export const custosLancamentosRouter = Router()

custosLancamentosRouter.get(
  '/',
  requirePerm(Modules.PRODUCAO, Actions.VIEW),
  validateQuery(ProducaoSchemas.ApuracaoQuery.partial()),
  (req, res) => {
    const safra_id = req.query.safra_id ? Number(req.query.safra_id) : null
    const talhao_id = req.query.talhao_id ? Number(req.query.talhao_id) : null
    res.json(custoLancamentoRepo.list({ safra_id, talhao_id }))
  },
)

custosLancamentosRouter.get(
  '/:id',
  requirePerm(Modules.PRODUCAO, Actions.VIEW),
  validateParams(S.IdParam),
  (req, res) => {
    const row = custoLancamentoRepo.get(req.params.id)
    if (!row) throw notFound('Custo nao encontrado')
    res.json(row)
  },
)

const Body = ProducaoSchemas.CustoLancamentoBody

custosLancamentosRouter.post('/', requirePerm(Modules.PRODUCAO, Actions.CREATE), validateBody(Body), (req, res) => {
  const row = custoLancamentoRepo.create(req.body, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'custos-lancamentos', record_id: row.id, action_type: 'create', new_values: row })
  res.status(201).json(row)
})

custosLancamentosRouter.put(
  '/:id',
  requirePerm(Modules.PRODUCAO, Actions.UPDATE),
  validateParams(S.IdParam),
  validateBody(Body),
  (req, res) => {
    const id = req.params.id
    const exists = custoLancamentoRepo.get(id)
    if (!exists) throw notFound('Custo nao encontrado')
    const row = custoLancamentoRepo.update(id, req.body, { user_id: req.user?.id })
    auditService.log(req, { module_name: 'custos-lancamentos', record_id: id, action_type: 'update', old_values: exists, new_values: row })
    res.json(row)
  },
)

custosLancamentosRouter.delete(
  '/:id',
  requirePerm(Modules.PRODUCAO, Actions.DELETE),
  validateParams(S.IdParam),
  (req, res) => {
    const id = req.params.id
    const exists = custoLancamentoRepo.get(id)
    if (!exists) throw notFound('Custo nao encontrado')
    auditService.log(req, { module_name: 'custos-lancamentos', record_id: id, action_type: 'delete', old_values: exists })
    custoLancamentoRepo.remove(id, { user_id: req.user?.id })
    res.status(204).send()
  },
)

import { Router } from 'express'

import { politicaCustosRepo } from '../../repositories/politicaCustosRepo.js'
import { notFound } from '../../errors.js'
import { validateBody, validateParams } from '../../middleware/validate.js'
import { requirePerm } from '../../middleware/auth.js'
import { Actions, Modules } from '../../auth/acl.js'
import { S, ProducaoSchemas } from '../../validation/apiSchemas.js'
import { auditService } from '../../services/auditService.js'
import { deleteDependencyService } from '../../services/deleteDependencyService.js'

export const politicasCustosRouter = Router()

politicasCustosRouter.get('/', requirePerm(Modules.PRODUCAO, Actions.VIEW), (_req, res) => {
  res.json(politicaCustosRepo.list())
})

politicasCustosRouter.get(
  '/:id',
  requirePerm(Modules.PRODUCAO, Actions.VIEW),
  validateParams(S.IdParam),
  (req, res) => {
    const row = politicaCustosRepo.get(req.params.id)
    if (!row) throw notFound('Politica nao encontrada')
    const regras = politicaCustosRepo.listRegras(row.id)
    res.json({ ...row, regras })
  },
)

const Body = ProducaoSchemas.PoliticaCustosBody

politicasCustosRouter.post('/', requirePerm(Modules.PRODUCAO, Actions.CREATE), validateBody(Body), (req, res) => {
  const row = politicaCustosRepo.create({ nome: req.body.nome, descricao: req.body.descricao || null }, { user_id: req.user?.id })
  politicaCustosRepo.replaceRegras(row.id, req.body.regras || [], { user_id: req.user?.id })
  const full = { ...row, regras: politicaCustosRepo.listRegras(row.id) }
  auditService.log(req, { module_name: 'politicas-custos', record_id: row.id, action_type: 'create', new_values: full })
  res.status(201).json(full)
})

politicasCustosRouter.put(
  '/:id',
  requirePerm(Modules.PRODUCAO, Actions.UPDATE),
  validateParams(S.IdParam),
  validateBody(Body),
  (req, res) => {
    const id = req.params.id
    const exists = politicaCustosRepo.get(id)
    if (!exists) throw notFound('Politica nao encontrada')
    const old = { ...exists, regras: politicaCustosRepo.listRegras(id) }

    const row = politicaCustosRepo.update(id, { nome: req.body.nome, descricao: req.body.descricao || null }, { user_id: req.user?.id })
    politicaCustosRepo.replaceRegras(id, req.body.regras || [], { user_id: req.user?.id })
    const full = { ...row, regras: politicaCustosRepo.listRegras(id) }

    auditService.log(req, { module_name: 'politicas-custos', record_id: id, action_type: 'update', old_values: old, new_values: full })
    res.json(full)
  },
)

politicasCustosRouter.delete(
  '/:id',
  requirePerm(Modules.PRODUCAO, Actions.DELETE),
  validateParams(S.IdParam),
  (req, res) => {
    const id = req.params.id
    const exists = politicaCustosRepo.get(id)
    if (!exists) throw notFound('Politica nao encontrada')
    deleteDependencyService.assertCanDeletePoliticaCustos(Number(id))
    auditService.log(req, { module_name: 'politicas-custos', record_id: id, action_type: 'delete', old_values: exists })
    politicaCustosRepo.remove(id, { user_id: req.user?.id })
    res.status(204).send()
  },
)

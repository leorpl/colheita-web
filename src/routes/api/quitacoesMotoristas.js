import { Router } from 'express'
import { validateBody, validateQuery, validateParams } from '../../middleware/validate.js'
import { quitacaoMotoristasService } from '../../services/quitacaoMotoristasService.js'
import { motoristaQuitacaoRepo } from '../../repositories/motoristaQuitacaoRepo.js'
import { notFound } from '../../errors.js'
import { requirePerm } from '../../middleware/auth.js'
import { Actions, Modules } from '../../auth/acl.js'
import { S, QuitacoesSchemas } from '../../validation/apiSchemas.js'
import { auditService } from '../../services/auditService.js'

export const quitacoesMotoristasRouter = Router()

const ResumoQuery = QuitacoesSchemas.ResumoQuery

quitacoesMotoristasRouter.get(
  '/resumo',
  requirePerm(Modules.QUITACOES, Actions.VIEW),
  validateQuery(ResumoQuery),
  (req, res) => {
    res.json(quitacaoMotoristasService.resumo(req.query))
  },
)

const CreateBody = QuitacoesSchemas.CreateBody

quitacoesMotoristasRouter.post(
  '/',
  requirePerm(Modules.QUITACOES, Actions.CREATE),
  validateBody(CreateBody),
  (req, res) => {
  const row = quitacaoMotoristasService.create(req.body, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'quitacao-motoristas', record_id: row?.id ?? null, action_type: 'create', new_values: row })
  res.status(201).json(row)
  },
)

quitacoesMotoristasRouter.put(
  '/:id',
  requirePerm(Modules.QUITACOES, Actions.UPDATE),
  validateParams(S.IdParam),
  validateBody(CreateBody),
  (req, res) => {
  const id = req.params.id
  const exists = motoristaQuitacaoRepo.get(id)
  if (!exists) throw notFound('Quitacao nao encontrada')
  const row = quitacaoMotoristasService.create({ ...req.body, id }, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'quitacao-motoristas', record_id: id, action_type: 'update', old_values: exists, new_values: row })
  res.json(row)
  },
)

quitacoesMotoristasRouter.delete(
  '/:id',
  requirePerm(Modules.QUITACOES, Actions.DELETE),
  validateParams(S.IdParam),
  (req, res) => {
  const id = req.params.id
  const exists = motoristaQuitacaoRepo.get(id)
  if (!exists) throw notFound('Quitacao nao encontrada')
  auditService.log(req, { module_name: 'quitacao-motoristas', record_id: id, action_type: 'delete', old_values: exists })
  motoristaQuitacaoRepo.remove(id)
  res.status(204).send()
  },
)

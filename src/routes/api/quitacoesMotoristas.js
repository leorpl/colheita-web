import { Router } from 'express'
import { validateBody, validateQuery, validateParams } from '../../middleware/validate.js'
import { quitacaoMotoristasService } from '../../services/quitacaoMotoristasService.js'
import { motoristaQuitacaoRepo } from '../../repositories/motoristaQuitacaoRepo.js'
import { notFound } from '../../errors.js'
import { requirePerm } from '../../middleware/auth.js'
import { Permissions } from '../../auth/permissions.js'
import { S, QuitacoesSchemas } from '../../validation/apiSchemas.js'

export const quitacoesMotoristasRouter = Router()

const ResumoQuery = QuitacoesSchemas.ResumoQuery

quitacoesMotoristasRouter.get(
  '/resumo',
  requirePerm(Permissions.QUITACOES_WRITE),
  validateQuery(ResumoQuery),
  (req, res) => {
    res.json(quitacaoMotoristasService.resumo(req.query))
  },
)

const CreateBody = QuitacoesSchemas.CreateBody

quitacoesMotoristasRouter.post(
  '/',
  requirePerm(Permissions.QUITACOES_WRITE),
  validateBody(CreateBody),
  (req, res) => {
  const row = quitacaoMotoristasService.create(req.body)
  res.status(201).json(row)
  },
)

quitacoesMotoristasRouter.put(
  '/:id',
  requirePerm(Permissions.QUITACOES_WRITE),
  validateParams(S.IdParam),
  validateBody(CreateBody),
  (req, res) => {
  const id = req.params.id
  const exists = motoristaQuitacaoRepo.get(id)
  if (!exists) throw notFound('Quitacao nao encontrada')
  const row = quitacaoMotoristasService.create({ ...req.body, id })
  res.json(row)
  },
)

quitacoesMotoristasRouter.delete(
  '/:id',
  requirePerm(Permissions.QUITACOES_WRITE),
  validateParams(S.IdParam),
  (req, res) => {
  const id = req.params.id
  const exists = motoristaQuitacaoRepo.get(id)
  if (!exists) throw notFound('Quitacao nao encontrada')
  motoristaQuitacaoRepo.remove(id)
  res.status(204).send()
  },
)

import { Router } from 'express'
import { validateBody, validateParams } from '../../middleware/validate.js'
import { safraRepo } from '../../repositories/safraRepo.js'
import { notFound } from '../../errors.js'
import { requirePerm } from '../../middleware/auth.js'
import { Permissions } from '../../auth/permissions.js'
import { S, SafraSchemas } from '../../validation/apiSchemas.js'

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
  const row = safraRepo.create(req.body)
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
  res.json(safraRepo.update(id, req.body))
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
  res.json(safraRepo.setPainel(id))
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
  safraRepo.remove(id)
  res.status(204).send()
  },
)

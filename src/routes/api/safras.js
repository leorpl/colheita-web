import { Router } from 'express'
import { z } from 'zod'
import { safraRepo } from '../../repositories/safraRepo.js'
import { notFound } from '../../errors.js'
import { validateBody } from '../../middleware/validate.js'
import { requirePerm } from '../../middleware/auth.js'
import { Permissions } from '../../auth/permissions.js'

export const safrasRouter = Router()

const SafraBody = z.object({
  safra: z.string().min(1),
  plantio: z.string().optional().nullable(),
  data_referencia: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  area_ha: z.coerce.number().min(0).optional().default(0),
})

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

safrasRouter.get('/:id', requirePerm(Permissions.CONFIG_READ), (req, res) => {
  const row = safraRepo.get(Number(req.params.id))
  if (!row) throw notFound('Safra nao encontrada')
  res.json(row)
})

safrasRouter.put(
  '/:id',
  requirePerm(Permissions.CONFIG_WRITE),
  validateBody(SafraBody),
  (req, res) => {
  const id = Number(req.params.id)
  const exists = safraRepo.get(id)
  if (!exists) throw notFound('Safra nao encontrada')
  res.json(safraRepo.update(id, req.body))
  },
)

const PainelBody = z.object({
  painel: z.coerce.boolean().default(true),
})

// define qual safra aparece no Painel
// obs: somente uma safra pode ficar marcada
safrasRouter.put('/:id/painel', validateBody(PainelBody), (req, res) => {
  const id = Number(req.params.id)
  const exists = safraRepo.get(id)
  if (!exists) throw notFound('Safra nao encontrada')
  if (!req.body.painel) return res.json(exists)
  res.json(safraRepo.setPainel(id))
})

safrasRouter.delete('/:id', requirePerm(Permissions.CONFIG_WRITE), (req, res) => {
  const id = Number(req.params.id)
  const exists = safraRepo.get(id)
  if (!exists) throw notFound('Safra nao encontrada')
  safraRepo.remove(id)
  res.status(204).send()
})

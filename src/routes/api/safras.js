import { Router } from 'express'
import { z } from 'zod'
import { safraRepo } from '../../repositories/safraRepo.js'
import { notFound } from '../../errors.js'
import { validateBody } from '../../middleware/validate.js'

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

safrasRouter.get('/', async (_req, res) => {
  res.json(await safraRepo.list())
})

safrasRouter.post('/', validateBody(SafraBody), async (req, res) => {
  const row = await safraRepo.create(req.body)
  res.status(201).json(row)
})

safrasRouter.get('/:id', async (req, res) => {
  const row = await safraRepo.get(Number(req.params.id))
  if (!row) throw notFound('Safra nao encontrada')
  res.json(row)
})

safrasRouter.put('/:id', validateBody(SafraBody), async (req, res) => {
  const id = Number(req.params.id)
  const exists = await safraRepo.get(id)
  if (!exists) throw notFound('Safra nao encontrada')
  res.json(await safraRepo.update(id, req.body))
})

const PainelBody = z.object({
  painel: z.coerce.boolean().default(true),
})

// define qual safra aparece no Painel
// obs: somente uma safra pode ficar marcada
safrasRouter.put('/:id/painel', validateBody(PainelBody), async (req, res) => {
  const id = Number(req.params.id)
  const exists = await safraRepo.get(id)
  if (!exists) throw notFound('Safra nao encontrada')
  if (!req.body.painel) return res.json(exists)
  res.json(await safraRepo.setPainel(id))
})

safrasRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const exists = await safraRepo.get(id)
  if (!exists) throw notFound('Safra nao encontrada')
  await safraRepo.remove(id)
  res.status(204).send()
})

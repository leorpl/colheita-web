import { Router } from 'express'
import { z } from 'zod'
import { freteRepo } from '../../repositories/freteRepo.js'
import { validateBody } from '../../middleware/validate.js'
import { notFound } from '../../errors.js'

export const fretesRouter = Router()

const FreteUpsertBody = z.object({
  safra_id: z.coerce.number().int().positive(),
  motorista_id: z.coerce.number().int().positive(),
  destino_id: z.coerce.number().int().positive(),
  valor_por_saca: z.coerce.number().nonnegative(),
})

fretesRouter.get('/', async (_req, res) => {
  res.json(await freteRepo.list())
})

fretesRouter.post('/', validateBody(FreteUpsertBody), async (req, res) => {
  const row = await freteRepo.upsert(req.body)
  res.status(201).json(row)
})

const CopySafraBody = z.object({
  from_safra_id: z.coerce.number().int().positive(),
  to_safra_id: z.coerce.number().int().positive(),
})

fretesRouter.post('/copiar-safra', validateBody(CopySafraBody), async (req, res) => {
  const { from_safra_id, to_safra_id } = req.body
  const r = await freteRepo.copySafra({ from_safra_id, to_safra_id })
  res.status(201).json(r)
})

const BulkUpsertBody = z.object({
  safra_id: z.coerce.number().int().positive(),
  items: z
    .array(
      z.object({
        motorista_id: z.coerce.number().int().positive(),
        destino_id: z.coerce.number().int().positive(),
        valor_por_saca: z.coerce.number().nonnegative(),
      }),
    )
    .default([]),
})

fretesRouter.post('/bulk-upsert', validateBody(BulkUpsertBody), async (req, res) => {
  const { safra_id, items } = req.body
  const r = await freteRepo.bulkUpsert({ safra_id, items })
  res.status(201).json(r)
})

fretesRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const exists = await freteRepo.get(id)
  if (!exists) throw notFound('Frete nao encontrado')
  await freteRepo.remove(id)
  res.status(204).send()
})

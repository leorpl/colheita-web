import { Router } from 'express'
import { z } from 'zod'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { talhaoSafraRepo } from '../../repositories/talhaoSafraRepo.js'

export const talhaoSafraRouter = Router()

const ListQuery = z.object({
  safra_id: z.coerce.number().int().positive(),
})

talhaoSafraRouter.get('/', validateQuery(ListQuery), (req, res) => {
  res.json(talhaoSafraRepo.listBySafra({ safra_id: req.query.safra_id }))
})

const UpsertBody = z.object({
  safra_id: z.coerce.number().int().positive(),
  talhao_id: z.coerce.number().int().positive(),
  pct_area_colhida: z.coerce.number().min(0).max(1),
})

talhaoSafraRouter.post('/', validateBody(UpsertBody), (req, res) => {
  const row = talhaoSafraRepo.upsert(req.body)
  res.status(201).json(row)
})

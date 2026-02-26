import { Router } from 'express'
import { z } from 'zod'
import { destinoRepo } from '../../repositories/destinoRepo.js'
import { notFound } from '../../errors.js'
import { validateBody } from '../../middleware/validate.js'

export const destinosRouter = Router()

const DestinoBody = z.object({
  codigo: z.string().min(1),
  local: z.string().min(1),
  maps_url: z.string().optional().nullable(),
  trava_sacas: z
    .union([z.coerce.number().min(0), z.null()])
    .optional()
    .nullable(),
  distancia_km: z
    .union([z.coerce.number().min(0), z.null()])
    .optional()
    .nullable(),
  observacoes: z.string().optional().nullable(),
})

destinosRouter.get('/', async (_req, res) => {
  res.json(await destinoRepo.list())
})

destinosRouter.post('/', validateBody(DestinoBody), async (req, res) => {
  const row = await destinoRepo.create(req.body)
  res.status(201).json(row)
})

destinosRouter.get('/:id', async (req, res) => {
  const row = await destinoRepo.get(Number(req.params.id))
  if (!row) throw notFound('Destino nao encontrado')
  res.json(row)
})

destinosRouter.put('/:id', validateBody(DestinoBody), async (req, res) => {
  const id = Number(req.params.id)
  const exists = await destinoRepo.get(id)
  if (!exists) throw notFound('Destino nao encontrado')
  res.json(await destinoRepo.update(id, req.body))
})

destinosRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const exists = await destinoRepo.get(id)
  if (!exists) throw notFound('Destino nao encontrado')
  await destinoRepo.remove(id)
  res.status(204).send()
})

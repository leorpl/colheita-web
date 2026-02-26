import { Router } from 'express'
import { z } from 'zod'
import { plantioTipoRepo } from '../../repositories/plantioTipoRepo.js'
import { notFound } from '../../errors.js'
import { validateBody } from '../../middleware/validate.js'

export const tiposPlantioRouter = Router()

const Body = z.object({
  nome: z.string().trim().min(1),
})

tiposPlantioRouter.get('/', async (_req, res) => {
  res.json(await plantioTipoRepo.list())
})

tiposPlantioRouter.post('/', validateBody(Body), async (req, res) => {
  const row = await plantioTipoRepo.create(req.body)
  res.status(201).json(row)
})

tiposPlantioRouter.put('/:id', validateBody(Body), async (req, res) => {
  const id = Number(req.params.id)
  const exists = await plantioTipoRepo.get(id)
  if (!exists) throw notFound('Tipo de plantio nao encontrado')
  res.json(await plantioTipoRepo.update(id, req.body))
})

tiposPlantioRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const exists = await plantioTipoRepo.get(id)
  if (!exists) throw notFound('Tipo de plantio nao encontrado')
  await plantioTipoRepo.remove(id)
  res.status(204).send()
})

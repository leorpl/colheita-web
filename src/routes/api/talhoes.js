import { Router } from 'express'
import { z } from 'zod'
import { talhaoRepo } from '../../repositories/talhaoRepo.js'
import { notFound } from '../../errors.js'
import { validateBody } from '../../middleware/validate.js'

export const talhoesRouter = Router()

const TalhaoBody = z.object({
  codigo: z.string().min(1),
  local: z.string().optional().nullable(),
  nome: z.string().optional().nullable(),
  situacao: z.string().optional().nullable(),
  hectares: z.coerce.number().min(0),
  posse: z.string().optional().nullable(),
  contrato: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  irrigacao: z.string().optional().nullable(),
  foto_url: z.string().optional().nullable(),
  maps_url: z.string().optional().nullable(),
  tipo_solo: z.string().optional().nullable(),
  calagem: z.string().optional().nullable(),
  gessagem: z.string().optional().nullable(),
  fosforo_corretivo: z.string().optional().nullable(),
})

talhoesRouter.get('/', async (_req, res) => {
  res.json(await talhaoRepo.list())
})

talhoesRouter.post('/', validateBody(TalhaoBody), async (req, res) => {
  const row = await talhaoRepo.create(req.body)
  res.status(201).json(row)
})

talhoesRouter.get('/:id', async (req, res) => {
  const row = await talhaoRepo.get(Number(req.params.id))
  if (!row) throw notFound('Talhao nao encontrado')
  res.json(row)
})

talhoesRouter.put('/:id', validateBody(TalhaoBody), async (req, res) => {
  const id = Number(req.params.id)
  const exists = await talhaoRepo.get(id)
  if (!exists) throw notFound('Talhao nao encontrado')
  res.json(await talhaoRepo.update(id, req.body))
})

talhoesRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const exists = await talhaoRepo.get(id)
  if (!exists) throw notFound('Talhao nao encontrado')
  await talhaoRepo.remove(id)
  res.status(204).send()
})

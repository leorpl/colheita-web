import { Router } from 'express'
import { z } from 'zod'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { quitacaoMotoristasService } from '../../services/quitacaoMotoristasService.js'
import { motoristaQuitacaoRepo } from '../../repositories/motoristaQuitacaoRepo.js'
import { notFound } from '../../errors.js'

export const quitacoesMotoristasRouter = Router()

const ResumoQuery = z.object({
  de: z.string().min(1),
  ate: z.string().min(1),
})

quitacoesMotoristasRouter.get(
  '/resumo',
  validateQuery(ResumoQuery),
  async (req, res) => {
    res.json(await quitacaoMotoristasService.resumo(req.query))
  },
)

const CreateBody = z.object({
  motorista_id: z.coerce.number().int().positive(),
  de: z.string().min(1),
  ate: z.string().min(1),
  data_pagamento: z.string().min(1),
  valor: z.coerce.number().positive(),
  forma_pagamento: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
})

quitacoesMotoristasRouter.post('/', validateBody(CreateBody), async (req, res) => {
  const row = await quitacaoMotoristasService.create(req.body)
  res.status(201).json(row)
})

quitacoesMotoristasRouter.put('/:id', validateBody(CreateBody), async (req, res) => {
  const id = Number(req.params.id)
  const exists = await motoristaQuitacaoRepo.get(id)
  if (!exists) throw notFound('Quitacao nao encontrada')
  const row = await quitacaoMotoristasService.create({ ...req.body, id })
  res.json(row)
})

quitacoesMotoristasRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const exists = await motoristaQuitacaoRepo.get(id)
  if (!exists) throw notFound('Quitacao nao encontrada')
  await motoristaQuitacaoRepo.remove(id)
  res.status(204).send()
})

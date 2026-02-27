import { Router } from 'express'
import { z } from 'zod'
import { motoristaRepo } from '../../repositories/motoristaRepo.js'
import { notFound } from '../../errors.js'
import { validateBody } from '../../middleware/validate.js'

export const motoristasRouter = Router()

const MotoristaBody = z.object({
  nome: z.string().min(1),
  placa: z.string().optional().nullable(),
  cpf: z.string().optional().nullable(),
  banco: z.string().optional().nullable(),
  pix_conta: z.string().optional().nullable(),
  tipo_veiculo: z.string().optional().nullable(),
  capacidade_kg: z
    .union([z.coerce.number().min(0), z.null()])
    .optional()
    .nullable(),
})

motoristasRouter.get('/', (_req, res) => {
  res.json(motoristaRepo.list())
})

motoristasRouter.post('/', validateBody(MotoristaBody), (req, res) => {
  const row = motoristaRepo.create(req.body)
  res.status(201).json(row)
})

motoristasRouter.get('/:id', (req, res) => {
  const row = motoristaRepo.get(Number(req.params.id))
  if (!row) throw notFound('Motorista nao encontrado')
  res.json(row)
})

motoristasRouter.put('/:id', validateBody(MotoristaBody), (req, res) => {
  const id = Number(req.params.id)
  const exists = motoristaRepo.get(id)
  if (!exists) throw notFound('Motorista nao encontrado')
  res.json(motoristaRepo.update(id, req.body))
})

motoristasRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  const exists = motoristaRepo.get(id)
  if (!exists) throw notFound('Motorista nao encontrado')
  motoristaRepo.remove(id)
  res.status(204).send()
})

import { Router } from 'express'
import { z } from 'zod'
import { motoristaRepo } from '../../repositories/motoristaRepo.js'
import { notFound } from '../../errors.js'
import { validateBody } from '../../middleware/validate.js'
import { requirePerm } from '../../middleware/auth.js'
import { Permissions } from '../../auth/permissions.js'

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

motoristasRouter.get('/', requirePerm(Permissions.CADASTROS_READ), (_req, res) => {
  res.json(motoristaRepo.list())
})

motoristasRouter.post(
  '/',
  requirePerm(Permissions.CADASTROS_WRITE),
  validateBody(MotoristaBody),
  (req, res) => {
  const row = motoristaRepo.create(req.body)
  res.status(201).json(row)
  },
)

motoristasRouter.get('/:id', requirePerm(Permissions.CADASTROS_READ), (req, res) => {
  const row = motoristaRepo.get(Number(req.params.id))
  if (!row) throw notFound('Motorista nao encontrado')
  res.json(row)
})

motoristasRouter.put(
  '/:id',
  requirePerm(Permissions.CADASTROS_WRITE),
  validateBody(MotoristaBody),
  (req, res) => {
  const id = Number(req.params.id)
  const exists = motoristaRepo.get(id)
  if (!exists) throw notFound('Motorista nao encontrado')
  res.json(motoristaRepo.update(id, req.body))
  },
)

motoristasRouter.delete('/:id', requirePerm(Permissions.CADASTROS_WRITE), (req, res) => {
  const id = Number(req.params.id)
  const exists = motoristaRepo.get(id)
  if (!exists) throw notFound('Motorista nao encontrado')
  motoristaRepo.remove(id)
  res.status(204).send()
})

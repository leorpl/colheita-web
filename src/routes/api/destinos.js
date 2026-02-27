import { Router } from 'express'
import { z } from 'zod'
import { destinoRepo } from '../../repositories/destinoRepo.js'
import { notFound } from '../../errors.js'
import { validateBody } from '../../middleware/validate.js'
import { requirePerm } from '../../middleware/auth.js'
import { Permissions } from '../../auth/permissions.js'

export const destinosRouter = Router()

const DestinoBody = z.object({
  codigo: z.string().min(1),
  local: z.string().min(1),
  maps_url: z.string().optional().nullable(),
  distancia_km: z
    .union([z.coerce.number().min(0), z.null()])
    .optional()
    .nullable(),
  observacoes: z.string().optional().nullable(),
})

destinosRouter.get('/', requirePerm(Permissions.CADASTROS_READ), (_req, res) => {
  res.json(destinoRepo.list())
})

destinosRouter.post(
  '/',
  requirePerm(Permissions.CADASTROS_WRITE),
  validateBody(DestinoBody),
  (req, res) => {
  const row = destinoRepo.create(req.body)
  res.status(201).json(row)
  },
)

destinosRouter.get('/:id', requirePerm(Permissions.CADASTROS_READ), (req, res) => {
  const row = destinoRepo.get(Number(req.params.id))
  if (!row) throw notFound('Destino nao encontrado')
  res.json(row)
})

destinosRouter.put(
  '/:id',
  requirePerm(Permissions.CADASTROS_WRITE),
  validateBody(DestinoBody),
  (req, res) => {
  const id = Number(req.params.id)
  const exists = destinoRepo.get(id)
  if (!exists) throw notFound('Destino nao encontrado')
  res.json(destinoRepo.update(id, req.body))
  },
)

destinosRouter.delete('/:id', requirePerm(Permissions.CADASTROS_WRITE), (req, res) => {
  const id = Number(req.params.id)
  const exists = destinoRepo.get(id)
  if (!exists) throw notFound('Destino nao encontrado')
  destinoRepo.remove(id)
  res.status(204).send()
})

import { Router } from 'express'
import { viagemRepo } from '../../repositories/viagemRepo.js'
import { notFound } from '../../errors.js'
import { validateBody, validateQuery, validateParams } from '../../middleware/validate.js'
import { viagemService } from '../../services/viagemService.js'
import { requirePerm } from '../../middleware/auth.js'
import { Permissions } from '../../auth/permissions.js'
import { S, ViagemSchemas } from '../../validation/apiSchemas.js'

export const viagensRouter = Router()

const ViagemBody = ViagemSchemas.Body
const PreviewBody = ViagemSchemas.PreviewBody
const RecalcAllBody = ViagemSchemas.RecalcAllBody

viagensRouter.post(
  '/preview',
  requirePerm(Permissions.COLHEITA_READ),
  validateBody(PreviewBody),
  (req, res) => {
  const id = req.body.id ? Number(req.body.id) : null
  const payload = id
    ? viagemService.buildPayload(req.body, { current_id: id, exclude_id: id })
    : viagemService.buildPayload(req.body)
  const trava = viagemService.getTravaStatus({
    destino_id: payload.destino_id,
    safra_id: payload.safra_id,
    tipo_plantio: payload.tipo_plantio,
    sacas: payload.sacas,
    exclude_id: id || null,
  })
  res.json({ ...payload, trava })
  },
)

// Comparar sacas por destino (mesma safra + tipo de plantio)
const CompareBody = ViagemSchemas.CompareBody

viagensRouter.post(
  '/comparar-destinos',
  requirePerm(Permissions.COLHEITA_READ),
  validateBody(CompareBody),
  (req, res) => {
    const id = req.body.id ? Number(req.body.id) : null
    res.json(viagemService.compararDestinos({ ...req.body, id }))
  },
)

const ListQuery = ViagemSchemas.ListQuery

viagensRouter.get(
  '/',
  requirePerm(Permissions.COLHEITA_READ),
  validateQuery(ListQuery),
  (req, res) => {
  const items = viagemRepo.list(req.query)
  const totals = viagemRepo.totals(req.query)
  res.json({ items, totals })
  },
)

const NextFichaQuery = ViagemSchemas.NextFichaQuery

viagensRouter.get(
  '/next-ficha',
  requirePerm(Permissions.COLHEITA_READ),
  validateQuery(NextFichaQuery),
  (req, res) => {
  res.json(viagemService.nextFicha(Number(req.query.safra_id)))
  },
)

viagensRouter.post(
  '/',
  requirePerm(Permissions.COLHEITA_WRITE),
  validateBody(ViagemBody),
  (req, res) => {
  const row = viagemService.create(req.body)
  res.status(201).json(row)
  },
)

// Recalcular colheitas com base nas regras atuais.
// Usado quando houve ajustes de regras/regras de negocio e precisa re-materializar campos calculados.
viagensRouter.post(
  '/recalcular-todas',
  requirePerm(Permissions.CONFIG_WRITE),
  validateBody(RecalcAllBody),
  (req, res) => {
    const r = viagemService.recalcularTodas(req.body)
    res.status(201).json(r)
  },
)

viagensRouter.get(
  '/:id',
  requirePerm(Permissions.COLHEITA_READ),
  validateParams(S.IdParam),
  (req, res) => {
  const row = viagemRepo.get(req.params.id)
  if (!row) throw notFound('Viagem nao encontrada')
  res.json(row)
  },
)

viagensRouter.put(
  '/:id',
  requirePerm(Permissions.COLHEITA_WRITE),
  validateParams(S.IdParam),
  validateBody(ViagemBody),
  (req, res) => {
  const id = req.params.id
  const exists = viagemRepo.get(id)
  if (!exists) throw notFound('Viagem nao encontrada')
  res.json(viagemService.update(id, req.body))
  },
)

viagensRouter.delete(
  '/:id',
  requirePerm(Permissions.COLHEITA_WRITE),
  validateParams(S.IdParam),
  (req, res) => {
  const id = req.params.id
  const exists = viagemRepo.get(id)
  if (!exists) throw notFound('Viagem nao encontrada')
  viagemRepo.remove(id)
  res.status(204).send()
  },
)

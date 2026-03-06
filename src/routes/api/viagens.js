import { Router } from 'express'
import { viagemRepo } from '../../repositories/viagemRepo.js'
import { notFound } from '../../errors.js'
import { validateBody, validateQuery, validateParams } from '../../middleware/validate.js'
import { viagemService } from '../../services/viagemService.js'
import { requireCan } from '../../middleware/auth.js'
import { Actions, Modules } from '../../auth/acl.js'
import { S, ViagemSchemas } from '../../validation/apiSchemas.js'
import { auditService } from '../../services/auditService.js'

export const viagensRouter = Router()

const ViagemBody = ViagemSchemas.Body
const PreviewBody = ViagemSchemas.PreviewBody
const RecalcAllBody = ViagemSchemas.RecalcAllBody

viagensRouter.post(
  '/preview',
  requireCan(Modules.COLHEITA, Actions.VIEW),
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
  requireCan(Modules.COLHEITA, Actions.VIEW),
  validateBody(CompareBody),
  (req, res) => {
    const id = req.body.id ? Number(req.body.id) : null
    res.json(viagemService.compararDestinos({ ...req.body, id }))
  },
)

const ListQuery = ViagemSchemas.ListQuery

viagensRouter.get(
  '/',
  requireCan(Modules.COLHEITA, Actions.VIEW),
  validateQuery(ListQuery),
  (req, res) => {
  const view = String(req.query.view || 'legacy')
  const items =
    view === 'flat' || view === 'grouped'
      ? viagemService.listView({ ...req.query, view })
      : viagemRepo.list(req.query)
  const totals = viagemRepo.totals(req.query)
  res.json({ items, totals, view })
  },
)

const NextFichaQuery = ViagemSchemas.NextFichaQuery

viagensRouter.get(
  '/next-ficha',
  requireCan(Modules.COLHEITA, Actions.VIEW),
  validateQuery(NextFichaQuery),
  (req, res) => {
  res.json(viagemService.nextFicha(Number(req.query.safra_id)))
  },
)

viagensRouter.post(
  '/',
  requireCan(Modules.COLHEITA, Actions.CREATE),
  validateBody(ViagemBody),
  (req, res) => {
  const row = viagemService.create(req.body, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'colheita', record_id: row?.id ?? null, action_type: 'create', new_values: row })
  res.status(201).json(row)
  },
)

// Recalcular colheitas com base nas regras atuais.
// Usado quando houve ajustes de regras/regras de negocio e precisa re-materializar campos calculados.
viagensRouter.post(
  '/recalcular-todas',
  requireCan(Modules.REGRAS_DESTINO, Actions.UPDATE),
  validateBody(RecalcAllBody),
  (req, res) => {
    const r = viagemService.recalcularTodas(req.body)
    res.status(201).json(r)
  },
)

viagensRouter.get(
  '/:id',
  requireCan(Modules.COLHEITA, Actions.VIEW),
  validateParams(S.IdParam),
  (req, res) => {
  const row = viagemRepo.get(req.params.id)
  if (!row) throw notFound('Viagem nao encontrada')
  res.json(row)
  },
)

viagensRouter.put(
  '/:id',
  requireCan(Modules.COLHEITA, Actions.UPDATE),
  validateParams(S.IdParam),
  validateBody(ViagemBody),
  (req, res) => {
  const id = req.params.id
  const exists = viagemRepo.get(id)
  if (!exists) throw notFound('Viagem nao encontrada')
  const row = viagemService.update(id, req.body, { user_id: req.user?.id })
  auditService.log(req, { module_name: 'colheita', record_id: id, action_type: 'update', old_values: exists, new_values: row })
  res.json(row)
  },
)

viagensRouter.delete(
  '/:id',
  requireCan(Modules.COLHEITA, Actions.DELETE),
  validateParams(S.IdParam),
  (req, res) => {
  const id = req.params.id
  const exists = viagemRepo.get(id)
  if (!exists) throw notFound('Viagem nao encontrada')
  auditService.log(req, { module_name: 'colheita', record_id: id, action_type: 'delete', old_values: exists })
  viagemRepo.remove(id)
  res.status(204).send()
  },
)

import { Router } from 'express'
import { z } from 'zod'
import { viagemRepo } from '../../repositories/viagemRepo.js'
import { notFound } from '../../errors.js'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { viagemService } from '../../services/viagemService.js'
import { requirePerm } from '../../middleware/auth.js'
import { Permissions } from '../../auth/permissions.js'

export const viagensRouter = Router()

const ViagemBody = z.object({
  ficha: z.union([
    z.string().trim().min(1).regex(/^[0-9]+$/),
    z.coerce.number().int().positive(),
  ]),
  safra_id: z.coerce.number().int().positive(),
  tipo_plantio: z.string().optional().nullable(),
  talhao_id: z.coerce.number().int().positive(),
  local: z.string().optional().nullable(),
  destino_id: z.coerce.number().int().positive(),
  motorista_id: z.coerce.number().int().positive(),
  placa: z.string().optional().nullable(),

  data_saida: z.string().optional().nullable(),
  hora_saida: z.string().optional().nullable(),
  data_entrega: z.string().optional().nullable(),
  hora_entrega: z.string().optional().nullable(),

  carga_total_kg: z.coerce.number().nonnegative(),
  tara_kg: z.coerce.number().nonnegative(),

  umidade_pct: z.coerce.number().min(0).optional().nullable(),
  umidade_desc_pct_manual: z.coerce.number().min(0).optional().nullable(),
  impureza_pct: z.coerce.number().min(0).optional().nullable(),
  ardidos_pct: z.coerce.number().min(0).optional().nullable(),
  queimados_pct: z.coerce.number().min(0).optional().nullable(),
  avariados_pct: z.coerce.number().min(0).optional().nullable(),
  esverdiados_pct: z.coerce.number().min(0).optional().nullable(),
  quebrados_pct: z.coerce.number().min(0).optional().nullable(),

  impureza_limite_pct: z.coerce.number().min(0).optional().nullable(),
  ardidos_limite_pct: z.coerce.number().min(0).optional().nullable(),
  queimados_limite_pct: z.coerce.number().min(0).optional().nullable(),
  avariados_limite_pct: z.coerce.number().min(0).optional().nullable(),
  esverdiados_limite_pct: z.coerce.number().min(0).optional().nullable(),
  quebrados_limite_pct: z.coerce.number().min(0).optional().nullable(),
})

const PreviewBody = ViagemBody.extend({
  id: z.coerce.number().int().positive().optional(),
})

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
  })
  res.json({ ...payload, trava })
  },
)

// Comparar sacas por destino (mesma safra + tipo de plantio)
const CompareBody = ViagemBody.extend({
  // quando estiver editando uma colheita, evita contar ela mesma no acumulado
  id: z.coerce.number().int().positive().optional(),
})

viagensRouter.post(
  '/comparar-destinos',
  requirePerm(Permissions.COLHEITA_READ),
  validateBody(CompareBody),
  (req, res) => {
    res.json(viagemService.compararDestinos(req.body))
  },
)

const ListQuery = z.object({
  safra_id: z.coerce.number().int().positive().optional(),
  talhao_id: z.coerce.number().int().positive().optional(),
  destino_id: z.coerce.number().int().positive().optional(),
  motorista_id: z.coerce.number().int().positive().optional(),
  de: z.string().optional(),
  ate: z.string().optional(),
})

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

const NextFichaQuery = z.object({
  safra_id: z.coerce.number().int().positive(),
})

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

const RecalcCompraBody = z.object({
  safra_id: z.coerce.number().int().positive(),
  destino_id: z.coerce.number().int().positive(),
  tipo_plantio: z.string().trim().min(1),
})

viagensRouter.post(
  '/recalcular-compra',
  requirePerm(Permissions.CONFIG_WRITE),
  validateBody(RecalcCompraBody),
  (req, res) => {
    const r = viagemService.recalcularPrecosCompraSilo(req.body)
    res.status(201).json(r)
  },
)

viagensRouter.get('/:id', requirePerm(Permissions.COLHEITA_READ), (req, res) => {
  const row = viagemRepo.get(Number(req.params.id))
  if (!row) throw notFound('Viagem nao encontrada')
  res.json(row)
})

viagensRouter.put(
  '/:id',
  requirePerm(Permissions.COLHEITA_WRITE),
  validateBody(ViagemBody),
  (req, res) => {
  const id = Number(req.params.id)
  const exists = viagemRepo.get(id)
  if (!exists) throw notFound('Viagem nao encontrada')
  res.json(viagemService.update(id, req.body))
  },
)

viagensRouter.delete('/:id', requirePerm(Permissions.COLHEITA_WRITE), (req, res) => {
  const id = Number(req.params.id)
  const exists = viagemRepo.get(id)
  if (!exists) throw notFound('Viagem nao encontrada')
  viagemRepo.remove(id)
  res.status(204).send()
})

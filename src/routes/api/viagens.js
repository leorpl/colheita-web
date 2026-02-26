import { Router } from 'express'
import { z } from 'zod'
import { viagemRepo } from '../../repositories/viagemRepo.js'
import { notFound } from '../../errors.js'
import { validateBody, validateQuery } from '../../middleware/validate.js'
import { viagemService } from '../../services/viagemService.js'

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

viagensRouter.post('/preview', validateBody(ViagemBody), async (req, res) => {
  const payload = await viagemService.buildPayload(req.body)
  const trava = await viagemService.getTravaStatus({
    destino_id: payload.destino_id,
    safra_id: payload.safra_id,
    sacas: payload.sacas,
  })
  res.json({ ...payload, trava })
})

const ListQuery = z.object({
  safra_id: z.coerce.number().int().positive().optional(),
  talhao_id: z.coerce.number().int().positive().optional(),
  destino_id: z.coerce.number().int().positive().optional(),
  motorista_id: z.coerce.number().int().positive().optional(),
  de: z.string().optional(),
  ate: z.string().optional(),
})

viagensRouter.get('/', validateQuery(ListQuery), async (req, res) => {
  const items = await viagemRepo.list(req.query)
  const totals = await viagemRepo.totals(req.query)
  res.json({ items, totals })
})

const NextFichaQuery = z.object({
  safra_id: z.coerce.number().int().positive(),
})

viagensRouter.get('/next-ficha', validateQuery(NextFichaQuery), async (req, res) => {
  res.json(await viagemService.nextFicha(Number(req.query.safra_id)))
})

viagensRouter.post('/', validateBody(ViagemBody), async (req, res) => {
  const row = await viagemService.create(req.body)
  res.status(201).json(row)
})

viagensRouter.get('/:id', async (req, res) => {
  const row = await viagemRepo.get(Number(req.params.id))
  if (!row) throw notFound('Viagem nao encontrada')
  res.json(row)
})

viagensRouter.put('/:id', validateBody(ViagemBody), async (req, res) => {
  const id = Number(req.params.id)
  const exists = await viagemRepo.get(id)
  if (!exists) throw notFound('Viagem nao encontrada')
  res.json(await viagemService.update(id, req.body))
})

viagensRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const exists = await viagemRepo.get(id)
  if (!exists) throw notFound('Viagem nao encontrada')
  await viagemRepo.remove(id)
  res.status(204).send()
})

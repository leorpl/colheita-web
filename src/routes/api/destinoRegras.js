import { Router } from 'express'
import { z } from 'zod'

import { validateBody, validateQuery } from '../../middleware/validate.js'
import { destinoRegraRepo } from '../../repositories/destinoRegraRepo.js'
import { normalizePercent100 } from '../../domain/normalize.js'

export const destinoRegrasRouter = Router()

const ListQuery = z.object({
  safra_id: z.coerce.number().int().positive(),
})

destinoRegrasRouter.get('/', validateQuery(ListQuery), async (req, res) => {
  res.json(await destinoRegraRepo.listBySafra({ safra_id: req.query.safra_id }))
})

const UpsertBody = z.object({
  safra_id: z.coerce.number().int().positive(),
  destino_id: z.coerce.number().int().positive(),
  tipo_plantio: z.string().trim().min(1),
  trava_sacas: z.union([z.coerce.number().min(0), z.null()]).optional().nullable(),

  custo_silo_por_saca: z.coerce.number().min(0).max(999999).optional().nullable(),
  custo_terceiros_por_saca: z.coerce.number().min(0).max(999999).optional().nullable(),

  impureza_limite_pct: z.coerce.number().min(0).max(100).optional().nullable(),
  ardidos_limite_pct: z.coerce.number().min(0).max(100).optional().nullable(),
  queimados_limite_pct: z.coerce.number().min(0).max(100).optional().nullable(),
  avariados_limite_pct: z.coerce.number().min(0).max(100).optional().nullable(),
  esverdiados_limite_pct: z.coerce.number().min(0).max(100).optional().nullable(),
  quebrados_limite_pct: z.coerce.number().min(0).max(100).optional().nullable(),

  umidade_faixas: z
    .array(
      z.object({
        umid_gt: z.coerce.number().min(0).max(100),
        umid_lte: z.coerce.number().min(0).max(100),
        desconto_pct: z.coerce.number().min(0).max(100),
        custo_secagem_por_saca: z.coerce.number().min(0).max(999999).optional(),
      }),
    )
    .optional(),
})

destinoRegrasRouter.post('/', validateBody(UpsertBody), async (req, res) => {
  const body = req.body
  const tipo_plantio = String(body.tipo_plantio)

  const base = {
    safra_id: body.safra_id,
    destino_id: body.destino_id,
    trava_sacas: body.trava_sacas ?? null,
    custo_silo_por_saca: Number(body.custo_silo_por_saca || 0),
    custo_terceiros_por_saca: Number(body.custo_terceiros_por_saca || 0),
    impureza_limite_pct: normalizePercent100(
      body.impureza_limite_pct ?? 0,
      'impureza_limite_pct',
    ),
    ardidos_limite_pct: normalizePercent100(
      body.ardidos_limite_pct ?? 0,
      'ardidos_limite_pct',
    ),
    queimados_limite_pct: normalizePercent100(
      body.queimados_limite_pct ?? 0,
      'queimados_limite_pct',
    ),
    avariados_limite_pct: normalizePercent100(
      body.avariados_limite_pct ?? 0,
      'avariados_limite_pct',
    ),
    esverdiados_limite_pct: normalizePercent100(
      body.esverdiados_limite_pct ?? 0,
      'esverdiados_limite_pct',
    ),
    quebrados_limite_pct: normalizePercent100(
      body.quebrados_limite_pct ?? 0,
      'quebrados_limite_pct',
    ),
  }

  const regra = await destinoRegraRepo.upsertPlantio({ ...base, tipo_plantio })

  if (body.umidade_faixas) {
    const faixasNorm = body.umidade_faixas.map((f) => ({
      umid_gt: normalizePercent100(f.umid_gt, 'umid_gt'),
      umid_lte: normalizePercent100(f.umid_lte, 'umid_lte'),
      desconto_pct: normalizePercent100(f.desconto_pct, 'desconto_pct'),
      custo_secagem_por_saca: Number(f.custo_secagem_por_saca || 0),
    }))
    await destinoRegraRepo.replaceUmidadeFaixasPlantio(regra.id, faixasNorm)
  }

  const faixas = await destinoRegraRepo.getUmidadeFaixasPlantio(regra.id)
  res.status(201).json({ ...regra, umidade_faixas: faixas })
})

const GetQuery = z.object({
  safra_id: z.coerce.number().int().positive(),
  destino_id: z.coerce.number().int().positive(),
  tipo_plantio: z.string().trim().min(1),
})

destinoRegrasRouter.get('/one', validateQuery(GetQuery), async (req, res) => {
  const tipo_plantio = String(req.query.tipo_plantio)

  const regra = await destinoRegraRepo.getBySafraDestinoPlantio({
    safra_id: req.query.safra_id,
    destino_id: req.query.destino_id,
    tipo_plantio,
  })

  if (!regra) return res.json(null)

  const faixas = await destinoRegraRepo.getUmidadeFaixasPlantio(regra.id)

  res.json({ ...regra, umidade_faixas: faixas })
})

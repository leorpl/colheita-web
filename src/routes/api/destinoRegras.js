import { Router } from 'express'

import { validateBody, validateQuery, validateParams } from '../../middleware/validate.js'
import { destinoRegraRepo } from '../../repositories/destinoRegraRepo.js'
import { normalizePercent100 } from '../../domain/normalize.js'
import { conflict, notFound } from '../../errors.js'
import { db } from '../../db/db.js'
import { requirePerm } from '../../middleware/auth.js'
import { Permissions } from '../../auth/permissions.js'
import { S, DestinoRegrasSchemas } from '../../validation/apiSchemas.js'

export const destinoRegrasRouter = Router()

const ListQuery = DestinoRegrasSchemas.ListQuery

destinoRegrasRouter.get(
  '/',
  requirePerm(Permissions.CONFIG_READ),
  validateQuery(ListQuery),
  (req, res) => {
  res.json(destinoRegraRepo.listBySafra({ safra_id: req.query.safra_id }))
  },
)

// Lista regras por safra+destino+plantio (nova UI)
const ListPlantioQuery = DestinoRegrasSchemas.ListPlantioQuery

destinoRegrasRouter.get(
  '/plantio',
  requirePerm(Permissions.CONFIG_READ),
  validateQuery(ListPlantioQuery),
  (req, res) => {
    res.json(destinoRegraRepo.listPlantio({ safra_id: req.query.safra_id }))
  },
)

destinoRegrasRouter.delete(
  '/plantio/:id',
  requirePerm(Permissions.CONFIG_WRITE),
  validateParams(S.IdParam),
  validateQuery(DestinoRegrasSchemas.DeletePlantioQuery),
  (req, res) => {
  const id = req.params.id
  const force = Number(req.query.force || 0) === 1

  const regra = destinoRegraRepo.getPlantioById(id)
  if (!regra) throw notFound('Regra (plantio) nao encontrada')

  const used = db
    .prepare(
      `SELECT COUNT(*) as c
       FROM viagem
       WHERE safra_id=@safra_id AND destino_id=@destino_id AND UPPER(tipo_plantio)=@tipo_plantio`,
    )
    .get({
      safra_id: regra.safra_id,
      destino_id: regra.destino_id,
      tipo_plantio: String(regra.tipo_plantio || '').trim().toUpperCase(),
    }).c

  if (!force && Number(used || 0) > 0) {
    throw conflict(
      'Esta regra ja foi usada na colheita. Excluir nao apaga as colheitas, mas pode afetar o preview e indicadores. Use force=1 para excluir mesmo assim.',
      {
        used_count: Number(used || 0),
        safra_id: regra.safra_id,
        destino_id: regra.destino_id,
        tipo_plantio: regra.tipo_plantio,
      },
    )
  }

  destinoRegraRepo.removePlantio(id)
  res.status(204).send()
  },
)

const UpsertBody = DestinoRegrasSchemas.UpsertBody

destinoRegrasRouter.post(
  '/',
  requirePerm(Permissions.CONFIG_WRITE),
  validateBody(UpsertBody),
  (req, res) => {
  const body = req.body
  const tipo_plantio = String(body.tipo_plantio)

  const base = {
    safra_id: body.safra_id,
    destino_id: body.destino_id,
    trava_sacas: body.trava_sacas ?? null,
    valor_compra_por_saca: Number(body.valor_compra_por_saca ?? 120),
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

  const regra = destinoRegraRepo.upsertPlantio({ ...base, tipo_plantio })

  if (body.umidade_faixas) {
    const faixasNorm = body.umidade_faixas.map((f) => ({
      umid_gt: normalizePercent100(f.umid_gt, 'umid_gt'),
      umid_lte: normalizePercent100(f.umid_lte, 'umid_lte'),
      desconto_pct: normalizePercent100(f.desconto_pct, 'desconto_pct'),
      custo_secagem_por_saca: Number(f.custo_secagem_por_saca || 0),
    }))
    destinoRegraRepo.replaceUmidadeFaixasPlantio(regra.id, faixasNorm)
  }

  if (body.compra_faixas) {
    const faixasNorm = body.compra_faixas
      .map((f) => ({
        sacas_gt: Number(f.sacas_gt || 0),
        sacas_lte: f.sacas_lte === null || f.sacas_lte === undefined ? null : Number(f.sacas_lte),
        preco_por_saca: Number(f.preco_por_saca || 0),
      }))
      .filter((f) => Number.isFinite(f.sacas_gt) && Number.isFinite(f.preco_por_saca))

    destinoRegraRepo.replaceCompraFaixasPlantio(regra.id, faixasNorm)
  }

  const faixas = destinoRegraRepo.getUmidadeFaixasPlantio(regra.id)
  const compra_faixas = destinoRegraRepo.getCompraFaixasPlantio(regra.id)
  res.status(201).json({ ...regra, umidade_faixas: faixas, compra_faixas })
  },
)

const GetQuery = DestinoRegrasSchemas.GetQuery

destinoRegrasRouter.get(
  '/one',
  requirePerm(Permissions.CONFIG_READ),
  validateQuery(GetQuery),
  (req, res) => {
  const tipo_plantio = String(req.query.tipo_plantio)

  const regra = destinoRegraRepo.getBySafraDestinoPlantio({
    safra_id: req.query.safra_id,
    destino_id: req.query.destino_id,
    tipo_plantio,
  })

  if (!regra) return res.json(null)

  const faixas = destinoRegraRepo.getUmidadeFaixasPlantio(regra.id)
  const compra_faixas = destinoRegraRepo.getCompraFaixasPlantio(regra.id)

    res.json({ ...regra, umidade_faixas: faixas, compra_faixas })
  },
)

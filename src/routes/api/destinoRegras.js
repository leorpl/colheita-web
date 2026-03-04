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

function normalizeCompraFaixasWithContrato({ compra_faixas, contrato_sacas, preco_padrao }) {
  const c = Number(contrato_sacas)
  if (!Number.isFinite(c) || c <= 0) return compra_faixas

  const faixas = Array.isArray(compra_faixas) ? [...compra_faixas] : []

  // Se nao vier tabela, cria 2 faixas (contrato e pos-contrato) com o preco informado.
  if (!faixas.length) {
    const p = Number(preco_padrao || 0)
    return [
      { sacas_gt: 0, sacas_lte: c, preco_por_saca: p },
      { sacas_gt: c, sacas_lte: null, preco_por_saca: p },
    ]
  }

  // Caso comum: 1 faixa "0 .. (sem limite)".
  // Se existir contrato, fecha a primeira em contrato e cria a faixa pos-contrato.
  if (faixas.length === 1) {
    const f0 = faixas[0]
    const gt0 = Number(f0?.sacas_gt || 0)
    const lte0 = f0?.sacas_lte === null || f0?.sacas_lte === undefined ? null : Number(f0.sacas_lte)
    const p0 = Number(f0?.preco_por_saca || 0)

    if (Number.isFinite(gt0) && gt0 <= 0 && (lte0 === null || !Number.isFinite(lte0))) {
      return [
        { sacas_gt: 0, sacas_lte: c, preco_por_saca: p0 },
        { sacas_gt: c, sacas_lte: null, preco_por_saca: p0 },
      ]
    }
  }

  return faixas
}

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

// Get regra (plantio) por id (editor)
destinoRegrasRouter.get(
  '/plantio/:id',
  requirePerm(Permissions.CONFIG_READ),
  validateParams(S.IdParam),
  (req, res) => {
    const id = req.params.id
    const regra = destinoRegraRepo.getPlantioById(id)
    if (!regra) throw notFound('Regra (plantio) nao encontrada')
    const faixas = destinoRegraRepo.getUmidadeFaixasPlantio(regra.id)
    const compra_faixas = destinoRegraRepo.getCompraFaixasPlantio(regra.id)
    res.json({ ...regra, umidade_faixas: faixas, compra_faixas })
  },
)

const UpsertBody = DestinoRegrasSchemas.UpsertBody

destinoRegrasRouter.post(
  '/',
  requirePerm(Permissions.CONFIG_WRITE),
  validateBody(UpsertBody),
  (req, res) => {
  const body = req.body
  const tipo_plantio = String(body.tipo_plantio || '').trim().toUpperCase()

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
    let faixasNorm = body.compra_faixas
      .map((f) => ({
        sacas_gt: Number(f.sacas_gt || 0),
        sacas_lte: f.sacas_lte === null || f.sacas_lte === undefined ? null : Number(f.sacas_lte),
        preco_por_saca: Number(f.preco_por_saca || 0),
      }))
      .filter((f) => Number.isFinite(f.sacas_gt) && Number.isFinite(f.preco_por_saca))

    faixasNorm = normalizeCompraFaixasWithContrato({
      compra_faixas: faixasNorm,
      contrato_sacas: base.trava_sacas,
      preco_padrao: base.valor_compra_por_saca,
    })

    destinoRegraRepo.replaceCompraFaixasPlantio(regra.id, faixasNorm)
  }

  const faixas = destinoRegraRepo.getUmidadeFaixasPlantio(regra.id)
  const compra_faixas = destinoRegraRepo.getCompraFaixasPlantio(regra.id)
  res.status(201).json({ ...regra, umidade_faixas: faixas, compra_faixas })
  },
)

// Update regra (plantio) por id: permite alterar safra/destino/tipo,
// mas bloqueia duplicacao (mesma safra+destino+tipo) com 409.
destinoRegrasRouter.put(
  '/plantio/:id',
  requirePerm(Permissions.CONFIG_WRITE),
  validateParams(S.IdParam),
  validateBody(UpsertBody),
  (req, res) => {
    const id = req.params.id
    const body = req.body
    const tipo_plantio = String(body.tipo_plantio || '').trim().toUpperCase()

    const exists = destinoRegraRepo.getPlantioById(id)
    if (!exists) throw notFound('Regra (plantio) nao encontrada')

    // conflito de identidade (duplicacao)
    const other = db
      .prepare(
        `SELECT id
         FROM destino_regra_plantio
         WHERE safra_id=@safra_id
           AND destino_id=@destino_id
           AND UPPER(tipo_plantio)=@tipo_plantio
           AND id <> @id
         LIMIT 1`,
      )
      .get({
        id,
        safra_id: body.safra_id,
        destino_id: body.destino_id,
        tipo_plantio,
      })

    if (other?.id) {
      throw conflict('Ja existe regra para esta safra/destino/tipo de plantio', {
        existing_id: Number(other.id),
      })
    }

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

    const tx = db.transaction(() => {
      destinoRegraRepo.updatePlantioById(id, { ...base, tipo_plantio })

      if (body.umidade_faixas) {
        const faixasNorm = body.umidade_faixas.map((f) => ({
          umid_gt: normalizePercent100(f.umid_gt, 'umid_gt'),
          umid_lte: normalizePercent100(f.umid_lte, 'umid_lte'),
          desconto_pct: normalizePercent100(f.desconto_pct, 'desconto_pct'),
          custo_secagem_por_saca: Number(f.custo_secagem_por_saca || 0),
        }))
        destinoRegraRepo.replaceUmidadeFaixasPlantio(Number(id), faixasNorm)
      }

      if (body.compra_faixas) {
        let faixasNorm = body.compra_faixas
          .map((f) => ({
            sacas_gt: Number(f.sacas_gt || 0),
            sacas_lte:
              f.sacas_lte === null || f.sacas_lte === undefined
                ? null
                : Number(f.sacas_lte),
            preco_por_saca: Number(f.preco_por_saca || 0),
          }))
          .filter((f) => Number.isFinite(f.sacas_gt) && Number.isFinite(f.preco_por_saca))

        faixasNorm = normalizeCompraFaixasWithContrato({
          compra_faixas: faixasNorm,
          contrato_sacas: base.trava_sacas,
          preco_padrao: base.valor_compra_por_saca,
        })

        destinoRegraRepo.replaceCompraFaixasPlantio(Number(id), faixasNorm)
      }

      const regra2 = destinoRegraRepo.getPlantioById(id)
      const faixas2 = destinoRegraRepo.getUmidadeFaixasPlantio(Number(id))
      const compra2 = destinoRegraRepo.getCompraFaixasPlantio(Number(id))
      return { ...regra2, umidade_faixas: faixas2, compra_faixas: compra2 }
    })

    res.json(tx())
  },
)

const GetQuery = DestinoRegrasSchemas.GetQuery

destinoRegrasRouter.get(
  '/one',
  requirePerm(Permissions.CONFIG_READ),
  validateQuery(GetQuery),
  (req, res) => {
  const tipo_plantio = String(req.query.tipo_plantio || '').trim().toUpperCase()

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

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

// compra por faixas removida (somente contrato)

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

    // Bloqueio de edicao: se a regra ja foi usada em colheitas,
    // nao permitir alterar para evitar efeitos retroativos.
    const used = db
      .prepare(
        `SELECT COUNT(*) as c
         FROM viagem v
         JOIN safra s ON s.id = v.safra_id
         WHERE v.safra_id=@safra_id
           AND v.destino_id=@destino_id
           AND UPPER(COALESCE(NULLIF(v.tipo_plantio, ''), NULLIF(s.plantio, ''))) = @tipo_plantio`,
      )
      .get({
        safra_id: regra.safra_id,
        destino_id: regra.destino_id,
        tipo_plantio: String(regra.tipo_plantio || '').trim().toUpperCase(),
      })?.c

    res.json({ ...regra, umidade_faixas: faixas, used_count: Number(used || 0) })
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

  // Se ja existe regra para esta combinacao e ela ja foi usada em colheitas,
  // bloquear alteracao (upsert atualizaria retroativamente).
  const existing = destinoRegraRepo.getBySafraDestinoPlantio({
    safra_id: body.safra_id,
    destino_id: body.destino_id,
    tipo_plantio,
  })
  if (existing) {
    const used = db
      .prepare(
        `SELECT COUNT(*) as c
         FROM viagem v
         JOIN safra s ON s.id = v.safra_id
         WHERE v.safra_id=@safra_id
           AND v.destino_id=@destino_id
           AND UPPER(COALESCE(NULLIF(v.tipo_plantio, ''), NULLIF(s.plantio, ''))) = @tipo_plantio`,
      )
      .get({
        safra_id: body.safra_id,
        destino_id: body.destino_id,
        tipo_plantio,
      })?.c

    if (Number(used || 0) > 0) {
      throw conflict(
        'Esta regra de destino ja esta sendo utilizada em registros de colheita.\nAlteracoes podem comprometer calculos historicos (ex.: umidade, descontos e limites).',
        {
          code: 'REGRA_DESTINO_EM_USO',
          used_count: Number(used || 0),
          safra_id: body.safra_id,
          destino_id: body.destino_id,
          tipo_plantio,
          orientacao: [
            'Corrigir os registros de colheita vinculados.',
            'Ou criar uma nova regra de destino.',
            'Ou copiar a safra para uma nova versao e ajustar os registros.',
          ],
          fluxo_seguro: [
            'Criar copia da safra com outro nome',
            'Ajustar as regras de destino da nova safra',
            'Alterar os registros de colheita para apontar para a nova safra/regra',
          ],
        },
      )
    }
  }

  const base = {
    safra_id: body.safra_id,
    destino_id: body.destino_id,
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

  const faixas = destinoRegraRepo.getUmidadeFaixasPlantio(regra.id)
  res.status(201).json({ ...regra, umidade_faixas: faixas })
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

    // Regra obrigatoria: se ja existe qualquer colheita vinculada a esta regra,
    // bloquear edicao para evitar alteracao retroativa.
    const used = db
      .prepare(
        `SELECT COUNT(*) as c
         FROM viagem v
         JOIN safra s ON s.id = v.safra_id
         WHERE v.safra_id=@safra_id
           AND v.destino_id=@destino_id
           AND UPPER(COALESCE(NULLIF(v.tipo_plantio, ''), NULLIF(s.plantio, ''))) = @tipo_plantio
           AND v.id IS NOT NULL`,
      )
      .get({
        safra_id: exists.safra_id,
        destino_id: exists.destino_id,
        tipo_plantio: String(exists.tipo_plantio || '').trim().toUpperCase(),
      })?.c

    if (Number(used || 0) > 0) {
      throw conflict(
        'Esta regra de destino ja esta sendo utilizada em registros de colheita.\nAlteracoes podem comprometer calculos historicos (ex.: umidade, descontos e limites).',
        {
          code: 'REGRA_DESTINO_EM_USO',
          used_count: Number(used || 0),
          safra_id: exists.safra_id,
          destino_id: exists.destino_id,
          tipo_plantio: String(exists.tipo_plantio || '').trim().toUpperCase(),
          orientacao: [
            'Corrigir os registros de colheita vinculados.',
            'Ou criar uma nova regra de destino.',
            'Ou copiar a safra para uma nova versao e ajustar os registros.',
          ],
          fluxo_seguro: [
            'Criar copia da safra com outro nome',
            'Ajustar as regras de destino da nova safra',
            'Alterar os registros de colheita para apontar para a nova safra/regra',
          ],
        },
      )
    }

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

      const regra2 = destinoRegraRepo.getPlantioById(id)
      const faixas2 = destinoRegraRepo.getUmidadeFaixasPlantio(Number(id))
      return { ...regra2, umidade_faixas: faixas2 }
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
    res.json({ ...regra, umidade_faixas: faixas })
  },
)

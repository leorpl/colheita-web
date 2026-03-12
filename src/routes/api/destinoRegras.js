import { Router } from 'express'
import multer from 'multer'
import XLSX from 'xlsx'

import { validateBody, validateQuery, validateParams } from '../../middleware/validate.js'
import { destinoRegraRepo } from '../../repositories/destinoRegraRepo.js'
import { normalizePercent100 } from '../../domain/normalize.js'
import { conflict, notFound } from '../../errors.js'
import { db } from '../../db/db.js'
import { requirePerm } from '../../middleware/auth.js'
import { Actions, Modules } from '../../auth/acl.js'
import { S, DestinoRegrasSchemas } from '../../validation/apiSchemas.js'
import { auditService } from '../../services/auditService.js'
import { xlsxExportService } from '../../services/xlsxExportService.js'

export const destinoRegrasRouter = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// compra por faixas removida (somente contrato)

const ListQuery = DestinoRegrasSchemas.ListQuery

destinoRegrasRouter.get(
  '/',
  requirePerm(Modules.REGRAS_DESTINO, Actions.VIEW),
  validateQuery(ListQuery),
  (req, res) => {
  res.json(destinoRegraRepo.listBySafra({ safra_id: req.query.safra_id }))
  },
)

// Lista regras por safra+destino+plantio (nova UI)
const ListPlantioQuery = DestinoRegrasSchemas.ListPlantioQuery

destinoRegrasRouter.get(
  '/umidade-template.xlsx',
  requirePerm(Modules.REGRAS_DESTINO, Actions.VIEW),
  (_req, res) => {
    const buf = xlsxExportService.aoaToXlsxBuffer({
      sheetName: 'Umidade',
      aoa: [
        ['umid_gt', 'umid_lte', 'desconto_pct', 'custo_secagem_por_saca'],
        [13, 14, 0.5, 0],
        [14, 15, 1.0, 0],
        [15, 16, 1.5, 0],
      ],
    })
    res.setHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('content-disposition', 'attachment; filename="modelo-umidade-destino.xlsx"')
    res.send(buf)
  },
)

destinoRegrasRouter.get(
  '/plantio/:id/umidade-template.xlsx',
  requirePerm(Modules.REGRAS_DESTINO, Actions.VIEW),
  validateParams(S.IdParam),
  (req, res) => {
    const regra = destinoRegraRepo.getPlantioById(req.params.id)
    if (!regra) throw notFound('Regra (plantio) nao encontrada')
    const faixas = destinoRegraRepo.getUmidadeFaixasPlantio(regra.id)
    const buf = xlsxExportService.aoaToXlsxBuffer({
      sheetName: 'Umidade',
      aoa: [
        ['umid_gt', 'umid_lte', 'desconto_pct', 'custo_secagem_por_saca'],
        ...faixas.map((f) => [
          Number(f.umid_gt || 0) * 100,
          Number(f.umid_lte || 0) * 100,
          Number(f.desconto_pct || 0) * 100,
          Number(f.custo_secagem_por_saca || 0),
        ]),
      ],
    })
    res.setHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('content-disposition', `attachment; filename="umidade-regra-${req.params.id}.xlsx"`)
    res.send(buf)
  },
)

destinoRegrasRouter.post(
  '/umidade-import-preview',
  requirePerm(Modules.REGRAS_DESTINO, Actions.UPDATE),
  upload.single('file'),
  (req, res) => {
    if (!req.file?.buffer) throw conflict('Arquivo Excel nao enviado')
    let wb
    try {
      wb = XLSX.read(req.file.buffer, { type: 'buffer' })
    } catch {
      throw conflict('Nao foi possivel ler o arquivo Excel enviado.')
    }
    const sheetName = wb.SheetNames?.[0]
    const ws = sheetName ? wb.Sheets[sheetName] : null
    if (!ws) throw conflict('A planilha nao possui aba valida.')
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })
    if (!Array.isArray(rows) || rows.length < 2) throw conflict('A planilha nao possui linhas suficientes para importar.')

    const header = rows[0].map((h) => String(h || '').trim().toLowerCase())
    const col = (names) => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1
    const idxGt = col(['umid_gt', 'umidade_gt', 'umid >', 'umid_gt (%)'])
    const idxLte = col(['umid_lte', 'umidade_lte', 'umid <=', 'umid_lte (%)'])
    const idxDesc = col(['desconto_pct', 'desconto', 'desconto (%)'])
    const idxCusto = col(['custo_secagem_por_saca', 'secagem', 'secagem (r$/sc)', 'custo'])
    if ([idxGt, idxLte, idxDesc].some((i) => i < 0)) {
      throw conflict('Colunas obrigatorias nao encontradas. Use o arquivo modelo para preencher a tabela.')
    }

    const toNum = (v) => {
      if (typeof v === 'number') return v
      const s = String(v || '').trim()
      if (!s) return NaN
      const cleaned = s.replace('%', '').replace(/\./g, '').replace(',', '.')
      return Number(cleaned)
    }
    const toPercent = (v) => {
      const n = toNum(v)
      if (!Number.isFinite(n)) return NaN
      // Excel often stores percent-formatted cells as fractions (e.g. 14% => 0.14).
      if (n >= 0 && n <= 1) return n * 100
      return n
    }
    const faixas = rows.slice(1)
      .map((r) => ({
        umid_gt: toPercent(r[idxGt]),
        umid_lte: toPercent(r[idxLte]),
        desconto_pct: toPercent(r[idxDesc]),
        custo_secagem_por_saca: idxCusto >= 0 ? toNum(r[idxCusto]) : 0,
      }))
      .filter((f) => Number.isFinite(f.umid_gt) && Number.isFinite(f.umid_lte) && Number.isFinite(f.desconto_pct))

    if (!faixas.length) throw conflict('Nenhuma faixa valida foi encontrada na planilha.')
    res.json({ file_name: req.file.originalname, count: faixas.length, faixas })
  },
)

destinoRegrasRouter.get(
  '/plantio',
  requirePerm(Modules.REGRAS_DESTINO, Actions.VIEW),
  validateQuery(ListPlantioQuery),
  (req, res) => {
    res.json(destinoRegraRepo.listPlantio({ safra_id: req.query.safra_id }))
  },
)

destinoRegrasRouter.delete(
  '/plantio/:id',
  requirePerm(Modules.REGRAS_DESTINO, Actions.DELETE),
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

  auditService.log(req, { module_name: 'regras-destino', record_id: id, action_type: 'delete', old_values: regra })
  destinoRegraRepo.removePlantio(id)
  res.status(204).send()
  },
)

// Get regra (plantio) por id (editor)
destinoRegrasRouter.get(
  '/plantio/:id',
  requirePerm(Modules.REGRAS_DESTINO, Actions.VIEW),
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
  requirePerm(Modules.REGRAS_DESTINO, Actions.UPDATE),
  validateBody(UpsertBody),
  (req, res) => {
  const body = req.body
  const tipo_plantio = String(body.tipo_plantio || '').trim().toUpperCase()

  // Se ja existe regra para esta combinacao, atualizar a mesma regra.
  // Alteracoes retroativas sao permitidas, mas a UI deve avisar e recalcular as colheitas vinculadas.
  const existing = destinoRegraRepo.getBySafraDestinoPlantio({
    safra_id: body.safra_id,
    destino_id: body.destino_id,
    tipo_plantio,
  })

  const base = {
    safra_id: body.safra_id,
    destino_id: body.destino_id,
    custo_silo_por_saca: Number(body.custo_silo_por_saca || 0),
    custo_terceiros_por_saca: Number(body.custo_terceiros_por_saca || 0),
    cobrar_secagem_no_silo: body.cobrar_secagem_no_silo === undefined ? 1 : (body.cobrar_secagem_no_silo ? 1 : 0),
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

  const oldRow = destinoRegraRepo.getBySafraDestinoPlantio({
    safra_id: body.safra_id,
    destino_id: body.destino_id,
    tipo_plantio,
  })

  const regra = destinoRegraRepo.upsertPlantio({ ...base, tipo_plantio }, { user_id: req.user?.id })

  if (body.umidade_faixas) {
    const faixasNorm = body.umidade_faixas.map((f) => ({
      umid_gt: normalizePercent100(f.umid_gt, 'umid_gt'),
      umid_lte: normalizePercent100(f.umid_lte, 'umid_lte'),
      desconto_pct: normalizePercent100(f.desconto_pct, 'desconto_pct'),
      custo_secagem_por_saca: Number(f.custo_secagem_por_saca || 0),
    }))
    destinoRegraRepo.replaceUmidadeFaixasPlantio(regra.id, faixasNorm, { user_id: req.user?.id })
  }

  const faixas = destinoRegraRepo.getUmidadeFaixasPlantio(regra.id)
  const out = { ...regra, umidade_faixas: faixas }
  auditService.log(req, {
    module_name: 'regras-destino',
    record_id: regra.id,
    action_type: oldRow ? 'update' : 'create',
    old_values: oldRow,
    new_values: out,
  })
  res.status(oldRow ? 200 : 201).json(out)
  },
)

// Update regra (plantio) por id: permite alterar safra/destino/tipo,
// mas bloqueia duplicacao (mesma safra+destino+tipo) com 409.
destinoRegrasRouter.put(
  '/plantio/:id',
  requirePerm(Modules.REGRAS_DESTINO, Actions.UPDATE),
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
      custo_silo_por_saca: Number(body.custo_silo_por_saca || 0),
      custo_terceiros_por_saca: Number(body.custo_terceiros_por_saca || 0),
      cobrar_secagem_no_silo: body.cobrar_secagem_no_silo === undefined ? 1 : (body.cobrar_secagem_no_silo ? 1 : 0),
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
      destinoRegraRepo.updatePlantioById(id, { ...base, tipo_plantio }, { user_id: req.user?.id })

      if (body.umidade_faixas) {
        const faixasNorm = body.umidade_faixas.map((f) => ({
          umid_gt: normalizePercent100(f.umid_gt, 'umid_gt'),
          umid_lte: normalizePercent100(f.umid_lte, 'umid_lte'),
          desconto_pct: normalizePercent100(f.desconto_pct, 'desconto_pct'),
          custo_secagem_por_saca: Number(f.custo_secagem_por_saca || 0),
        }))
        destinoRegraRepo.replaceUmidadeFaixasPlantio(Number(id), faixasNorm, { user_id: req.user?.id })
      }

      const regra2 = destinoRegraRepo.getPlantioById(id)
      const faixas2 = destinoRegraRepo.getUmidadeFaixasPlantio(Number(id))
      return { ...regra2, umidade_faixas: faixas2 }
    })

    const out = tx()
    auditService.log(req, { module_name: 'regras-destino', record_id: id, action_type: 'update', old_values: exists, new_values: out })
    res.json(out)
  },
)

const GetQuery = DestinoRegrasSchemas.GetQuery

destinoRegrasRouter.get(
  '/one',
  requirePerm(Modules.REGRAS_DESTINO, Actions.VIEW),
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

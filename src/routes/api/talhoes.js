import { Router } from 'express'
import multer from 'multer'
import { talhaoRepo } from '../../repositories/talhaoRepo.js'
import { conflict, notFound, unprocessable } from '../../errors.js'
import { validateBody, validateParams } from '../../middleware/validate.js'
import { requirePerm } from '../../middleware/auth.js'
import { Actions, Modules } from '../../auth/acl.js'
import { S, TalhaoSchemas } from '../../validation/apiSchemas.js'
import { auditService } from '../../services/auditService.js'
import { deleteDependencyService } from '../../services/deleteDependencyService.js'
import { buildTalhaoGeometryBulkPreview, getGeometryAreaHa, parseTalhaoGeometryUpload } from '../../services/talhaoGeometryService.js'

export const talhoesRouter = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } })

const TalhaoBody = TalhaoSchemas.Body

function withGeometryArea(row) {
  if (!row) return row
  return {
    ...row,
    geometry_area_ha: getGeometryAreaHa(row.geometry_geojson),
  }
}

talhoesRouter.get('/', requirePerm(Modules.TALHOES, Actions.VIEW), (_req, res) => {
  res.json(talhaoRepo.listWithGeometry().map(withGeometryArea))
})

talhoesRouter.post(
  '/geometry-preview',
  requirePerm(Modules.TALHOES, Actions.UPDATE),
  upload.single('file'),
  async (req, res) => {
    if (!req.file?.buffer) throw unprocessable('Arquivo .zip nao enviado')
    const out = await parseTalhaoGeometryUpload(req.file.buffer, req.file.originalname)
    res.json(out)
  },
)

talhoesRouter.post(
  '/geometry-bulk-preview',
  requirePerm(Modules.TALHOES, Actions.UPDATE),
  upload.single('file'),
  async (req, res) => {
    if (!req.file?.buffer) throw unprocessable('Arquivo .zip nao enviado')
    const parsed = await parseTalhaoGeometryUpload(req.file.buffer, req.file.originalname)
    const preview = buildTalhaoGeometryBulkPreview({
      talhoes: talhaoRepo.list(),
      candidates: parsed.candidates,
      source_name: parsed.source_name,
    })
    preview.unmatched_polygons = preview.unmatched_polygons.map((p) => {
      const c = parsed.candidates.find((x) => Number(x.index) === Number(p.candidate_index))
      return { ...p, feature: c?.feature || null }
    })
    res.json(preview)
  },
)

talhoesRouter.post(
  '/geometry-bulk-apply',
  requirePerm(Modules.TALHOES, Actions.UPDATE),
  upload.single('file'),
  async (req, res) => {
    if (!req.file?.buffer) throw unprocessable('Arquivo .zip nao enviado')
    const parsed = await parseTalhaoGeometryUpload(req.file.buffer, req.file.originalname)
    const preview = buildTalhaoGeometryBulkPreview({
      talhoes: talhaoRepo.list(),
      candidates: parsed.candidates,
      source_name: parsed.source_name,
    })

    let selectedIds = null
    try {
      if (req.body?.selected_ids_json) {
        const arr = JSON.parse(String(req.body.selected_ids_json || '[]'))
        if (Array.isArray(arr)) selectedIds = new Set(arr.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0))
      }
    } catch {
      throw unprocessable('Seleção de talhões inválida para atualização em lote.')
    }

    const matchesToApply = selectedIds
      ? preview.matched.filter((m) => selectedIds.has(Number(m.talhao_id)))
      : preview.matched

    const updated = []
    for (const m of matchesToApply) {
      const oldRow = talhaoRepo.get(m.talhao_id)
      if (!oldRow) continue
      const row = talhaoRepo.update(
        m.talhao_id,
        {
          ...oldRow,
          hectares: Number(m.area_ha || oldRow.hectares || 0),
          geometry_geojson: m.geometry_geojson,
          geometry_props_json: m.geometry_props_json,
          geometry_source_name: m.geometry_source_name,
          maps_url: null,
        },
        { user_id: req.user?.id },
      )
      auditService.log(req, {
        module_name: 'talhoes',
        record_id: m.talhao_id,
        action_type: 'update',
        old_values: oldRow,
        new_values: row,
        notes: `atualizacao em lote de georreferenciamento (${parsed.source_name})`,
      })
      updated.push({ id: row.id, codigo: row.codigo, nome: row.nome || '' })
    }

    res.json({
      source_name: parsed.source_name,
      detected_count: parsed.count,
      updated_count: updated.length,
      updated,
      unmatched_talhoes: preview.unmatched_talhoes,
      unmatched_polygons: preview.unmatched_polygons,
    })
  },
)

talhoesRouter.post(
  '/',
  requirePerm(Modules.TALHOES, Actions.CREATE),
  validateBody(TalhaoBody),
  (req, res) => {
  const row = withGeometryArea(talhaoRepo.create(req.body, { user_id: req.user?.id }))
  auditService.log(req, { module_name: 'talhoes', record_id: row.id, action_type: 'create', new_values: row })
  res.status(201).json(row)
  },
)

talhoesRouter.get(
  '/:id',
  requirePerm(Modules.TALHOES, Actions.VIEW),
  validateParams(S.IdParam),
  (req, res) => {
  const row = withGeometryArea(talhaoRepo.get(req.params.id))
  if (!row) throw notFound('Talhao nao encontrado')
  res.json(row)
  },
)

talhoesRouter.put(
  '/:id',
  requirePerm(Modules.TALHOES, Actions.UPDATE),
  validateParams(S.IdParam),
  validateBody(TalhaoBody),
  (req, res) => {
  const id = req.params.id
  const exists = talhaoRepo.get(id)
  if (!exists) throw notFound('Talhao nao encontrado')
  if (req.body.expected_updated_at && String(exists.updated_at || '') !== String(req.body.expected_updated_at || '')) {
    throw conflict('Este talhão foi alterado por outra pessoa. Reabra o cadastro antes de salvar novamente.', {
      code: 'STALE_RECORD',
      current_updated_at: exists.updated_at || null,
    })
  }
  const row = withGeometryArea(talhaoRepo.update(id, req.body, { user_id: req.user?.id }))
  auditService.log(req, { module_name: 'talhoes', record_id: id, action_type: 'update', old_values: exists, new_values: row })
  res.json(row)
  },
)

talhoesRouter.delete(
  '/:id',
  requirePerm(Modules.TALHOES, Actions.DELETE),
  validateParams(S.IdParam),
  (req, res) => {
  const id = req.params.id
  const exists = talhaoRepo.get(id)
  if (!exists) throw notFound('Talhao nao encontrado')
  deleteDependencyService.assertCanDeleteTalhao(Number(id))
  auditService.log(req, { module_name: 'talhoes', record_id: id, action_type: 'delete', old_values: exists })
  talhaoRepo.remove(id, { user_id: req.user?.id })
  res.status(204).send()
  },
)

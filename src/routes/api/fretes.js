import { Router } from 'express'
import { freteRepo } from '../../repositories/freteRepo.js'
import { validateBody, validateParams } from '../../middleware/validate.js'
import { notFound } from '../../errors.js'
import { requirePerm } from '../../middleware/auth.js'
import { Actions, Modules } from '../../auth/acl.js'
import { S, FreteSchemas } from '../../validation/apiSchemas.js'
import { auditService } from '../../services/auditService.js'
import { db } from '../../db/db.js'
import { deleteDependencyService } from '../../services/deleteDependencyService.js'

export const fretesRouter = Router()

const FreteUpsertBody = FreteSchemas.UpsertBody

fretesRouter.get('/', requirePerm(Modules.FRETES, Actions.VIEW), (_req, res) => {
  res.json(freteRepo.list())
})

fretesRouter.post(
  '/',
  requirePerm(Modules.FRETES, Actions.UPDATE),
  validateBody(FreteUpsertBody),
  (req, res) => {
  // best-effort old snapshot
  const oldRow = (() => {
    try {
      return db
        .prepare('SELECT * FROM frete WHERE safra_id=? AND motorista_id=? AND destino_id=?')
        .get(req.body.safra_id, req.body.motorista_id, req.body.destino_id)
    } catch {
      return null
    }
  })()

  const row = freteRepo.upsert(req.body, { user_id: req.user?.id })
  auditService.log(req, {
    module_name: 'fretes',
    record_id: row?.id ?? null,
    action_type: oldRow ? 'update' : 'create',
    old_values: oldRow,
    new_values: row,
  })
  res.status(201).json(row)
  },
)

const CopySafraBody = FreteSchemas.CopySafraBody
const BulkDeleteSafraBody = FreteSchemas.BulkDeleteSafraBody

fretesRouter.post(
  '/copiar-safra',
  requirePerm(Modules.FRETES, Actions.UPDATE),
  validateBody(CopySafraBody),
  (req, res) => {
  const { from_safra_id, to_safra_id } = req.body
  const r = freteRepo.copySafra({ from_safra_id, to_safra_id })
  auditService.log(req, { module_name: 'fretes', record_id: null, action_type: 'create', notes: `copiou safra ${from_safra_id} -> ${to_safra_id}` })
  res.status(201).json(r)
  },
)

fretesRouter.post(
  '/bulk-delete-safra',
  requirePerm(Modules.FRETES, Actions.DELETE),
  validateBody(BulkDeleteSafraBody),
  (req, res) => {
    const safra_id = Number(req.body.safra_id)
    const selected = Array.isArray(req.body.items) ? req.body.items : []
    const rowsAll = freteRepo.listBySafra(safra_id)
    const wanted = new Set(
      selected.map((x) => `${Number(x.motorista_id)}:${Number(x.destino_id)}`),
    )
    const rows = wanted.size
      ? rowsAll.filter((r) => wanted.has(`${Number(r.motorista_id)}:${Number(r.destino_id)}`))
      : rowsAll

    db.exec('BEGIN')
    try {
      for (const row of rows) {
        deleteDependencyService.assertCanDeleteFrete(Number(row.id))
      }
      for (const row of rows) {
        auditService.log(req, {
          module_name: 'fretes',
          record_id: row.id,
          action_type: 'delete',
          old_values: row,
          notes: `exclusao em lote da safra ${safra_id}`,
        })
        freteRepo.remove(row.id)
      }
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }

    res.json({ deleted: rows.length })
  },
)

const BulkUpsertBody = FreteSchemas.BulkUpsertBody
const BulkSaveBody = FreteSchemas.BulkSaveBody

fretesRouter.post(
  '/bulk-upsert',
  requirePerm(Modules.FRETES, Actions.UPDATE),
  validateBody(BulkUpsertBody),
  (req, res) => {
  const { safra_id, items } = req.body
  const r = freteRepo.bulkUpsert({ safra_id, items })
  auditService.log(req, { module_name: 'fretes', record_id: null, action_type: 'update', notes: `bulk-upsert safra ${safra_id} (${Array.isArray(items) ? items.length : 0} itens)` })
  res.status(201).json(r)
  },
)

fretesRouter.post(
  '/bulk-save',
  requirePerm(Modules.FRETES, Actions.UPDATE),
  validateBody(BulkSaveBody),
  (req, res) => {
    const { safra_id, items, delete_items } = req.body
    const upserts = Array.isArray(items) ? items : []
    const deletes = Array.isArray(delete_items) ? delete_items : []

    db.exec('BEGIN')
    try {
      for (const d of deletes) {
        const row = freteRepo.getByKey({
          safra_id,
          motorista_id: d.motorista_id,
          destino_id: d.destino_id,
        })
        if (!row) continue
        deleteDependencyService.assertCanDeleteFrete(Number(row.id))
        auditService.log(req, { module_name: 'fretes', record_id: row.id, action_type: 'delete', old_values: row })
        freteRepo.remove(row.id)
      }

      for (const r of upserts) {
        const oldRow = freteRepo.getByKey({
          safra_id,
          motorista_id: r.motorista_id,
          destino_id: r.destino_id,
        })
        const row = freteRepo.upsert({ safra_id, ...r }, { user_id: req.user?.id })
        auditService.log(req, {
          module_name: 'fretes',
          record_id: row?.id ?? null,
          action_type: oldRow ? 'update' : 'create',
          old_values: oldRow,
          new_values: row,
        })
      }

      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }

    res.status(201).json({ upserted: upserts.length, deleted: deletes.length })
  },
)

fretesRouter.delete(
  '/:id',
  requirePerm(Modules.FRETES, Actions.DELETE),
  validateParams(S.IdParam),
  (req, res) => {
  const id = req.params.id
  const exists = freteRepo.get(id)
  if (!exists) throw notFound('Frete nao encontrado')
  deleteDependencyService.assertCanDeleteFrete(Number(id))
  auditService.log(req, { module_name: 'fretes', record_id: id, action_type: 'delete', old_values: exists })
  freteRepo.remove(id)
  res.status(204).send()
  },
)

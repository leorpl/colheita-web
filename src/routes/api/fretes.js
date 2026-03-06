import { Router } from 'express'
import { freteRepo } from '../../repositories/freteRepo.js'
import { validateBody, validateParams } from '../../middleware/validate.js'
import { notFound } from '../../errors.js'
import { requirePerm } from '../../middleware/auth.js'
import { Permissions } from '../../auth/permissions.js'
import { S, FreteSchemas } from '../../validation/apiSchemas.js'
import { auditService } from '../../services/auditService.js'
import { db } from '../../db/db.js'

export const fretesRouter = Router()

const FreteUpsertBody = FreteSchemas.UpsertBody

fretesRouter.get('/', requirePerm(Permissions.CONFIG_READ), (_req, res) => {
  res.json(freteRepo.list())
})

fretesRouter.post(
  '/',
  requirePerm(Permissions.CONFIG_WRITE),
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

fretesRouter.post(
  '/copiar-safra',
  requirePerm(Permissions.CONFIG_WRITE),
  validateBody(CopySafraBody),
  (req, res) => {
  const { from_safra_id, to_safra_id } = req.body
  const r = freteRepo.copySafra({ from_safra_id, to_safra_id })
  auditService.log(req, { module_name: 'fretes', record_id: null, action_type: 'create', notes: `copiou safra ${from_safra_id} -> ${to_safra_id}` })
  res.status(201).json(r)
  },
)

const BulkUpsertBody = FreteSchemas.BulkUpsertBody

fretesRouter.post(
  '/bulk-upsert',
  requirePerm(Permissions.CONFIG_WRITE),
  validateBody(BulkUpsertBody),
  (req, res) => {
  const { safra_id, items } = req.body
  const r = freteRepo.bulkUpsert({ safra_id, items })
  auditService.log(req, { module_name: 'fretes', record_id: null, action_type: 'update', notes: `bulk-upsert safra ${safra_id} (${Array.isArray(items) ? items.length : 0} itens)` })
  res.status(201).json(r)
  },
)

fretesRouter.delete(
  '/:id',
  requirePerm(Permissions.CONFIG_WRITE),
  validateParams(S.IdParam),
  (req, res) => {
  const id = req.params.id
  const exists = freteRepo.get(id)
  if (!exists) throw notFound('Frete nao encontrado')
  auditService.log(req, { module_name: 'fretes', record_id: id, action_type: 'delete', old_values: exists })
  freteRepo.remove(id)
  res.status(204).send()
  },
)

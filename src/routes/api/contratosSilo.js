import { Router } from 'express'

import { validateBody, validateQuery } from '../../middleware/validate.js'
import { requirePerm } from '../../middleware/auth.js'
import { Actions, Modules } from '../../auth/acl.js'
import { contratoSiloRepo } from '../../repositories/contratoSiloRepo.js'
import { z } from 'zod'
import { auditService } from '../../services/auditService.js'

export const contratosSiloRouter = Router()

const ListQuery = z.object({
  safra_id: z.coerce.number().int().positive().optional(),
})

const OneQuery = z.object({
  safra_id: z.coerce.number().int().positive(),
  destino_id: z.coerce.number().int().positive(),
  tipo_plantio: z.string().trim().min(1).max(40),
})

const UpsertBody = z.object({
  safra_id: z.coerce.number().int().positive(),
  destino_id: z.coerce.number().int().positive(),
  tipo_plantio: z.string().trim().min(1).max(40),
  faixas: z
    .array(
      z.object({
        sacas: z.coerce.number().positive().max(9_999_999),
        preco_por_saca: z.coerce.number().min(0).max(999_999),
      }),
    )
    .max(50)
    .default([]),
  observacoes: z.string().trim().max(4000).optional().nullable(),
})

contratosSiloRouter.get(
  '/',
  requirePerm(Modules.REGRAS_DESTINO, Actions.VIEW),
  validateQuery(ListQuery),
  (req, res) => {
    res.json(contratoSiloRepo.list({ safra_id: req.query.safra_id }))
  },
)

contratosSiloRouter.get(
  '/one',
  requirePerm(Modules.REGRAS_DESTINO, Actions.VIEW),
  validateQuery(OneQuery),
  (req, res) => {
    res.json(
      contratoSiloRepo.getOne({
        safra_id: req.query.safra_id,
        destino_id: req.query.destino_id,
        tipo_plantio: req.query.tipo_plantio,
      }),
    )
  },
)

contratosSiloRouter.post(
  '/',
  requirePerm(Modules.REGRAS_DESTINO, Actions.UPDATE),
  validateBody(UpsertBody),
  (req, res) => {
    const oldRow = contratoSiloRepo.getOne(req.body)
    const row = contratoSiloRepo.replaceFaixas(req.body, { user_id: req.user?.id })
    auditService.log(req, {
      module_name: 'contratos-silo',
      record_id: row?.id ?? oldRow?.id ?? null,
      action_type: oldRow ? (row ? 'update' : 'delete') : 'create',
      old_values: oldRow,
      new_values: row,
    })
    res.status(201).json(row)
  },
)

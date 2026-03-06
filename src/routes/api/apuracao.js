import { Router } from 'express'

import { validateBody, validateQuery } from '../../middleware/validate.js'
import { requirePerm } from '../../middleware/auth.js'
import { Actions, Modules } from '../../auth/acl.js'
import { ProducaoSchemas } from '../../validation/apiSchemas.js'
import { z } from 'zod'
import { participanteSacasMovRepo } from '../../repositories/participanteSacasMovRepo.js'
import { producaoService } from '../../services/producaoService.js'
import { auditService } from '../../services/auditService.js'

export const apuracaoRouter = Router()

apuracaoRouter.get(
  '/saldo/participantes',
  requirePerm(Modules.PRODUCAO, Actions.VIEW),
  validateQuery(ProducaoSchemas.ApuracaoQuery),
  (req, res) => {
    res.json(participanteSacasMovRepo.saldoPorParticipante({ safra_id: req.query.safra_id }))
  },
)

apuracaoRouter.get(
  '/saldo/talhoes',
  requirePerm(Modules.PRODUCAO, Actions.VIEW),
  validateQuery(ProducaoSchemas.ApuracaoQuery),
  (req, res) => {
    res.json(participanteSacasMovRepo.saldoPorTalhao({ safra_id: req.query.safra_id }))
  },
)

apuracaoRouter.get(
  '/extrato',
  requirePerm(Modules.PRODUCAO, Actions.VIEW),
  validateQuery(
    ProducaoSchemas.ApuracaoQuery.extend({
      participante_id: z.coerce.number().int().positive().optional(),
      talhao_id: z.coerce.number().int().positive().optional(),
    }),
  ),
  (req, res) => {
    res.json(
      participanteSacasMovRepo.extrato({
        safra_id: req.query.safra_id,
        participante_id: req.query.participante_id,
        talhao_id: req.query.talhao_id,
      }),
    )
  },
)

apuracaoRouter.get(
  '/pendencias',
  requirePerm(Modules.PRODUCAO, Actions.VIEW),
  validateQuery(ProducaoSchemas.ApuracaoQuery),
  (req, res) => {
    res.json(participanteSacasMovRepo.pendenciasPreco({ safra_id: req.query.safra_id }))
  },
)

apuracaoRouter.post(
  '/reapurar',
  requirePerm(Modules.PRODUCAO, Actions.UPDATE),
  validateBody(ProducaoSchemas.ApuracaoQuery),
  (req, res) => {
    const stats = producaoService.reapurarSafra({ safra_id: req.body.safra_id, user_id: req.user?.id })
    auditService.log(req, { module_name: 'apuracao', record_id: Number(req.body.safra_id), action_type: 'reapurar', new_values: stats })
    res.json({ ok: true, stats })
  },
)

import { Router } from 'express'
import { z } from 'zod'

import { requireAuth } from '../../middleware/auth.js'
import { validateBody } from '../../middleware/validate.js'
import { userNotificationPrefRepo } from '../../repositories/userNotificationPrefRepo.js'
import { auditService } from '../../services/auditService.js'

export const notificationsRouter = Router()

notificationsRouter.get('/preferences', requireAuth, (req, res) => {
  res.json({
    user_id: req.user.id,
    prefs: userNotificationPrefRepo.listByUser(req.user.id),
  })
})

const PrefRow = z.object({
  module: z.string().trim().min(1).max(60),
  notify_create: z.coerce.boolean().optional().default(false),
  notify_update: z.coerce.boolean().optional().default(false),
  notify_delete: z.coerce.boolean().optional().default(false),
  notify_status_change: z.coerce.boolean().optional().default(false),
  notify_security_events: z.coerce.boolean().optional().default(false),
  delivery_mode: z.string().trim().optional().default('immediate'),
})

const Body = z.object({
  prefs: z.array(PrefRow).max(200),
})

notificationsRouter.put('/preferences', requireAuth, validateBody(Body), (req, res) => {
  const before = userNotificationPrefRepo.listByUser(req.user.id)
  const after = userNotificationPrefRepo.replaceForUser(req.user.id, req.body.prefs)
  auditService.log(req, {
    module_name: 'notificacoes',
    record_id: req.user.id,
    action_type: 'update',
    old_values: { prefs: before },
    new_values: { prefs: after },
    notes: 'preferencias de notificacao',
  })
  res.json({ ok: true, prefs: after })
})

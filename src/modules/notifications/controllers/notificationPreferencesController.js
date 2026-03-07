import { userNotificationPrefRepo } from '../../../repositories/userNotificationPrefRepo.js'
import { auditService } from '../../../services/auditService.js'

export function getPreferences(req, res) {
  res.json({
    user_id: req.user.id,
    prefs: userNotificationPrefRepo.listByUser(req.user.id),
  })
}

export function updatePreferences(req, res) {
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
}

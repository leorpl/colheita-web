import { Router } from 'express'

import { requireAuth } from '../../../middleware/auth.js'
import { validateBody } from '../../../middleware/validate.js'
import {
  getPreferences,
  updatePreferences,
} from '../controllers/notificationPreferencesController.js'
import { UpdatePreferencesBody } from '../validators/notificationPreferencesSchemas.js'

export const notificationsRouter = Router()

notificationsRouter.get('/preferences', requireAuth, getPreferences)

notificationsRouter.put(
  '/preferences',
  requireAuth,
  validateBody(UpdatePreferencesBody),
  updatePreferences,
)

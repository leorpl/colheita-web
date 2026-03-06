import { Router } from 'express'

import { requireAuth } from '../../middleware/auth.js'
import { env } from '../../config/env.js'

export const comunicacaoRouter = Router()

comunicacaoRouter.get('/webmail', requireAuth, (_req, res) => {
  res.json({
    url: String(env.WEBMAIL_URL || '').trim() || null,
    label: String(env.WEBMAIL_LABEL || '').trim() || 'Webmail da fazenda',
    hint: String(env.WEBMAIL_HINT || '').trim() || null,
  })
})

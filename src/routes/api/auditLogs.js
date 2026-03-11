import { Router } from 'express'

import { validateParams, validateQuery } from '../../middleware/validate.js'
import { requireCan } from '../../middleware/auth.js'
import { Actions, Modules } from '../../auth/acl.js'
import { notFound } from '../../errors.js'
import { auditLogRepo } from '../../repositories/auditLogRepo.js'
import { S } from '../../validation/apiSchemas.js'
import { z } from 'zod'

export const auditLogsRouter = Router()

auditLogsRouter.use(requireCan(Modules.AUDITORIA, Actions.VIEW))

const ListQuery = z.object({
  module_name: z.string().trim().max(60).optional(),
  action_type: z.string().trim().max(60).optional(),
  user_id: z.coerce.number().int().positive().optional(),
  record_id: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(120).optional(),
  de: z.string().trim().max(30).optional(),
  ate: z.string().trim().max(30).optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
})

const PageQuery = ListQuery.extend({
  offset: z.coerce.number().int().min(0).max(200000).optional(),
  sort_key: z.string().trim().max(40).optional(),
  sort_dir: z.string().trim().max(6).optional(),
  critical: z.coerce.number().int().min(0).max(1).optional(),
})

const StatsQuery = z.object({
  de: z.string().trim().max(30).optional(),
  ate: z.string().trim().max(30).optional(),
  module_name: z.string().trim().max(60).optional(),
  user_id: z.coerce.number().int().positive().optional(),
})

auditLogsRouter.get('/', validateQuery(ListQuery), (req, res) => {
  res.json(auditLogRepo.list(req.query))
})

auditLogsRouter.get('/page', validateQuery(PageQuery), (req, res) => {
  const total = auditLogRepo.count(req.query)
  const items = auditLogRepo.listPage(req.query)
  res.json({ total, items })
})

auditLogsRouter.get('/stats', validateQuery(StatsQuery), (req, res) => {
  res.json(auditLogRepo.stats(req.query))
})

auditLogsRouter.get('/recent-logins', (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 50)
  res.json(auditLogRepo.recentLogins(limit))
})

auditLogsRouter.get('/export.csv', validateQuery(ListQuery), (req, res) => {
  const rows = auditLogRepo.list({ ...req.query, limit: Math.min(Number(req.query.limit || 2000), 2000) })

  const esc = (v) => {
    const s = String(v ?? '')
    if (/[";\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`
    return s
  }

  const header = [
    'id',
    'created_at',
    'user',
    'module',
    'record_id',
    'action',
    'summary',
    'ip',
  ]

  const lines = [header.join(';')]
  for (const r of rows || []) {
    const who = r.changed_by_nome || r.changed_by_username || r.changed_by_name_snapshot || ''
    lines.push(
      [
        r.id,
        r.created_at,
        who,
        r.module_name,
        r.record_id ?? '',
        r.action_type,
        r.summary || '',
        r.ip_address || '',
      ]
        .map(esc)
        .join(';'),
    )
  }

  res.setHeader('content-type', 'text/csv; charset=utf-8')
  res.setHeader('content-disposition', 'attachment; filename="auditoria.csv"')
  res.send(lines.join('\n'))
})

auditLogsRouter.get('/:id', validateParams(S.IdParam), (req, res) => {
  const row = auditLogRepo.get(req.params.id)
  if (!row) throw notFound('Log nao encontrado')
  res.json(row)
})

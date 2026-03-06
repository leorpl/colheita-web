import { db } from '../db/db.js'
import { env } from '../config/env.js'
import { logger } from '../logger.js'
import { Roles } from '../auth/permissions.js'
import { userNotificationPrefRepo } from '../repositories/userNotificationPrefRepo.js'
import { emailNotificationSentRepo } from '../repositories/emailNotificationSentRepo.js'
import { sendSystemEmail } from './mailer.js'

function normKey(x) {
  return String(x || '').trim().toLowerCase()
}

function isSecurityAction(action_type) {
  const a = normKey(action_type)
  return ['permission_change', 'password_reset', 'login_failed'].includes(a)
}

function actionPrefField(action_type) {
  const a = normKey(action_type)
  if (a === 'create') return 'notify_create'
  if (a === 'update') return 'notify_update'
  if (a === 'delete') return 'notify_delete'
  if (a === 'status_change') return 'notify_status_change'
  if (isSecurityAction(a)) return 'notify_security_events'
  return null
}

function baseUrlFromReq(req) {
  const conf = String(env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '')
  if (conf) return conf
  try {
    const host = req?.get ? req.get('host') : ''
    const proto = req?.protocol || 'http'
    if (host) return `${proto}://${host}`
  } catch {
    // ignore
  }
  return ''
}

function jumpHashForAudit(a) {
  const mod = normKey(a.module_name)
  const rid = a.record_id === null || a.record_id === undefined ? null : Number(a.record_id)
  if (!rid) return null
  if (mod === 'colheita') return `#/colheita?edit_id=${rid}`
  if (mod === 'viagens') return `#/colheita?edit_id=${rid}`
  if (mod === 'regras-destino') return `#/regras-destino?edit_id=${rid}`
  if (mod === 'contratos-silo') return `#/regras-destino?edit_id=${rid}`
  if (mod === 'usuarios') return `#/usuarios?edit_id=${rid}`
  if (mod === 'safras') return `#/safras?edit_id=${rid}`
  if (mod === 'talhoes') return `#/talhoes?edit_id=${rid}`
  if (mod === 'destinos') return `#/destinos?edit_id=${rid}`
  if (mod === 'motoristas') return `#/motoristas?edit_id=${rid}`
  if (mod === 'fretes') return `#/fretes?edit_id=${rid}`
  if (mod === 'tipos-plantio') return `#/tipos-plantio?edit_id=${rid}`
  return null
}

function pickPref(mapByModule, module_name) {
  const mod = normKey(module_name)
  return mapByModule.get(mod) || mapByModule.get('*') || null
}

function toPrefMap(rows) {
  const m = new Map()
  for (const r of rows || []) {
    m.set(normKey(r.module), r)
  }
  return m
}

function summarizeFields(changed_fields_json) {
  if (!changed_fields_json) return []
  try {
    const arr = JSON.parse(changed_fields_json)
    if (!Array.isArray(arr)) return []
    return arr
      .slice(0, 10)
      .map((x) => {
        const k = String(x?.key || '').trim()
        const from = x?.from
        const to = x?.to
        if (!k) return null
        return { key: k, from, to }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

function fmtWhen(ts) {
  return String(ts || '').replace('T', ' ')
}

export const emailNotificationService = {
  async notifyAudit(req, auditRow) {
    const a = auditRow || null
    if (!a) return

    const prefField = actionPrefField(a.action_type)
    if (!prefField) return

    // never email about notifications themselves (avoid loops)
    if (normKey(a.module_name) === 'notificacoes') return
    if (normKey(a.module_name) === 'audit') return

    const recipients = db
      .prepare(
        `SELECT id, username, nome, email, role, active
         FROM usuario
         WHERE active=1
           AND email IS NOT NULL
           AND TRIM(email) <> ''`,
      )
      .all()

    if (!recipients.length) return

    const actorName = String(a.changed_by_nome || a.changed_by_username || a.changed_by_name_snapshot || '').trim() || '-'
    const baseUrl = baseUrlFromReq(req)
    const hash = jumpHashForAudit(a)
    const link = baseUrl && hash ? `${baseUrl}/${hash}` : null

    const fields = summarizeFields(a.changed_fields_json)
    const fieldLines = fields.map((f) => `- ${f.key}: ${String(f.from ?? '')} -> ${String(f.to ?? '')}`).join('\n')

    const subject = `[NazcaTraker] ${String(a.module_name || '').toUpperCase()} ${String(a.action_type || '').toUpperCase()}${a.record_id != null ? ` #${a.record_id}` : ''}`

    const text = [
      `Modulo: ${a.module_name}`,
      `Acao: ${a.action_type}`,
      `Registro: ${a.record_id == null ? '-' : a.record_id}`,
      `Por: ${actorName}`,
      `Quando: ${fmtWhen(a.created_at)}`,
      a.summary ? `Resumo: ${a.summary}` : null,
      fields.length ? `\nAlteracoes:\n${fieldLines}` : null,
      link ? `\nAbrir no sistema: ${link}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.4">
        <h2 style="margin:0 0 10px">${String(a.module_name || '').toUpperCase()} - ${String(a.action_type || '').toUpperCase()}</h2>
        <div><b>Registro:</b> ${a.record_id == null ? '-' : a.record_id}</div>
        <div><b>Por:</b> ${actorName}</div>
        <div><b>Quando:</b> ${escapeHtml(fmtWhen(a.created_at))}</div>
        <div><b>Modulo:</b> ${escapeHtml(String(a.module_name || ''))}</div>
        ${a.summary ? `<div style="margin-top:8px"><b>Resumo:</b> ${escapeHtml(String(a.summary))}</div>` : ''}
        ${fields.length ? `<div style="margin-top:10px"><b>Alteracoes:</b><pre style="background:#f7f7f7;padding:10px;border-radius:8px;white-space:pre-wrap">${escapeHtml(fieldLines)}</pre></div>` : ''}
        ${link ? `<div style="margin-top:10px"><a href="${link}">Abrir no sistema</a></div>` : ''}
      </div>
    `.trim()

    // Load preferences by recipient (per user)
    for (const u of recipients) {
      const uid = Number(u.id)
      if (emailNotificationSentRepo.has({ user_id: uid, audit_log_id: a.id })) continue

      const prefsRows = userNotificationPrefRepo.listByUser(uid)
      const prefMap = toPrefMap(prefsRows)
      const p = pickPref(prefMap, a.module_name)

      let allowed = false
      if (p) {
        allowed = Boolean(p[prefField]) && String(p.delivery_mode || 'immediate') === 'immediate'
      } else {
        // default: admins receive security events
        const isAdmin = normKey(u.role) === normKey(Roles.ADMIN)
        if (isAdmin && prefField === 'notify_security_events') allowed = true
      }

      if (!allowed) {
        emailNotificationSentRepo.mark({ user_id: uid, audit_log_id: a.id, status: 'skipped' })
        continue
      }

      const to = String(u.email || '').trim()
      if (!to) {
        emailNotificationSentRepo.mark({ user_id: uid, audit_log_id: a.id, status: 'skipped' })
        continue
      }

      const r = await sendSystemEmail({ to, subject, text, html })
      if (r?.ok) {
        emailNotificationSentRepo.mark({ user_id: uid, audit_log_id: a.id, status: 'sent' })
      } else {
        emailNotificationSentRepo.mark({ user_id: uid, audit_log_id: a.id, status: 'failed', error: r?.error || r?.reason || 'failed' })
        logger.warn({ to, audit_id: a.id, err: r?.error || r?.reason }, 'Email notification failed')
      }
    }
  },
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

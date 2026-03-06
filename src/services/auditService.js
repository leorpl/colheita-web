import { auditLogRepo } from '../repositories/auditLogRepo.js'
import { diffShallow, summarizeChange } from '../audit/diff.js'

function pickActor(req) {
  const u = req?.user || null
  if (!u) return { user_id: null, name_snapshot: null }
  const name = String(u.nome || u.username || '').trim() || null
  return { user_id: Number(u.id) || null, name_snapshot: name }
}

function getIp(req) {
  // express populates req.ip; keep as text
  return String(req?.ip || '').trim() || null
}

function getUserAgent(req) {
  return String(req?.headers?.['user-agent'] || '').trim() || null
}

function jsonOrNull(v) {
  if (v === undefined) return null
  try {
    return JSON.stringify(v)
  } catch {
    return JSON.stringify(String(v))
  }
}

function sanitize(module_name, values) {
  const mod = String(module_name || '').toLowerCase()
  const v = values && typeof values === 'object' ? { ...values } : values
  if (!v || typeof v !== 'object') return v

  // Never store password material.
  delete v.password
  delete v.password_hash
  delete v.password_salt

  if (mod === 'usuarios' || mod === 'usuario') {
    delete v.menus_json
  }

  return v
}

export const auditService = {
  log(req, {
    module_name,
    record_id = null,
    action_type,
    old_values,
    new_values,
    ignoreKeys,
    notes,
  } = {}) {
    const mod = String(module_name || '').trim()
    const action = String(action_type || '').trim()
    if (!mod || !action) return null

    const actor = pickActor(req)
    const ip_address = getIp(req)
    const user_agent = getUserAgent(req)

    const oldSan = sanitize(mod, old_values)
    const newSan = sanitize(mod, new_values)

    const changed_fields = diffShallow(oldSan, newSan, {
      ignoreKeys: [
        'updated_at',
        'updated_by_user_id',
        'created_at',
        'created_by_user_id',
        ...(ignoreKeys || []),
      ],
    })

    const summary = summarizeChange({
      action_type: action,
      module_name: mod,
      changed_fields,
    })

    return auditLogRepo.create({
      module_name: mod,
      record_id: record_id === null ? null : Number(record_id),
      action_type: action,
      changed_by_user_id: actor.user_id,
      changed_by_name_snapshot: actor.name_snapshot,
      ip_address,
      user_agent,
      old_values_json: jsonOrNull(oldSan),
      new_values_json: jsonOrNull(newSan),
      changed_fields_json: jsonOrNull(changed_fields),
      summary,
      notes: notes ? String(notes).slice(0, 2000) : null,
    })
  },
}

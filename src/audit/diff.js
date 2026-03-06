function isObject(x) {
  return x && typeof x === 'object' && !Array.isArray(x)
}

function stableJson(v) {
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

export function diffShallow(oldValues, newValues, { ignoreKeys = [] } = {}) {
  const ignore = new Set((ignoreKeys || []).map((k) => String(k)))
  const o = isObject(oldValues) ? oldValues : {}
  const n = isObject(newValues) ? newValues : {}

  const keys = new Set([...Object.keys(o), ...Object.keys(n)])
  const changed = []

  for (const k of keys) {
    if (ignore.has(k)) continue
    const ov = o[k]
    const nv = n[k]
    // Compare by value for primitives; stringify for arrays/objects.
    const eq =
      isObject(ov) || Array.isArray(ov) || isObject(nv) || Array.isArray(nv)
        ? stableJson(ov) === stableJson(nv)
        : ov === nv
    if (!eq) changed.push(k)
  }

  changed.sort()
  return changed
}

export function summarizeChange({ action_type, module_name, changed_fields = [] } = {}) {
  const action = String(action_type || '').toLowerCase()
  const mod = String(module_name || '').trim()
  const n = Array.isArray(changed_fields) ? changed_fields.length : 0

  if (action === 'create') return `Criou ${mod}`.trim()
  if (action === 'delete') return `Excluiu ${mod}`.trim()
  if (action === 'login') return 'Login'
  if (action === 'logout') return 'Logout'
  if (action === 'password_reset') return 'Redefiniu senha'
  if (action === 'permission_change') return 'Alterou permissões'
  if (action === 'status_change') return 'Alterou status'
  if (action === 'update') {
    if (n === 0) return `Alterou ${mod}`.trim()
    if (n === 1) return `Alterou 1 campo: ${changed_fields[0]}`
    return `Alterou ${n} campos: ${changed_fields.slice(0, 4).join(', ')}${n > 4 ? '…' : ''}`
  }
  return `${action_type || 'evento'}${mod ? ` (${mod})` : ''}`
}

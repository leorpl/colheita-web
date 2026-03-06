import { aclRepo } from '../repositories/aclRepo.js'
import { permsForRole, Permissions, Roles } from './permissions.js'

export const Actions = {
  VIEW: 'view',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
}

export const Modules = {
  PAINEL: 'painel',
  COLHEITA: 'colheita',
  RELATORIOS: 'relatorios',
  QUITACOES: 'quitacao-motoristas',
  SAFRAS: 'safras',
  TALHOES: 'talhoes',
  DESTINOS: 'destinos',
  MOTORISTAS: 'motoristas',
  FRETES: 'fretes',
  REGRAS_DESTINO: 'regras-destino',
  TIPOS_PLANTIO: 'tipos-plantio',
  AREA_COLHIDA: 'area-colhida',
  FAZENDA: 'fazenda',
  USUARIOS: 'usuarios',
  AUDITORIA: 'auditoria',
}

function normKey(x) {
  return String(x || '').trim().toLowerCase()
}

function legacyRoleAllow(roleName, moduleKey, action) {
  const role = normKey(roleName)
  if (role === Roles.ADMIN) return true
  if ((moduleKey === Modules.PAINEL || moduleKey === Modules.FAZENDA) && action === Actions.VIEW) return true

  const legacy = permsForRole(role)
  const has = (p) => legacy.includes(p)
  const isCad = [Modules.SAFRAS, Modules.TALHOES, Modules.DESTINOS, Modules.MOTORISTAS, Modules.FRETES, Modules.TIPOS_PLANTIO].includes(moduleKey)
  const isConfig = [Modules.REGRAS_DESTINO].includes(moduleKey)

  if (moduleKey === Modules.COLHEITA) {
    if (action === Actions.VIEW) return has(Permissions.COLHEITA_READ)
    return has(Permissions.COLHEITA_WRITE)
  }
  if (moduleKey === Modules.RELATORIOS || moduleKey === Modules.AREA_COLHIDA) {
    return action === Actions.VIEW && has(Permissions.RELATORIOS_READ)
  }
  if (moduleKey === Modules.QUITACOES) {
    if (action === Actions.VIEW) return has(Permissions.RELATORIOS_READ) || has(Permissions.QUITACOES_WRITE)
    return has(Permissions.QUITACOES_WRITE)
  }
  if (moduleKey === Modules.USUARIOS) {
    return has(Permissions.USERS_MANAGE)
  }

  if (moduleKey === Modules.AUDITORIA) {
    // Inicialmente: somente admin (via fallback admin acima).
    return false
  }
  if (isCad) {
    if (action === Actions.VIEW) return has(Permissions.CADASTROS_READ)
    return has(Permissions.CADASTROS_WRITE)
  }
  if (isConfig) {
    if (action === Actions.VIEW) return has(Permissions.CONFIG_READ)
    return has(Permissions.CONFIG_WRITE)
  }
  return false
}

function listToMap(rows) {
  const out = new Map()
  for (const r of rows || []) {
    out.set(normKey(r.module), {
      can_view: r.can_view,
      can_create: r.can_create,
      can_update: r.can_update,
      can_delete: r.can_delete,
    })
  }
  return out
}

export function can(user, moduleKey, action) {
  const u = user || null
  const mod = normKey(moduleKey)
  const act = normKey(action)
  if (!u) return false
  if (normKey(u.role) === Roles.ADMIN) return true

  // Base role permissions (DB if exists; fallback to legacy mapping).
  const roleRows = aclRepo.getRolePermissionsByRoleName(u.role)
  const roleMap = roleRows.length ? listToMap(roleRows) : null
  const base = roleMap?.get(mod) || null

  // User overrides (nullable columns mean "inherit").
  const userRows = aclRepo.getUserPermissionOverrides(Number(u.id))
  const userMap = listToMap(userRows)
  const over = userMap.get(mod) || null

  function pick(field, legacyAction) {
    const v = over?.[field]
    if (v === 0 || v === 1) return Boolean(v)
    const b = base?.[field]
    if (b === 0 || b === 1) return Boolean(b)
    return legacyRoleAllow(u.role, mod, legacyAction)
  }

  if (act === Actions.VIEW) return pick('can_view', Actions.VIEW)
  if (act === Actions.CREATE) return pick('can_create', Actions.CREATE)
  if (act === Actions.UPDATE) return pick('can_update', Actions.UPDATE)
  if (act === Actions.DELETE) return pick('can_delete', Actions.DELETE)
  return false
}

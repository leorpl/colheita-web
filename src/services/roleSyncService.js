import { can, Actions } from '../auth/acl.js'
import { usuarioRepo } from '../repositories/usuarioRepo.js'

const MENU_KEYS = [
  'painel',
  'colheita',
  'area-colhida',
  'relatorios',
  'producao',
  'comunicacao',
  'quitacao-motoristas',
  'safras',
  'talhoes',
  'destinos',
  'motoristas',
  'fretes',
  'regras-destino',
  'tipos-plantio',
  'fazenda',
  'usuarios',
  'perfis',
  'auditoria',
]

function fakeUserForRole(roleName) {
  return { id: 0, role: String(roleName || '').trim().toLowerCase() }
}

function buildMenusForRole(roleName) {
  const u = fakeUserForRole(roleName)
  const menus = []
  for (const k of MENU_KEYS) {
    if (k === 'perfis') {
      if (can(u, 'usuarios', Actions.UPDATE)) menus.push('perfis')
      continue
    }
    if (can(u, k, Actions.VIEW)) menus.push(k)
  }
  return menus
}

export const roleSyncService = {
  syncUsersMenusForRole(roleName, { user_id } = {}) {
    const role = String(roleName || '').trim().toLowerCase()
    if (!role) return { updated: 0, role }
    const menus = buildMenusForRole(role)
    const updated = usuarioRepo.updateMenusByRole(role, menus, { user_id })
    return { updated: Number(updated?.changes || 0), role, menus }
  },
}

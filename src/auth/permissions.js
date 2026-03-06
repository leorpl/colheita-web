export const Roles = {
  ADMIN: 'admin',
  GESTOR: 'gestor',
  OPERADOR: 'operador',
  LEITURA: 'leitura',
  MOTORISTA: 'motorista',
}

export const Menus = {
  painel: 'painel',
  colheita: 'colheita',
  'area-colhida': 'area-colhida',
  relatorios: 'relatorios',
  'quitacao-motoristas': 'quitacao-motoristas',
  safras: 'safras',
  talhoes: 'talhoes',
  destinos: 'destinos',
  motoristas: 'motoristas',
  fretes: 'fretes',
  'regras-destino': 'regras-destino',
  'tipos-plantio': 'tipos-plantio',
  fazenda: 'fazenda',
  usuarios: 'usuarios',
  auditoria: 'auditoria',
}

export const Permissions = {
  USERS_MANAGE: 'users:manage',
  CADASTROS_READ: 'cadastros:read',
  CADASTROS_WRITE: 'cadastros:write',
  CONFIG_READ: 'config:read',
  CONFIG_WRITE: 'config:write',
  COLHEITA_READ: 'colheita:read',
  COLHEITA_WRITE: 'colheita:write',
  RELATORIOS_READ: 'relatorios:read',
  QUITACOES_WRITE: 'quitacoes:write',
}

const RolePerms = {
  [Roles.ADMIN]: Object.values(Permissions),
  [Roles.GESTOR]: [
    Permissions.CADASTROS_READ,
    Permissions.CADASTROS_WRITE,
    Permissions.CONFIG_READ,
    Permissions.CONFIG_WRITE,
    Permissions.COLHEITA_READ,
    Permissions.COLHEITA_WRITE,
    Permissions.RELATORIOS_READ,
    Permissions.QUITACOES_WRITE,
  ],
  [Roles.OPERADOR]: [
    Permissions.CADASTROS_READ,
    Permissions.CONFIG_READ,
    Permissions.COLHEITA_READ,
    Permissions.COLHEITA_WRITE,
    Permissions.RELATORIOS_READ,
  ],
  [Roles.LEITURA]: [
    Permissions.CADASTROS_READ,
    Permissions.CONFIG_READ,
    Permissions.COLHEITA_READ,
    Permissions.RELATORIOS_READ,
  ],
  // Motorista (futuro): por enquanto leitura basica.
  [Roles.MOTORISTA]: [Permissions.COLHEITA_READ],
}

export function permsForRole(role) {
  return RolePerms[String(role || '').toLowerCase()] || []
}

const RoleMenus = {
  [Roles.ADMIN]: Object.values(Menus),
  [Roles.GESTOR]: Object.values(Menus).filter((m) => m !== Menus.usuarios && m !== Menus.auditoria),
  [Roles.OPERADOR]: [
    Menus.painel,
    Menus.colheita,
    Menus['area-colhida'],
    Menus.relatorios,
    Menus.fazenda,
  ],
  [Roles.LEITURA]: [Menus.painel, Menus.relatorios, Menus.fazenda],
  [Roles.MOTORISTA]: [Menus.colheita],
}

export function menusForRole(role) {
  return RoleMenus[String(role || '').toLowerCase()] || []
}

export function hasPerm(role, perm) {
  return permsForRole(role).includes(perm)
}

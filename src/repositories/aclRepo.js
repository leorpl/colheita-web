import { db } from '../db/db.js'

export const aclRepo = {
  listRoles() {
    return db.prepare('SELECT id, name FROM role ORDER BY name ASC').all()
  },

  getRoleIdByName(name) {
    const n = String(name || '').trim().toLowerCase()
    if (!n) return null
    const r = db.prepare('SELECT id FROM role WHERE LOWER(name)=? LIMIT 1').get(n)
    return r ? Number(r.id) : null
  },

  getRolePermissionsByRoleName(roleName) {
    const role_id = this.getRoleIdByName(roleName)
    if (!role_id) return []
    return db
      .prepare(
        `SELECT module, can_view, can_create, can_update, can_delete
         FROM role_permission
         WHERE role_id=?`,
      )
      .all(role_id)
  },

  getUserPermissionOverrides(user_id) {
    return db
      .prepare(
        `SELECT module, can_view, can_create, can_update, can_delete
         FROM user_permission
         WHERE user_id=?`,
      )
      .all(user_id)
  },
}

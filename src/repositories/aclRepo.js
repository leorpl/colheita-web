import { db } from '../db/db.js'

export const aclRepo = {
  listRoles() {
    return db.prepare('SELECT id, name FROM role ORDER BY name ASC').all()
  },

  createRole(name) {
    const n = String(name || '').trim().toLowerCase()
    if (!n) return null
    try {
      const info = db.prepare('INSERT INTO role (name) VALUES (?)').run(n)
      return this.getRoleIdByName(n) || Number(info.lastInsertRowid)
    } catch {
      return this.getRoleIdByName(n)
    }
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

  upsertRolePermission({ roleName, module, can_view, can_create, can_update, can_delete }) {
    const role_id = this.getRoleIdByName(roleName)
    if (!role_id) return null
    db.prepare(
      `INSERT INTO role_permission (role_id, module, can_view, can_create, can_update, can_delete, updated_at)
       VALUES (@role_id, @module, @can_view, @can_create, @can_update, @can_delete, datetime('now'))
       ON CONFLICT(role_id, module) DO UPDATE SET
         can_view=excluded.can_view,
         can_create=excluded.can_create,
         can_update=excluded.can_update,
         can_delete=excluded.can_delete,
         updated_at=datetime('now')`,
    ).run({
      role_id,
      module: String(module || '').trim().toLowerCase(),
      can_view: can_view ? 1 : 0,
      can_create: can_create ? 1 : 0,
      can_update: can_update ? 1 : 0,
      can_delete: can_delete ? 1 : 0,
    })
    return this.getRolePermissionsByRoleName(roleName)
  },

  cloneRolePermissions({ fromRoleName, toRoleName }) {
    const from_id = this.getRoleIdByName(fromRoleName)
    if (!from_id) return null
    const to_id = this.createRole(toRoleName)
    if (!to_id) return null

    const rows = db
      .prepare(
        `SELECT module, can_view, can_create, can_update, can_delete
         FROM role_permission
         WHERE role_id=?`,
      )
      .all(from_id)

    const ins = db.prepare(
      `INSERT INTO role_permission (role_id, module, can_view, can_create, can_update, can_delete, updated_at)
       VALUES (@role_id, @module, @can_view, @can_create, @can_update, @can_delete, datetime('now'))
       ON CONFLICT(role_id, module) DO UPDATE SET
         can_view=excluded.can_view,
         can_create=excluded.can_create,
         can_update=excluded.can_update,
         can_delete=excluded.can_delete,
         updated_at=datetime('now')`,
    )

    for (const r of rows || []) {
      ins.run({
        role_id: to_id,
        module: String(r.module || '').trim().toLowerCase(),
        can_view: r.can_view ? 1 : 0,
        can_create: r.can_create ? 1 : 0,
        can_update: r.can_update ? 1 : 0,
        can_delete: r.can_delete ? 1 : 0,
      })
    }

    return this.getRolePermissionsByRoleName(toRoleName)
  },

  upsertUserOverride({ user_id, module, can_view, can_create, can_update, can_delete }) {
    const uid = Number(user_id)
    if (!Number.isInteger(uid) || uid <= 0) return null
    const mod = String(module || '').trim().toLowerCase()
    if (!mod) return null

    const norm = (v) => {
      if (v === null || v === undefined) return null
      if (v === 0 || v === 1) return Number(v)
      if (typeof v === 'boolean') return v ? 1 : 0
      return null
    }

    db.prepare(
      `INSERT INTO user_permission (user_id, module, can_view, can_create, can_update, can_delete, updated_at)
       VALUES (@user_id, @module, @can_view, @can_create, @can_update, @can_delete, datetime('now'))
       ON CONFLICT(user_id, module) DO UPDATE SET
         can_view=excluded.can_view,
         can_create=excluded.can_create,
         can_update=excluded.can_update,
         can_delete=excluded.can_delete,
         updated_at=datetime('now')`,
    ).run({
      user_id: uid,
      module: mod,
      can_view: norm(can_view),
      can_create: norm(can_create),
      can_update: norm(can_update),
      can_delete: norm(can_delete),
    })

    return this.getUserPermissionOverrides(uid)
  },

  removeUserOverride({ user_id, module }) {
    const uid = Number(user_id)
    const mod = String(module || '').trim().toLowerCase()
    if (!Number.isInteger(uid) || uid <= 0) return { changes: 0 }
    if (!mod) return { changes: 0 }
    return db.prepare('DELETE FROM user_permission WHERE user_id=? AND module=?').run(uid, mod)
  },
}

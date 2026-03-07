import { db } from '../db/db.js'

export const usuarioRepo = {
  list() {
    return db
      .prepare(
        `SELECT id, username, email, nome, role, motorista_id, menus_json, active, created_at, updated_at,
                must_change_password,
                created_by_user_id, updated_by_user_id, deleted_at, deleted_by_user_id
         FROM usuario
         WHERE deleted_at IS NULL
         ORDER BY id DESC`,
      )
      .all()
  },

  get(id) {
    return db
      .prepare(
        `SELECT id, username, email, nome, role, motorista_id, menus_json, active, created_at, updated_at,
                must_change_password,
                created_by_user_id, updated_by_user_id, deleted_at, deleted_by_user_id
         FROM usuario WHERE id=?`,
      )
      .get(id)
  },

  getAuthByUsername(username) {
    return db
      .prepare(
        `SELECT * FROM usuario WHERE username=? AND deleted_at IS NULL LIMIT 1`,
      )
      .get(username)
  },

  getAuthByEmail(email) {
    const e = String(email || '').trim().toLowerCase()
    if (!e) return null
    return db
      .prepare(
        `SELECT * FROM usuario WHERE LOWER(email)=? AND deleted_at IS NULL LIMIT 1`,
      )
      .get(e)
  },

  // Accept login either by username or email.
  getAuthByLogin(login) {
    const l = String(login || '').trim()
    if (!l) return null
    // Fast path: if looks like email, try email first.
    if (l.includes('@')) {
      return this.getAuthByEmail(l) || this.getAuthByUsername(l)
    }
    return this.getAuthByUsername(l) || this.getAuthByEmail(l)
  },

  create(
    { username, email, nome, role, motorista_id, password_hash, password_salt, must_change_password = 0 },
    { user_id } = {},
  ) {
    const info = db
      .prepare(
        `INSERT INTO usuario (username, email, nome, role, motorista_id, menus_json, password_hash, password_salt, active,
                              must_change_password,
                              created_by_user_id, updated_by_user_id, updated_at)
         VALUES (@username, @email, @nome, @role, @motorista_id, @menus_json, @password_hash, @password_salt, 1,
                  @must_change_password,
                  @created_by_user_id, @updated_by_user_id, datetime('now'))`,
      )
      .run({
        username,
        email: email || null,
        nome,
        role,
        motorista_id: motorista_id || null,
        menus_json: null,
        password_hash,
        password_salt,
        must_change_password: must_change_password ? 1 : 0,
        created_by_user_id: user_id ?? null,
        updated_by_user_id: user_id ?? null,
      })
    return this.get(info.lastInsertRowid)
  },

  update(id, { username, email, nome, role, motorista_id, active, menus_json }, { user_id } = {}) {
    db.prepare(
      `UPDATE usuario
       SET username=@username, email=@email, nome=@nome, role=@role, motorista_id=@motorista_id, active=@active, menus_json=@menus_json,
           updated_by_user_id=@updated_by_user_id,
           updated_at=datetime('now')
       WHERE id=@id`,
    ).run({
      id,
      username,
      email: email || null,
      nome,
      role,
      motorista_id: motorista_id || null,
      active: active ? 1 : 0,
      menus_json: menus_json ?? null,
      updated_by_user_id: user_id ?? null,
    })
    return this.get(id)
  },

  setPassword(id, { password_hash, password_salt, must_change_password }, { user_id } = {}) {
    db.prepare(
      `UPDATE usuario
       SET password_hash=@password_hash, password_salt=@password_salt,
           must_change_password=COALESCE(@must_change_password, must_change_password),
           updated_by_user_id=@updated_by_user_id,
           updated_at=datetime('now')
       WHERE id=@id`,
    ).run({
      id,
      password_hash,
      password_salt,
      must_change_password:
        must_change_password === null || must_change_password === undefined
          ? null
          : must_change_password
            ? 1
            : 0,
      updated_by_user_id: user_id ?? null,
    })
    return this.get(id)
  },

  updateMenusByRole(roleName, menus, { user_id } = {}) {
    const role = String(roleName || '').trim().toLowerCase()
    const list = Array.isArray(menus) ? menus.map((x) => String(x)) : []
    const menus_json = JSON.stringify(list)
    return db
      .prepare(
        `UPDATE usuario
         SET menus_json=@menus_json,
             updated_by_user_id=@updated_by_user_id,
             updated_at=datetime('now')
         WHERE LOWER(role)=@role
           AND deleted_at IS NULL`,
      )
      .run({ menus_json, role, updated_by_user_id: user_id ?? null })
  },

  remove(id, { user_id } = {}) {
    // soft delete
    return db
      .prepare(
        `UPDATE usuario
         SET deleted_at=datetime('now'), deleted_by_user_id=@deleted_by_user_id, updated_at=datetime('now')
         WHERE id=@id`,
      )
      .run({ id, deleted_by_user_id: user_id ?? null })
  },
}

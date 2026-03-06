import { db } from '../db/db.js'

export const usuarioRepo = {
  list() {
    return db
      .prepare(
        `SELECT id, username, nome, role, motorista_id, menus_json, active, created_at, updated_at,
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
        `SELECT id, username, nome, role, motorista_id, menus_json, active, created_at, updated_at,
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

  create({ username, nome, role, motorista_id, password_hash, password_salt }, { user_id } = {}) {
    const info = db
      .prepare(
        `INSERT INTO usuario (username, nome, role, motorista_id, menus_json, password_hash, password_salt, active,
                             created_by_user_id, updated_by_user_id, updated_at)
         VALUES (@username, @nome, @role, @motorista_id, @menus_json, @password_hash, @password_salt, 1,
                 @created_by_user_id, @updated_by_user_id, datetime('now'))`,
      )
      .run({
        username,
        nome,
        role,
        motorista_id: motorista_id || null,
        menus_json: null,
        password_hash,
        password_salt,
        created_by_user_id: user_id ?? null,
        updated_by_user_id: user_id ?? null,
      })
    return this.get(info.lastInsertRowid)
  },

  update(id, { username, nome, role, motorista_id, active, menus_json }, { user_id } = {}) {
    db.prepare(
      `UPDATE usuario
       SET username=@username, nome=@nome, role=@role, motorista_id=@motorista_id, active=@active, menus_json=@menus_json,
           updated_by_user_id=@updated_by_user_id,
           updated_at=datetime('now')
       WHERE id=@id`,
    ).run({
      id,
      username,
      nome,
      role,
      motorista_id: motorista_id || null,
      active: active ? 1 : 0,
      menus_json: menus_json ?? null,
      updated_by_user_id: user_id ?? null,
    })
    return this.get(id)
  },

  setPassword(id, { password_hash, password_salt }, { user_id } = {}) {
    db.prepare(
      `UPDATE usuario
       SET password_hash=@password_hash, password_salt=@password_salt,
           updated_by_user_id=@updated_by_user_id,
           updated_at=datetime('now')
       WHERE id=@id`,
    ).run({ id, password_hash, password_salt, updated_by_user_id: user_id ?? null })
    return this.get(id)
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

import { db } from '../db/db.js'

export const usuarioRepo = {
  list() {
    return db
      .prepare(
        `SELECT id, username, nome, role, motorista_id, menus_json, active, created_at, updated_at
         FROM usuario
         ORDER BY id DESC`,
      )
      .all()
  },

  get(id) {
    return db
      .prepare(
        `SELECT id, username, nome, role, motorista_id, menus_json, active, created_at, updated_at
         FROM usuario WHERE id=?`,
      )
      .get(id)
  },

  getAuthByUsername(username) {
    return db
      .prepare(
        `SELECT * FROM usuario WHERE username=? LIMIT 1`,
      )
      .get(username)
  },

  create({ username, nome, role, motorista_id, password_hash, password_salt }) {
    const info = db
      .prepare(
        `INSERT INTO usuario (username, nome, role, motorista_id, menus_json, password_hash, password_salt, active, updated_at)
         VALUES (@username, @nome, @role, @motorista_id, @menus_json, @password_hash, @password_salt, 1, datetime('now'))`,
      )
      .run({
        username,
        nome,
        role,
        motorista_id: motorista_id || null,
        menus_json: null,
        password_hash,
        password_salt,
      })
    return this.get(info.lastInsertRowid)
  },

  update(id, { username, nome, role, motorista_id, active, menus_json }) {
    db.prepare(
      `UPDATE usuario
       SET username=@username, nome=@nome, role=@role, motorista_id=@motorista_id, active=@active, menus_json=@menus_json,
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
    })
    return this.get(id)
  },

  setPassword(id, { password_hash, password_salt }) {
    db.prepare(
      `UPDATE usuario
       SET password_hash=@password_hash, password_salt=@password_salt, updated_at=datetime('now')
       WHERE id=@id`,
    ).run({ id, password_hash, password_salt })
    return this.get(id)
  },

  remove(id) {
    return db.prepare('DELETE FROM usuario WHERE id=?').run(id)
  },
}

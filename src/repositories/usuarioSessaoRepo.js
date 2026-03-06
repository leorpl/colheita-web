import { db } from '../db/db.js'

export const usuarioSessaoRepo = {
  create({ usuario_id, token_hash, expires_at }) {
    db.prepare(
      `INSERT INTO usuario_sessao (usuario_id, token_hash, expires_at)
       VALUES (@usuario_id, @token_hash, @expires_at)`,
    ).run({ usuario_id, token_hash, expires_at })
  },

  getByTokenHash(token_hash) {
    return db
      .prepare(
        `SELECT s.*, u.username, u.nome, u.role, u.motorista_id, u.active, u.menus_json
         FROM usuario_sessao s
         JOIN usuario u ON u.id = s.usuario_id
         WHERE s.token_hash=? LIMIT 1`,
      )
      .get(token_hash)
  },

  deleteByTokenHash(token_hash) {
    return db
      .prepare('DELETE FROM usuario_sessao WHERE token_hash=?')
      .run(token_hash)
  },

  deleteByUserId(usuario_id) {
    return db
      .prepare('DELETE FROM usuario_sessao WHERE usuario_id=?')
      .run(usuario_id)
  },

  purgeExpired() {
    return db
      .prepare("DELETE FROM usuario_sessao WHERE expires_at <= datetime('now')")
      .run()
  },
}

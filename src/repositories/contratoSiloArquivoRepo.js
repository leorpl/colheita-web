import { db } from '../db/db.js'

export const contratoSiloArquivoRepo = {
  listByContrato({ contrato_silo_id }) {
    return db
      .prepare(
        `SELECT a.*,
                u.nome as uploaded_by_nome,
                u.username as uploaded_by_username
         FROM contrato_silo_arquivo a
         LEFT JOIN usuario u ON u.id = a.created_by_user_id
         WHERE a.contrato_silo_id = @contrato_silo_id
           AND a.deleted_at IS NULL
         ORDER BY a.created_at DESC, a.id DESC`,
      )
      .all({ contrato_silo_id: Number(contrato_silo_id) })
  },

  get(id) {
    return db
      .prepare(
        `SELECT a.*,
                u.nome as uploaded_by_nome,
                u.username as uploaded_by_username
         FROM contrato_silo_arquivo a
         LEFT JOIN usuario u ON u.id = a.created_by_user_id
         WHERE a.id = @id AND a.deleted_at IS NULL`,
      )
      .get({ id: Number(id) })
  },

  create({ contrato_silo_id, file_name, storage_key, mime_type, file_size }, { user_id } = {}) {
    const info = db
      .prepare(
        `INSERT INTO contrato_silo_arquivo (
           contrato_silo_id, file_name, storage_key, mime_type, file_size,
           created_by_user_id, updated_by_user_id, updated_at
         ) VALUES (
           @contrato_silo_id, @file_name, @storage_key, @mime_type, @file_size,
           @created_by_user_id, @updated_by_user_id, datetime('now')
         )`,
      )
      .run({
        contrato_silo_id: Number(contrato_silo_id),
        file_name: String(file_name || ''),
        storage_key: String(storage_key || ''),
        mime_type: mime_type ? String(mime_type) : null,
        file_size: file_size === null || file_size === undefined ? null : Number(file_size),
        created_by_user_id: user_id ?? null,
        updated_by_user_id: user_id ?? null,
      })
    return this.get(info.lastInsertRowid)
  },

  remove(id, { user_id } = {}) {
    return db
      .prepare(
        `UPDATE contrato_silo_arquivo
         SET deleted_at=datetime('now'),
             deleted_by_user_id=@deleted_by_user_id,
             updated_by_user_id=@updated_by_user_id,
             updated_at=datetime('now')
         WHERE id=@id AND deleted_at IS NULL`,
      )
      .run({
        id: Number(id),
        deleted_by_user_id: user_id ?? null,
        updated_by_user_id: user_id ?? null,
      })
  },
}

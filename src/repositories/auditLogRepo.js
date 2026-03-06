import { db } from '../db/db.js'

export const auditLogRepo = {
  create(row) {
    const info = db
      .prepare(
        `INSERT INTO audit_log (
          module_name, record_id, action_type,
          changed_by_user_id, changed_by_name_snapshot,
          ip_address, user_agent,
          old_values_json, new_values_json, changed_fields_json,
          summary, notes
        ) VALUES (
          @module_name, @record_id, @action_type,
          @changed_by_user_id, @changed_by_name_snapshot,
          @ip_address, @user_agent,
          @old_values_json, @new_values_json, @changed_fields_json,
          @summary, @notes
        )`,
      )
      .run(row)
    return this.get(info.lastInsertRowid)
  },

  get(id) {
    return db
      .prepare(
        `SELECT a.*,
                u.username as changed_by_username,
                u.nome as changed_by_nome
         FROM audit_log a
         LEFT JOIN usuario u ON u.id = a.changed_by_user_id
         WHERE a.id=?`,
      )
      .get(id)
  },

  list(filters = {}) {
    const params = {
      module_name: filters.module_name ?? null,
      action_type: filters.action_type ?? null,
      user_id: filters.user_id ?? null,
      record_id: filters.record_id ?? null,
      q: filters.q ? `%${String(filters.q).trim()}%` : null,
      de: filters.de ?? null,
      ate: filters.ate ?? null,
      limit: Number(filters.limit || 200),
    }

    return db
      .prepare(
        `SELECT a.*,
                u.username as changed_by_username,
                u.nome as changed_by_nome
         FROM audit_log a
         LEFT JOIN usuario u ON u.id = a.changed_by_user_id
         WHERE (@module_name IS NULL OR a.module_name = @module_name)
           AND (@action_type IS NULL OR a.action_type = @action_type)
           AND (@user_id IS NULL OR a.changed_by_user_id = @user_id)
           AND (@record_id IS NULL OR a.record_id = @record_id)
           AND (
             @q IS NULL OR (
               a.summary LIKE @q OR
               a.notes LIKE @q OR
               a.old_values_json LIKE @q OR
               a.new_values_json LIKE @q
             )
           )
           AND (@de IS NULL OR a.created_at >= @de)
           AND (@ate IS NULL OR a.created_at <= @ate)
         ORDER BY a.id DESC
         LIMIT @limit`,
      )
      .all(params)
  },
}

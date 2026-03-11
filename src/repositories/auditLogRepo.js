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

  count(filters = {}) {
    const params = {
      module_name: filters.module_name ?? null,
      action_type: filters.action_type ?? null,
      user_id: filters.user_id ?? null,
      record_id: filters.record_id ?? null,
      q: filters.q ? `%${String(filters.q).trim()}%` : null,
      de: filters.de ?? null,
      ate: filters.ate ?? null,
      critical: filters.critical ? 1 : 0,
    }

    const row = db
      .prepare(
        `SELECT COUNT(1) as total
         FROM audit_log a
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
           AND (
             @critical = 0 OR (
               a.action_type IN ('permission_change', 'password_reset', 'delete', 'status_change') OR
               (a.module_name = 'colheita' AND (
                 a.changed_fields_json LIKE '%destino%' OR
                 a.changed_fields_json LIKE '%umidade_desc_pct_manual%' OR
                 a.changed_fields_json LIKE '%valor_compra%'
               ))
             )
           )`,
      )
      .get(params)

    return Number(row?.total || 0)
  },

  listPage(filters = {}) {
    const sortKey = String(filters.sort_key || 'id')
    const sortDir = String(filters.sort_dir || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC'
    const sortMap = {
      id: 'a.id',
      created_at: 'a.created_at',
      module_name: 'a.module_name',
      action_type: 'a.action_type',
      record_id: 'a.record_id',
      changed_by_user_id: 'a.changed_by_user_id',
    }
    const orderBy = sortMap[sortKey] || sortMap.id

    const params = {
      module_name: filters.module_name ?? null,
      action_type: filters.action_type ?? null,
      user_id: filters.user_id ?? null,
      record_id: filters.record_id ?? null,
      q: filters.q ? `%${String(filters.q).trim()}%` : null,
      de: filters.de ?? null,
      ate: filters.ate ?? null,
      limit: Number(filters.limit || 200),
      offset: Number(filters.offset || 0),
      critical: filters.critical ? 1 : 0,
    }

    const sql = `SELECT a.*,
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
                 AND (
                   @critical = 0 OR (
                     a.action_type IN ('permission_change', 'password_reset', 'delete', 'status_change') OR
                     (a.module_name = 'colheita' AND (
                       a.changed_fields_json LIKE '%destino%' OR
                       a.changed_fields_json LIKE '%umidade_desc_pct_manual%' OR
                       a.changed_fields_json LIKE '%valor_compra%'
                     ))
                   )
                 )
               ORDER BY ${orderBy} ${sortDir}
               LIMIT @limit OFFSET @offset`

    return db.prepare(sql).all(params)
  },

  stats(filters = {}) {
    const params = {
      de: filters.de ?? null,
      ate: filters.ate ?? null,
      module_name: filters.module_name ?? null,
      user_id: filters.user_id ?? null,
    }

    const row = db
      .prepare(
        `SELECT
           COUNT(1) as total,
           SUM(CASE WHEN action_type = 'login' THEN 1 ELSE 0 END) as logins,
           SUM(CASE WHEN action_type IN ('create','update','delete','status_change') THEN 1 ELSE 0 END) as cadastros,
           SUM(CASE WHEN action_type = 'permission_change' THEN 1 ELSE 0 END) as permissoes,
           SUM(CASE WHEN action_type = 'password_reset' THEN 1 ELSE 0 END) as password_reset,
           SUM(CASE WHEN action_type = 'delete' THEN 1 ELSE 0 END) as deletes,
           SUM(CASE WHEN action_type IN ('permission_change','password_reset','delete','status_change') THEN 1 ELSE 0 END) as criticos
         FROM audit_log
         WHERE (@de IS NULL OR created_at >= @de)
           AND (@ate IS NULL OR created_at <= @ate)
           AND (@module_name IS NULL OR module_name = @module_name)
           AND (@user_id IS NULL OR changed_by_user_id = @user_id)`,
      )
      .get(params)

    return {
      total: Number(row?.total || 0),
      logins: Number(row?.logins || 0),
      cadastros: Number(row?.cadastros || 0),
      permissoes: Number(row?.permissoes || 0),
      password_reset: Number(row?.password_reset || 0),
      deletes: Number(row?.deletes || 0),
      criticos: Number(row?.criticos || 0),
    }
  },

  recentLogins(limit = 10) {
    return db
      .prepare(
        `SELECT a.id, a.created_at, a.action_type, a.summary,
                u.username as changed_by_username,
                u.nome as changed_by_nome,
                a.changed_by_name_snapshot,
                a.ip_address
         FROM audit_log a
         LEFT JOIN usuario u ON u.id = a.changed_by_user_id
         WHERE a.module_name = 'auth'
           AND a.action_type IN ('login', 'logout', 'login_failed')
         ORDER BY a.id DESC
         LIMIT ?`,
      )
      .all(Number(limit || 10))
  },
}

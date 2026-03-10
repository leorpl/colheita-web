import { db } from '../db/db.js'

export const talhaoRepo = {
  _hydrate(row) {
    if (!row) return row
    return {
      ...row,
      geometry_geojson: row.geometry_geojson ? JSON.parse(row.geometry_geojson) : null,
      geometry_props_json: row.geometry_props_json ? JSON.parse(row.geometry_props_json) : null,
    }
  },
  list() {
    return db
      .prepare(
        `SELECT id, codigo, local, nome, situacao, hectares, posse, contrato, observacoes,
                irrigacao, foto_url, maps_url, tipo_solo, calagem, gessagem, fosforo_corretivo,
                geometry_source_name, created_at, updated_at, created_by_user_id, updated_by_user_id,
                deleted_at, deleted_by_user_id
         FROM talhao
         WHERE deleted_at IS NULL
         ORDER BY id DESC`,
      )
      .all()
  },
  listWithGeometry() {
    return db
      .prepare(
        `SELECT *
         FROM talhao
         WHERE deleted_at IS NULL
         ORDER BY id DESC`,
      )
      .all()
      .map((r) => this._hydrate(r))
  },
  get(id) {
    return this._hydrate(db.prepare('SELECT * FROM talhao WHERE id = ? AND deleted_at IS NULL').get(id))
  },
  create(data, { user_id } = {}) {
    const info = db
      .prepare(
        `INSERT INTO talhao (codigo, local, nome, situacao, hectares, posse, contrato, observacoes,
                             irrigacao, foto_url, maps_url, tipo_solo, calagem, gessagem, fosforo_corretivo,
                             geometry_geojson, geometry_props_json, geometry_source_name,
                             created_by_user_id, updated_by_user_id, updated_at)
         VALUES (@codigo, @local, @nome, @situacao, @hectares, @posse, @contrato, @observacoes,
                 @irrigacao, @foto_url, @maps_url, @tipo_solo, @calagem, @gessagem, @fosforo_corretivo,
                 @geometry_geojson, @geometry_props_json, @geometry_source_name,
                 @created_by_user_id, @updated_by_user_id, datetime('now'))`,
      )
      .run({
        ...data,
        geometry_geojson: data.geometry_geojson ? JSON.stringify(data.geometry_geojson) : null,
        geometry_props_json: data.geometry_props_json ? JSON.stringify(data.geometry_props_json) : null,
        geometry_source_name: data.geometry_source_name || null,
        created_by_user_id: user_id ?? null,
        updated_by_user_id: user_id ?? null,
      })
    return this.get(info.lastInsertRowid)
  },
  update(id, data, { user_id } = {}) {
    db.prepare(
      `UPDATE talhao
       SET codigo=@codigo, local=@local, nome=@nome, situacao=@situacao, hectares=@hectares,
             posse=@posse, contrato=@contrato, observacoes=@observacoes,
             irrigacao=@irrigacao, foto_url=@foto_url, maps_url=@maps_url, tipo_solo=@tipo_solo, calagem=@calagem, gessagem=@gessagem, fosforo_corretivo=@fosforo_corretivo,
             geometry_geojson=@geometry_geojson, geometry_props_json=@geometry_props_json, geometry_source_name=@geometry_source_name,
             updated_by_user_id=@updated_by_user_id, updated_at=datetime('now')
        WHERE id=@id AND deleted_at IS NULL`,
    ).run({
      ...data,
      id,
      geometry_geojson: data.geometry_geojson ? JSON.stringify(data.geometry_geojson) : null,
      geometry_props_json: data.geometry_props_json ? JSON.stringify(data.geometry_props_json) : null,
      geometry_source_name: data.geometry_source_name || null,
      updated_by_user_id: user_id ?? null,
    })
    return this.get(id)
  },
  remove(id, { user_id } = {}) {
    return db
      .prepare(
        `UPDATE talhao
         SET deleted_at=datetime('now'), deleted_by_user_id=@deleted_by_user_id,
             updated_by_user_id=@updated_by_user_id, updated_at=datetime('now')
         WHERE id=@id AND deleted_at IS NULL`,
      )
      .run({ id, deleted_by_user_id: user_id ?? null, updated_by_user_id: user_id ?? null })
  },
}

import { db } from '../db/db.js'

export const motoristaRepo = {
  list() {
    return db.prepare('SELECT * FROM motorista ORDER BY id DESC').all()
  },
  get(id) {
    return db.prepare('SELECT * FROM motorista WHERE id = ?').get(id)
  },
  create(data) {
    const info = db
      .prepare(
        `INSERT INTO motorista (nome, placa, cpf, banco, pix_conta, tipo_veiculo, capacidade_kg, updated_at)
         VALUES (@nome, @placa, @cpf, @banco, @pix_conta, @tipo_veiculo, @capacidade_kg, datetime('now'))`,
      )
      .run(data)
    return this.get(info.lastInsertRowid)
  },
  update(id, data) {
    db.prepare(
      `UPDATE motorista
       SET nome=@nome, placa=@placa, cpf=@cpf, banco=@banco, pix_conta=@pix_conta,
           tipo_veiculo=@tipo_veiculo, capacidade_kg=@capacidade_kg, updated_at=datetime('now')
       WHERE id=@id`,
    ).run({ ...data, id })
    return this.get(id)
  },
  remove(id) {
    return db.prepare('DELETE FROM motorista WHERE id=?').run(id)
  },
}

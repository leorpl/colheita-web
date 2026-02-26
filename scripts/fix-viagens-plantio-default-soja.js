import { migrate } from '../src/db/migrate.js'
import { db } from '../src/db/db.js'

// Corrige esta base de dados: viagens antigas sem tipo_plantio passam a SOJA.

migrate()

const info = db
  .prepare(
    "UPDATE viagem SET tipo_plantio='SOJA', updated_at=datetime('now') WHERE tipo_plantio IS NULL OR TRIM(tipo_plantio)=''",
  )
  .run()

console.log('Viagens atualizadas para SOJA:', info.changes)

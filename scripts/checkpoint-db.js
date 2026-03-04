import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const dbPath = process.env.DB_PATH || 'data/app.db'

const abs = path.resolve(dbPath)
if (!fs.existsSync(abs)) {
  console.error('Arquivo do banco não encontrado:', abs)
  process.exit(1)
}

console.log('Usando banco:', abs)

const db = new Database(abs)

// garante que tudo do WAL vá pro app.db e trunque o WAL
const r = db.pragma('wal_checkpoint(TRUNCATE)')
console.log('Checkpoint:', r)

// fecha certinho
db.close()

console.log('OK. Agora o app.db deve conter os dados mais recentes.')
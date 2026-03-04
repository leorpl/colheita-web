import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const dbPath = process.env.DB_PATH || 'data/app.db'
const abs = path.resolve(dbPath)

console.log('[inspect-db] DB_PATH =', dbPath)
console.log('[inspect-db] ABS =', abs)

try {
  const st = fs.statSync(abs)
  console.log('[inspect-db] size(bytes)=', st.size)
} catch (e) {
  console.log('[inspect-db] stat error:', e?.message)
}

const db = new Database(abs, { readonly: true })

try {
  const tables = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
  `).all()
  console.log('[inspect-db] tables:', tables.map(t => t.name).join(', '))

  const hasUsuario = tables.some(t => t.name === 'usuario')
  if (!hasUsuario) {
    console.log('[inspect-db] tabela usuario NÃO existe nesse banco.')
    process.exit(0)
  }

  const count = db.prepare(`SELECT COUNT(*) as c FROM usuario`).get().c
  console.log('[inspect-db] usuario count =', count)

  const users = db.prepare(`
    SELECT id, username, role, active, created_at
    FROM usuario
    ORDER BY id ASC
    LIMIT 20
  `).all()

  console.log('[inspect-db] primeiros usuarios:', users)
} catch (e) {
  console.log('[inspect-db] query error:', e?.message)
} finally {
  db.close()
}
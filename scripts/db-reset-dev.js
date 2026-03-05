// Danger: deletes the local DB file and recreates schema.
// This script refuses to run in production.
//
// Usage:
//   node scripts/db-reset-dev.js --yes

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

if (!process.argv.includes('--yes')) {
  console.log('[db-reset-dev] Refusing to run without --yes')
  process.exit(1)
}

// Load env after we have a chance to guard.
const { env } = await import('../src/config/env.js')
if (env.NODE_ENV === 'production') {
  throw new Error('[db-reset-dev] Refusing to run in production')
}

const dbAbs = path.resolve(env.DB_PATH)

// Safety: only allow deleting DB inside this repo by default.
const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptsDir, '..')
const insideRepo = dbAbs.startsWith(repoRoot + path.sep)
const allowOutside = process.argv.includes('--allow-outside')
if (!insideRepo && !allowOutside) {
  throw new Error(
    `[db-reset-dev] DB_PATH fora do repo: ${dbAbs}\n` +
      'Use --allow-outside somente se tiver certeza do caminho.',
  )
}

for (const p of [dbAbs, `${dbAbs}-wal`, `${dbAbs}-shm`, `${dbAbs}-journal`]) {
  if (fs.existsSync(p)) {
    fs.rmSync(p, { force: true })
    console.log('[db-reset-dev] deleted', p)
  }
}

// Recreate schema (will also seed dev admin when DB is empty).
const { migrate } = await import('../src/db/migrate.js')
migrate()

console.log('[db-reset-dev] ok')

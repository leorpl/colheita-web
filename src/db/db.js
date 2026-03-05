import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { env } from '../config/env.js'

function ensureDirForFile(filePath) {
  const dir = path.dirname(path.resolve(filePath))
  fs.mkdirSync(dir, { recursive: true })
}

export const dbPathAbs = path.resolve(env.DB_PATH)
ensureDirForFile(dbPathAbs)

export const db = new Database(dbPathAbs)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

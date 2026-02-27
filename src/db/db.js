import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { env } from '../config/env.js'

function ensureDirForFile(filePath) {
  const dir = path.dirname(path.resolve(filePath))
  fs.mkdirSync(dir, { recursive: true })
}

ensureDirForFile(env.DB_PATH)

export const db = new Database(env.DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

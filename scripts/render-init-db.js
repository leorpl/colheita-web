import fs from 'node:fs'
import path from 'node:path'

function exists(p) {
  try {
    fs.accessSync(p)
    return true
  } catch {
    return false
  }
}

function ensureDirForFile(filePath) {
  const dir = path.dirname(path.resolve(filePath))
  fs.mkdirSync(dir, { recursive: true })
}

// No Render, eh comum usar Persistent Disk. Se o DB ainda nao existir no mount,
// copiamos um snapshot inicial versionado em ./data/app.db (se existir).
if (process.env.RENDER) {
  const dbPath = process.env.DB_PATH || './data/app.db'
  if (!exists(dbPath)) {
    const seedSnapshot = path.resolve('./data/app.db')
    if (exists(seedSnapshot)) {
      ensureDirForFile(dbPath)
      fs.copyFileSync(seedSnapshot, dbPath)
      // eslint-disable-next-line no-console
      console.log(`Initialized sqlite db from snapshot: ${seedSnapshot} -> ${dbPath}`)
    }
  }
}

import fs from 'node:fs'
import path from 'node:path'

import sharp from 'sharp'

const root = path.resolve(process.cwd())
const src = path.join(root, 'src', 'public', 'logo.png')
const outDir = path.join(root, 'src', 'public')

if (!fs.existsSync(src)) {
  throw new Error(`Nao achei o arquivo: ${src}`)
}

const meta = await sharp(src).metadata()
const w = Number(meta.width || 0)
const h = Number(meta.height || 0)
if (!w || !h) throw new Error('Falha ao ler dimensoes da logo')

// Corta a parte superior (passaro) para ficar legivel como favicon.
const cropH = Math.max(1, Math.round(h * 0.55))

async function writePng(fileName, size) {
  const out = path.join(outDir, fileName)
  await sharp(src)
    .extract({ left: 0, top: 0, width: w, height: cropH })
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .png({ compressionLevel: 9 })
    .toFile(out)
  return out
}

const files = await Promise.all([
  writePng('favicon-32.png', 32),
  writePng('favicon-192.png', 192),
  writePng('apple-touch-icon.png', 180),
])

console.log('Favicons gerados:')
files.forEach((f) => console.log('-', f))

import fs from 'node:fs'
import path from 'node:path'

import { migrate } from '../src/db/migrate.js'
import { db } from '../src/db/db.js'
import { destinoRegraRepo } from '../src/repositories/destinoRegraRepo.js'
import { logger } from '../src/logger.js'

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function parseUmidadeFaixas(tbRows) {
  const headerIdx = tbRows.findIndex(
    (r) => Array.isArray(r) && String(r[0] || '').includes('UMIDADE'),
  )
  if (headerIdx < 0) return []

  const faixas = []
  for (const r of tbRows.slice(headerIdx + 1)) {
    if (!Array.isArray(r)) continue
    const a = Number(r[0])
    const b = Number(r[1])
    const c = Number(r[2])
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) break
    if (a < 0 || b < 0 || a > 1 || b > 1) break
    faixas.push({ umid_gt: a, umid_lte: b, desconto_pct: c })
  }
  return faixas
}

function parsePadraoClassificacao(tbRows) {
  // Linha "COBRANÇA VENDA TERCEIROS:" termina com 6 numeros (Impureza..Quebrados).
  const row = tbRows.find(
    (r) =>
      Array.isArray(r) &&
      String(r[0] || '').toUpperCase().includes('COBRANÇA VENDA TERCEIROS'),
  )
  if (!row) return null

  const tail = row.slice(-6).map((v) => (v === null ? null : Number(v)))
  const safe = (n) => (Number.isFinite(n) ? n : 0)
  return {
    impureza_limite_pct: safe(tail[0]),
    ardidos_limite_pct: safe(tail[1]),
    queimados_limite_pct: safe(tail[2]),
    avariados_limite_pct: safe(tail[3]),
    esverdiados_limite_pct: safe(tail[4]),
    quebrados_limite_pct: safe(tail[5]),
  }
}

function inferLimitesFromColheita(dumpDir) {
  const colheita = readJson(path.join(dumpDir, 'COLHEITA.json'))
  const headerIdx = colheita.findIndex((r) => Array.isArray(r) && r[0] === 'FICHA')
  if (headerIdx < 0) {
    return {
      impureza_limite_pct: 0,
      ardidos_limite_pct: 0,
      queimados_limite_pct: 0.06,
      avariados_limite_pct: 0.01,
      esverdiados_limite_pct: 0.06,
      quebrados_limite_pct: 0,
    }
  }

  const header = colheita[headerIdx]
  const idx = (name) => header.indexOf(name)
  const sample = colheita.slice(headerIdx + 1).find((r) => Array.isArray(r) && r[0])
  if (!sample) {
    return {
      impureza_limite_pct: 0,
      ardidos_limite_pct: 0,
      queimados_limite_pct: 0.06,
      avariados_limite_pct: 0.01,
      esverdiados_limite_pct: 0.06,
      quebrados_limite_pct: 0,
    }
  }

  const val = (i, fallback = 0) => {
    const n = Number(sample[i])
    return Number.isFinite(n) ? n : fallback
  }

  return {
    impureza_limite_pct: val(idx('IMPUREZA  LIMITE(%)'), 0),
    ardidos_limite_pct: val(idx('ARDIDOS LIMITE(%)'), 0),
    queimados_limite_pct: val(idx('QUEIMADOS LIMITE(%)'), 0.06),
    avariados_limite_pct: val(idx('AVARIADOS  LIMITE(%)'), 0.01),
    esverdiados_limite_pct: val(idx('ESVERDIADOS LIMITE(%)'), 0.06),
    quebrados_limite_pct: val(idx('QUEBRADOS LIMITE(%)'), 0),
  }
}

function getSafraIdPreferida() {
  const row = db.prepare('SELECT id FROM safra WHERE safra=?').get('2025-2026')
  if (row?.id) return row.id
  return db.prepare('SELECT id FROM safra ORDER BY id ASC LIMIT 1').get()?.id ?? 1
}

function main() {
  migrate()
  const dumpDir = path.resolve(process.cwd(), '..', '_xlsx_dump')
  const tb01Path = path.join(dumpDir, 'TB01_AP.json')
  const tb02Path = path.join(dumpDir, 'TB02_GO.json')
  const tb04Path = path.join(dumpDir, 'TB04_PMG_P.json')

  const safra_id = getSafraIdPreferida()
  const limites = inferLimitesFromColheita(dumpDir)

  const tb01 = readJson(tb01Path)
  const tb02 = readJson(tb02Path)
  const tb04 = fs.existsSync(tb04Path) ? readJson(tb04Path) : null

  const faixasTB01 = parseUmidadeFaixas(tb01)
  const faixasTB02 = parseUmidadeFaixas(tb02)
  const faixasTB04 = tb04 ? parseUmidadeFaixas(tb04) : []

  const classTB01 = parsePadraoClassificacao(tb01)
  const classTB02 = parsePadraoClassificacao(tb02)
  const classTB04 = tb04 ? parsePadraoClassificacao(tb04) : null

  const destinos = db.prepare('SELECT * FROM destino ORDER BY id').all()
  const results = []

  const tx = db.transaction(() => {
    for (const d of destinos) {
      let faixas = []
      let padrao = null
      if (d.local.trim() === 'Formiga AP') faixas = faixasTB01
      if (d.local.trim() === 'Formiga AP') padrao = classTB01
      else if (d.local.trim() === 'Arcos - Grão de Ouro') {
        faixas = faixasTB02
        padrao = classTB02
      }
      else if (d.local.trim() === 'Iguatama - Agil') {
        // planilha fornecida nao contem aba TB03-AGIL; aplicar TB02 como padrao para nao bloquear operacao.
        faixas = faixasTB02
        padrao = classTB02
      } else if (d.local.trim() === 'Piumhi - PMG') {
        faixas = faixasTB04
        padrao = classTB04
      } else if (d.local.trim() === 'Formiga - PMG') {
        // nao existe aba especifica para Formiga - PMG; usar a mesma do PMG(P) por padrao.
        faixas = faixasTB04
        padrao = classTB04
      }

      const regra = destinoRegraRepo.upsert({
        safra_id,
        destino_id: d.id,
        trava_sacas: d.trava_sacas ?? null,
        ...(padrao ?? limites),
      })

      if (faixas.length) {
        destinoRegraRepo.replaceUmidadeFaixas(regra.id, faixas)
      }

      results.push({
        destino: d.local,
        destino_id: d.id,
        faixas: faixas.length,
      })
    }
  })

  tx()

  logger.info(
    {
      safra_id,
      limites,
      results,
    },
    'seed destino regras concluido',
  )

  console.log('Regras de destino cadastradas:')
  for (const r of results) {
    console.log(`- ${r.destino}: ${r.faixas} faixas de umidade`)
  }
}

main()

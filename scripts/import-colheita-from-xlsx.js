import path from 'node:path'

import XLSX from 'xlsx'

import { migrate } from '../src/db/migrate.js'
import { db } from '../src/db/db.js'
import { viagemService } from '../src/services/viagemService.js'

function usage() {
  return `
Uso:
  node scripts/import-colheita-from-xlsx.js --file "C:\\caminho\\planilha.xlsx" --sheet "COLHEITA" --safra "2025-2026" [--apply]

Padrao: dry-run (nao grava no banco).
  --apply: cria/atualiza as viagens.
`
}

function arg(name) {
  const i = process.argv.indexOf(name)
  if (i < 0) return null
  return process.argv[i + 1] ?? null
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function stripAccents(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function canon(s) {
  return stripAccents(String(s || ''))
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

function asText(v) {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function toNumber(v) {
  if (v === null || v === undefined || v === '') return NaN
  if (typeof v === 'number') return v
  const s = String(v).trim().replace(',', '.')
  return Number(s)
}

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return NaN
  return Math.round(x * 100) / 100
}

function sheetPercentTo100(v) {
  const x = Number(v)
  if (!Number.isFinite(x)) return NaN
  // Planilhas as vezes trazem percentuais como fracao (ex: 0.18 = 18%).
  if (x >= 0 && x <= 1) return x * 100
  return x
}

function excelDateToISO(v) {
  if (!v) return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const yyyy = v.getFullYear()
    const mm = String(v.getMonth() + 1).padStart(2, '0')
    const dd = String(v.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
    // Excel 1900 system: day 0 = 1899-12-30
    const epoch = Date.UTC(1899, 11, 30)
    const ms = epoch + Math.round(v * 86400000)
    const d = new Date(ms)
    const yyyy = d.getUTCFullYear()
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  const s = asText(v)
  if (!s) return null
  // tenta dd/mm/yyyy
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m) {
    const dd = String(m[1]).padStart(2, '0')
    const mm = String(m[2]).padStart(2, '0')
    let yyyy = m[3]
    if (yyyy.length === 2) yyyy = `20${yyyy}`
    return `${yyyy}-${mm}-${dd}`
  }
  // tenta yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return null
}

function excelTimeToHHMM(v) {
  if (!v && v !== 0) return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const hh = String(v.getHours()).padStart(2, '0')
    const mm = String(v.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  }
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1) {
    const totalMinutes = Math.round(v * 24 * 60)
    const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')
    const mm = String(totalMinutes % 60).padStart(2, '0')
    return `${hh}:${mm}`
  }
  const s = asText(v)
  if (!s) return null
  const m = s.match(/^(\d{1,2}):(\d{2})/) // HH:MM
  if (m) return `${String(m[1]).padStart(2, '0')}:${m[2]}`
  return null
}

function buildHeaderIndex(headerRow) {
  const idx = {}
  headerRow.forEach((h, i) => {
    const k = canon(h)
    if (!k) return
    if (idx[k] === undefined) idx[k] = i
  })
  return idx
}

function firstHeaderRow(rows) {
  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const row = rows[r]
    if (!Array.isArray(row)) continue
    const line = row.map((x) => canon(x)).filter(Boolean)
    if (!line.length) continue
    const hasFicha = line.includes('FICHA')
    const hasSafra = line.includes('SAFRA')
    const hasTalhao = line.some((x) => x.includes('TALHAO'))
    const hasDestino = line.includes('DESTINO') || line.includes('DESTINA')
    if (hasFicha && (hasTalhao || hasDestino || hasSafra)) return r
  }
  return -1
}

function pick(idx, keys) {
  for (const k of keys) {
    if (idx[k] !== undefined) return idx[k]
  }
  return -1
}

function readSheet(filePath, sheetName) {
  const wb = XLSX.readFile(filePath, { cellDates: true })
  const name = sheetName || wb.SheetNames.find((s) => canon(s) === 'COLHEITA')
  if (!name) throw new Error(`Nao achei a aba: ${sheetName || 'COLHEITA'}`)
  const ws = wb.Sheets[name]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })
  return { name, rows }
}

function getSafraIdByNome(safraNome) {
  const row = db.prepare('SELECT id FROM safra WHERE safra=?').get(safraNome)
  if (!row?.id) throw new Error(`Safra nao encontrada no banco: ${safraNome}`)
  return row.id
}

function loadLookups() {
  const talhoes = db
    .prepare('SELECT id, codigo, local, nome FROM talhao')
    .all()
  const destinos = db.prepare('SELECT id, codigo, local FROM destino').all()
  const motoristas = db.prepare('SELECT id, nome, placa FROM motorista').all()

  const talhaoByCodigo = new Map()
  const talhaoByLocalNome = new Map()
  for (const t of talhoes) {
    talhaoByCodigo.set(canon(t.codigo), t)
    talhaoByLocalNome.set(`${canon(t.local)}|${canon(t.nome)}`, t)
  }

  const destinoByCodigo = new Map()
  const destinoByLocal = new Map()
  for (const d of destinos) {
    if (d.codigo) destinoByCodigo.set(canon(d.codigo), d)
    destinoByLocal.set(canon(d.local), d)
  }

  const motoristaByNome = new Map()
  for (const m of motoristas) {
    motoristaByNome.set(canon(m.nome), m)
  }

  return {
    talhaoByCodigo,
    talhaoByLocalNome,
    destinoByCodigo,
    destinoByLocal,
    motoristaByNome,
  }
}

function findTalhao({ codigo, local, nome }, lk) {
  if (codigo) {
    const t = lk.talhaoByCodigo.get(canon(codigo))
    if (t) return t
  }
  if (local && nome) {
    const t = lk.talhaoByLocalNome.get(`${canon(local)}|${canon(nome)}`)
    if (t) return t

    // Alguns descritivos vêm invertidos (ex: local="Varzea" nome="Nilson").
    const inv = lk.talhaoByLocalNome.get(`${canon(nome)}|${canon(local)}`)
    if (inv) return inv
  }
  return null
}

function findDestino({ codigo, local }, lk) {
  if (codigo) {
    const d = lk.destinoByCodigo.get(canon(codigo))
    if (d) return d
  }
  if (local) {
    const d = lk.destinoByLocal.get(canon(local))
    if (d) return d
  }
  return null
}

function findMotorista({ nome }, lk) {
  if (!nome) return null
  return lk.motoristaByNome.get(canon(nome)) || null
}

function getExistingViagemId({ safra_id, ficha }) {
  const row = db
    .prepare(
      'SELECT id FROM viagem WHERE safra_id=? AND ficha=? ORDER BY id DESC LIMIT 1',
    )
    .get(safra_id, ficha)
  return row?.id ?? null
}

function shouldSkipNotLaunched(row) {
  // regra simples: sem carga/tara ou sem destino/motorista => nao lancado
  if (!row.ficha) return true
  if (!Number.isFinite(row.carga_total_kg) || !Number.isFinite(row.tara_kg)) return true
  if (!row.destino_local && !row.destino_codigo) return true
  if (!row.motorista_nome) return true
  return false
}

function main() {
  const file = arg('--file')
  const sheet = arg('--sheet') || 'COLHEITA'
  const safraNome = arg('--safra') || '2025-2026'
  if (!file) {
    console.error(usage())
    process.exit(2)
  }
  const apply = hasFlag('--apply')
  const list = hasFlag('--list')
  const onlyFichaFrom = arg('--only-ficha-from')
  const onlyFichaTo = arg('--only-ficha-to')

  migrate()

  const safra_id = getSafraIdByNome(safraNome)
  const lk = loadLookups()

  const { name: usedSheet, rows } = readSheet(file, sheet)
  const headerRowIdx = firstHeaderRow(rows)
  if (headerRowIdx < 0) throw new Error('Nao achei o header na aba COLHEITA')
  const header = rows[headerRowIdx]
  const idx = buildHeaderIndex(header)

  const cFicha = pick(idx, ['FICHA'])
  const cDataSaida = pick(idx, ['DATA SAIDA', 'DATA DE SAIDA', 'DATA'])
  const cHoraSaida = pick(idx, ['HORA SAIDA', 'HORA DE SAIDA', 'HORA'])
  const cPlaca = pick(idx, ['PLACA'])
  const cMotorista = pick(idx, ['MOTORISTA'])
  const cDestino = pick(idx, ['DESTINO', 'DESTINA'])
  const cDestinoCod = pick(idx, ['COD DESTINO', 'CODIGO DESTINO', 'COD DEST'])
  const cTalhao = pick(idx, ['TALHAO', 'TALHAO NOME', 'NOME TALHAO'])
  const cTalhaoCod = pick(idx, ['COD TALHAO', 'CODIGO TALHAO', 'TALHAO COD'])
  const cLocal = pick(idx, ['LOCAL'])

  const cCarga = pick(idx, ['CARGA TOTAL', 'CARGA TOTAL KG', 'CARGA (KG)', 'CARGA KG', 'CARGA'])
  const cTara = pick(idx, ['TARA', 'TARA KG', 'TARA (KG)'])

  const cUmid = pick(idx, ['UMIDADE', 'UMIDADE %', 'UMIDADE PCT'])
  const cImp = pick(idx, ['IMPUREZA', 'IMPUREZA %'])
  const cArd = pick(idx, ['ARDIDOS', 'ARDIDOS %'])
  const cQue = pick(idx, ['QUEIMADOS', 'QUEIMADOS %'])
  const cAva = pick(idx, ['AVARIADOS', 'AVARIADOS %'])
  const cEsv = pick(idx, ['ESVERDIADOS', 'ESVERDIADOS %'])
  const cQbr = pick(idx, ['QUEBRADOS', 'QUEBRADOS %'])

  const out = []
  const errors = []
  let skippedNotLaunched = 0

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r]
    if (!Array.isArray(row)) continue
    const fichaRaw = asText(row[cFicha])
    const ficha = fichaRaw ? String(Number.parseInt(fichaRaw, 10)) : ''
    const parsed = {
      r,
      ficha,
      data_saida: excelDateToISO(row[cDataSaida]),
      hora_saida: excelTimeToHHMM(row[cHoraSaida]),
      placa: asText(row[cPlaca]) || null,
      motorista_nome: asText(row[cMotorista]) || null,
      destino_local: asText(row[cDestino]) || null,
      destino_codigo: asText(row[cDestinoCod]) || null,
      talhao_nome: asText(row[cTalhao]) || null,
      talhao_codigo: asText(row[cTalhaoCod]) || null,
      talhao_local: asText(row[cLocal]) || null,
      carga_total_kg: toNumber(row[cCarga]),
      tara_kg: toNumber(row[cTara]),
      umidade_pct_100: toNumber(row[cUmid]),
      impureza_pct_100: toNumber(row[cImp]),
      ardidos_pct_100: toNumber(row[cArd]),
      queimados_pct_100: toNumber(row[cQue]),
      avariados_pct_100: toNumber(row[cAva]),
      esverdiados_pct_100: toNumber(row[cEsv]),
      quebrados_pct_100: toNumber(row[cQbr]),
    }

    if (onlyFichaFrom || onlyFichaTo) {
      const n = Number.parseInt(parsed.ficha || '0', 10)
      const fromN = onlyFichaFrom ? Number.parseInt(String(onlyFichaFrom), 10) : null
      const toN = onlyFichaTo ? Number.parseInt(String(onlyFichaTo), 10) : null
      if (Number.isFinite(fromN) && n < fromN) continue
      if (Number.isFinite(toN) && n > toN) continue
    }

    if (!parsed.ficha && !parsed.motorista_nome && !parsed.destino_local) continue
    if (shouldSkipNotLaunched(parsed)) {
      skippedNotLaunched++
      continue
    }

    const motorista = findMotorista({ nome: parsed.motorista_nome }, lk)
    if (!motorista) {
      errors.push({ r, ficha: parsed.ficha, error: `Motorista nao encontrado: ${parsed.motorista_nome}` })
      continue
    }

    const destino = findDestino(
      { codigo: parsed.destino_codigo, local: parsed.destino_local },
      lk,
    )
    if (!destino) {
      errors.push({ r, ficha: parsed.ficha, error: `Destino nao encontrado: ${parsed.destino_local || parsed.destino_codigo}` })
      continue
    }

    const talhao = findTalhao(
      {
        codigo: parsed.talhao_codigo,
        local: parsed.talhao_local,
        nome: parsed.talhao_nome,
      },
      lk,
    )
    if (!talhao) {
      errors.push({ r, ficha: parsed.ficha, error: `Talhao nao encontrado: ${parsed.talhao_codigo || ''} ${parsed.talhao_local || ''} ${parsed.talhao_nome || ''}`.trim() })
      continue
    }

    out.push({ parsed, motorista, destino, talhao })
  }

  console.log(`Arquivo: ${path.resolve(file)}`)
  console.log(`Aba: ${usedSheet}`)
  console.log(`Safra: ${safraNome} (#${safra_id})`)
  console.log(`Linhas importaveis: ${out.length}`)
  console.log(`Linhas puladas (nao lancadas): ${skippedNotLaunched}`)
  console.log(`Erros (nao importadas): ${errors.length}`)
  if (errors.length) {
    console.log('--- Erros (primeiros 20) ---')
    for (const e of errors.slice(0, 20)) {
      console.log(`#${e.r + 1} ficha=${e.ficha || '-'} :: ${e.error}`)
    }
  }

  if (list) {
    console.log('--- Itens (primeiros 25) ---')
    for (const x of out.slice(0, 25)) {
      const { parsed, motorista, destino, talhao } = x
      console.log(
        `ficha=${parsed.ficha} data=${parsed.data_saida || '-'} ${talhao.codigo} ${talhao.local || ''} ${talhao.nome || ''} -> ${destino.local || ''} | ${motorista.nome}`,
      )
    }
  }

  if (!apply) {
    console.log('\nDry-run: nao gravei nada. Use --apply para importar.')
    return
  }

  // Validar + aplicar em transacao (tudo ou nada)
  const tx = db.transaction(() => {
    let created = 0
    let updated = 0
    for (const x of out) {
      const { parsed, motorista, destino, talhao } = x
      const ficha = String(Number.parseInt(parsed.ficha, 10)).padStart(3, '0')
      const body = {
        ficha,
        safra_id,
        tipo_plantio: null,
        talhao_id: talhao.id,
        local: talhao.local || null,
        destino_id: destino.id,
        motorista_id: motorista.id,
        placa: parsed.placa || motorista.placa || null,
        data_saida: parsed.data_saida || null,
        hora_saida: parsed.hora_saida || null,
        data_entrega: null,
        hora_entrega: null,
        carga_total_kg: parsed.carga_total_kg,
        tara_kg: parsed.tara_kg,
        umidade_pct: Number.isFinite(parsed.umidade_pct_100)
          ? round2(sheetPercentTo100(parsed.umidade_pct_100))
          : 0,
        umidade_desc_pct_manual: null,
        impureza_pct: Number.isFinite(parsed.impureza_pct_100)
          ? round2(sheetPercentTo100(parsed.impureza_pct_100))
          : 0,
        ardidos_pct: Number.isFinite(parsed.ardidos_pct_100)
          ? round2(sheetPercentTo100(parsed.ardidos_pct_100))
          : 0,
        queimados_pct: Number.isFinite(parsed.queimados_pct_100)
          ? round2(sheetPercentTo100(parsed.queimados_pct_100))
          : 0,
        avariados_pct: Number.isFinite(parsed.avariados_pct_100)
          ? round2(sheetPercentTo100(parsed.avariados_pct_100))
          : 0,
        esverdiados_pct: Number.isFinite(parsed.esverdiados_pct_100)
          ? round2(sheetPercentTo100(parsed.esverdiados_pct_100))
          : 0,
        quebrados_pct: Number.isFinite(parsed.quebrados_pct_100)
          ? round2(sheetPercentTo100(parsed.quebrados_pct_100))
          : 0,
        // Nao forcar limites no lancamento: deixar a regra do destino (se existir) decidir.
        impureza_limite_pct: null,
        ardidos_limite_pct: null,
        queimados_limite_pct: null,
        avariados_limite_pct: null,
        esverdiados_limite_pct: null,
        quebrados_limite_pct: null,
      }

      try {
        // valida antes de gravar (gera erro com campo)
        viagemService.buildPayload(body)
      } catch (e) {
        const msg = String(e?.message || e)
        throw new Error(
          `Falha ao validar linha #${parsed.r + 1} (ficha ${parsed.ficha}): ${msg}`,
          { cause: e },
        )
      }

      const id = getExistingViagemId({ safra_id, ficha })
      if (id) {
        viagemService.update(id, body)
        updated++
      } else {
        viagemService.create(body)
        created++
      }
    }
    return { created, updated }
  })

  const r = tx()
  console.log(`\nImportacao concluida: ${r.created} criadas, ${r.updated} atualizadas.`)
}

try {
  main()
} catch (e) {
  console.error(String(e?.stack || e?.message || e))
  process.exit(1)
}

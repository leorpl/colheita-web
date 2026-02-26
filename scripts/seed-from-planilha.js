import fs from 'node:fs'
import path from 'node:path'

import { migrate } from '../src/db/migrate.js'
import { db } from '../src/db/db.js'
import { viagemService } from '../src/services/viagemService.js'
import { logger } from '../src/logger.js'

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(raw)
}

function excelSerialToISODate(serial) {
  if (serial === null || serial === undefined || serial === '') return null
  const n = Number(serial)
  if (!Number.isFinite(n) || n <= 0) return null
  // Excel 1900 system: day 0 = 1899-12-30
  const epoch = Date.UTC(1899, 11, 30)
  const ms = epoch + Math.round(n * 86400000)
  const d = new Date(ms)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function excelTimeFractionToHHMM(frac) {
  if (frac === null || frac === undefined || frac === '') return null
  const n = Number(frac)
  if (!Number.isFinite(n) || n <= 0) return null
  const totalMinutes = Math.round(n * 24 * 60)
  const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')
  const mm = String(totalMinutes % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

function normText(v) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s ? s : null
}

function upsertSafra({ safra, plantio, area_ha }) {
  db.prepare(
    `INSERT INTO safra (safra, plantio, area_ha, updated_at)
     VALUES (@safra, @plantio, @area_ha, datetime('now'))
     ON CONFLICT(safra) DO UPDATE SET
       plantio=excluded.plantio,
       area_ha=excluded.area_ha,
       updated_at=datetime('now')`,
  ).run({ safra, plantio, area_ha })

  return db.prepare('SELECT * FROM safra WHERE safra=?').get(safra)
}

function upsertTalhao({ codigo, local, nome, situacao, hectares, posse, contrato, observacoes }) {
  db.prepare(
    `INSERT INTO talhao (codigo, local, nome, situacao, hectares, posse, contrato, observacoes, updated_at)
     VALUES (@codigo, @local, @nome, @situacao, @hectares, @posse, @contrato, @observacoes, datetime('now'))
     ON CONFLICT(codigo) DO UPDATE SET
       local=excluded.local,
       nome=excluded.nome,
       situacao=excluded.situacao,
       hectares=excluded.hectares,
       posse=excluded.posse,
       contrato=excluded.contrato,
       observacoes=excluded.observacoes,
       updated_at=datetime('now')`,
  ).run({ codigo, local, nome, situacao, hectares, posse, contrato, observacoes })

  return db.prepare('SELECT * FROM talhao WHERE codigo=?').get(codigo)
}

function upsertDestino({ codigo, local, trava_sacas, distancia_km, observacoes }) {
  db.prepare(
    `INSERT INTO destino (codigo, local, trava_sacas, distancia_km, observacoes, updated_at)
     VALUES (@codigo, @local, @trava_sacas, @distancia_km, @observacoes, datetime('now'))
     ON CONFLICT(codigo) DO UPDATE SET
       local=excluded.local,
       trava_sacas=excluded.trava_sacas,
       distancia_km=excluded.distancia_km,
       observacoes=excluded.observacoes,
       updated_at=datetime('now')`,
  ).run({ codigo, local, trava_sacas, distancia_km, observacoes })

  return db.prepare('SELECT * FROM destino WHERE codigo=?').get(codigo)
}

function upsertMotorista({ nome, placa, cpf, banco, pix_conta, tipo_veiculo, capacidade_kg }) {
  db.prepare(
    `INSERT INTO motorista (nome, placa, cpf, banco, pix_conta, tipo_veiculo, capacidade_kg, updated_at)
     VALUES (@nome, @placa, @cpf, @banco, @pix_conta, @tipo_veiculo, @capacidade_kg, datetime('now'))
     ON CONFLICT(nome) DO UPDATE SET
       placa=COALESCE(excluded.placa, motorista.placa),
       cpf=COALESCE(excluded.cpf, motorista.cpf),
       banco=COALESCE(excluded.banco, motorista.banco),
       pix_conta=COALESCE(excluded.pix_conta, motorista.pix_conta),
       tipo_veiculo=COALESCE(excluded.tipo_veiculo, motorista.tipo_veiculo),
       capacidade_kg=COALESCE(excluded.capacidade_kg, motorista.capacidade_kg),
       updated_at=datetime('now')`,
  ).run({ nome, placa, cpf, banco, pix_conta, tipo_veiculo, capacidade_kg })

  return db.prepare('SELECT * FROM motorista WHERE nome=?').get(nome)
}

function getDestinoIdByLocal(local) {
  const row = db
    .prepare('SELECT id FROM destino WHERE TRIM(local) = TRIM(?)')
    .get(local)
  return row?.id ?? null
}

function getTalhaoIdByLocalNome(local, nome) {
  const row = db
    .prepare('SELECT id FROM talhao WHERE TRIM(local)=TRIM(?) AND TRIM(nome)=TRIM(?)')
    .get(local, nome)
  return row?.id ?? null
}

function seedSafras(dumpDir) {
  const filePath = path.join(dumpDir, 'SAFRAS.json')
  const rows = readJson(filePath)
  // header esperado: ITEM, SAFRA, PLANTIO, AREA, ...
  const headerRow = rows.find((r) => Array.isArray(r) && r.includes('SAFRA'))
  const headerIdx = rows.indexOf(headerRow)
  if (headerIdx < 0) throw new Error('Nao achei header em SAFRAS.json')

  const idxSafra = headerRow.indexOf('SAFRA')
  const idxPlantio = headerRow.indexOf('PLANTIO')
  const idxArea = headerRow.indexOf('AREA')

  let count = 0
  for (const r of rows.slice(headerIdx + 1)) {
    const safra = normText(r[idxSafra])
    if (!safra) continue
    const plantio = normText(r[idxPlantio])
    const area_ha = Number(r[idxArea] ?? 0)
    upsertSafra({ safra, plantio, area_ha })
    count++
  }
  return count
}

function seedTalhoes(dumpDir) {
  const filePath = path.join(dumpDir, 'TALHOES.json')
  const rows = readJson(filePath)
  const headerRow = rows.find((r) => Array.isArray(r) && r[0] === 'CÓDIGO')
  const headerIdx = rows.indexOf(headerRow)
  if (headerIdx < 0) throw new Error('Nao achei header em TALHOES.json')

  const idxCodigo = 0
  const idxLocal = headerRow.indexOf('LOCAL')
  const idxNome = headerRow.indexOf('NOME TALHÃO')
  const idxSituacao = headerRow.indexOf('SITUAÇÃO')
  const idxHectares = headerRow.indexOf('HECTÁRES')
  const idxPosse = headerRow.indexOf('TIPO DE POSSE')
  const idxContrato = headerRow.indexOf('CONTRATO')
  const idxObs = headerRow.indexOf('OBSERVAÇÕES')

  let count = 0
  for (const r of rows.slice(headerIdx + 1)) {
    const codigo = normText(r[idxCodigo])
    if (!codigo) continue
    const local = normText(r[idxLocal])
    const nome = normText(r[idxNome])
    const situacao = normText(r[idxSituacao])
    const hectares = Number(r[idxHectares] ?? 0)
    const posse = idxPosse >= 0 ? normText(r[idxPosse]) : null
    const contrato = idxContrato >= 0 ? normText(r[idxContrato]) : null
    const observacoes = idxObs >= 0 ? normText(r[idxObs]) : null

    upsertTalhao({ codigo, local, nome, situacao, hectares, posse, contrato, observacoes })
    count++
  }
  return count
}

function seedDestinos(dumpDir) {
  const filePath = path.join(dumpDir, 'DESTINOS.json')
  const rows = readJson(filePath)
  const headerRow = rows.find((r) => Array.isArray(r) && r[0] === 'ITEM')
  const headerIdx = rows.indexOf(headerRow)
  if (headerIdx < 0) throw new Error('Nao achei header em DESTINOS.json')

  const idxLocal = headerRow.indexOf('LOCAL')
  const idxTrava = headerRow.indexOf('TRAVA')
  const idxDist = headerRow.indexOf('DISTÂNCIA')
  const idxObs = headerRow.indexOf('OBSERVAÇÕES')

  let count = 0
  for (const r of rows.slice(headerIdx + 1)) {
    // formato esperado do dump:
    // [codigoDestino, nomeDestino, trava, entrega, distancia, obs]
    const code = normText(r[0])
    if (!code) continue

    const local = idxLocal >= 0 ? normText(r[idxLocal]) : normText(r[1])
    if (!local) continue

    const travaRaw = idxTrava >= 0 ? r[idxTrava] : null
    const trava_sacas = travaRaw === null || travaRaw === undefined || travaRaw === '' ? null : Number(travaRaw)
    const distancia_km = idxDist >= 0 && r[idxDist] !== null && r[idxDist] !== undefined && r[idxDist] !== ''
      ? Number(r[idxDist])
      : null
    const observacoes = idxObs >= 0 ? normText(r[idxObs]) : null

    upsertDestino({ codigo: code, local, trava_sacas, distancia_km, observacoes })
    count++
  }
  return count
}

function seedMotoristasEFretes(dumpDir) {
  const filePath = path.join(dumpDir, 'MOTORISTAS_E_FRETES.json')
  const rows = readJson(filePath)

  const headerRow = rows.find((r) => Array.isArray(r) && r.includes('MOTORISTA'))
  const headerIdx = rows.indexOf(headerRow)
  if (headerIdx < 0) throw new Error('Nao achei header em MOTORISTAS_E_FRETES.json')

  const idxMotorista = headerRow.indexOf('MOTORISTA')
  const idxPlaca = headerRow.indexOf('PLACA')
  const idxCpf = headerRow.indexOf('CPF')
  const idxBanco = headerRow.indexOf('BANCO')
  const idxPix = headerRow.indexOf('PIX/CONTA')
  const idxTipo = headerRow.indexOf('TIPO DE VEÍCULO')
  const idxCap = headerRow.indexOf('CAPACIDADE')

  const idxValorStart = headerRow.indexOf('VALOR')
  const destinoCols = []
  for (let i = idxValorStart + 1; i < headerRow.length; i++) {
    const name = normText(headerRow[i])
    if (!name) continue
    if (name.toUpperCase() === 'OBSERVAÇÕES') break
    destinoCols.push({ name, index: i })
  }

  let motoristasCount = 0
  let fretesCount = 0

  const safraDefault = db.prepare('SELECT id FROM safra ORDER BY id ASC LIMIT 1').get()?.id ?? 1

  for (const r of rows.slice(headerIdx + 1)) {
    const nome = normText(r[idxMotorista])
    if (!nome) continue

    const motorista = upsertMotorista({
      nome,
      placa: normText(r[idxPlaca]),
      cpf: idxCpf >= 0 ? normText(r[idxCpf]) : null,
      banco: idxBanco >= 0 ? normText(r[idxBanco]) : null,
      pix_conta: idxPix >= 0 ? normText(r[idxPix]) : null,
      tipo_veiculo: idxTipo >= 0 ? normText(r[idxTipo]) : null,
      capacidade_kg: idxCap >= 0 && r[idxCap] !== null && r[idxCap] !== undefined && r[idxCap] !== ''
        ? Number(r[idxCap])
        : null,
    })
    motoristasCount++

    for (const dc of destinoCols) {
      const destinoId = getDestinoIdByLocal(dc.name)
      if (!destinoId) continue
      const rate = r[dc.index]
      if (rate === null || rate === undefined || rate === '') continue
      const valor = Number(rate)
      if (!Number.isFinite(valor) || valor <= 0) continue

      db.prepare(
        `INSERT INTO frete (safra_id, motorista_id, destino_id, valor_por_saca, updated_at)
         VALUES (@safra_id, @motorista_id, @destino_id, @valor_por_saca, datetime('now'))
         ON CONFLICT(safra_id, motorista_id, destino_id) DO UPDATE SET
           valor_por_saca=excluded.valor_por_saca,
           updated_at=datetime('now')`,
      ).run({ safra_id: safraDefault, motorista_id: motorista.id, destino_id: destinoId, valor_por_saca: valor })
      fretesCount++
    }
  }

  return { motoristasCount, fretesCount }
}

function seedViagens(dumpDir) {
  const filePath = path.join(dumpDir, 'COLHEITA.json')
  const rows = readJson(filePath)
  const headerRow = rows.find((r) => Array.isArray(r) && r[0] === 'FICHA')
  const headerIdx = rows.indexOf(headerRow)
  if (headerIdx < 0) throw new Error('Nao achei header em COLHEITA.json')

  const idx = (name) => headerRow.indexOf(name)

  let count = 0
  let skipped = 0

  for (const r of rows.slice(headerIdx + 1)) {
    const fichaNum = r[0]
    if (fichaNum === null || fichaNum === undefined || fichaNum === '') continue
    const ficha = String(fichaNum).padStart(3, '0')

    const safraNome = normText(r[idx('SAFRA')])
    if (!safraNome) continue
    const safraRow = db.prepare('SELECT * FROM safra WHERE safra=?').get(safraNome)
    if (!safraRow) {
      upsertSafra({ safra: safraNome, plantio: normText(r[idx('TIPO PLANTIO')]), area_ha: 0 })
    }
    const safra_id = db.prepare('SELECT id FROM safra WHERE safra=?').get(safraNome).id

    const localTalhao = normText(r[idx('LOCAL')])
    const nomeTalhao = normText(r[idx('NOME TALHÃO')])
    const destinoLocal = normText(r[idx('DESTINO')])
    const motoristaNome = normText(r[idx('MOTORISTA')])
    if (!localTalhao || !nomeTalhao || !destinoLocal || !motoristaNome) {
      skipped++
      continue
    }

    const talhao_id = getTalhaoIdByLocalNome(localTalhao, nomeTalhao)
    const destino_id = getDestinoIdByLocal(destinoLocal)

    if (!talhao_id || !destino_id) {
      skipped++
      continue
    }

    const motorista = upsertMotorista({ nome: motoristaNome, placa: normText(r[idx('PLACA')]) })
    const motorista_id = motorista.id

    // garantir que existe frete (se nao houver, usar o valor da planilha para esta viagem)
    const freteTabela = r[idx('FRETE TABELA')]
    if (freteTabela !== null && freteTabela !== undefined && freteTabela !== '') {
      const valor = Number(freteTabela)
      if (Number.isFinite(valor) && valor > 0) {
        db.prepare(
          `INSERT INTO frete (safra_id, motorista_id, destino_id, valor_por_saca, updated_at)
           VALUES (@safra_id, @motorista_id, @destino_id, @valor_por_saca, datetime('now'))
           ON CONFLICT(safra_id, motorista_id, destino_id) DO UPDATE SET
             valor_por_saca=excluded.valor_por_saca,
             updated_at=datetime('now')`,
        ).run({ safra_id, motorista_id, destino_id, valor_por_saca: valor })
      }
    }

    const payload = {
      ficha,
      safra_id,
      tipo_plantio: normText(r[idx('TIPO PLANTIO')]),
      talhao_id,
      local: localTalhao,
      destino_id,
      motorista_id,
      placa: normText(r[idx('PLACA')]),

      data_saida: excelSerialToISODate(r[idx('DATA SAÍDA')]),
      hora_saida: excelTimeFractionToHHMM(r[idx('HORA SAÍDA')]),
      data_entrega: excelSerialToISODate(r[idx('DATA ENTREGA SILO')]),
      hora_entrega: excelTimeFractionToHHMM(r[idx('HORA ENTREGA')]),

      carga_total_kg: Number(r[idx('CARGA TOTAL (KG)')] ?? 0),
      tara_kg: Number(r[idx('TARA (KG)')] ?? 0),

      umidade_pct: Number(r[idx('UMIDADE (%)')] ?? 0),
      impureza_pct: Number(r[idx('IMPUREZA  (%)')] ?? 0),
      ardidos_pct: Number(r[idx('ARDIDOS (%)')] ?? 0),
      queimados_pct: Number(r[idx('QUEIMADOS (%)')] ?? 0),
      avariados_pct: Number(r[idx('AVARIADOS  (%)')] ?? 0),
      esverdiados_pct: Number(r[idx('ESVERDIADOS (%)')] ?? 0),
      quebrados_pct: Number(r[idx('QUEBRADOS (%)')] ?? 0),

      impureza_limite_pct: Number(r[idx('IMPUREZA  LIMITE(%)')] ?? 0),
      ardidos_limite_pct: Number(r[idx('ARDIDOS LIMITE(%)')] ?? 0),
      queimados_limite_pct: Number(r[idx('QUEIMADOS LIMITE(%)')] ?? 0),
      avariados_limite_pct: Number(r[idx('AVARIADOS  LIMITE(%)')] ?? 0),
      esverdiados_limite_pct: Number(r[idx('ESVERDIADOS LIMITE(%)')] ?? 0),
      quebrados_limite_pct: Number(r[idx('QUEBRADOS LIMITE(%)')] ?? 0),
    }

    try {
      viagemService.create(payload)
      count++
    } catch {
      // se ja existe (safra_id, ficha) ou outra falha, apenas pular
      skipped++
    }
  }

  return { count, skipped }
}

function main() {
  const dumpDir = path.resolve(process.cwd(), '..', '_xlsx_dump')
  if (!fs.existsSync(dumpDir)) {
    throw new Error(`Diretorio de dump nao encontrado: ${dumpDir}`)
  }

  migrate()

  const tx = db.transaction(() => {
    const safras = seedSafras(dumpDir)
    const talhoes = seedTalhoes(dumpDir)
    const destinos = seedDestinos(dumpDir)
    const { motoristasCount, fretesCount } = seedMotoristasEFretes(dumpDir)
    const { count: viagensCount, skipped: viagensSkipped } = seedViagens(dumpDir)

    return { safras, talhoes, destinos, motoristasCount, fretesCount, viagensCount, viagensSkipped }
  })

  const result = tx()
  logger.info(result, 'seed concluido')

  // output amigavel pra CLI
  console.log('Seed concluido:')
  console.log(`- Safras: ${result.safras}`)
  console.log(`- Talhoes: ${result.talhoes}`)
  console.log(`- Destinos: ${result.destinos}`)
  console.log(`- Motoristas: ${result.motoristasCount}`)
  console.log(`- Fretes: ${result.fretesCount}`)
  console.log(`- Viagens importadas: ${result.viagensCount} (puladas: ${result.viagensSkipped})`)
}

main()

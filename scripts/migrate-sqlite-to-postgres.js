import sqlite3 from 'sqlite3'

import { PrismaClient } from '../src/generated/prisma/index.js'

function requiredEnv(name) {
  const v = String(process.env[name] || '').trim()
  if (!v) throw new Error(`${name} is required`)
  return v
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function openSqliteReadOnly(file) {
  const db = new sqlite3.Database(file, sqlite3.OPEN_READONLY)
  const all = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err)
        resolve(rows)
      })
    })
  const get = (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) return reject(err)
        resolve(row)
      })
    })
  const close = () =>
    new Promise((resolve, reject) => {
      db.close((err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  return { all, get, close }
}

async function setSequence(prisma, table) {
  // Usa o nome do sequence criado por SERIAL.
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"${table}"','id'), (SELECT COALESCE(MAX(id), 1) FROM "${table}"), true);`,
  )
}

async function ensureEmptyOrMode(prisma, mode, modelName, tableName) {
  const c = await prisma[modelName].count()
  if (c === 0) return
  if (mode === 'merge') return
  throw new Error(
    `Tabela destino nao esta vazia: ${tableName} (count=${c}). Use MIGRATE_MODE=merge se quiser mesclar.`,
  )
}

async function migrateTableCreateMany({ prisma, sqlite, modelName, tableName, rows, batchSize = 1000 }) {
  if (!rows.length) return { inserted: 0 }
  let inserted = 0
  for (const part of chunk(rows, batchSize)) {
    const r = await prisma[modelName].createMany({ data: part })
    inserted += Number(r.count || 0)
  }
  await setSequence(prisma, tableName)
  return { inserted }
}

async function migrateTableUpsertById({ prisma, modelName, rows }) {
  let upserted = 0
  for (const row of rows) {
    const { id, ...rest } = row
    await prisma[modelName].upsert({
      where: { id: Number(id) },
      create: { id: Number(id), ...rest },
      update: rest,
    })
    upserted++
  }
  return { upserted }
}

async function main() {
  // Entradas
  const sqlitePath = requiredEnv('SQLITE_PATH')
  // DATABASE_URL e carregado pelo Prisma via env; valida aqui para falhar cedo.
  requiredEnv('DATABASE_URL')

  const mode = String(process.env.MIGRATE_MODE || 'abort').trim().toLowerCase()
  if (!['abort', 'merge'].includes(mode)) {
    throw new Error('MIGRATE_MODE invalido. Use abort (padrao) ou merge.')
  }

  const prisma = new PrismaClient()
  const sqlite = openSqliteReadOnly(sqlitePath)

  try {
    // Ordem por dependencias/FKs
    const plan = [
      { table: 'plantio_tipo', model: 'plantioTipo' },
      { table: 'safra', model: 'safra' },
      { table: 'talhao', model: 'talhao' },
      { table: 'destino', model: 'destino' },
      { table: 'motorista', model: 'motorista' },
      { table: 'frete', model: 'frete' },
      { table: 'destino_regra', model: 'destinoRegra' },
      { table: 'destino_regra_plantio', model: 'destinoRegraPlantio' },
      { table: 'umidade_faixa', model: 'umidadeFaixa' },
      { table: 'umidade_faixa_plantio', model: 'umidadeFaixaPlantio' },
      { table: 'talhao_safra', model: 'talhaoSafra' },
      { table: 'viagem', model: 'viagem' },
      { table: 'motorista_quitacao', model: 'motoristaQuitacao' },
      { table: 'usuario', model: 'usuario' },
      { table: 'usuario_sessao', model: 'usuarioSessao' },
    ]

    for (const { table, model } of plan) {
      await ensureEmptyOrMode(prisma, mode, model, table)
      const rows = await sqlite.all(`SELECT * FROM ${table} ORDER BY id ASC`)

      // Normalizacoes leves (tipos)
      const normalized = rows.map((r) => {
        const out = { ...r }
        if ('id' in out) out.id = Number(out.id)
        return out
      })

      if (mode === 'merge') {
        await migrateTableUpsertById({ prisma, modelName: model, rows: normalized })
      } else {
        await migrateTableCreateMany({ prisma, sqlite, modelName: model, tableName: table, rows: normalized })
      }
    }

    // Validacao basica
    const sqliteCounts = {}
    for (const { table } of [
      { table: 'safra' },
      { table: 'talhao' },
      { table: 'destino' },
      { table: 'motorista' },
      { table: 'frete' },
      { table: 'destino_regra_plantio' },
      { table: 'umidade_faixa_plantio' },
      { table: 'talhao_safra' },
      { table: 'viagem' },
      { table: 'motorista_quitacao' },
      { table: 'usuario' },
      { table: 'usuario_sessao' },
    ]) {
      sqliteCounts[table] = Number((await sqlite.get(`SELECT COUNT(*) as c FROM ${table}`))?.c || 0)
    }

    const pgCounts = {
      safra: await prisma.safra.count(),
      talhao: await prisma.talhao.count(),
      destino: await prisma.destino.count(),
      motorista: await prisma.motorista.count(),
      frete: await prisma.frete.count(),
      destino_regra_plantio: await prisma.destinoRegraPlantio.count(),
      umidade_faixa_plantio: await prisma.umidadeFaixaPlantio.count(),
      talhao_safra: await prisma.talhaoSafra.count(),
      viagem: await prisma.viagem.count(),
      motorista_quitacao: await prisma.motoristaQuitacao.count(),
      usuario: await prisma.usuario.count(),
      usuario_sessao: await prisma.usuarioSessao.count(),
    }

    // eslint-disable-next-line no-console
    console.log('Migracao concluida. Contagens (sqlite -> pg):')
    for (const k of Object.keys(pgCounts)) {
      // eslint-disable-next-line no-console
      console.log(`- ${k}: ${sqliteCounts[k] ?? '?'} -> ${pgCounts[k]}`)
    }

    const sqliteViagemSum = await sqlite.get(
      'SELECT COALESCE(SUM(sacas), 0) as sacas, COALESCE(SUM(peso_bruto_kg), 0) as peso_bruto_kg FROM viagem',
    )
    const pgViagemSum = await prisma.viagem.aggregate({
      _sum: { sacas: true, peso_bruto_kg: true },
    })

    // eslint-disable-next-line no-console
    console.log('Checksums viagem:')
    // eslint-disable-next-line no-console
    console.log(
      `- sacas: ${Number(sqliteViagemSum?.sacas || 0)} -> ${Number(pgViagemSum._sum?.sacas || 0)}`,
    )
    // eslint-disable-next-line no-console
    console.log(
      `- peso_bruto_kg: ${Number(sqliteViagemSum?.peso_bruto_kg || 0)} -> ${Number(pgViagemSum._sum?.peso_bruto_kg || 0)}`,
    )
  } finally {
    await sqlite.close()
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e)
  process.exit(1)
})

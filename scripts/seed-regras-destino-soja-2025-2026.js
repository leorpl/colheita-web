import { migrate } from '../src/db/migrate.js'
import { db } from '../src/db/db.js'
import { destinoRegraRepo } from '../src/repositories/destinoRegraRepo.js'

function pct(n) {
  return Number(n) / 100
}

function faixa(gt, lte, descPct, sec) {
  return {
    umid_gt: pct(gt),
    umid_lte: pct(lte),
    desconto_pct: pct(descPct),
    custo_secagem_por_saca: Number(sec || 0),
  }
}

function getSafraId(nome) {
  const r = db.prepare('SELECT id FROM safra WHERE safra=?').get(nome)
  if (!r?.id) throw new Error(`Safra nao encontrada: ${nome}`)
  return r.id
}

function getDestinoIdByCodigo(codigo) {
  const r = db.prepare('SELECT id FROM destino WHERE codigo=?').get(codigo)
  if (!r?.id) throw new Error(`Destino nao encontrado: ${codigo}`)
  return r.id
}

function upsert({ safra_id, destino_codigo, tipo_plantio, faixas }) {
  const destino_id = getDestinoIdByCodigo(destino_codigo)
  const regra = destinoRegraRepo.upsertPlantio({
    safra_id,
    destino_id,
    tipo_plantio,
    trava_sacas: null,
    custo_silo_por_saca: 0,
    custo_terceiros_por_saca: 0,
    impureza_limite_pct: 0,
    ardidos_limite_pct: 0,
    queimados_limite_pct: 0,
    avariados_limite_pct: 0,
    esverdiados_limite_pct: 0,
    quebrados_limite_pct: 0,
  })

  destinoRegraRepo.replaceUmidadeFaixasPlantio(regra.id, faixas)
  return { destino_codigo, destino_id, faixas: faixas.length }
}

function main() {
  migrate()
  const safra_id = getSafraId('2025-2026')
  const tipo_plantio = 'SOJA'

  const TB02 = [
    faixa(0.0, 14.0, 0.0, 0),
    faixa(14.0, 15.0, 1.27, 0.59),
    faixa(15.0, 16.0, 2.3, 0.59),
    faixa(16.0, 17.0, 3.45, 0.59),
    faixa(17.0, 18.0, 4.6, 1.33),
    faixa(18.0, 19.0, 5.75, 1.33),
    faixa(19.0, 20.0, 6.9, 1.85),
    faixa(20.0, 21.0, 8.05, 1.85),
    faixa(21.0, 22.0, 10.4, 2.74),
    faixa(22.0, 23.0, 11.7, 2.74),
    faixa(23.0, 24.0, 13.0, 2.74),
    faixa(24.0, 25.0, 14.3, 2.74),
    faixa(25.0, 26.0, 15.6, 3.11),
    faixa(26.0, 27.0, 19.5, 3.72),
    faixa(27.0, 28.0, 21.0, 4.41),
    faixa(28.0, 29.0, 22.5, 4.41),
    faixa(29.0, 30.0, 24.0, 5.06),
    faixa(30.0, 31.0, 25.5, 5.53),
  ]

  const TB04 = [
    faixa(0.0, 14.0, 0.0, 3.95),
    faixa(14.0, 15.0, 2.3, 3.39),
    faixa(15.0, 16.0, 3.45, 3.59),
    faixa(16.0, 17.0, 4.6, 3.78),
    faixa(17.0, 18.0, 5.75, 5.49),
    faixa(18.0, 19.0, 6.9, 4.15),
    faixa(19.0, 20.0, 8.05, 4.35),
    faixa(20.0, 21.0, 10.4, 4.55),
    faixa(21.0, 22.0, 11.7, 4.73),
    faixa(22.0, 23.0, 13.0, 4.89),
    faixa(23.0, 24.0, 14.3, 5.11),
    faixa(24.0, 25.0, 15.6, 5.29),
    faixa(25.0, 26.0, 19.5, 5.69),
    faixa(26.0, 27.0, 21.0, 5.91),
    faixa(27.0, 28.0, 22.5, 6.19),
    faixa(28.0, 29.0, 24.0, 6.39),
    faixa(29.0, 30.0, 25.5, 6.65),
    faixa(30.0, 31.0, 27.0, 6.9),
    faixa(31.0, 32.0, 28.5, 7.12),
    faixa(32.0, 33.0, 30.0, 7.35),
    faixa(33.0, 34.0, 31.5, 7.55),
    faixa(34.0, 35.0, 33.0, 8.65),
    faixa(35.0, 36.0, 34.5, 8.99),
    faixa(36.0, 37.0, 36.0, 7.89),
    faixa(37.0, 38.0, 37.5, 8.0),
    faixa(38.0, 39.0, 39.0, 8.21),
    faixa(39.0, 40.0, 40.5, 8.45),
  ]

  const TB01 = [
    faixa(0.0, 14.0, 0.0, 0),
    faixa(14.0, 14.5, 1.73, 0.43),
    faixa(14.5, 15.0, 2.3, 0.53),
    faixa(15.0, 15.5, 2.88, 0.61),
    faixa(15.5, 16.0, 3.45, 0.61),
    faixa(16.0, 16.5, 4.03, 0.81),
    faixa(16.5, 17.0, 4.6, 1.11),
    faixa(17.0, 17.5, 4.71, 1.15),
    faixa(17.5, 18.0, 5.29, 1.25),
    faixa(18.0, 18.5, 6.33, 1.3),
    faixa(18.5, 19.0, 6.55, 1.39),
    faixa(19.0, 19.5, 7.48, 1.41),
    faixa(19.5, 20.0, 8.05, 1.47),
    faixa(20.0, 20.5, 9.75, 1.51),
    faixa(20.5, 21.0, 10.4, 1.57),
    faixa(21.0, 21.5, 11.05, 1.63),
    faixa(21.5, 22.0, 11.7, 1.7),
    faixa(22.0, 22.5, 12.35, 1.76),
    faixa(22.5, 23.0, 13.0, 1.82),
    faixa(23.0, 23.5, 13.65, 1.83),
    faixa(23.5, 24.0, 14.3, 1.88),
    faixa(24.0, 24.5, 14.95, 1.94),
    faixa(24.5, 25.0, 15.6, 1.99),
    faixa(25.0, 25.5, 18.75, 2.76),
    faixa(25.5, 26.0, 19.5, 2.84),
    faixa(26.0, 26.5, 20.25, 3.47),
    faixa(26.5, 27.0, 21.0, 3.82),
    faixa(27.0, 27.5, 21.75, 3.89),
    faixa(27.5, 28.0, 22.5, 4.22),
    faixa(28.0, 28.5, 23.25, 4.39),
    faixa(28.5, 29.0, 24.0, 5.14),
    faixa(29.0, 29.5, 24.75, 5.76),
    faixa(29.5, 30.0, 25.5, 6.05),
  ]

  const r1 = upsert({ safra_id, destino_codigo: 'TB02-G.O', tipo_plantio, faixas: TB02 })
  const r2 = upsert({ safra_id, destino_codigo: 'TB04-PMG(P)', tipo_plantio, faixas: TB04 })
  const r3 = upsert({ safra_id, destino_codigo: 'TB04-PMG(F)', tipo_plantio, faixas: TB04 })
  const r4 = upsert({ safra_id, destino_codigo: 'TB01-AP', tipo_plantio, faixas: TB01 })

  console.log('OK', [r1, r2, r3, r4])
}

main()

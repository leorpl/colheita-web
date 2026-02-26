import { migrate } from '../src/db/migrate.js'
import { db } from '../src/db/db.js'
import { destinoRegraRepo } from '../src/repositories/destinoRegraRepo.js'

function getSafraIdPreferida() {
  const row = db.prepare('SELECT id FROM safra WHERE safra=?').get('2025-2026')
  if (row?.id) return row.id
  return db.prepare('SELECT id FROM safra ORDER BY id ASC LIMIT 1').get()?.id ?? 1
}

function getDestinoIdByLocal(local) {
  const row = db.prepare('SELECT id FROM destino WHERE local=?').get(local)
  return row?.id ?? null
}

function pct(n) {
  return n / 100
}

function main() {
  migrate()

  const safra_id = getSafraIdPreferida()
  const destino_id = getDestinoIdByLocal('Formiga AP')
  if (!destino_id) {
    throw new Error('Destino "Formiga AP" nao encontrado no cadastro de destinos')
  }

  // garante que existe regra (mantem limites/trava atuais se ja existir)
  const existing = destinoRegraRepo.getBySafraDestino({ safra_id, destino_id })
  const regra = destinoRegraRepo.upsert({
    safra_id,
    destino_id,
    trava_sacas: existing?.trava_sacas ?? null,
    impureza_limite_pct: existing?.impureza_limite_pct ?? 0,
    ardidos_limite_pct: existing?.ardidos_limite_pct ?? 0,
    queimados_limite_pct: existing?.queimados_limite_pct ?? 0,
    avariados_limite_pct: existing?.avariados_limite_pct ?? 0,
    esverdiados_limite_pct: existing?.esverdiados_limite_pct ?? 0,
    quebrados_limite_pct: existing?.quebrados_limite_pct ?? 0,
  })

  // Tabela informada pelo usuario (SILO - Formiga AP)
  const faixas = [
    { umid_gt: pct(0.0), umid_lte: pct(14.0), desconto_pct: pct(0.0) },
    { umid_gt: pct(14.0), umid_lte: pct(14.5), desconto_pct: pct(1.73) },
    { umid_gt: pct(14.5), umid_lte: pct(15.0), desconto_pct: pct(2.3) },
    { umid_gt: pct(15.0), umid_lte: pct(15.5), desconto_pct: pct(2.88) },
    { umid_gt: pct(15.5), umid_lte: pct(16.0), desconto_pct: pct(3.45) },
    { umid_gt: pct(16.0), umid_lte: pct(16.5), desconto_pct: pct(4.03) },
    { umid_gt: pct(16.5), umid_lte: pct(17.0), desconto_pct: pct(4.6) },
    { umid_gt: pct(17.0), umid_lte: pct(17.5), desconto_pct: pct(4.71) },
    { umid_gt: pct(17.5), umid_lte: pct(18.0), desconto_pct: pct(5.29) },
    { umid_gt: pct(18.0), umid_lte: pct(18.5), desconto_pct: pct(6.33) },
    { umid_gt: pct(18.5), umid_lte: pct(19.0), desconto_pct: pct(6.55) },
    { umid_gt: pct(19.0), umid_lte: pct(19.5), desconto_pct: pct(7.48) },
    { umid_gt: pct(19.5), umid_lte: pct(20.0), desconto_pct: pct(8.05) },
    { umid_gt: pct(20.0), umid_lte: pct(20.5), desconto_pct: pct(9.75) },
    { umid_gt: pct(20.5), umid_lte: pct(21.0), desconto_pct: pct(10.4) },
    { umid_gt: pct(21.0), umid_lte: pct(21.5), desconto_pct: pct(11.05) },
    { umid_gt: pct(21.5), umid_lte: pct(22.0), desconto_pct: pct(11.7) },
    { umid_gt: pct(22.0), umid_lte: pct(22.5), desconto_pct: pct(12.35) },
    { umid_gt: pct(22.5), umid_lte: pct(23.0), desconto_pct: pct(13.0) },
    { umid_gt: pct(23.0), umid_lte: pct(23.5), desconto_pct: pct(13.65) },
    { umid_gt: pct(23.5), umid_lte: pct(24.0), desconto_pct: pct(14.3) },
    { umid_gt: pct(24.0), umid_lte: pct(24.5), desconto_pct: pct(14.95) },
    { umid_gt: pct(24.5), umid_lte: pct(25.0), desconto_pct: pct(15.6) },
    { umid_gt: pct(25.0), umid_lte: pct(25.5), desconto_pct: pct(18.75) },
    { umid_gt: pct(25.5), umid_lte: pct(26.0), desconto_pct: pct(19.5) },
    { umid_gt: pct(26.0), umid_lte: pct(26.5), desconto_pct: pct(20.25) },
    { umid_gt: pct(26.5), umid_lte: pct(27.0), desconto_pct: pct(21.0) },
    { umid_gt: pct(27.0), umid_lte: pct(27.5), desconto_pct: pct(21.75) },
    { umid_gt: pct(27.5), umid_lte: pct(28.0), desconto_pct: pct(22.5) },
    { umid_gt: pct(28.0), umid_lte: pct(28.5), desconto_pct: pct(23.25) },
    { umid_gt: pct(28.5), umid_lte: pct(29.0), desconto_pct: pct(24.0) },
    { umid_gt: pct(29.0), umid_lte: pct(29.5), desconto_pct: pct(24.75) },
    { umid_gt: pct(29.5), umid_lte: pct(30.0), desconto_pct: pct(25.5) },
  ]

  destinoRegraRepo.replaceUmidadeFaixas(regra.id, faixas)

  const confirm = db
    .prepare(
      `SELECT umid_gt, umid_lte, desconto_pct
       FROM umidade_faixa
       WHERE destino_regra_id=?
       ORDER BY umid_gt`,
    )
    .all(regra.id)

  console.log(
    `Atualizado Formiga AP (safra_id=${safra_id}) com ${confirm.length} faixas de umidade.`,
  )
  const r = confirm.find((x) => x.umid_gt === 0.18 && x.umid_lte === 0.185)
  console.log('Checagem 18.0-18.5:', r)
}

main()

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

function applyTable({ safra_id, destino_local, faixas }) {
  const destino_id = getDestinoIdByLocal(destino_local)
  if (!destino_id) {
    throw new Error(`Destino "${destino_local}" nao encontrado no cadastro de destinos`)
  }

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

  destinoRegraRepo.replaceUmidadeFaixas(regra.id, faixas)

  const confirmCount = db
    .prepare('SELECT COUNT(*) as c FROM umidade_faixa WHERE destino_regra_id=?')
    .get(regra.id).c

  console.log(
    `Atualizado ${destino_local} (safra_id=${safra_id}) com ${confirmCount} faixas de umidade.`,
  )
}

function main() {
  migrate()

  const safra_id = getSafraIdPreferida()

  // Tabela informada pelo usuario (TB04-PMG(P))
  const faixas = [
    { umid_gt: pct(0.0), umid_lte: pct(14.0), desconto_pct: pct(0.0) },
    { umid_gt: pct(14.0), umid_lte: pct(15.0), desconto_pct: pct(2.3) },
    { umid_gt: pct(15.0), umid_lte: pct(16.0), desconto_pct: pct(3.45) },
    { umid_gt: pct(16.0), umid_lte: pct(17.0), desconto_pct: pct(4.6) },
    { umid_gt: pct(17.0), umid_lte: pct(18.0), desconto_pct: pct(5.75) },
    { umid_gt: pct(18.0), umid_lte: pct(19.0), desconto_pct: pct(6.9) },
    { umid_gt: pct(19.0), umid_lte: pct(20.0), desconto_pct: pct(8.05) },
    { umid_gt: pct(20.0), umid_lte: pct(21.0), desconto_pct: pct(10.4) },
    { umid_gt: pct(21.0), umid_lte: pct(22.0), desconto_pct: pct(11.7) },
    { umid_gt: pct(22.0), umid_lte: pct(23.0), desconto_pct: pct(13.0) },
    { umid_gt: pct(23.0), umid_lte: pct(24.0), desconto_pct: pct(14.3) },
    { umid_gt: pct(24.0), umid_lte: pct(25.0), desconto_pct: pct(15.6) },
    { umid_gt: pct(25.0), umid_lte: pct(26.0), desconto_pct: pct(19.5) },
    { umid_gt: pct(26.0), umid_lte: pct(27.0), desconto_pct: pct(21.0) },
    { umid_gt: pct(27.0), umid_lte: pct(28.0), desconto_pct: pct(22.5) },
    { umid_gt: pct(28.0), umid_lte: pct(29.0), desconto_pct: pct(24.0) },
    { umid_gt: pct(29.0), umid_lte: pct(30.0), desconto_pct: pct(25.5) },
    { umid_gt: pct(30.0), umid_lte: pct(31.0), desconto_pct: pct(27.0) },
    { umid_gt: pct(31.0), umid_lte: pct(32.0), desconto_pct: pct(28.5) },
    { umid_gt: pct(32.0), umid_lte: pct(33.0), desconto_pct: pct(30.0) },
    { umid_gt: pct(33.0), umid_lte: pct(34.0), desconto_pct: pct(31.5) },
    { umid_gt: pct(34.0), umid_lte: pct(35.0), desconto_pct: pct(33.0) },
    { umid_gt: pct(35.0), umid_lte: pct(36.0), desconto_pct: pct(34.5) },
    { umid_gt: pct(36.0), umid_lte: pct(37.0), desconto_pct: pct(36.0) },
    { umid_gt: pct(37.0), umid_lte: pct(38.0), desconto_pct: pct(37.5) },
    { umid_gt: pct(38.0), umid_lte: pct(39.0), desconto_pct: pct(39.0) },
    { umid_gt: pct(39.0), umid_lte: pct(40.0), desconto_pct: pct(40.5) },
  ]

  applyTable({ safra_id, destino_local: 'Piumhi - PMG', faixas })

  // Opcional: aplicar o mesmo padrao para Formiga - PMG
  applyTable({ safra_id, destino_local: 'Formiga - PMG', faixas })

  const check = db
    .prepare(
      `SELECT uf.umid_gt, uf.umid_lte, uf.desconto_pct
       FROM umidade_faixa uf
       JOIN destino_regra dr ON dr.id = uf.destino_regra_id
       JOIN destino d ON d.id = dr.destino_id
       WHERE dr.safra_id=? AND d.local='Piumhi - PMG'
         AND uf.umid_gt=0.30 AND uf.umid_lte=0.31`,
    )
    .get(safra_id)
  console.log('Checagem 30.0-31.0:', check)
}

main()

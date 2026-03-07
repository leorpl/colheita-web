import { unprocessable } from '../../../errors.js'
import { normalizePercent100, round } from '../../../domain/normalize.js'
import { toDbNumber } from './viagemCoerce.js'

function normalizeTalhoesRateioInput(input) {
  if (!input) return []
  const raw = input.talhoes
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x) => x && x.talhao_id !== null && x.talhao_id !== undefined)
    .map((x) => ({
      talhao_id: Number(x.talhao_id),
      pct_rateio_raw: x.pct_rateio,
      kg_rateio_raw: x.kg_rateio,
    }))
}

export function buildRateioItems({ input, peso_base_kg, fallback_talhao_id }) {
  const rawItems = normalizeTalhoesRateioInput(input)
  const items0 = rawItems.length
    ? rawItems
    : [{ talhao_id: Number(fallback_talhao_id), pct_rateio_raw: 100, kg_rateio_raw: null }]

  const used = new Set()
  const items = []

  for (const it of items0) {
    const talhao_id = Number(it.talhao_id)
    if (!Number.isInteger(talhao_id) || talhao_id <= 0) {
      throw unprocessable('Talhao invalido no rateio')
    }
    if (used.has(talhao_id)) {
      throw unprocessable('Talhao repetido no rateio')
    }
    used.add(talhao_id)

    const hasPct = !(it.pct_rateio_raw === null || it.pct_rateio_raw === undefined || it.pct_rateio_raw === '')
    const hasKg = !(it.kg_rateio_raw === null || it.kg_rateio_raw === undefined || it.kg_rateio_raw === '')
    if (!hasPct && !hasKg) {
      throw unprocessable('Informe percentual ou kg no rateio do talhao')
    }

    const kg_rateio = hasKg ? toDbNumber(it.kg_rateio_raw, 'kg_rateio') : null
    if (kg_rateio !== null && kg_rateio < 0) {
      throw unprocessable('kg_rateio invalido')
    }

    const pct_rateio = hasPct
      ? normalizePercent100(it.pct_rateio_raw, 'pct_rateio')
      : null

    items.push({ talhao_id, pct_rateio, kg_rateio })
  }

  const base = Number(peso_base_kg || 0)
  const hasBase = Number.isFinite(base) && base > 0

  // Sem peso base: exigir fechamento em % (estimativa) para evitar rateio inconsistente.
  if (!hasBase) {
    const out = items.map((it) => {
      if (it.pct_rateio === null || it.pct_rateio === undefined) {
        throw unprocessable('Rateio: informe percentual (%) para todos os talhoes (sem peso bruto)', {
          missing_field: 'pct_rateio',
        })
      }
      return {
        talhao_id: it.talhao_id,
        pct_rateio: it.pct_rateio,
        kg_rateio: it.kg_rateio ?? null,
      }
    })

    let sumPct = 0
    for (const it of out) sumPct += Number(it.pct_rateio || 0)
    const deltaPct = round(1 - sumPct, 9)
    const tolPct = 0.0001
    if (Math.abs(deltaPct) > tolPct) {
      throw unprocessable('Rateio: percentual deve fechar 100%', {
        soma_pct: sumPct,
        delta_pct: deltaPct,
        soma_pct_100: sumPct * 100,
        delta_pct_100: deltaPct * 100,
      })
    }

    // Ajuste fino no ultimo item para fechar (evita erro por arredondamento)
    if (out.length) {
      const last = out[out.length - 1]
      last.pct_rateio = round(Number(last.pct_rateio || 0) + deltaPct, 9)
    }

    return out
  }

  // Se o peso base existir, materializa kg/pct faltantes e valida fechamento.
  if (hasBase) {
    const out = items.map((it) => {
      let kg = it.kg_rateio
      let pct = it.pct_rateio

      if (kg !== null && kg !== undefined) {
        pct = base > 0 ? kg / base : 0
      } else if (pct !== null && pct !== undefined) {
        kg = round(base * pct, 6)
      } else {
        throw unprocessable('Rateio do talhao incompleto')
      }

      return {
        talhao_id: it.talhao_id,
        kg_rateio: kg,
        pct_rateio: pct,
      }
    })

    let sumKg = 0
    for (const it of out) sumKg += Number(it.kg_rateio || 0)

    const delta = round(base - sumKg, 6)
    const tolKg = 2
    if (Math.abs(delta) > tolKg) {
      const sumPct = base > 0 ? sumKg / base : 0
      const deltaPct = base > 0 ? delta / base : 0
      throw unprocessable('Rateio: nao fecha (ajuste para 100%)', {
        peso_bruto_kg: base,
        soma_kg_rateio: sumKg,
        delta_kg: delta,
        soma_pct: sumPct,
        delta_pct: deltaPct,
        soma_pct_100: sumPct * 100,
        delta_pct_100: deltaPct * 100,
        tolerancia_kg: tolKg,
      })
    }

    // Ajuste fino no ultimo item para fechar (evita erro por arredondamento)
    if (out.length) {
      const last = out[out.length - 1]
      const fixedKg = round(Number(last.kg_rateio || 0) + delta, 6)
      last.kg_rateio = fixedKg
      last.pct_rateio = base > 0 ? fixedKg / base : 0
    }

    return out
  }
}

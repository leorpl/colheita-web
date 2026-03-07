import { db } from '../../../db/db.js'
import { unprocessable } from '../../../errors.js'
import { viagemRepo } from '../../../repositories/viagemRepo.js'

export function recalcularTodasViagens({ buildPayload, safra_id, destino_id, tipo_plantio } = {}) {
  if (typeof buildPayload !== 'function') {
    throw new Error('buildPayload obrigatorio')
  }

  const sid = safra_id === null || safra_id === undefined || safra_id === '' ? null : Number(safra_id)
  const did = destino_id === null || destino_id === undefined || destino_id === '' ? null : Number(destino_id)
  const tp = tipo_plantio === null || tipo_plantio === undefined ? null : String(tipo_plantio || '').trim().toUpperCase()

  if (sid !== null && (!Number.isInteger(sid) || sid <= 0)) throw unprocessable('safra_id invalido')
  if (did !== null && (!Number.isInteger(did) || did <= 0)) throw unprocessable('destino_id invalido')
  if (tp !== null && !tp) throw unprocessable('tipo_plantio invalido')

  const rows = db
    .prepare(
      `SELECT v.*,
              s.plantio as safra_plantio
       FROM viagem v
       JOIN safra s ON s.id = v.safra_id
       WHERE (@safra_id IS NULL OR v.safra_id = @safra_id)
         AND (@destino_id IS NULL OR v.destino_id = @destino_id)
         AND (@tipo_plantio IS NULL OR UPPER(COALESCE(NULLIF(v.tipo_plantio, ''), NULLIF(s.plantio, ''))) = @tipo_plantio)
         AND v.deleted_at IS NULL
        ORDER BY
          v.destino_id ASC,
          UPPER(COALESCE(NULLIF(v.tipo_plantio, ''), NULLIF(s.plantio, ''))) ASC,
          CASE WHEN v.data_saida IS NULL OR v.data_saida='' THEN 1 ELSE 0 END,
          v.data_saida ASC,
         COALESCE(v.hora_saida, '99:99') ASC,
         v.id ASC`,
    )
    .all({ safra_id: sid, destino_id: did, tipo_plantio: tp })

  const errors = []
  let updated = 0
  let skipped = 0

  const toPct100 = (frac) => {
    if (frac === null || frac === undefined) return null
    const n = Number(frac)
    if (!Number.isFinite(n)) return null
    return n * 100
  }

  const tx = db.transaction(() => {
    for (const v of rows) {
      try {
        // Converte fracoes armazenadas (0..1) de volta para 0..100,
        // pois buildPayload normaliza em normalizePercent100.
        const input = {
          ficha: v.ficha,
          safra_id: Number(v.safra_id),
          tipo_plantio: v.tipo_plantio || null,
          talhao_id: Number(v.talhao_id),
          talhoes: undefined, // nao recalcular rateio em lote
          local: v.local ?? null,
          destino_id: Number(v.destino_id),
          motorista_id: Number(v.motorista_id),
          placa: v.placa ?? null,
          data_saida: v.data_saida ?? null,
          hora_saida: v.hora_saida ?? null,
          data_entrega: v.data_entrega ?? null,
          hora_entrega: v.hora_entrega ?? null,
          carga_total_kg: Number(v.carga_total_kg || 0),
          tara_kg: Number(v.tara_kg || 0),

          umidade_pct: toPct100(v.umidade_pct),
          umidade_desc_pct_manual:
            v.umidade_desc_pct_manual === null || v.umidade_desc_pct_manual === undefined
              ? null
              : toPct100(v.umidade_desc_pct_manual),

          impureza_pct: toPct100(v.impureza_pct),
          ardidos_pct: toPct100(v.ardidos_pct),
          queimados_pct: toPct100(v.queimados_pct),
          avariados_pct: toPct100(v.avariados_pct),
          esverdiados_pct: toPct100(v.esverdiados_pct),
          quebrados_pct: toPct100(v.quebrados_pct),

          // Limites: nao enviar => usa regra atual.
          // (sem flags antigas, nao da para saber se algum limite foi ajustado manualmente)
          impureza_limite_pct: undefined,
          ardidos_limite_pct: undefined,
          queimados_limite_pct: undefined,
          avariados_limite_pct: undefined,
          esverdiados_limite_pct: undefined,
          quebrados_limite_pct: undefined,
        }

        const payload = buildPayload(input, { current_id: Number(v.id), exclude_id: Number(v.id) })
        viagemRepo.update(Number(v.id), payload)
        updated++
      } catch (e) {
        skipped++
        errors.push({
          id: Number(v.id),
          ficha: String(v.ficha || ''),
          safra_id: Number(v.safra_id),
          destino_id: Number(v.destino_id),
          tipo_plantio: String(v.tipo_plantio || '').trim().toUpperCase() || null,
          message: String(e?.message || e),
          details: e?.details || null,
        })
      }
    }
  })

  tx()

  return {
    scope: {
      safra_id: sid,
      destino_id: did,
      tipo_plantio: tp,
    },
    total: rows.length,
    updated,
    skipped,
    errors_count: errors.length,
    // evita payload gigante; UI pode pedir de novo filtrando
    errors: errors.slice(0, 50),
  }
}

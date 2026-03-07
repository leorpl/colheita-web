import { db } from '../../../db/db.js'
import { viagemRepo } from '../../../repositories/viagemRepo.js'
import { viagemTalhaoRepo } from '../../../repositories/viagemTalhaoRepo.js'
import { conflict, unprocessable } from '../../../errors.js'

import { buildRateioItems } from './rateioService.js'

export function createViagem({ input, user_id, buildPayload, getTravaStatus }) {
  if (typeof buildPayload !== 'function') throw new Error('buildPayload obrigatorio')
  if (typeof getTravaStatus !== 'function') throw new Error('getTravaStatus obrigatorio')

  const payload = buildPayload(input)

  if (!payload.data_saida) throw unprocessable('data_saida obrigatoria')
  if (!payload.hora_saida) throw unprocessable('hora_saida obrigatoria')

  const rateioItems = buildRateioItems({
    input,
    peso_base_kg: payload.peso_bruto_kg,
    fallback_talhao_id: payload.talhao_id,
  })

  const trava = getTravaStatus({
    destino_id: payload.destino_id,
    safra_id: payload.safra_id,
    tipo_plantio: payload.tipo_plantio,
    sacas: payload.sacas,
  })

  try {
    const tx = db.transaction(() => {
      const row = viagemRepo.create(payload, { user_id })
      viagemTalhaoRepo.replaceForViagem({ viagem_id: row.id, items: rateioItems })
      return viagemRepo.get(row.id)
    })
    const full = tx()
    return { ...full, trava }
  } catch (e) {
    if (
      e?.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
      String(e.message || '').includes('viagem.safra_id') &&
      String(e.message || '').includes('viagem.ficha')
    ) {
      throw conflict('Ja existe lancamento com esta ficha na mesma safra', {
        safra_id: payload.safra_id,
        ficha: payload.ficha,
      })
    }
    throw e
  }
}

export function updateViagem({ id, input, user_id, buildPayload, getTravaStatus }) {
  if (!Number.isInteger(Number(id)) || Number(id) <= 0) throw unprocessable('id invalido')
  if (typeof buildPayload !== 'function') throw new Error('buildPayload obrigatorio')
  if (typeof getTravaStatus !== 'function') throw new Error('getTravaStatus obrigatorio')

  const payload = buildPayload(input, { current_id: Number(id), exclude_id: Number(id) })

  if (!payload.data_saida) throw unprocessable('data_saida obrigatoria')
  if (!payload.hora_saida) throw unprocessable('hora_saida obrigatoria')

  const rateioItems = buildRateioItems({
    input,
    peso_base_kg: payload.peso_bruto_kg,
    fallback_talhao_id: payload.talhao_id,
  })

  const trava = getTravaStatus({
    destino_id: payload.destino_id,
    safra_id: payload.safra_id,
    tipo_plantio: payload.tipo_plantio,
    sacas: payload.sacas,
    exclude_id: Number(id),
  })

  try {
    const tx = db.transaction(() => {
      viagemRepo.update(Number(id), payload, { user_id })
      viagemTalhaoRepo.replaceForViagem({ viagem_id: Number(id), items: rateioItems })
      return viagemRepo.get(Number(id))
    })
    const full = tx()
    return { ...full, trava }
  } catch (e) {
    if (
      e?.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
      String(e.message || '').includes('viagem.safra_id') &&
      String(e.message || '').includes('viagem.ficha')
    ) {
      throw conflict('Ja existe lancamento com esta ficha na mesma safra', {
        safra_id: payload.safra_id,
        ficha: payload.ficha,
      })
    }
    throw e
  }
}

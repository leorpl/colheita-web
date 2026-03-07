import { db } from '../../../db/db.js'
import { destinoRepo } from '../../../repositories/destinoRepo.js'
import { contratoSiloRepo } from '../../../repositories/contratoSiloRepo.js'
import { unprocessable } from '../../../errors.js'
import { round } from '../../../domain/normalize.js'

export function getTravaStatus({ destino_id, safra_id, tipo_plantio, sacas, exclude_id } = {}) {
  const destino = destinoRepo.get(destino_id)
  if (!destino) throw unprocessable('Destino inexistente')

  const tp = String(tipo_plantio || '').trim().toUpperCase()
  const contrato = contratoSiloRepo.getOne({ safra_id, destino_id, tipo_plantio: tp })
  if (!contrato) return null
  const faixas = Array.isArray(contrato.faixas) ? contrato.faixas : []
  const contrato_total = faixas.reduce((a, f) => a + Number(f?.sacas || 0), 0)
  const contrato_sacas_raw = contrato_total

  const whereExtra = exclude_id ? ' AND v.id <> @exclude_id' : ''
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(v.sacas), 0) as entrega_atual
       FROM viagem v
       JOIN safra s ON s.id = v.safra_id
       WHERE v.destino_id=@destino_id
         AND v.safra_id=@safra_id
         AND UPPER(COALESCE(NULLIF(v.tipo_plantio, ''), NULLIF(s.plantio, ''))) = @tipo_plantio
         AND v.deleted_at IS NULL
         ${whereExtra}`,
    )
    .get({ destino_id, safra_id, exclude_id, tipo_plantio: tp })

  const entrega_atual = Number(row?.entrega_atual || 0)
  const contrato_sacas = Number(contrato_sacas_raw)
  const tentativa = Number(sacas || 0)

  if (!Number.isFinite(contrato_sacas) || contrato_sacas <= 0) return null

  const restante_antes = Math.max(0, contrato_sacas - entrega_atual)
  const dentro_contrato = Math.max(0, Math.min(tentativa, restante_antes))
  const fora_contrato = Math.max(0, tentativa - dentro_contrato)
  const entrega_depois = round(entrega_atual + tentativa, 9)
  const eps = 1e-9
  const atingiu = entrega_depois >= contrato_sacas - eps
  const excedeu = entrega_depois > contrato_sacas + eps
  const ratio = contrato_sacas > 0 ? entrega_depois / contrato_sacas : null
  const proximo = typeof ratio === 'number' && ratio >= 0.85 && ratio < 1
  const excedente_total = Math.max(0, entrega_depois - contrato_sacas)

  return {
    // compat: "atingida" era usado como alerta de trava
    atingida: atingiu,
    excedeu,
    proximo,
    atingiu,
    ultrapassou: excedeu,
    status: excedeu ? 'ultrapassado' : atingiu ? 'atingido' : proximo ? 'proximo' : 'ok',
    destino_id,
    safra_id,
    tipo_plantio: tp,
    contrato_sacas,
    // compat
    trava_sacas: contrato_sacas,
    entrega_atual_sacas: entrega_atual,
    tentativa_sacas: tentativa,
    restante_sacas: restante_antes,
    restante_antes_sacas: restante_antes,
    restante_depois_sacas: Math.max(0, contrato_sacas - entrega_depois),
    dentro_contrato_sacas: round(dentro_contrato, 9),
    fora_contrato_sacas: round(fora_contrato, 9),
    entrega_depois_sacas: entrega_depois,
    excedente_total_sacas: round(excedente_total, 9),
  }
}

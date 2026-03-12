import { viagemRepo } from '../repositories/viagemRepo.js'
import { getTravaStatus as getTravaStatusFromContracts } from '../modules/contracts/services/travaService.js'
import { listViagensView } from '../modules/harvest/services/viagemListViewService.js'
import { recalcularTodasViagens } from '../modules/harvest/services/viagemRecalcService.js'
import { compararDestinos as compararDestinosFromHarvest } from '../modules/harvest/services/viagemCompareDestinosService.js'
import { buildViagemPayload } from '../modules/harvest/services/viagemPayloadService.js'
import { createViagem, updateViagem } from '../modules/harvest/services/viagemCrudService.js'

export const viagemService = {
  listView(filters = {}) {
    return listViagensView(filters)
  },

  nextFicha(safra_id) {
    const { maxNum, maxLen } = viagemRepo.fichaStatsBySafra({ safra_id })
    const nextNum = (Number(maxNum) || 0) + 1
    const width = Math.max(3, Number(maxLen) || 0, String(nextNum).length)
    const next_ficha = String(nextNum).padStart(width, '0')
    return { safra_id, nextNum, width, next_ficha }
  },

  buildPayload(input, opts = {}) {
    return buildViagemPayload(input, opts, {
      resolveUmidadeFaixa: (args) => this.resolveUmidadeFaixa(args),
    })
  },

  resolveUmidadeFaixa({ umidade_pct, faixas }) {
    for (const f of faixas) {
      if (umidade_pct > f.umid_gt && umidade_pct <= f.umid_lte) return f
    }
    return null
  },

  getTravaStatus({ destino_id, safra_id, tipo_plantio, sacas, exclude_id } = {}) {
    return getTravaStatusFromContracts({ destino_id, safra_id, tipo_plantio, sacas, exclude_id })
  },

  create(input, { user_id } = {}) {
    return createViagem({
      input,
      user_id,
      buildPayload: (i, opts) => this.buildPayload(i, opts),
      getTravaStatus: (args) => this.getTravaStatus(args),
    })
  },

  update(id, input, { user_id } = {}) {
    return updateViagem({
      id,
      input,
      user_id,
      buildPayload: (i, opts) => this.buildPayload(i, opts),
      getTravaStatus: (args) => this.getTravaStatus(args),
    })
  },

  // Recalcula os campos materializados das colheitas (viagens) usando as regras atuais.
  // Observacao: preserva os valores informados pelo usuario (pesos/percentuais e umidade_desc_pct_manual),
  // e re-aplica regras/contratos/fretes para re-materializar sacas, descontos, custos e compra.
  recalcularTodas({ safra_id, destino_id, tipo_plantio, user_id } = {}) {
    return recalcularTodasViagens({
      buildPayload: (input, opts) => this.buildPayload(input, opts),
      safra_id,
      destino_id,
      tipo_plantio,
      user_id,
    })
  },

  compararDestinos(input) {
    return compararDestinosFromHarvest(input, {
      resolveUmidadeFaixa: (args) => this.resolveUmidadeFaixa(args),
    })
  },
}

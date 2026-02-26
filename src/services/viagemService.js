import { freteRepo } from '../repositories/freteRepo.js'
import { destinoRepo } from '../repositories/destinoRepo.js'
import { viagemRepo } from '../repositories/viagemRepo.js'
import { calcularViagem } from '../domain/calculations.js'
import { conflict, unprocessable } from '../errors.js'
import { normalizePercent100, round } from '../domain/normalize.js'
import { destinoRegraRepo } from '../repositories/destinoRegraRepo.js'
import { safraRepo } from '../repositories/safraRepo.js'
import { prismaClient } from '../db/prisma.js'

function toDbNumber(value, fieldName) {
  const n = Number(value)
  if (!Number.isFinite(n)) throw unprocessable(`Campo invalido: ${fieldName}`)
  return n
}

function normalizeOptionalPercent(value, fieldName) {
  if (value === null || value === undefined || value === '') return undefined
  return normalizePercent100(value, fieldName)
}

export const viagemService = {
  async nextFicha(safra_id) {
    const { maxNum, maxLen } = await viagemRepo.fichaStatsBySafra({ safra_id })
    const nextNum = (Number(maxNum) || 0) + 1
    const width = Math.max(3, Number(maxLen) || 0, String(nextNum).length)
    const next_ficha = String(nextNum).padStart(width, '0')
    return { safra_id, nextNum, width, next_ficha }
  },

  async buildPayload(input) {
    const carga_total_kg = toDbNumber(input.carga_total_kg, 'carga_total_kg')
    const tara_kg = toDbNumber(input.tara_kg, 'tara_kg')
    if (carga_total_kg < 0 || tara_kg < 0 || tara_kg > carga_total_kg) {
      throw unprocessable('Pesos invalidos (tara deve ser <= carga_total)')
    }

    const safra_id = Number(input.safra_id)
    if (!Number.isInteger(safra_id) || safra_id <= 0) {
      throw unprocessable('safra_id invalido')
    }
    const fichaRaw = String(input.ficha ?? '').trim()

    if (!fichaRaw) throw unprocessable('ficha obrigatoria')
    if (!/^[0-9]+$/.test(fichaRaw)) {
      throw unprocessable('ficha deve conter apenas numeros')
    }

    const fichaNum = Number.parseInt(fichaRaw, 10)
    if (!Number.isFinite(fichaNum) || fichaNum <= 0) {
      throw unprocessable('ficha deve ser um numero positivo')
    }

    const { maxLen } = await viagemRepo.fichaStatsBySafra({ safra_id })
    const width = Math.max(3, Number(maxLen) || 0, fichaRaw.length)
    const ficha = String(fichaNum).padStart(width, '0')

    const safraRow = await safraRepo.get(safra_id)
    const defaultPlantio = String(safraRow?.plantio || 'SOJA')
      .trim()
      .toUpperCase()

    const inputPlantio = String(input.tipo_plantio ?? '').trim().toUpperCase()
    const tipo_plantio = inputPlantio || defaultPlantio

    const payload = {
      ficha,
      safra_id,
      tipo_plantio,
      talhao_id: Number(input.talhao_id),
      local: input.local ?? null,
      destino_id: Number(input.destino_id),
      motorista_id: Number(input.motorista_id),
      placa: input.placa ?? null,
      data_saida: input.data_saida ?? null,
      hora_saida: input.hora_saida ?? null,
      data_entrega: input.data_entrega ?? null,
      hora_entrega: input.hora_entrega ?? null,
      carga_total_kg,
      tara_kg,

      umidade_pct: normalizePercent100(input.umidade_pct, 'umidade_pct'),

      umidade_desc_pct_manual:
        input.umidade_desc_pct_manual === null ||
        input.umidade_desc_pct_manual === undefined ||
        input.umidade_desc_pct_manual === ''
          ? null
          : normalizePercent100(
              input.umidade_desc_pct_manual,
              'umidade_desc_pct_manual',
            ),

      impureza_pct: normalizePercent100(input.impureza_pct, 'impureza_pct'),
      ardidos_pct: normalizePercent100(input.ardidos_pct, 'ardidos_pct'),
      queimados_pct: normalizePercent100(input.queimados_pct, 'queimados_pct'),
      avariados_pct: normalizePercent100(input.avariados_pct, 'avariados_pct'),
      esverdiados_pct: normalizePercent100(
        input.esverdiados_pct,
        'esverdiados_pct',
      ),
      quebrados_pct: normalizePercent100(input.quebrados_pct, 'quebrados_pct'),

      impureza_limite_pct: normalizeOptionalPercent(
        input.impureza_limite_pct,
        'impureza_limite_pct',
      ),
      ardidos_limite_pct: normalizeOptionalPercent(
        input.ardidos_limite_pct,
        'ardidos_limite_pct',
      ),
      queimados_limite_pct: normalizeOptionalPercent(
        input.queimados_limite_pct,
        'queimados_limite_pct',
      ),
      avariados_limite_pct: normalizeOptionalPercent(
        input.avariados_limite_pct,
        'avariados_limite_pct',
      ),
      esverdiados_limite_pct: normalizeOptionalPercent(
        input.esverdiados_limite_pct,
        'esverdiados_limite_pct',
      ),
      quebrados_limite_pct: normalizeOptionalPercent(
        input.quebrados_limite_pct,
        'quebrados_limite_pct',
      ),
    }

    // safra_id ja validado no inicio
    if (!Number.isInteger(payload.talhao_id))
      throw unprocessable('talhao_id invalido')
    if (!Number.isInteger(payload.destino_id))
      throw unprocessable('destino_id invalido')
    if (!Number.isInteger(payload.motorista_id))
      throw unprocessable('motorista_id invalido')

    // datas: armazenar como YYYY-MM-DD quando vier do front
    // sem normalizar aqui, so validar ordem se ambas existirem
    if (payload.data_saida && payload.data_entrega) {
      if (payload.data_entrega < payload.data_saida) {
        throw unprocessable('data_entrega nao pode ser anterior a data_saida')
      }
    }

    const valorFrete = await freteRepo.getValor({
      safra_id: payload.safra_id,
      motorista_id: payload.motorista_id,
      destino_id: payload.destino_id,
    })
    if (valorFrete === null) {
      throw unprocessable(
        'Nao existe frete cadastrado para (safra, motorista, destino)',
      )
    }

    // regras SEMPRE por destino+safra+tipo_plantio.
    // Se nao existir para o plantio, nao deve "cair" em outra tabela (evita usar regra errada).
    const regra = await destinoRegraRepo.getBySafraDestinoPlantio({
      safra_id: payload.safra_id,
      destino_id: payload.destino_id,
      tipo_plantio: payload.tipo_plantio,
    })

    const faixas = regra
      ? await destinoRegraRepo.getUmidadeFaixasPlantio(regra.id)
      : []

    const faixaUmid = this.resolveUmidadeFaixa({
      umidade_pct: payload.umidade_pct,
      faixas,
    })

    // Se nao existir faixa (ou regra), NAO aplicar fallback por UMIDADE_BASE.
    // O desconto deve vir somente da tabela; se nao houver, considerar 0.
    const umidade_desc_pct = faixaUmid ? faixaUmid.desconto_pct : 0
    const secagem_custo_por_saca = faixaUmid
      ? Number(faixaUmid.custo_secagem_por_saca || 0)
      : 0

    const destino_regra_existe = Boolean(regra)
    const umidade_faixas_qtd = faixas.length
    const umidade_faixa_encontrada = faixaUmid !== null && faixaUmid !== undefined

    // se existir regra, ela substitui limites (mantem override do lancamento se usuario enviar explicitamente)
    const limites = {
      impureza_limite_pct:
        payload.impureza_limite_pct ?? regra?.impureza_limite_pct ?? 0,
      ardidos_limite_pct:
        payload.ardidos_limite_pct ?? regra?.ardidos_limite_pct ?? 0,
      queimados_limite_pct:
        payload.queimados_limite_pct ?? regra?.queimados_limite_pct ?? 0,
      avariados_limite_pct:
        payload.avariados_limite_pct ?? regra?.avariados_limite_pct ?? 0,
      esverdiados_limite_pct:
        payload.esverdiados_limite_pct ?? regra?.esverdiados_limite_pct ?? 0,
      quebrados_limite_pct:
        payload.quebrados_limite_pct ?? regra?.quebrados_limite_pct ?? 0,
    }

    const limites_origem = {
      impureza: payload.impureza_limite_pct !== undefined ? 'lancamento' : regra ? 'destino_regra' : 'zero',
      ardidos: payload.ardidos_limite_pct !== undefined ? 'lancamento' : regra ? 'destino_regra' : 'zero',
      queimados: payload.queimados_limite_pct !== undefined ? 'lancamento' : regra ? 'destino_regra' : 'zero',
      avariados: payload.avariados_limite_pct !== undefined ? 'lancamento' : regra ? 'destino_regra' : 'zero',
      esverdiados: payload.esverdiados_limite_pct !== undefined ? 'lancamento' : regra ? 'destino_regra' : 'zero',
      quebrados: payload.quebrados_limite_pct !== undefined ? 'lancamento' : regra ? 'destino_regra' : 'zero',
    }

    const calc = calcularViagem({
      ...payload,
      ...limites,
      umidade_desc_pct,
      frete_tabela: valorFrete,
    })

    const sub_total_secagem = round(calc.sacas_frete * secagem_custo_por_saca, 6)

    const custo_silo_por_saca = regra ? Number(regra.custo_silo_por_saca || 0) : 0
    const custo_terceiros_por_saca = regra
      ? Number(regra.custo_terceiros_por_saca || 0)
      : 0

    const sub_total_custo_silo = round(calc.sacas * custo_silo_por_saca, 6)
    const sub_total_custo_terceiros = round(
      calc.sacas * custo_terceiros_por_saca,
      6,
    )

    const abatimento_total_silo = round(
      calc.sub_total_frete + sub_total_secagem + sub_total_custo_silo,
      6,
    )
    const abatimento_total_terceiros = round(
      calc.sub_total_frete + sub_total_secagem + sub_total_custo_terceiros,
      6,
    )

    const abatimento_por_saca_silo =
      calc.sacas > 0 ? round(abatimento_total_silo / calc.sacas, 6) : 0
    const abatimento_por_saca_terceiros =
      calc.sacas > 0 ? round(abatimento_total_terceiros / calc.sacas, 6) : 0

    if (calc.peso_limpo_seco_kg < 0 || calc.sacas < 0) {
      throw unprocessable('Calculo resultou em peso/sacas negativas. Revise os percentuais e limites.')
    }

    const umidade_origem =
      payload.umidade_desc_pct_manual !== null
        ? 'manual'
        : !regra
          ? 'sem_tabela'
          : umidade_faixa_encontrada
            ? 'tabela'
            : 'fora_faixa'

    return {
      ...payload,
      ...limites,
      ...calc,
      secagem_custo_por_saca: round(secagem_custo_por_saca, 6),
      sub_total_secagem,

      custo_silo_por_saca: round(custo_silo_por_saca, 6),
      sub_total_custo_silo,
      abatimento_total_silo,
      abatimento_por_saca_silo,

      custo_terceiros_por_saca: round(custo_terceiros_por_saca, 6),
      sub_total_custo_terceiros,
      abatimento_total_terceiros,
      abatimento_por_saca_terceiros,

      destino_regra_existe,
      umidade_faixas_qtd,
      umidade_origem,
      trava_sacas:
        regra?.trava_sacas ??
        (await destinoRepo.get(payload.destino_id))?.trava_sacas ??
        null,
      limites_origem,
    }
  },

  resolveUmidadeFaixa({ umidade_pct, faixas }) {
    for (const f of faixas) {
      if (umidade_pct > f.umid_gt && umidade_pct <= f.umid_lte) return f
    }
    return null
  },

  async getTravaStatus({ destino_id, safra_id, sacas, exclude_id } = {}) {
    const destino = await destinoRepo.get(destino_id)
    if (!destino) throw unprocessable('Destino inexistente')

    const regra = await destinoRegraRepo.getBySafraDestino({ safra_id, destino_id })
    const trava_sacas = regra?.trava_sacas ?? destino.trava_sacas
    if (trava_sacas === null || trava_sacas === undefined) return null

    const prisma = prismaClient()
    const agg = await prisma.viagem.aggregate({
      where: {
        destino_id,
        safra_id,
        ...(exclude_id ? { id: { not: exclude_id } } : {}),
      },
      _sum: { sacas: true },
    })
    const entrega_atual = Number(agg._sum?.sacas || 0)
    const trava = Number(trava_sacas)
    const tentativa = Number(sacas || 0)

    if (!Number.isFinite(trava) || trava <= 0) return null

    const atingida = round(entrega_atual + tentativa, 9) > trava

    return {
      atingida,
      destino_id,
      safra_id,
      trava_sacas: trava,
      entrega_atual_sacas: entrega_atual,
      tentativa_sacas: tentativa,
      restante_sacas: Math.max(0, trava - entrega_atual),
    }
  },

  async create(input) {
    const payload = await this.buildPayload(input)
    const trava = await this.getTravaStatus({
      destino_id: payload.destino_id,
      safra_id: payload.safra_id,
      sacas: payload.sacas,
    })
    try {
      const row = await viagemRepo.create(payload)
      return { ...row, trava }
    } catch (e) {
      if (
        e?.code === 'P2002' &&
        String(e.meta?.target || '').includes('safra_id') &&
        String(e.meta?.target || '').includes('ficha')
      ) {
        throw conflict('Ja existe lancamento com esta ficha na mesma safra', {
          safra_id: payload.safra_id,
          ficha: payload.ficha,
        })
      }
      throw e
    }
  },

  async update(id, input) {
    const payload = await this.buildPayload(input)

    const trava = await this.getTravaStatus({
      destino_id: payload.destino_id,
      safra_id: payload.safra_id,
      sacas: payload.sacas,
      exclude_id: id,
    })

    try {
      const row = await viagemRepo.update(id, payload)
      return { ...row, trava }
    } catch (e) {
      if (
        e?.code === 'P2002' &&
        String(e.meta?.target || '').includes('safra_id') &&
        String(e.meta?.target || '').includes('ficha')
      ) {
        throw conflict('Ja existe lancamento com esta ficha na mesma safra', {
          safra_id: payload.safra_id,
          ficha: payload.ficha,
        })
      }
      throw e
    }
  },
}

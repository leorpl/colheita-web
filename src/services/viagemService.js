import { freteRepo } from '../repositories/freteRepo.js'
import { destinoRepo } from '../repositories/destinoRepo.js'
import { viagemRepo } from '../repositories/viagemRepo.js'
import { viagemTalhaoRepo } from '../repositories/viagemTalhaoRepo.js'
import { calcularViagem } from '../domain/calculations.js'
import { conflict, unprocessable } from '../errors.js'
import { normalizePercent100, round } from '../domain/normalize.js'
import { db } from '../db/db.js'
import { destinoRegraRepo } from '../repositories/destinoRegraRepo.js'

function toDbNumber(value, fieldName) {
  const n = Number(value)
  if (!Number.isFinite(n)) throw unprocessable(`Campo invalido: ${fieldName}`)
  return n
}

function normalizeOptionalPercent(value, fieldName) {
  if (value === null || value === undefined || value === '') return undefined
  return normalizePercent100(value, fieldName)
}

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

function buildRateioItems({ input, peso_base_kg, fallback_talhao_id }) {
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

export const viagemService = {
  nextFicha(safra_id) {
    const { maxNum, maxLen } = viagemRepo.fichaStatsBySafra({ safra_id })
    const nextNum = (Number(maxNum) || 0) + 1
    const width = Math.max(3, Number(maxLen) || 0, String(nextNum).length)
    const next_ficha = String(nextNum).padStart(width, '0')
    return { safra_id, nextNum, width, next_ficha }
  },

  buildPayload(input, opts = {}) {
    const current_id =
      Number.isFinite(Number(opts.current_id)) && Number(opts.current_id) > 0
        ? Number(opts.current_id)
        : 1e18
    const exclude_id =
      Number.isFinite(Number(opts.exclude_id)) && Number(opts.exclude_id) > 0
        ? Number(opts.exclude_id)
        : null
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

    const { maxLen } = viagemRepo.fichaStatsBySafra({ safra_id })
    const width = Math.max(3, Number(maxLen) || 0, fichaRaw.length)
    const ficha = String(fichaNum).padStart(width, '0')

    const safraRow = db
      .prepare('SELECT plantio FROM safra WHERE id=?')
      .get(safra_id)
    const defaultPlantio = String(safraRow?.plantio || 'SOJA')
      .trim()
      .toUpperCase()

    const inputPlantio = String(input.tipo_plantio ?? '').trim().toUpperCase()
    const tipo_plantio = inputPlantio || defaultPlantio

    const payload = {
      ficha,
      safra_id,
      tipo_plantio,
      talhao_id: Number(
        Number.isFinite(Number(input.talhao_id)) && Number(input.talhao_id) > 0
          ? input.talhao_id
          : (Array.isArray(input.talhoes) && input.talhoes.length
              ? input.talhoes[0]?.talhao_id
              : input.talhao_id),
      ),
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
    if (!Number.isInteger(payload.talhao_id) || payload.talhao_id <= 0)
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

    const valorFrete = freteRepo.getValor({
      safra_id: payload.safra_id,
      motorista_id: payload.motorista_id,
      destino_id: payload.destino_id,
    })
    if (valorFrete === null) {
      throw unprocessable(
        'Nao existe frete cadastrado para (safra, motorista, destino). Cadastre em Fretes.',
        {
          safra_id: payload.safra_id,
          motorista_id: payload.motorista_id,
          destino_id: payload.destino_id,
        },
      )
    }

    // regras SEMPRE por destino+safra+tipo_plantio.
    // Se nao existir para o plantio, nao deve "cair" em outra tabela (evita usar regra errada).
    const regra = destinoRegraRepo.getBySafraDestinoPlantio({
      safra_id: payload.safra_id,
      destino_id: payload.destino_id,
      tipo_plantio: payload.tipo_plantio,
    })

    if (!regra) {
      throw unprocessable('Nao existe regra do destino para (safra, destino, tipo_plantio). Cadastre em Regras do destino.', {
        safra_id: payload.safra_id,
        destino_id: payload.destino_id,
        tipo_plantio: payload.tipo_plantio,
      })
    }

    const faixas = regra ? destinoRegraRepo.getUmidadeFaixasPlantio(regra.id) : []

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

    const destino_regra_existe = true
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

    // Secagem e cobrada por saca do produto (base limpa/seca).
    const sub_total_secagem = round(calc.sacas * secagem_custo_por_saca, 6)

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

    const frete_por_saca =
      calc.sacas > 0 ? round(calc.sub_total_frete / calc.sacas, 6) : 0

    function getCompraFaixas(regraPlantioId) {
      if (!regraPlantioId) return []
      return destinoRegraRepo.getCompraFaixasPlantio(regraPlantioId)
    }

    function getEntregaAntesSacas() {
      // Ordenacao da colheita: data_saida + hora_saida + id
      // Se nao tiver data_saida, considera que entra por ultimo.
      const tp = String(payload.tipo_plantio || '').trim().toUpperCase()
      if (!payload.data_saida) {
        const row = db
          .prepare(
            `SELECT COALESCE(SUM(v.sacas), 0) as entrega
             FROM viagem v
             JOIN safra s ON s.id = v.safra_id
             WHERE v.safra_id=@safra_id
               AND v.destino_id=@destino_id
               AND UPPER(COALESCE(NULLIF(v.tipo_plantio, ''), NULLIF(s.plantio, ''))) = @tipo_plantio
               AND (@exclude_id IS NULL OR v.id <> @exclude_id)`,
          )
          .get({
            safra_id: payload.safra_id,
            destino_id: payload.destino_id,
            tipo_plantio: tp,
            exclude_id,
          })
        return Number(row?.entrega || 0)
      }

      const horaKey = String(payload.hora_saida || '99:99')

      const row = db
        .prepare(
          `SELECT COALESCE(SUM(v.sacas), 0) as entrega
           FROM viagem v
           JOIN safra s ON s.id = v.safra_id
           WHERE v.safra_id=@safra_id
             AND v.destino_id=@destino_id
             AND UPPER(COALESCE(NULLIF(v.tipo_plantio, ''), NULLIF(s.plantio, ''))) = @tipo_plantio
             AND (@exclude_id IS NULL OR v.id <> @exclude_id)
             AND (
               (v.data_saida IS NOT NULL AND v.data_saida < @data_saida)
               OR (
                 v.data_saida = @data_saida
                 AND COALESCE(v.hora_saida, '99:99') < @hora_saida
               )
               OR (
                 v.data_saida = @data_saida
                 AND COALESCE(v.hora_saida, '99:99') = @hora_saida
                 AND v.id < @current_id
               )
             )`,
        )
        .get({
          safra_id: payload.safra_id,
          destino_id: payload.destino_id,
          tipo_plantio: tp,
          data_saida: payload.data_saida,
          hora_saida: horaKey,
          current_id,
          exclude_id,
        })
      return Number(row?.entrega || 0)
    }

    function computeCompraByFaixas({ entregueAntes, sacas, faixas }) {
      const qty = Number(sacas || 0)
      if (!Number.isFinite(qty) || qty <= 0) {
        return {
          entregueAntes: Number(entregueAntes || 0),
          entregueDepois: Number(entregueAntes || 0),
          precoMedio: 0,
          total: 0,
          detalhes: [],
        }
      }

      const sorted = [...(faixas || [])]
        .map((f) => ({
          sacas_gt: Number(f.sacas_gt || 0),
          sacas_lte:
            f.sacas_lte === null || f.sacas_lte === undefined
              ? null
              : Number(f.sacas_lte),
          preco_por_saca: Number(f.preco_por_saca || 0),
        }))
        .filter((f) => Number.isFinite(f.sacas_gt) && Number.isFinite(f.preco_por_saca))
        .sort((a, b) => {
          if (a.sacas_gt !== b.sacas_gt) return a.sacas_gt - b.sacas_gt
          const ae = a.sacas_lte === null ? 1e18 : a.sacas_lte
          const be = b.sacas_lte === null ? 1e18 : b.sacas_lte
          return ae - be
        })

      // fallback (nunca deixa vazio)
      if (!sorted.length) {
        sorted.push({ sacas_gt: 0, sacas_lte: null, preco_por_saca: 0 })
      }

      const start = Number(entregueAntes || 0)
      const end = start + qty
      let total = 0
      const detalhes = []

      for (const f of sorted) {
        const faixaIni = Number(f.sacas_gt || 0)
        const faixaFim = f.sacas_lte === null ? Infinity : Number(f.sacas_lte)
        const ini = Math.max(start, faixaIni)
        const fim = Math.min(end, faixaFim)
        const q = Math.max(0, fim - ini)
        if (q <= 0) continue
        total += q * Number(f.preco_por_saca || 0)
        detalhes.push({
          de_acumulado: ini,
          ate_acumulado: fim,
          sacas: round(q, 6),
          preco_por_saca: round(Number(f.preco_por_saca || 0), 6),
        })
      }

      // Se ficou algum "buraco" (faixas mal definidas), usa o ultimo preco
      const somaDetalhes = detalhes.reduce((a, x) => a + Number(x.sacas || 0), 0)
      const falta = Math.max(0, qty - somaDetalhes)
      if (falta > 0) {
        const last = sorted[sorted.length - 1]
        total += falta * Number(last.preco_por_saca || 0)
        detalhes.push({
          de_acumulado: end - falta,
          ate_acumulado: end,
          sacas: round(falta, 6),
          preco_por_saca: round(Number(last.preco_por_saca || 0), 6),
        })
      }

      const precoMedio = qty > 0 ? total / qty : 0
      return {
        entregueAntes: round(start, 6),
        entregueDepois: round(end, 6),
        precoMedio: round(precoMedio, 6),
        total: round(total, 6),
        detalhes,
      }
    }

    const compra_faixas_db = regra ? getCompraFaixas(regra.id) : []
    const compra_faixas = compra_faixas_db.length
      ? compra_faixas_db
      : regra
        ? [{ sacas_gt: 0, sacas_lte: null, preco_por_saca: Number(regra.valor_compra_por_saca ?? 120) }]
        : []

    const entregaAntes = regra ? getEntregaAntesSacas() : 0
    const compraCalc = regra
      ? computeCompraByFaixas({ entregueAntes: entregaAntes, sacas: calc.sacas, faixas: compra_faixas })
      : { entregueAntes: null, entregueDepois: null, precoMedio: null, total: null, detalhes: [] }

    const valor_compra_por_saca = regra ? compraCalc.precoMedio : null

    const despesas_silo_por_saca = round(
      (secagem_custo_por_saca || 0) + (custo_silo_por_saca || 0) + frete_por_saca,
      6,
    )

    const despesas_terceiros_por_saca = round(
      despesas_silo_por_saca + (custo_terceiros_por_saca || 0),
      6,
    )

    const valor_compra_silo_liquida_por_saca =
      valor_compra_por_saca === null
        ? null
        : round(valor_compra_por_saca - despesas_silo_por_saca, 6)

    const valor_venda_terceiros_bruto_ideal_por_saca =
      valor_compra_silo_liquida_por_saca === null
        ? null
        : round(valor_compra_silo_liquida_por_saca + despesas_terceiros_por_saca, 6)

    const venda_silo_preco_liquido_por_saca =
      valor_compra_por_saca === null
        ? null
        : round(valor_compra_por_saca - abatimento_por_saca_silo, 6)

    const venda_silo_total_liquido =
      venda_silo_preco_liquido_por_saca === null
        ? null
        : round(calc.sacas * venda_silo_preco_liquido_por_saca, 6)

    const venda_terceiros_preco_equivalente_por_saca =
      venda_silo_preco_liquido_por_saca === null
        ? null
        : round(venda_silo_preco_liquido_por_saca + abatimento_por_saca_terceiros, 6)

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

      // Venda (comparativo): usa valor de compra no silo e mostra o preco equivalente para terceiros
      valor_compra_por_saca,
      valor_compra_por_saca_aplicado: valor_compra_por_saca,
      valor_compra_total: regra ? compraCalc.total : null,
      valor_compra_detalhe_json: regra ? JSON.stringify(compraCalc.detalhes) : null,
      valor_compra_entrega_antes: regra ? compraCalc.entregueAntes : null,
      valor_compra_entrega_depois: regra ? compraCalc.entregueDepois : null,
      valor_compra_detalhes: regra ? compraCalc.detalhes : [],
      frete_por_saca,
      despesas_silo_por_saca,
      despesas_terceiros_por_saca,
      valor_compra_silo_liquida_por_saca,
      valor_venda_terceiros_bruto_ideal_por_saca,
      venda_silo_preco_liquido_por_saca,
      venda_silo_total_liquido,
      venda_terceiros_preco_equivalente_por_saca,

      destino_regra_existe,
      umidade_faixas_qtd,
      umidade_origem,
      trava_sacas: regra?.trava_sacas ?? null,
      limites_origem,
    }
  },

  resolveUmidadeFaixa({ umidade_pct, faixas }) {
    for (const f of faixas) {
      if (umidade_pct > f.umid_gt && umidade_pct <= f.umid_lte) return f
    }
    return null
  },

  getTravaStatus({ destino_id, safra_id, tipo_plantio, sacas, exclude_id } = {}) {
    const destino = destinoRepo.get(destino_id)
    if (!destino) throw unprocessable('Destino inexistente')

    const tp = String(tipo_plantio || '').trim().toUpperCase()
    const regra = destinoRegraRepo.getBySafraDestinoPlantio({
      safra_id,
      destino_id,
      tipo_plantio: tp,
    })

    // Regra de negocio (contrato): "trava_sacas" representa o volume contratado (sacas).
    // Ate este volume, aplica-se o preco/condicao negociado. Acima, entra em regime "fora do contrato".
    const contrato_sacas_raw = regra?.trava_sacas ?? null
    if (contrato_sacas_raw === null || contrato_sacas_raw === undefined) return null

    const whereExtra = exclude_id ? ' AND v.id <> @exclude_id' : ''
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(v.sacas), 0) as entrega_atual
         FROM viagem v
         JOIN safra s ON s.id = v.safra_id
         WHERE v.destino_id=@destino_id
           AND v.safra_id=@safra_id
           AND UPPER(COALESCE(NULLIF(v.tipo_plantio, ''), NULLIF(s.plantio, ''))) = @tipo_plantio
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
    const excedeu = entrega_depois > contrato_sacas

    return {
      // compat: "atingida" era usado como alerta de trava
      atingida: excedeu,
      excedeu,
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
    }
  },

  create(input) {
    const payload = this.buildPayload(input)
    const rateioItems = buildRateioItems({
      input,
      peso_base_kg: payload.peso_bruto_kg,
      fallback_talhao_id: payload.talhao_id,
    })
    const trava = this.getTravaStatus({
      destino_id: payload.destino_id,
      safra_id: payload.safra_id,
      tipo_plantio: payload.tipo_plantio,
      sacas: payload.sacas,
    })
    try {
      const tx = db.transaction(() => {
        const row = viagemRepo.create(payload)
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
  },

  update(id, input) {
    const payload = this.buildPayload(input, { current_id: id, exclude_id: id })

    const rateioItems = buildRateioItems({
      input,
      peso_base_kg: payload.peso_bruto_kg,
      fallback_talhao_id: payload.talhao_id,
    })

    const trava = this.getTravaStatus({
      destino_id: payload.destino_id,
      safra_id: payload.safra_id,
      tipo_plantio: payload.tipo_plantio,
      sacas: payload.sacas,
      exclude_id: id,
    })

    try {
      const tx = db.transaction(() => {
        viagemRepo.update(id, payload)
        viagemTalhaoRepo.replaceForViagem({ viagem_id: id, items: rateioItems })
        return viagemRepo.get(id)
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
  },

  recalcularPrecosCompraSilo({ safra_id, destino_id, tipo_plantio }) {
    const sid = Number(safra_id)
    const did = Number(destino_id)
    const tp = String(tipo_plantio || '').trim().toUpperCase()
    if (!Number.isInteger(sid) || sid <= 0) throw unprocessable('safra_id invalido')
    if (!Number.isInteger(did) || did <= 0) throw unprocessable('destino_id invalido')
    if (!tp) throw unprocessable('tipo_plantio obrigatorio')

    const regra = destinoRegraRepo.getBySafraDestinoPlantio({
      safra_id: sid,
      destino_id: did,
      tipo_plantio: tp,
    })
    if (!regra) {
      throw unprocessable('Nao existe regra para (safra, destino, tipo_plantio)')
    }

    const faixasDb = destinoRegraRepo.getCompraFaixasPlantio(regra.id) || []
    const faixas = (faixasDb.length
      ? faixasDb
      : [
          {
            sacas_gt: 0,
            sacas_lte: null,
            preco_por_saca: Number(regra.valor_compra_por_saca ?? 120),
          },
        ]
    )
      .map((f) => ({
        sacas_gt: Number(f.sacas_gt || 0),
        sacas_lte:
          f.sacas_lte === null || f.sacas_lte === undefined
            ? null
            : Number(f.sacas_lte),
        preco_por_saca: Number(f.preco_por_saca || 0),
      }))
      .filter((f) => Number.isFinite(f.sacas_gt) && Number.isFinite(f.preco_por_saca))
      .sort((a, b) => {
        if (a.sacas_gt !== b.sacas_gt) return a.sacas_gt - b.sacas_gt
        const ae = a.sacas_lte === null ? 1e18 : a.sacas_lte
        const be = b.sacas_lte === null ? 1e18 : b.sacas_lte
        return ae - be
      })

    function computeCompraByFaixas({ entregueAntes, sacas }) {
      const qty = Number(sacas || 0)
      const start = Number(entregueAntes || 0)
      if (!Number.isFinite(qty) || qty <= 0) {
        return { entregueAntes: start, entregueDepois: start, precoMedio: 0, total: 0, detalhes: [] }
      }

      const end = start + qty
      let total = 0
      const detalhes = []

      for (const f of faixas) {
        const faixaIni = Number(f.sacas_gt || 0)
        const faixaFim = f.sacas_lte === null ? Infinity : Number(f.sacas_lte)
        const ini = Math.max(start, faixaIni)
        const fim = Math.min(end, faixaFim)
        const q = Math.max(0, fim - ini)
        if (q <= 0) continue
        total += q * Number(f.preco_por_saca || 0)
        detalhes.push({
          de_acumulado: ini,
          ate_acumulado: fim,
          sacas: round(q, 6),
          preco_por_saca: round(Number(f.preco_por_saca || 0), 6),
        })
      }

      const somaDetalhes = detalhes.reduce((a, x) => a + Number(x.sacas || 0), 0)
      const falta = Math.max(0, qty - somaDetalhes)
      if (falta > 0) {
        const last = faixas[faixas.length - 1]
        total += falta * Number(last.preco_por_saca || 0)
        detalhes.push({
          de_acumulado: end - falta,
          ate_acumulado: end,
          sacas: round(falta, 6),
          preco_por_saca: round(Number(last.preco_por_saca || 0), 6),
        })
      }

      const precoMedio = qty > 0 ? total / qty : 0
      return {
        entregueAntes: round(start, 6),
        entregueDepois: round(end, 6),
        precoMedio: round(precoMedio, 6),
        total: round(total, 6),
        detalhes,
      }
    }

    const viagens = db
      .prepare(
        `SELECT
           v.id,
           v.ficha,
           v.motorista_id,
           v.carga_total_kg,
           v.tara_kg,
           v.umidade_pct,
           v.umidade_desc_pct_manual,
           v.impureza_pct,
           v.ardidos_pct,
           v.queimados_pct,
           v.avariados_pct,
           v.esverdiados_pct,
           v.quebrados_pct,
           v.impureza_limite_pct,
           v.ardidos_limite_pct,
           v.queimados_limite_pct,
           v.avariados_limite_pct,
           v.esverdiados_limite_pct,
           v.quebrados_limite_pct,
           v.frete_tabela,
           v.data_saida,
           v.hora_saida
         FROM viagem v
         JOIN safra s ON s.id = v.safra_id
         WHERE v.safra_id=@safra_id
           AND v.destino_id=@destino_id
           AND UPPER(COALESCE(NULLIF(v.tipo_plantio, ''), NULLIF(s.plantio, ''))) = @tipo_plantio
         ORDER BY
           CASE WHEN v.data_saida IS NULL OR v.data_saida='' THEN 1 ELSE 0 END,
           v.data_saida ASC,
           COALESCE(v.hora_saida, '99:99') ASC,
           v.id ASC`,
      )
      .all({ safra_id: sid, destino_id: did, tipo_plantio: tp })

    const upd = db.prepare(
      `UPDATE viagem
       SET
         peso_bruto_kg=@peso_bruto_kg,
         umidade_desc_pct=@umidade_desc_pct,
         umidade_kg=@umidade_kg,
         impureza_kg=@impureza_kg,
         ardidos_kg=@ardidos_kg,
         queimados_kg=@queimados_kg,
         avariados_kg=@avariados_kg,
         esverdiados_kg=@esverdiados_kg,
         quebrados_kg=@quebrados_kg,
         peso_limpo_seco_kg=@peso_limpo_seco_kg,
         sacas=@sacas,
         sacas_frete=@sacas_frete,
         frete_tabela=@frete_tabela,
         sub_total_frete=@sub_total_frete,
         secagem_custo_por_saca=@secagem_custo_por_saca,
         sub_total_secagem=@sub_total_secagem,
         custo_silo_por_saca=@custo_silo_por_saca,
         sub_total_custo_silo=@sub_total_custo_silo,
         abatimento_total_silo=@abatimento_total_silo,
         abatimento_por_saca_silo=@abatimento_por_saca_silo,
         custo_terceiros_por_saca=@custo_terceiros_por_saca,
         sub_total_custo_terceiros=@sub_total_custo_terceiros,
         abatimento_total_terceiros=@abatimento_total_terceiros,
         abatimento_por_saca_terceiros=@abatimento_por_saca_terceiros,

         valor_compra_por_saca_aplicado=@valor_compra_por_saca_aplicado,
         valor_compra_total=@valor_compra_total,
         valor_compra_detalhe_json=@valor_compra_detalhe_json,
         valor_compra_entrega_antes=@valor_compra_entrega_antes,
         valor_compra_entrega_depois=@valor_compra_entrega_depois,
         updated_at=datetime('now')
       WHERE id=@id`,
    )

    const tx = db.transaction(() => {
      let entregue = 0
      let totalSacas = 0
      for (const v of viagens) {
        // Recalcular sacas/umidade/frete/custos com base nas regras atuais
        const faixasUmid = destinoRegraRepo.getUmidadeFaixasPlantio(regra.id) || []
        const faixaUmid = this.resolveUmidadeFaixa({
          umidade_pct: Number(v.umidade_pct || 0),
          faixas: faixasUmid,
        })

        const umidade_desc_pct_sugerida = faixaUmid ? Number(faixaUmid.desconto_pct || 0) : 0
        const secagem_custo_por_saca = faixaUmid ? Number(faixaUmid.custo_secagem_por_saca || 0) : 0

        const freteAtual = freteRepo.getValor({
          safra_id: sid,
          motorista_id: Number(v.motorista_id),
          destino_id: did,
        })
        const frete_tabela = freteAtual === null ? Number(v.frete_tabela || 0) : Number(freteAtual)

        const calc = calcularViagem({
          carga_total_kg: Number(v.carga_total_kg || 0),
          tara_kg: Number(v.tara_kg || 0),
          umidade_pct: Number(v.umidade_pct || 0),
          umidade_desc_pct: umidade_desc_pct_sugerida,
          umidade_desc_pct_manual:
            v.umidade_desc_pct_manual === null || v.umidade_desc_pct_manual === undefined
              ? null
              : Number(v.umidade_desc_pct_manual),
          impureza_pct: Number(v.impureza_pct || 0),
          ardidos_pct: Number(v.ardidos_pct || 0),
          queimados_pct: Number(v.queimados_pct || 0),
          avariados_pct: Number(v.avariados_pct || 0),
          esverdiados_pct: Number(v.esverdiados_pct || 0),
          quebrados_pct: Number(v.quebrados_pct || 0),
          impureza_limite_pct: Number(v.impureza_limite_pct || 0),
          ardidos_limite_pct: Number(v.ardidos_limite_pct || 0),
          queimados_limite_pct: Number(v.queimados_limite_pct || 0),
          avariados_limite_pct: Number(v.avariados_limite_pct || 0),
          esverdiados_limite_pct: Number(v.esverdiados_limite_pct || 0),
          quebrados_limite_pct: Number(v.quebrados_limite_pct || 0),
          frete_tabela,
        })

        const sacas = Number(calc.sacas || 0)
        const sub_total_secagem = round(sacas * secagem_custo_por_saca, 6)

        const custo_silo_por_saca = Number(regra.custo_silo_por_saca || 0)
        const custo_terceiros_por_saca = Number(regra.custo_terceiros_por_saca || 0)

        const sub_total_custo_silo = round(sacas * custo_silo_por_saca, 6)
        const sub_total_custo_terceiros = round(sacas * custo_terceiros_por_saca, 6)

        const abatimento_total_silo = round(
          Number(calc.sub_total_frete || 0) + sub_total_secagem + sub_total_custo_silo,
          6,
        )
        const abatimento_total_terceiros = round(
          Number(calc.sub_total_frete || 0) + sub_total_secagem + sub_total_custo_terceiros,
          6,
        )

        const abatimento_por_saca_silo = sacas > 0 ? round(abatimento_total_silo / sacas, 6) : 0
        const abatimento_por_saca_terceiros = sacas > 0 ? round(abatimento_total_terceiros / sacas, 6) : 0

        const c = computeCompraByFaixas({ entregueAntes: entregue, sacas })
        upd.run({
          id: v.id,
          peso_bruto_kg: calc.peso_bruto_kg,
          umidade_desc_pct: calc.umidade_desc_pct,
          umidade_kg: calc.umidade_kg,
          impureza_kg: calc.impureza_kg,
          ardidos_kg: calc.ardidos_kg,
          queimados_kg: calc.queimados_kg,
          avariados_kg: calc.avariados_kg,
          esverdiados_kg: calc.esverdiados_kg,
          quebrados_kg: calc.quebrados_kg,
          peso_limpo_seco_kg: calc.peso_limpo_seco_kg,
          sacas: calc.sacas,
          sacas_frete: calc.sacas_frete,
          frete_tabela: calc.frete_tabela,
          sub_total_frete: calc.sub_total_frete,
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
          valor_compra_por_saca_aplicado: c.precoMedio,
          valor_compra_total: c.total,
          valor_compra_detalhe_json: JSON.stringify(c.detalhes || []),
          valor_compra_entrega_antes: c.entregueAntes,
          valor_compra_entrega_depois: c.entregueDepois,
        })
        entregue += Number.isFinite(sacas) ? sacas : 0
        totalSacas += Number.isFinite(sacas) ? sacas : 0
      }
      return { updated: viagens.length, total_sacas: round(totalSacas, 6) }
    })

    const r = tx()
    return {
      ...r,
      safra_id: sid,
      destino_id: did,
      tipo_plantio: tp,
      destino_regra_plantio_id: regra.id,
      faixas: faixas.length,
    }
  },

  compararDestinos(input) {
    const carga_total_kg = toDbNumber(input.carga_total_kg, 'carga_total_kg')
    const tara_kg = toDbNumber(input.tara_kg, 'tara_kg')
    if (carga_total_kg < 0 || tara_kg < 0 || tara_kg > carga_total_kg) {
      throw unprocessable('Pesos invalidos (tara deve ser <= carga_total)')
    }

    const safra_id = Number(input.safra_id)
    if (!Number.isInteger(safra_id) || safra_id <= 0) {
      throw unprocessable('safra_id invalido')
    }

    const destino_atual_id = Number(input.destino_id)
    if (!Number.isInteger(destino_atual_id) || destino_atual_id <= 0) {
      throw unprocessable('destino_id invalido')
    }

    const motorista_id = Number(input.motorista_id)
    if (!Number.isInteger(motorista_id) || motorista_id <= 0) {
      throw unprocessable('motorista_id invalido')
    }

    const safraRow = db
      .prepare('SELECT plantio FROM safra WHERE id=?')
      .get(safra_id)
    const defaultPlantio = String(safraRow?.plantio || 'SOJA')
      .trim()
      .toUpperCase()
    const inputPlantio = String(input.tipo_plantio ?? '').trim().toUpperCase()
    const tipo_plantio = inputPlantio || defaultPlantio

    const current_id =
      Number.isFinite(Number(input.id)) && Number(input.id) > 0
        ? Number(input.id)
        : 1e18
    const exclude_id =
      Number.isFinite(Number(input.id)) && Number(input.id) > 0
        ? Number(input.id)
        : null

    const base = {
      carga_total_kg,
      tara_kg,
      umidade_pct: normalizePercent100(input.umidade_pct, 'umidade_pct'),
      // comparar destinos usa a tabela do destino (nao o manual)
      umidade_desc_pct_manual: null,
      impureza_pct: normalizePercent100(input.impureza_pct, 'impureza_pct'),
      ardidos_pct: normalizePercent100(input.ardidos_pct, 'ardidos_pct'),
      queimados_pct: normalizePercent100(input.queimados_pct, 'queimados_pct'),
      avariados_pct: normalizePercent100(input.avariados_pct, 'avariados_pct'),
      esverdiados_pct: normalizePercent100(input.esverdiados_pct, 'esverdiados_pct'),
      quebrados_pct: normalizePercent100(input.quebrados_pct, 'quebrados_pct'),
    }

    const regras = destinoRegraRepo.listPlantioBySafraTipo({
      safra_id,
      tipo_plantio,
    })

    const peso_bruto_kg = carga_total_kg - tara_kg
    const sacas_frete = peso_bruto_kg / 60

    function getEntregaAntesSacas({ destino_id }) {
      // Mesmo criterio do preview: soma entregas ANTES desta viagem (por data_saida + hora_saida + id)
      const tp = String(tipo_plantio || '').trim().toUpperCase()
      const data_saida = input.data_saida || null
      const hora_saida = String(input.hora_saida || '99:99')

      if (!data_saida) {
        const row = db
          .prepare(
            `SELECT COALESCE(SUM(v.sacas), 0) as entrega
             FROM viagem v
             JOIN safra s ON s.id = v.safra_id
             WHERE v.safra_id=@safra_id
               AND v.destino_id=@destino_id
               AND UPPER(COALESCE(NULLIF(v.tipo_plantio, ''), NULLIF(s.plantio, ''))) = @tipo_plantio
               AND (@exclude_id IS NULL OR v.id <> @exclude_id)`,
          )
          .get({ safra_id, destino_id, tipo_plantio: tp, exclude_id })
        return Number(row?.entrega || 0)
      }

      const row = db
        .prepare(
          `SELECT COALESCE(SUM(v.sacas), 0) as entrega
           FROM viagem v
           JOIN safra s ON s.id = v.safra_id
           WHERE v.safra_id=@safra_id
             AND v.destino_id=@destino_id
             AND UPPER(COALESCE(NULLIF(v.tipo_plantio, ''), NULLIF(s.plantio, ''))) = @tipo_plantio
             AND (@exclude_id IS NULL OR v.id <> @exclude_id)
             AND (
               (v.data_saida IS NOT NULL AND v.data_saida < @data_saida)
               OR (
                 v.data_saida = @data_saida
                 AND COALESCE(v.hora_saida, '99:99') < @hora_saida
               )
               OR (
                 v.data_saida = @data_saida
                 AND COALESCE(v.hora_saida, '99:99') = @hora_saida
                 AND v.id < @current_id
               )
             )`,
        )
        .get({
          safra_id,
          destino_id,
          tipo_plantio: tp,
          data_saida,
          hora_saida,
          current_id,
          exclude_id,
        })
      return Number(row?.entrega || 0)
    }

    function computeCompraByFaixas({ entregueAntes, sacas, faixas }) {
      const qty = Number(sacas || 0)
      if (!Number.isFinite(qty) || qty <= 0) {
        return {
          entregueAntes: Number(entregueAntes || 0),
          entregueDepois: Number(entregueAntes || 0),
          precoMedio: 0,
          total: 0,
          detalhes: [],
        }
      }

      const sorted = [...(faixas || [])]
        .map((f) => ({
          sacas_gt: Number(f.sacas_gt || 0),
          sacas_lte:
            f.sacas_lte === null || f.sacas_lte === undefined
              ? null
              : Number(f.sacas_lte),
          preco_por_saca: Number(f.preco_por_saca || 0),
        }))
        .filter(
          (f) => Number.isFinite(f.sacas_gt) && Number.isFinite(f.preco_por_saca),
        )
        .sort((a, b) => {
          if (a.sacas_gt !== b.sacas_gt) return a.sacas_gt - b.sacas_gt
          const ae = a.sacas_lte === null ? 1e18 : a.sacas_lte
          const be = b.sacas_lte === null ? 1e18 : b.sacas_lte
          return ae - be
        })

      if (!sorted.length) sorted.push({ sacas_gt: 0, sacas_lte: null, preco_por_saca: 0 })

      const start = Number(entregueAntes || 0)
      const end = start + qty
      let total = 0
      const detalhes = []

      for (const f of sorted) {
        const faixaIni = Number(f.sacas_gt || 0)
        const faixaFim = f.sacas_lte === null ? Infinity : Number(f.sacas_lte)
        const ini = Math.max(start, faixaIni)
        const fim = Math.min(end, faixaFim)
        const q = Math.max(0, fim - ini)
        if (q <= 0) continue
        total += q * Number(f.preco_por_saca || 0)
        detalhes.push({
          de_acumulado: ini,
          ate_acumulado: fim,
          sacas: round(q, 6),
          preco_por_saca: round(Number(f.preco_por_saca || 0), 6),
        })
      }

      const somaDetalhes = detalhes.reduce((a, x) => a + Number(x.sacas || 0), 0)
      const falta = Math.max(0, qty - somaDetalhes)
      if (falta > 0) {
        const last = sorted[sorted.length - 1]
        total += falta * Number(last.preco_por_saca || 0)
        detalhes.push({
          de_acumulado: end - falta,
          ate_acumulado: end,
          sacas: round(falta, 6),
          preco_por_saca: round(Number(last.preco_por_saca || 0), 6),
        })
      }

      const precoMedio = qty > 0 ? total / qty : 0
      return {
        entregueAntes: round(start, 6),
        entregueDepois: round(end, 6),
        precoMedio: round(precoMedio, 6),
        total: round(total, 6),
        detalhes,
      }
    }

    const computeForRegra = (r) => {
      const faixas = destinoRegraRepo.getUmidadeFaixasPlantio(r.id) || []
      const faixaUmid = this.resolveUmidadeFaixa({
        umidade_pct: base.umidade_pct,
        faixas,
      })
      const umidade_desc_pct = faixaUmid ? Number(faixaUmid.desconto_pct || 0) : 0
      const secagem_custo_por_saca = faixaUmid
        ? Number(faixaUmid.custo_secagem_por_saca || 0)
        : 0

      const calc = calcularViagem({
        ...base,
        impureza_limite_pct: Number(r.impureza_limite_pct || 0),
        ardidos_limite_pct: Number(r.ardidos_limite_pct || 0),
        queimados_limite_pct: Number(r.queimados_limite_pct || 0),
        avariados_limite_pct: Number(r.avariados_limite_pct || 0),
        esverdiados_limite_pct: Number(r.esverdiados_limite_pct || 0),
        quebrados_limite_pct: Number(r.quebrados_limite_pct || 0),
        umidade_desc_pct,
        // comparação: frete nao entra (fica neutro)
        frete_tabela: 0,
      })

      const sub_total_secagem = round(calc.sacas * secagem_custo_por_saca, 6)
      const custo_silo_por_saca = Number(r.custo_silo_por_saca || 0)
      const sub_total_custo_silo = round(calc.sacas * custo_silo_por_saca, 6)

      const compra_faixas_db = destinoRegraRepo.getCompraFaixasPlantio(r.id) || []
      const compra_faixas = compra_faixas_db.length
        ? compra_faixas_db
        : [
            {
              sacas_gt: 0,
              sacas_lte: null,
              preco_por_saca: Number(r.valor_compra_por_saca ?? 120),
            },
          ]

      const entregaAntes = getEntregaAntesSacas({ destino_id: r.destino_id })
      const compraCalc = computeCompraByFaixas({
        entregueAntes: entregaAntes,
        sacas: calc.sacas,
        faixas: compra_faixas,
      })

      const valor_compra_por_saca = compraCalc.precoMedio

      // Frete (por motorista x destino)
      const frete_tabela = freteRepo.getValor({
        safra_id,
        motorista_id,
        destino_id: Number(r.destino_id),
      })
      const sub_total_frete =
        frete_tabela === null || frete_tabela === undefined
          ? null
          : round(sacas_frete * Number(frete_tabela || 0), 6)

      // Precos/valores finais (Silo)
      // - preco_liquido_sem_frete: compra - secagem - custos do silo
      // - total_sem_frete: sacas * preco_liquido_sem_frete
      // - total_com_frete: total_sem_frete - frete
      const preco_compra_por_saca = valor_compra_por_saca
      const preco_liquido_sem_frete_por_saca = round(
        preco_compra_por_saca - (secagem_custo_por_saca || 0) - (custo_silo_por_saca || 0),
        6,
      )

      const valor_compra_total = compraCalc.total
      const valor_final_total_sem_frete = round(
        calc.sacas * preco_liquido_sem_frete_por_saca,
        6,
      )
      const valor_final_total_com_frete =
        sub_total_frete === null
          ? null
          : round(valor_final_total_sem_frete - sub_total_frete, 6)

      return {
        destino_id: r.destino_id,
        destino_local: r.destino_local,
        destino_codigo: r.destino_codigo,
        tipo_plantio,
        sacas: calc.sacas,
        peso_limpo_seco_kg: calc.peso_limpo_seco_kg,
        umidade_desc_pct_sugerida: calc.umidade_desc_pct_sugerida,
        umidade_desc_pct: calc.umidade_desc_pct,
        secagem_custo_por_saca,
        custo_silo_por_saca,
        sub_total_secagem,
        sub_total_custo_silo,
        frete_tabela,
        sub_total_frete,

        preco_compra_por_saca,
        valor_compra_total,
        preco_liquido_sem_frete_por_saca,
        valor_final_total_sem_frete,
        valor_final_total_com_frete,
      }
    }

    const results = regras.map(computeForRegra)
    const atual = results.find((x) => Number(x.destino_id) === destino_atual_id) || null

    const items = results
      .map((x) => ({
        ...x,
        is_atual: Number(x.destino_id) === destino_atual_id,
        delta_valor_final_total_com_frete:
          atual && atual.valor_final_total_com_frete !== null && x.valor_final_total_com_frete !== null
            ? round(
                Number(x.valor_final_total_com_frete) - Number(atual.valor_final_total_com_frete),
                6,
              )
            : null,
      }))

      // Ordenar por valor final com frete quando existir; senao, por valor final sem frete
      .sort((a, b) => {
        const av = a.valor_final_total_com_frete === null ? a.valor_final_total_sem_frete : a.valor_final_total_com_frete
        const bv = b.valor_final_total_com_frete === null ? b.valor_final_total_sem_frete : b.valor_final_total_com_frete
        return Number(bv || 0) - Number(av || 0)
      })

    return {
      safra_id,
      tipo_plantio,
      destino_atual_id,
      base: {
        carga_total_kg,
        tara_kg,
        umidade_pct: base.umidade_pct,
        impureza_pct: base.impureza_pct,
        ardidos_pct: base.ardidos_pct,
        queimados_pct: base.queimados_pct,
        avariados_pct: base.avariados_pct,
        esverdiados_pct: base.esverdiados_pct,
        quebrados_pct: base.quebrados_pct,
      },
      items,
    }
  },
}

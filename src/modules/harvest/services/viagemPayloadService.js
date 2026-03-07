import { db } from '../../../db/db.js'
import { freteRepo } from '../../../repositories/freteRepo.js'
import { viagemRepo } from '../../../repositories/viagemRepo.js'
import { destinoRegraRepo } from '../../../repositories/destinoRegraRepo.js'
import { contratoSiloRepo } from '../../../repositories/contratoSiloRepo.js'
import { calcularViagem } from '../../../domain/calculations.js'
import { normalizePercent100, round } from '../../../domain/normalize.js'
import { unprocessable } from '../../../errors.js'
import { toDbNumber, normalizeOptionalPercent } from './viagemCoerce.js'

export function buildViagemPayload(input, opts = {}, { resolveUmidadeFaixa } = {}) {
  if (typeof resolveUmidadeFaixa !== 'function') {
    throw new Error('resolveUmidadeFaixa obrigatorio')
  }

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

  function normalizeCustoSacas(v, fieldName) {
    if (v === null || v === undefined || v === '') return 0
    const n = toDbNumber(v, fieldName)
    if (n < 0) throw unprocessable(`Campo invalido: ${fieldName}`)
    return round(n, 6)
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

  const safraRow = db.prepare('SELECT plantio FROM safra WHERE id=?').get(safra_id)
  const defaultPlantio = String(safraRow?.plantio || 'SOJA').trim().toUpperCase()
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

    // Custos em sacas (controle fisico; opcional)
    custo_frete_sacas: normalizeCustoSacas(input.custo_frete_sacas, 'custo_frete_sacas'),
    custo_secagem_sacas: normalizeCustoSacas(input.custo_secagem_sacas, 'custo_secagem_sacas'),
    custo_silo_sacas: normalizeCustoSacas(input.custo_silo_sacas, 'custo_silo_sacas'),
    custo_terceiros_sacas: normalizeCustoSacas(input.custo_terceiros_sacas, 'custo_terceiros_sacas'),
    custo_outros_sacas: normalizeCustoSacas(input.custo_outros_sacas, 'custo_outros_sacas'),

    umidade_pct: normalizePercent100(input.umidade_pct, 'umidade_pct'),

    umidade_desc_pct_manual:
      input.umidade_desc_pct_manual === null ||
      input.umidade_desc_pct_manual === undefined ||
      input.umidade_desc_pct_manual === ''
        ? null
        : normalizePercent100(input.umidade_desc_pct_manual, 'umidade_desc_pct_manual'),

    impureza_pct: normalizePercent100(input.impureza_pct, 'impureza_pct'),
    ardidos_pct: normalizePercent100(input.ardidos_pct, 'ardidos_pct'),
    queimados_pct: normalizePercent100(input.queimados_pct, 'queimados_pct'),
    avariados_pct: normalizePercent100(input.avariados_pct, 'avariados_pct'),
    esverdiados_pct: normalizePercent100(input.esverdiados_pct, 'esverdiados_pct'),
    quebrados_pct: normalizePercent100(input.quebrados_pct, 'quebrados_pct'),

    impureza_limite_pct: normalizeOptionalPercent(input.impureza_limite_pct, 'impureza_limite_pct'),
    ardidos_limite_pct: normalizeOptionalPercent(input.ardidos_limite_pct, 'ardidos_limite_pct'),
    queimados_limite_pct: normalizeOptionalPercent(input.queimados_limite_pct, 'queimados_limite_pct'),
    avariados_limite_pct: normalizeOptionalPercent(input.avariados_limite_pct, 'avariados_limite_pct'),
    esverdiados_limite_pct: normalizeOptionalPercent(input.esverdiados_limite_pct, 'esverdiados_limite_pct'),
    quebrados_limite_pct: normalizeOptionalPercent(input.quebrados_limite_pct, 'quebrados_limite_pct'),
  }

  if (!Number.isInteger(payload.talhao_id) || payload.talhao_id <= 0) throw unprocessable('talhao_id invalido')
  if (!Number.isInteger(payload.destino_id)) throw unprocessable('destino_id invalido')
  if (!Number.isInteger(payload.motorista_id)) throw unprocessable('motorista_id invalido')

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
    throw unprocessable('Nao existe frete cadastrado para (safra, motorista, destino). Cadastre em Fretes.', {
      safra_id: payload.safra_id,
      motorista_id: payload.motorista_id,
      destino_id: payload.destino_id,
    })
  }

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

  const faixas = destinoRegraRepo.getUmidadeFaixasPlantio(regra.id) || []
  const faixaUmid = resolveUmidadeFaixa({ umidade_pct: payload.umidade_pct, faixas })

  const umidade_desc_pct = faixaUmid ? faixaUmid.desconto_pct : 0
  const secagem_custo_por_saca = faixaUmid ? Number(faixaUmid.custo_secagem_por_saca || 0) : 0

  const destino_regra_existe = true
  const umidade_faixas_qtd = faixas.length
  const umidade_faixa_encontrada = faixaUmid !== null && faixaUmid !== undefined

  const limites = {
    impureza_limite_pct: payload.impureza_limite_pct ?? regra?.impureza_limite_pct ?? 0,
    ardidos_limite_pct: payload.ardidos_limite_pct ?? regra?.ardidos_limite_pct ?? 0,
    queimados_limite_pct: payload.queimados_limite_pct ?? regra?.queimados_limite_pct ?? 0,
    avariados_limite_pct: payload.avariados_limite_pct ?? regra?.avariados_limite_pct ?? 0,
    esverdiados_limite_pct: payload.esverdiados_limite_pct ?? regra?.esverdiados_limite_pct ?? 0,
    quebrados_limite_pct: payload.quebrados_limite_pct ?? regra?.quebrados_limite_pct ?? 0,
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

  const sub_total_secagem = round(calc.sacas * secagem_custo_por_saca, 6)

  const custo_silo_por_saca = regra ? Number(regra.custo_silo_por_saca || 0) : 0
  const custo_terceiros_por_saca = regra ? Number(regra.custo_terceiros_por_saca || 0) : 0

  const sub_total_custo_silo = round(calc.sacas * custo_silo_por_saca, 6)
  const sub_total_custo_terceiros = round(calc.sacas * custo_terceiros_por_saca, 6)

  const abatimento_total_silo = round(calc.sub_total_frete + sub_total_secagem + sub_total_custo_silo, 6)
  const abatimento_total_terceiros = round(calc.sub_total_frete + sub_total_secagem + sub_total_custo_terceiros, 6)

  const abatimento_por_saca_silo = calc.sacas > 0 ? round(abatimento_total_silo / calc.sacas, 6) : 0
  const abatimento_por_saca_terceiros = calc.sacas > 0 ? round(abatimento_total_terceiros / calc.sacas, 6) : 0

  const frete_por_saca = calc.sacas > 0 ? round(calc.sub_total_frete / calc.sacas, 6) : 0

  function getEntregaAntesSacas() {
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
             AND (@exclude_id IS NULL OR v.id <> @exclude_id)
             AND v.deleted_at IS NULL`,
        )
        .get({ safra_id: payload.safra_id, destino_id: payload.destino_id, tipo_plantio: tp, exclude_id })
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
           AND v.deleted_at IS NULL
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

  const entregaAntes = regra ? getEntregaAntesSacas() : 0

  function computeContratoByFaixas({ entregueAntes, sacas, faixas }) {
    const qty = Number(sacas || 0)
    const start = Number(entregueAntes || 0)
    if (!Number.isFinite(qty) || qty <= 0) {
      return { dentro_sacas: 0, fora_sacas: 0, total: 0, detalhes: [], contrato_total: 0 }
    }

    const list = Array.isArray(faixas) ? faixas : []
    const norm = list
      .map((f) => ({ sacas: Number(f?.sacas || 0), preco_por_saca: Number(f?.preco_por_saca || 0) }))
      .filter((f) => Number.isFinite(f.sacas) && f.sacas > 0 && Number.isFinite(f.preco_por_saca) && f.preco_por_saca >= 0)

    if (!norm.length) {
      return { dentro_sacas: 0, fora_sacas: qty, total: 0, detalhes: [], contrato_total: 0 }
    }

    let acc = 0
    const ranges = norm.map((f) => {
      const from = acc
      acc += f.sacas
      return { from, to: acc, preco_por_saca: f.preco_por_saca }
    })
    const contrato_total = acc

    const end = start + qty
    let total = 0
    let dentro = 0
    const detalhes = []
    for (const r of ranges) {
      const ini = Math.max(start, r.from)
      const fim = Math.min(end, r.to)
      const q = Math.max(0, fim - ini)
      if (q <= 0) continue
      dentro += q
      total += q * r.preco_por_saca
      detalhes.push({ de_acumulado: ini, ate_acumulado: fim, sacas: round(q, 6), preco_por_saca: round(Number(r.preco_por_saca || 0), 6) })
    }

    const fora = Math.max(0, qty - dentro)
    return {
      dentro_sacas: round(dentro, 6),
      fora_sacas: round(fora, 6),
      total: round(total, 6),
      detalhes,
      contrato_total,
    }
  }

  const contrato = contratoSiloRepo.getOne({ safra_id: payload.safra_id, destino_id: payload.destino_id, tipo_plantio: payload.tipo_plantio })
  const contratoFaixas = Array.isArray(contrato?.faixas) ? contrato.faixas : []
  const contratoCalc = computeContratoByFaixas({ entregueAntes: entregaAntes, sacas: calc.sacas, faixas: contratoFaixas })

  const contratoExcedido = Number(contratoCalc.fora_sacas || 0) > 0
  const compraTotal = regra && !contratoExcedido ? round(Number(contratoCalc.total || 0), 6) : null
  const valor_compra_por_saca = regra && !contratoExcedido && calc.sacas > 0 ? round(compraTotal / calc.sacas, 6) : null

  const despesas_silo_por_saca = round((secagem_custo_por_saca || 0) + (custo_silo_por_saca || 0) + frete_por_saca, 6)
  const despesas_terceiros_por_saca = round(despesas_silo_por_saca + (custo_terceiros_por_saca || 0), 6)

  const valor_compra_silo_liquida_por_saca = valor_compra_por_saca === null ? null : round(valor_compra_por_saca - despesas_silo_por_saca, 6)
  const valor_venda_terceiros_bruto_ideal_por_saca = valor_compra_silo_liquida_por_saca === null ? null : round(valor_compra_silo_liquida_por_saca + despesas_terceiros_por_saca, 6)
  const venda_silo_preco_liquido_por_saca = valor_compra_por_saca === null ? null : round(valor_compra_por_saca - abatimento_por_saca_silo, 6)
  const venda_silo_total_liquido = venda_silo_preco_liquido_por_saca === null ? null : round(calc.sacas * venda_silo_preco_liquido_por_saca, 6)
  const venda_terceiros_preco_equivalente_por_saca = venda_silo_preco_liquido_por_saca === null ? null : round(venda_silo_preco_liquido_por_saca + abatimento_por_saca_terceiros, 6)

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
    valor_compra_por_saca,
    valor_compra_por_saca_aplicado: valor_compra_por_saca,
    valor_compra_total: regra ? compraTotal : null,
    valor_compra_detalhe_json: regra
      ? JSON.stringify({
          contrato: contrato
            ? {
                sacas_total: round(Number(contratoCalc.contrato_total || 0), 6),
                entregue_antes: round(entregaAntes, 6),
                dentro_sacas: round(Number(contratoCalc.dentro_sacas || 0), 6),
                fora_sacas: round(Number(contratoCalc.fora_sacas || 0), 6),
                faixas: contratoFaixas,
              }
            : null,
          fora_contrato_faixas: [],
        })
      : null,
    valor_compra_entrega_antes: regra ? round(entregaAntes, 6) : null,
    valor_compra_entrega_depois: regra ? round(entregaAntes + calc.sacas, 6) : null,
    valor_compra_detalhes: regra ? [...contratoCalc.detalhes.map((d) => ({ kind: 'contrato', ...d }))] : [],
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
    trava_sacas: contrato ? Number(contratoCalc.contrato_total || 0) : null,
    limites_origem,
  }
}

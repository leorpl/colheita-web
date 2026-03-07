import { db } from '../../../db/db.js'
import { unprocessable } from '../../../errors.js'
import { normalizePercent100, round } from '../../../domain/normalize.js'
import { calcularViagem } from '../../../domain/calculations.js'

import { freteRepo } from '../../../repositories/freteRepo.js'
import { destinoRegraRepo } from '../../../repositories/destinoRegraRepo.js'
import { contratoSiloRepo } from '../../../repositories/contratoSiloRepo.js'
import { toDbNumber } from './viagemCoerce.js'

export function compararDestinos(input, { resolveUmidadeFaixa } = {}) {
  if (typeof resolveUmidadeFaixa !== 'function') {
    throw new Error('resolveUmidadeFaixa obrigatorio')
  }

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

  const safraRow = db.prepare('SELECT plantio FROM safra WHERE id=?').get(safra_id)
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
             AND (@exclude_id IS NULL OR v.id <> @exclude_id)
             AND v.deleted_at IS NULL`,
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

  function computeContratoByFaixas({ entregueAntes, sacas, faixas }) {
    const qty = Number(sacas || 0)
    const start = Number(entregueAntes || 0)
    if (!Number.isFinite(qty) || qty <= 0) {
      return {
        entregueAntes: round(start, 6),
        entregueDepois: round(start, 6),
        precoMedio: 0,
        total: 0,
        detalhes: [],
        dentro_sacas: 0,
        fora_sacas: 0,
        contrato_total: 0,
      }
    }

    const end = start + qty

    const list = Array.isArray(faixas) ? faixas : []
    const norm = list
      .map((f) => ({
        sacas: Number(f?.sacas || 0),
        preco_por_saca: Number(f?.preco_por_saca || 0),
      }))
      .filter(
        (f) =>
          Number.isFinite(f.sacas) &&
          f.sacas > 0 &&
          Number.isFinite(f.preco_por_saca) &&
          f.preco_por_saca >= 0,
      )

    if (!norm.length) {
      return {
        entregueAntes: round(start, 6),
        entregueDepois: round(end, 6),
        precoMedio: 0,
        total: 0,
        detalhes: [],
        dentro_sacas: 0,
        fora_sacas: round(qty, 6),
        contrato_total: 0,
      }
    }

    // build cumulative ranges (abate em ordem)
    let acc = 0
    const ranges = norm.map((f) => {
      const from = acc
      acc += f.sacas
      return { from, to: acc, preco_por_saca: f.preco_por_saca }
    })
    const contrato_total = acc

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
      detalhes.push({
        de_acumulado: ini,
        ate_acumulado: fim,
        sacas: round(q, 6),
        preco_por_saca: round(Number(r.preco_por_saca || 0), 6),
      })
    }

    const fora = Math.max(0, qty - dentro)
    const precoMedio = qty > 0 ? total / qty : 0
    return {
      entregueAntes: round(start, 6),
      entregueDepois: round(end, 6),
      precoMedio: round(precoMedio, 6),
      total: round(total, 6),
      detalhes,
      dentro_sacas: round(dentro, 6),
      fora_sacas: round(fora, 6),
      contrato_total: round(contrato_total, 6),
    }
  }

  const computeForRegra = (r) => {
    const faixas = destinoRegraRepo.getUmidadeFaixasPlantio(r.id) || []
    const faixaUmid = resolveUmidadeFaixa({
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

    const entregaAntes = getEntregaAntesSacas({ destino_id: r.destino_id })

    const contrato = contratoSiloRepo.getOne({
      safra_id,
      destino_id: Number(r.destino_id),
      tipo_plantio,
    })
    const contratoFaixas = Array.isArray(contrato?.faixas) ? contrato.faixas : []

    const contratoCalc = computeContratoByFaixas({
      entregueAntes: entregaAntes,
      sacas: calc.sacas,
      faixas: contratoFaixas,
    })

    const contratoExcedido = Number(contratoCalc.fora_sacas || 0) > 0
    const preco_compra_por_saca =
      contrato && !contratoExcedido ? Number(contratoCalc.precoMedio || 0) : null
    const valor_compra_total =
      contrato && !contratoExcedido ? Number(contratoCalc.total || 0) : null

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
    const preco_liquido_sem_frete_por_saca =
      preco_compra_por_saca === null
        ? null
        : round(
            preco_compra_por_saca - (secagem_custo_por_saca || 0) - (custo_silo_por_saca || 0),
            6,
          )

    const valor_final_total_sem_frete =
      preco_liquido_sem_frete_por_saca === null
        ? null
        : round(calc.sacas * preco_liquido_sem_frete_por_saca, 6)
    const valor_final_total_com_frete =
      sub_total_frete === null || valor_final_total_sem_frete === null
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
      const av =
        a.valor_final_total_com_frete === null
          ? a.valor_final_total_sem_frete
          : a.valor_final_total_com_frete
      const bv =
        b.valor_final_total_com_frete === null
          ? b.valor_final_total_sem_frete
          : b.valor_final_total_com_frete
      const aKey = av === null || av === undefined ? -1e18 : Number(av || 0)
      const bKey = bv === null || bv === undefined ? -1e18 : Number(bv || 0)
      return bKey - aKey
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
}

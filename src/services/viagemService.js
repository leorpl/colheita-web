import { freteRepo } from '../repositories/freteRepo.js'
import { destinoRepo } from '../repositories/destinoRepo.js'
import { viagemRepo } from '../repositories/viagemRepo.js'
import { viagemTalhaoRepo } from '../repositories/viagemTalhaoRepo.js'
import { calcularViagem } from '../domain/calculations.js'
import { conflict, unprocessable } from '../errors.js'
import { normalizePercent100, round } from '../domain/normalize.js'
import { db } from '../db/db.js'
import { destinoRegraRepo } from '../repositories/destinoRegraRepo.js'
import { contratoSiloRepo } from '../repositories/contratoSiloRepo.js'

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
  listView(filters = {}) {
    const view = String(filters.view || 'flat')
    if (view !== 'flat' && view !== 'grouped') {
      throw unprocessable('view invalido (use legacy, flat, grouped)')
    }

    const params = {
      safra_id: filters.safra_id ?? null,
      talhao_id: filters.talhao_id ?? null,
      destino_id: filters.destino_id ?? null,
      motorista_id: filters.motorista_id ?? null,
      de: filters.de ?? null,
      ate: filters.ate ?? null,
    }

    const rows = db
      .prepare(
        `SELECT
           v.*, s.safra as safra_nome,
           d.codigo as destino_codigo, d.local as destino_local,
           m.nome as motorista_nome,
           rp.valor_compra_por_saca as regra_valor_compra_por_saca,
           vt.id as rateio_id,
           vt.talhao_id as rateio_talhao_id,
           vt.pct_rateio as rateio_pct_rateio,
           vt.kg_rateio as rateio_kg_rateio,
           t.codigo as rateio_talhao_codigo,
           t.local as rateio_talhao_local,
           t.nome as rateio_talhao_nome
         FROM viagem v
         JOIN safra s ON s.id = v.safra_id
         JOIN destino d ON d.id = v.destino_id
         JOIN motorista m ON m.id = v.motorista_id
         LEFT JOIN destino_regra_plantio rp
           ON rp.safra_id = v.safra_id
          AND rp.destino_id = v.destino_id
          AND rp.tipo_plantio = UPPER(COALESCE(NULLIF(v.tipo_plantio, ''), NULLIF(s.plantio, '')))
         LEFT JOIN viagem_talhao vt ON vt.viagem_id = v.id
         LEFT JOIN talhao t ON t.id = vt.talhao_id
         WHERE (@safra_id IS NULL OR v.safra_id = @safra_id)
           AND (@talhao_id IS NULL OR EXISTS (
             SELECT 1 FROM viagem_talhao vt2
             WHERE vt2.viagem_id = v.id AND vt2.talhao_id = @talhao_id
           ))
           AND (@destino_id IS NULL OR v.destino_id = @destino_id)
           AND (@motorista_id IS NULL OR v.motorista_id = @motorista_id)
           AND (@de IS NULL OR v.data_saida >= @de)
           AND (@ate IS NULL OR v.data_saida <= @ate)
         ORDER BY
           v.safra_id ASC,
           v.ficha ASC,
           v.id ASC,
           vt.id ASC`,
      )
      .all(params)

    const byId = new Map()
    for (const r of rows) {
      const id = Number(r.id)
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          ficha: String(r.ficha ?? ''),
          safra_id: r.safra_id,
          safra_nome: r.safra_nome,
          destino_id: r.destino_id,
          destino_local: r.destino_local,
          destino_codigo: r.destino_codigo,
          motorista_id: r.motorista_id,
          motorista_nome: r.motorista_nome,

          data_saida: r.data_saida,
          hora_saida: r.hora_saida,
          tipo_plantio: r.tipo_plantio,

          umidade_pct: r.umidade_pct,
          peso_bruto_kg: r.peso_bruto_kg,
          peso_limpo_seco_kg: r.peso_limpo_seco_kg,
          sacas: r.sacas,

          sub_total_frete: r.sub_total_frete,
          frete_tabela: r.frete_tabela,
          secagem_custo_por_saca: r.secagem_custo_por_saca,
          custo_silo_por_saca: r.custo_silo_por_saca,
          custo_terceiros_por_saca: r.custo_terceiros_por_saca,

          valor_compra_por_saca_aplicado: r.valor_compra_por_saca_aplicado,
          regra_valor_compra_por_saca: r.regra_valor_compra_por_saca,

          talhoes: [],
        })
      }

      const v = byId.get(id)
      if (r.rateio_id !== null && r.rateio_id !== undefined) {
        v.talhoes.push({
          rateio_id: Number(r.rateio_id),
          talhao_id: Number(r.rateio_talhao_id),
          talhao_codigo: r.rateio_talhao_codigo,
          talhao_local: r.rateio_talhao_local,
          talhao_nome: r.rateio_talhao_nome,
          pct_rateio:
            r.rateio_pct_rateio === null || r.rateio_pct_rateio === undefined
              ? null
              : Number(r.rateio_pct_rateio),
          kg_rateio:
            r.rateio_kg_rateio === null || r.rateio_kg_rateio === undefined
              ? null
              : Number(r.rateio_kg_rateio),
        })
      }
    }

    const coll = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })

    function idxToSuffix(i) {
      // a..z, aa..az, ba..
      let n = Number(i) + 1
      let out = ''
      while (n > 0) {
        n--
        out = String.fromCharCode(97 + (n % 26)) + out
        n = Math.floor(n / 26)
      }
      return out
    }

    function makeChildLine(parent, idx, it, isRateado) {
      const fichaOriginal = String(parent.ficha || '')
      const suffix = idxToSuffix(idx)
      const display = isRateado ? `${fichaOriginal}(${suffix})` : fichaOriginal

      const totalPb = Number(parent.peso_bruto_kg || 0)
      const pct = it.pct_rateio === null || it.pct_rateio === undefined ? null : Number(it.pct_rateio)
      const portionKg =
        totalPb > 0
          ? (it.kg_rateio !== null && it.kg_rateio !== undefined
              ? Number(it.kg_rateio || 0)
              : Number(pct || 0) * totalPb)
          : 0
      const factor =
        totalPb > 0
          ? (portionKg > 0 ? portionKg / totalPb : 0)
          : (pct !== null && pct !== undefined ? Number(pct || 0) : 1)

      const rateioPct100 = pct === null ? (isRateado ? null : 100) : round(pct * 100, 2)

      const alloc = (x) => round(Number(x || 0) * factor, 6)

      return {
        id: parent.id,
        ficha_original: fichaOriginal,
        rateio_index: idx,
        display_ficha: display,
        rateio_suffix: suffix,
        is_rateado: Boolean(isRateado),
        rateio_count: parent.talhoes.length,

        talhao_id: it.talhao_id,
        talhao_codigo: it.talhao_codigo,
        talhao_local: it.talhao_local,
        talhao_nome: it.talhao_nome,
        pct_rateio_100: rateioPct100,

        // Reaproveita as colunas existentes da grid com valores da divisao
        safra_id: parent.safra_id,
        safra_nome: parent.safra_nome,
        destino_id: parent.destino_id,
        destino_local: parent.destino_local,
        destino_codigo: parent.destino_codigo,
        motorista_id: parent.motorista_id,
        motorista_nome: parent.motorista_nome,
        data_saida: parent.data_saida,
        hora_saida: parent.hora_saida,
        tipo_plantio: parent.tipo_plantio,

        umidade_pct: parent.umidade_pct,
        peso_bruto_kg: totalPb > 0 ? round(portionKg, 6) : alloc(parent.peso_bruto_kg),
        peso_limpo_seco_kg: alloc(parent.peso_limpo_seco_kg),
        sacas: alloc(parent.sacas),
        sub_total_frete: alloc(parent.sub_total_frete),

        frete_tabela: parent.frete_tabela,
        secagem_custo_por_saca: parent.secagem_custo_por_saca,
        custo_silo_por_saca: parent.custo_silo_por_saca,
        custo_terceiros_por_saca: parent.custo_terceiros_por_saca,
        valor_compra_por_saca_aplicado: parent.valor_compra_por_saca_aplicado,
        regra_valor_compra_por_saca: parent.regra_valor_compra_por_saca,
      }
    }

    const groups = Array.from(byId.values()).map((v) => {
      v.talhoes.sort((a, b) => Number(a.rateio_id) - Number(b.rateio_id))
      const isRateado = v.talhoes.length > 1
      const children = v.talhoes.map((it, idx) => makeChildLine(v, idx, it, isRateado))
      return { ...v, ficha_original: v.ficha, is_rateado: isRateado, rateio_count: v.talhoes.length, children }
    })

    // Ordenacao padrao: ficha_original asc, depois rateio_index asc
    groups.sort((a, b) => {
      const c = coll.compare(String(a.ficha_original || ''), String(b.ficha_original || ''))
      if (c !== 0) return c
      return Number(a.id) - Number(b.id)
    })
    for (const g of groups) {
      g.children.sort((a, b) => Number(a.rateio_index) - Number(b.rateio_index))
    }

    if (view === 'grouped') {
      return groups.map((g) => ({
        id: g.id,
        ficha_original: g.ficha_original,
        display_ficha: g.ficha_original,
        is_rateado: g.is_rateado,
        rateio_count: g.rateio_count,
        safra_id: g.safra_id,
        safra_nome: g.safra_nome,
        destino_id: g.destino_id,
        destino_local: g.destino_local,
        destino_codigo: g.destino_codigo,
        motorista_id: g.motorista_id,
        motorista_nome: g.motorista_nome,
        data_saida: g.data_saida,
        hora_saida: g.hora_saida,
        tipo_plantio: g.tipo_plantio,
        umidade_pct: g.umidade_pct,
        peso_bruto_kg: g.peso_bruto_kg,
        peso_limpo_seco_kg: g.peso_limpo_seco_kg,
        sacas: g.sacas,
        sub_total_frete: g.sub_total_frete,
        frete_tabela: g.frete_tabela,
        secagem_custo_por_saca: g.secagem_custo_por_saca,
        custo_silo_por_saca: g.custo_silo_por_saca,
        custo_terceiros_por_saca: g.custo_terceiros_por_saca,
        valor_compra_por_saca_aplicado: g.valor_compra_por_saca_aplicado,
        regra_valor_compra_por_saca: g.regra_valor_compra_por_saca,
        children: g.children,
      }))
    }

    // flat
    const out = []
    for (const g of groups) {
      if (g.is_rateado) out.push(...g.children)
      else out.push(g.children[0])
    }
    return out
  },
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

    const entregaAntes = regra ? getEntregaAntesSacas() : 0

    function computeContratoByFaixas({ entregueAntes, sacas, faixas }) {
      const qty = Number(sacas || 0)
      const start = Number(entregueAntes || 0)
      if (!Number.isFinite(qty) || qty <= 0) {
        return { dentro_sacas: 0, fora_sacas: 0, total: 0, detalhes: [], contrato_total: 0 }
      }

      const list = Array.isArray(faixas) ? faixas : []
      const norm = list
        .map((f) => ({
          sacas: Number(f?.sacas || 0),
          preco_por_saca: Number(f?.preco_por_saca || 0),
        }))
        .filter((f) => Number.isFinite(f.sacas) && f.sacas > 0 && Number.isFinite(f.preco_por_saca) && f.preco_por_saca >= 0)

      if (!norm.length) {
        return { dentro_sacas: 0, fora_sacas: qty, total: 0, detalhes: [], contrato_total: 0 }
      }

      // build cumulative ranges
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
        detalhes.push({
          de_acumulado: ini,
          ate_acumulado: fim,
          sacas: round(q, 6),
          preco_por_saca: round(Number(r.preco_por_saca || 0), 6),
        })
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

    // Contrato de venda futura (trava): uma ou mais faixas (quantidade + preco travado)
    const contrato = contratoSiloRepo.getOne({
      safra_id: payload.safra_id,
      destino_id: payload.destino_id,
      tipo_plantio: payload.tipo_plantio,
    })

    const contratoFaixas = Array.isArray(contrato?.faixas) ? contrato.faixas : []
    const contratoCalc = computeContratoByFaixas({
      entregueAntes: entregaAntes,
      sacas: calc.sacas,
      faixas: contratoFaixas,
    })

    // Regra de negocio: preco vem somente do contrato.
    // Se exceder contrato, nao calcula compra (e o salvar deve ser bloqueado em create/update).
    const contratoExcedido = Number(contratoCalc.fora_sacas || 0) > 0
    const compraTotal =
      regra && !contratoExcedido ? round(Number(contratoCalc.total || 0), 6) : null
    const valor_compra_por_saca =
      regra && !contratoExcedido && calc.sacas > 0
        ? round(compraTotal / calc.sacas, 6)
        : null

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
      valor_compra_detalhes: regra
        ? [...contratoCalc.detalhes.map((d) => ({ kind: 'contrato', ...d }))]
        : [],
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

    if (!payload.data_saida) throw unprocessable('data_saida obrigatoria')
    if (!payload.hora_saida) throw unprocessable('hora_saida obrigatoria')
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

    if (trava && Number(trava.fora_contrato_sacas || 0) > 0) {
      throw conflict('Entrega excede o contrato. Cadastre mais sacas no contrato antes de salvar.', {
        fora_contrato_sacas: trava.fora_contrato_sacas,
        dentro_contrato_sacas: trava.dentro_contrato_sacas,
        contrato_sacas: trava.contrato_sacas,
        entrega_atual_sacas: trava.entrega_atual_sacas,
      })
    }
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

    if (!payload.data_saida) throw unprocessable('data_saida obrigatoria')
    if (!payload.hora_saida) throw unprocessable('hora_saida obrigatoria')

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

    if (trava && Number(trava.fora_contrato_sacas || 0) > 0) {
      throw conflict('Entrega excede o contrato. Cadastre mais sacas no contrato antes de salvar.', {
        fora_contrato_sacas: trava.fora_contrato_sacas,
        dentro_contrato_sacas: trava.dentro_contrato_sacas,
        contrato_sacas: trava.contrato_sacas,
        entrega_atual_sacas: trava.entrega_atual_sacas,
      })
    }

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

  // Recalcula os campos materializados das colheitas (viagens) usando as regras atuais.
  // Observacao: preserva os valores informados pelo usuario (pesos/percentuais e umidade_desc_pct_manual),
  // e re-aplica regras/contratos/fretes para re-materializar sacas, descontos, custos e compra.
  recalcularTodas({ safra_id, destino_id, tipo_plantio } = {}) {
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

          const payload = this.buildPayload(input, { current_id: Number(v.id), exclude_id: Number(v.id) })
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
  },
}

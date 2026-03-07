import { db } from '../../../db/db.js'
import { unprocessable } from '../../../errors.js'
import { round } from '../../../domain/normalize.js'

export function listViagensView(filters = {}) {
  const view = String(filters.view || 'flat')
  if (view !== 'flat' && view !== 'grouped') {
    throw unprocessable('view invalido (use flat, grouped)')
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
          AND v.deleted_at IS NULL
        ORDER BY
          v.id DESC,
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

        // Pesagens (entrada)
        carga_total_kg: r.carga_total_kg,
        tara_kg: r.tara_kg,

        // Operacional
        placa: r.placa,
        local: r.local,

        data_saida: r.data_saida,
        hora_saida: r.hora_saida,
        data_entrega: r.data_entrega,
        hora_entrega: r.hora_entrega,
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
      placa: parent.placa,
      local: parent.local,
      data_saida: parent.data_saida,
      hora_saida: parent.hora_saida,
      data_entrega: parent.data_entrega,
      hora_entrega: parent.hora_entrega,
      tipo_plantio: parent.tipo_plantio,

      carga_total_kg: alloc(parent.carga_total_kg),
      tara_kg: alloc(parent.tara_kg),

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

  // Ordenacao padrao: mais recente primeiro (ultimo lancamento)
  groups.sort((a, b) => {
    const byId = Number(b.id) - Number(a.id)
    if (byId !== 0) return byId
    return coll.compare(String(b.ficha_original || ''), String(a.ficha_original || ''))
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
}

import { db } from '../db/db.js'
import { participanteSacasMovRepo } from '../repositories/participanteSacasMovRepo.js'

function ymFromDate(d) {
  const s = String(d || '')
  const m = s.match(/^([0-9]{4})-([0-9]{2})-/)
  return m ? `${m[1]}-${m[2]}` : null
}

function normTp(tp) {
  return String(tp || '').trim().toUpperCase()
}

function safeFracFromPctRateio(x) {
  const n = Number(x)
  if (!Number.isFinite(n)) return null
  if (n > 1.5) return n / 100
  return n
}

function pickTripDate(v) {
  return v.data_saida || v.data_entrega || String(v.created_at || '').slice(0, 10) || null
}

function defaultPolicyRuleFor(tipo) {
  // defaults: proportional cost to all participants
  return { custo_tipo: tipo, modo_rateio: 'proporcional_participacao', momento: 'depois_divisao' }
}

function sumPct(parts) {
  return (parts || []).reduce((acc, p) => acc + (Number(p.percentual_producao) || 0), 0)
}

function normalizeParts(parts) {
  const list = (parts || []).map((p) => ({
    participante_id: Number(p.participante_id),
    papel: String(p.papel || 'parceiro'),
    percentual_producao: Number(p.percentual_producao) || 0,
  }))
  const s = sumPct(list)
  if (s <= 0) return list
  // expected percentages are fractions 0..1
  if (s > 1.000001) {
    // allow inputs accidentally saved as 0..100
    if (s <= 100.000001) {
      for (const p of list) p.percentual_producao = p.percentual_producao / 100
    }
  }
  return list
}

function findPayers(parts, mode) {
  const ps = normalizeParts(parts)
  const isRole = (r) => (x) => String(x.papel || '') === r

  if (mode === 'somente_produtor') {
    const prod = ps.filter(isRole('produtor'))
    if (prod.length) return prod
    const meeiro = ps.filter(isRole('meeiro'))
    if (meeiro.length) return meeiro
    return ps
  }
  if (mode === 'somente_dono') {
    const donos = ps.filter(isRole('dono_terra'))
    if (donos.length) return donos
    const prop = ps.filter(isRole('proprietario'))
    if (prop.length) return prop
    return ps
  }
  return ps
}

function allocateByPct(parts, total) {
  const ps = normalizeParts(parts)
  const out = []
  for (const p of ps) {
    out.push({ participante_id: p.participante_id, sacas: (Number(total) || 0) * (Number(p.percentual_producao) || 0) })
  }
  return out
}

export const producaoService = {
  // Preco medio ponderado por sacas (VWAP) por mes e tipo_plantio
  listSalesPricesByMonth({ safra_id } = {}) {
    const rows = db
      .prepare(
        `SELECT tipo_plantio, substr(data_venda,1,7) as ym,
                SUM(sacas * preco_por_saca) as vtotal,
                SUM(sacas) as stotal
         FROM venda_saca
         WHERE safra_id=@safra_id
           AND deleted_at IS NULL
           AND sacas > 0
           AND preco_por_saca > 0
         GROUP BY tipo_plantio, substr(data_venda,1,7)
         ORDER BY tipo_plantio ASC, ym ASC`,
      )
      .all({ safra_id: Number(safra_id) })

    const map = new Map() // key: tp|ym -> price
    for (const r of rows) {
      const ym = String(r.ym || '')
      const tp = normTp(r.tipo_plantio)
      const st = Number(r.stotal || 0)
      const vt = Number(r.vtotal || 0)
      if (st > 0 && vt > 0) map.set(`${tp}|${ym}`, vt / st)
    }
    return map
  },

  priceFor({ pricesByMonth, tipo_plantio, date_ymd }) {
    const ym = ymFromDate(date_ymd)
    if (!ym) return null
    const tp = normTp(tipo_plantio)

    // 1) exact month, exact tipo
    const direct = pricesByMonth.get(`${tp}|${ym}`)
    if (Number.isFinite(direct) && direct > 0) return direct

    // 2) fallback: last available month <= ym, exact tipo
    // iterate all keys (few rows) - ok for small SQLite
    let best = null
    let bestYm = null
    for (const [k, v] of pricesByMonth.entries()) {
      const [ktp, kym] = k.split('|')
      if (ktp !== tp) continue
      if (kym <= ym && (!bestYm || kym > bestYm)) {
        bestYm = kym
        best = v
      }
    }
    if (Number.isFinite(best) && best > 0) return best

    // 3) fallback: any tipo (useful if type not filled in sales)
    let bestAny = null
    let bestAnyYm = null
    for (const [k, v] of pricesByMonth.entries()) {
      const kym = String(k).split('|')[1] || ''
      if (kym <= ym && (!bestAnyYm || kym > bestAnyYm)) {
        bestAnyYm = kym
        bestAny = v
      }
    }
    if (Number.isFinite(bestAny) && bestAny > 0) return bestAny
    return null
  },

  reapurarSafra({ safra_id, user_id } = {}) {
    const sid = Number(safra_id)
    if (!Number.isFinite(sid) || sid <= 0) throw new Error('safra_id invalido')

    // Prefetch agreements + participants
    const acordoRows = db
      .prepare(
        `SELECT a.id as acordo_id, a.talhao_id, a.safra_id, a.tipo_plantio, a.politica_custos_id,
                ap.participante_id, ap.papel, ap.percentual_producao
         FROM talhao_acordo a
         JOIN talhao_acordo_participante ap ON ap.talhao_acordo_id = a.id
         WHERE a.deleted_at IS NULL
           AND ap.deleted_at IS NULL
           AND a.safra_id = @safra_id`,
      )
      .all({ safra_id: sid })

    const acordoMap = new Map() // key: talhao_id|tp -> { politica_id, parts[] }
    for (const r of acordoRows) {
      const tp = normTp(r.tipo_plantio || '')
      const key = `${Number(r.talhao_id)}|${tp}`
      const cur = acordoMap.get(key) || {
        acordo_id: Number(r.acordo_id),
        talhao_id: Number(r.talhao_id),
        tipo_plantio: tp,
        politica_custos_id: r.politica_custos_id ? Number(r.politica_custos_id) : null,
        parts: [],
      }
      cur.parts.push({
        participante_id: Number(r.participante_id),
        papel: String(r.papel || 'parceiro'),
        percentual_producao: Number(r.percentual_producao) || 0,
      })
      acordoMap.set(key, cur)
    }

    // Prefetch cost policy rules
    const policyIds = Array.from(new Set(Array.from(acordoMap.values()).map((a) => a.politica_custos_id).filter(Boolean)))
    const policyRuleMap = new Map() // key: policy_id|custo_tipo -> rule
    if (policyIds.length) {
      const qMarks = policyIds.map(() => '?').join(',')
      const rules = db
        .prepare(
          `SELECT * FROM politica_custos_regra
           WHERE deleted_at IS NULL
             AND politica_custos_id IN (${qMarks})`,
        )
        .all(...policyIds)
      for (const r of rules) {
        policyRuleMap.set(`${Number(r.politica_custos_id)}|${String(r.custo_tipo)}`, {
          custo_tipo: String(r.custo_tipo),
          modo_rateio: String(r.modo_rateio),
          momento: String(r.momento),
        })
      }
    }

    const pricesByMonth = this.listSalesPricesByMonth({ safra_id: sid })

    // Fetch viagens + rateio lines
    const vtRows = db
      .prepare(
        `SELECT v.id as viagem_id, v.safra_id, v.destino_id, v.tipo_plantio, v.data_saida, v.data_entrega, v.created_at,
                v.sacas,
                v.sub_total_frete, v.sub_total_secagem, v.sub_total_custo_silo, v.sub_total_custo_terceiros,
                v.custo_frete_sacas, v.custo_secagem_sacas, v.custo_silo_sacas, v.custo_terceiros_sacas, v.custo_outros_sacas,
                vt.talhao_id, vt.pct_rateio, vt.kg_rateio
         FROM viagem v
         JOIN viagem_talhao vt ON vt.viagem_id = v.id
         WHERE v.safra_id=@safra_id
           AND v.deleted_at IS NULL
         ORDER BY v.id DESC, vt.id ASC`,
      )
      .all({ safra_id: sid })

    const byViagem = new Map()
    for (const r of vtRows) {
      const id = Number(r.viagem_id)
      const cur = byViagem.get(id) || {
        viagem_id: id,
        safra_id: Number(r.safra_id),
        destino_id: r.destino_id ? Number(r.destino_id) : null,
        tipo_plantio: normTp(r.tipo_plantio || ''),
        data_ref: pickTripDate(r),
        sacas: Number(r.sacas || 0),
        custos_rs: {
          frete: Number(r.sub_total_frete || 0),
          secagem: Number(r.sub_total_secagem || 0),
          silo: Number(r.sub_total_custo_silo || 0),
          terceiros: Number(r.sub_total_custo_terceiros || 0),
          outros: 0,
        },
        custos_sacas: {
          frete: Number(r.custo_frete_sacas || 0),
          secagem: Number(r.custo_secagem_sacas || 0),
          silo: Number(r.custo_silo_sacas || 0),
          terceiros: Number(r.custo_terceiros_sacas || 0),
          outros: Number(r.custo_outros_sacas || 0),
        },
        talhoes: [],
      }
      cur.talhoes.push({
        talhao_id: Number(r.talhao_id),
        pct_rateio: r.pct_rateio,
        kg_rateio: r.kg_rateio,
      })
      byViagem.set(id, cur)
    }

    // Preload vendas + custos manuais
    const vendas = db
      .prepare(
        `SELECT * FROM venda_saca
         WHERE safra_id=@safra_id AND deleted_at IS NULL`,
      )
      .all({ safra_id: sid })
    const custosManuais = db
      .prepare(
        `SELECT * FROM custo_lancamento
         WHERE safra_id=@safra_id AND deleted_at IS NULL`,
      )
      .all({ safra_id: sid })

    // Build movements
    const movs = []
    let stats = {
      viagens: byViagem.size,
      movs: 0,
      sacas_credito: 0,
      sacas_debito: 0,
      custos_pendentes: 0,
    }

    function pushMov(m) {
      movs.push(m)
      stats.movs += 1
      stats.sacas_credito += Number(m.sacas_credito || 0)
      stats.sacas_debito += Number(m.sacas_debito || 0)
      if (m.pendente_preco) stats.custos_pendentes += Number(m.valor_rs || 0)
    }

    function resolveAcordo({ talhao_id, tipo_plantio }) {
      const tp = normTp(tipo_plantio)
      const keyExact = `${Number(talhao_id)}|${tp}`
      const keyAny = `${Number(talhao_id)}|` // empty tp
      return acordoMap.get(keyExact) || acordoMap.get(keyAny) || null
    }

    function policyRule({ politica_custos_id, custo_tipo }) {
      if (!politica_custos_id) return defaultPolicyRuleFor(custo_tipo)
      return policyRuleMap.get(`${Number(politica_custos_id)}|${String(custo_tipo)}`) || defaultPolicyRuleFor(custo_tipo)
    }

    function fracTalhao(v, item, sumKg, sumPct) {
      if (sumKg > 0) {
        const kg = Number(item.kg_rateio)
        return Number.isFinite(kg) ? kg / sumKg : 0
      }
      if (sumPct > 0) {
        const pct = safeFracFromPctRateio(item.pct_rateio)
        return Number.isFinite(pct) ? pct / sumPct : 0
      }
      return v.talhoes.length === 1 ? 1 : 0
    }

    for (const v of byViagem.values()) {
      if (!Number.isFinite(v.sacas) || v.sacas <= 0) continue

      const sumKg = v.talhoes.reduce((acc, it) => acc + (Number(it.kg_rateio) || 0), 0)
      const sumPct = v.talhoes.reduce((acc, it) => acc + (safeFracFromPctRateio(it.pct_rateio) || 0), 0)

      for (const it of v.talhoes) {
        const frac = fracTalhao(v, it, sumKg, sumPct)
        if (!(frac > 0)) continue
        const talhao_id = Number(it.talhao_id)
        const sacasTalhao = v.sacas * frac
        const acordo = resolveAcordo({ talhao_id, tipo_plantio: v.tipo_plantio })
        if (!acordo) continue // sem acordo: nao apura

        const parts = normalizeParts(acordo.parts)

        // credit production by participant
        for (const a of allocateByPct(parts, sacasTalhao)) {
          if (!a.participante_id) continue
          pushMov({
            safra_id: sid,
            participante_id: a.participante_id,
            talhao_id,
            destino_id: v.destino_id,
            data_ref: v.data_ref,
            mov_tipo: 'producao_credito',
            origem_tipo: 'viagem',
            origem_id: v.viagem_id,
            custo_tipo: null,
            sacas_credito: a.sacas,
            sacas_debito: 0,
            valor_rs: null,
            preco_ref_rs_sc: null,
            pendente_preco: 0,
            notes: `viagem #${v.viagem_id}`,
          })
        }

        // allocate costs by type
        const costTypes = ['frete', 'secagem', 'silo', 'terceiros', 'outros']
        for (const ct of costTypes) {
          const rule = policyRule({ politica_custos_id: acordo.politica_custos_id, custo_tipo: ct })
          const moment = String(rule.momento || 'depois_divisao')
          const mode = String(rule.modo_rateio || 'proporcional_participacao')

          const debParts = mode === 'proporcional_participacao' ? parts : findPayers(parts, mode)
          const denom = sumPct(debParts)

          // Prefer sacas-based costs when present (no money in this phase).
          const sacas_total = Number(v.custos_sacas?.[ct] || 0)
          if (sacas_total > 0) {
            const sacas_talhao = sacas_total * frac
            for (const p of debParts) {
              const w = denom > 0 ? (Number(p.percentual_producao) || 0) / denom : 0
              pushMov({
                safra_id: sid,
                participante_id: Number(p.participante_id),
                talhao_id,
                destino_id: v.destino_id,
                data_ref: v.data_ref,
                mov_tipo: 'custo_debito',
                origem_tipo: 'viagem',
                origem_id: v.viagem_id,
                custo_tipo: ct,
                sacas_credito: 0,
                sacas_debito: sacas_talhao * w,
                valor_rs: null,
                preco_ref_rs_sc: null,
                pendente_preco: 0,
                notes: `${ct} (sacas) (${moment}) viagem #${v.viagem_id}`,
              })
            }
            continue
          }

          // Fallback: legacy monetary costs -> sacas equivalentes via preco de venda.
          const valor_rs_total = Number(v.custos_rs?.[ct] || 0)
          if (!(valor_rs_total > 0)) continue
          const valor_rs_talhao = valor_rs_total * frac

          const pr = this.priceFor({ pricesByMonth, tipo_plantio: v.tipo_plantio, date_ymd: v.data_ref })
          const price = Number.isFinite(pr) && pr > 0 ? pr : null
          const sacasEquiv = price ? valor_rs_talhao / price : null

          for (const p of debParts) {
            const w = denom > 0 ? (Number(p.percentual_producao) || 0) / denom : 0
            const deb = sacasEquiv !== null ? sacasEquiv * w : 0
            pushMov({
              safra_id: sid,
              participante_id: Number(p.participante_id),
              talhao_id,
              destino_id: v.destino_id,
              data_ref: v.data_ref,
              mov_tipo: 'custo_debito',
              origem_tipo: 'viagem',
              origem_id: v.viagem_id,
              custo_tipo: ct,
              sacas_credito: 0,
              sacas_debito: deb,
              valor_rs: valor_rs_talhao * w,
              preco_ref_rs_sc: price,
              pendente_preco: price ? 0 : 1,
              notes: `${ct} (equiv) (${moment}) viagem #${v.viagem_id}`,
            })
          }
        }
      }
    }

    // vendas: baixa fisica por participante
    for (const vd of vendas) {
      const s = Number(vd.sacas || 0)
      if (!(s > 0)) continue
      pushMov({
        safra_id: sid,
        participante_id: Number(vd.participante_id),
        talhao_id: vd.talhao_id ? Number(vd.talhao_id) : null,
        destino_id: vd.destino_id ? Number(vd.destino_id) : null,
        data_ref: vd.data_venda,
        mov_tipo: 'venda_debito',
        origem_tipo: 'venda_saca',
        origem_id: Number(vd.id),
        custo_tipo: null,
        sacas_credito: 0,
        sacas_debito: s,
        valor_rs: Number(vd.valor_total || 0) || (Number(vd.preco_por_saca || 0) * s),
        preco_ref_rs_sc: Number(vd.preco_por_saca || 0) || null,
        pendente_preco: 0,
        notes: `venda #${vd.id}`,
      })
    }

    // custos manuais: por talhao, aplica acordo e politica
    for (const c of custosManuais) {
      const talhao_id = Number(c.talhao_id)
      if (!talhao_id) continue

      const acordo = resolveAcordo({ talhao_id, tipo_plantio: '' })
      if (!acordo) continue

      const parts = normalizeParts(acordo.parts)
      const ct = String(c.custo_tipo || 'outros')
      const rule = policyRule({ politica_custos_id: acordo.politica_custos_id, custo_tipo: ct })
      const mode = String(rule.modo_rateio || 'proporcional_participacao')
      const debParts = mode === 'proporcional_participacao' ? parts : findPayers(parts, mode)
      const denom = sumPct(debParts)

      const valor_sacas = c.valor_sacas === null || c.valor_sacas === undefined ? null : Number(c.valor_sacas)
      const valor_rs = c.valor_rs === null || c.valor_rs === undefined ? null : Number(c.valor_rs)
      const dateRef = c.data_ref || String(c.created_at || '').slice(0, 10)
      const pr = this.priceFor({ pricesByMonth, tipo_plantio: '', date_ymd: dateRef })
      const price = Number.isFinite(pr) && pr > 0 ? pr : null

      const sacasEquiv = Number.isFinite(valor_sacas) && valor_sacas !== null
        ? valor_sacas
        : price && Number.isFinite(valor_rs) && valor_rs !== null
          ? valor_rs / price
          : null

      for (const p of debParts) {
        const w = denom > 0 ? (Number(p.percentual_producao) || 0) / denom : 0
        const deb = sacasEquiv !== null ? sacasEquiv * w : 0
        pushMov({
          safra_id: sid,
          participante_id: Number(p.participante_id),
          talhao_id,
          data_ref: dateRef,
          mov_tipo: 'custo_debito',
          origem_tipo: 'custo_lancamento',
          origem_id: Number(c.id),
          custo_tipo: ct,
          sacas_credito: 0,
          sacas_debito: deb,
          valor_rs: valor_rs !== null && Number.isFinite(valor_rs) ? valor_rs * w : null,
          preco_ref_rs_sc: valor_sacas !== null ? null : price,
          pendente_preco: sacasEquiv !== null ? 0 : 1,
          notes: `custo manual #${c.id}`,
        })
      }
    }

    // Persist (replace all for safra)
    const tx = db.transaction(() => {
      participanteSacasMovRepo.deleteBySafra(sid)
      participanteSacasMovRepo.insertMany(movs, { user_id })
    })
    tx()

    return stats
  },

  syncVendaMov({ venda, user_id } = {}) {
    if (!venda) return
    const sid = Number(venda.safra_id)
    const vid = Number(venda.id)
    if (!sid || !vid) return

    const tx = db.transaction(() => {
      participanteSacasMovRepo.deleteByOrigem({ origem_tipo: 'venda_saca', origem_id: vid })
      if (venda.deleted_at) return

      participanteSacasMovRepo.insertMany(
        [
          {
            safra_id: sid,
            participante_id: Number(venda.participante_id),
            talhao_id: venda.talhao_id ? Number(venda.talhao_id) : null,
            data_ref: venda.data_venda,
            mov_tipo: 'venda_debito',
            origem_tipo: 'venda_saca',
            origem_id: vid,
            custo_tipo: null,
            sacas_credito: 0,
            sacas_debito: Number(venda.sacas || 0),
            valor_rs: Number(venda.valor_total || 0) || (Number(venda.preco_por_saca || 0) * Number(venda.sacas || 0)),
            preco_ref_rs_sc: Number(venda.preco_por_saca || 0) || null,
            pendente_preco: 0,
            notes: `venda #${vid}`,
          },
        ],
        { user_id },
      )
    })
    tx()
  },
}

import { round } from './normalize.js'

export function calcularViagem(input) {
  const peso_bruto_kg = input.carga_total_kg - input.tara_kg

  function descontoKg(pct, limitePct) {
    const descPct = Math.max(0, pct - limitePct)
    return peso_bruto_kg * descPct
  }

  const impureza_kg = descontoKg(input.impureza_pct, input.impureza_limite_pct)
  const ardidos_kg = descontoKg(input.ardidos_pct, input.ardidos_limite_pct)
  const queimados_kg = descontoKg(input.queimados_pct, input.queimados_limite_pct)
  const avariados_kg = descontoKg(input.avariados_pct, input.avariados_limite_pct)
  const esverdiados_kg = descontoKg(
    input.esverdiados_pct,
    input.esverdiados_limite_pct,
  )
  const quebrados_kg = descontoKg(input.quebrados_pct, input.quebrados_limite_pct)

  const descontos_sem_umidade_kg =
    impureza_kg +
    ardidos_kg +
    queimados_kg +
    avariados_kg +
    esverdiados_kg +
    quebrados_kg

  // Umidade:
  // - sugerida: vem da regra/tabela (input.umidade_desc_pct). Se nao houver faixa/tabela, considerar 0.
  // - aplicada: pode ser sobrescrita por input.umidade_desc_pct_manual
  const umidade_desc_pct_sugerida =
    input.umidade_desc_pct !== null && input.umidade_desc_pct !== undefined
      ? input.umidade_desc_pct
      : 0

  const umidade_desc_pct_aplicada =
    input.umidade_desc_pct_manual !== null &&
    input.umidade_desc_pct_manual !== undefined
      ? input.umidade_desc_pct_manual
      : umidade_desc_pct_sugerida

  // Regra solicitada: calcular umidade depois de descontar impurezas/defeitos.
  const peso_base_umidade_kg = Math.max(0, peso_bruto_kg - descontos_sem_umidade_kg)
  const umidade_kg = peso_base_umidade_kg * umidade_desc_pct_aplicada

  const peso_limpo_seco_kg =
    peso_bruto_kg -
    umidade_kg -
    descontos_sem_umidade_kg

  const sacas = peso_limpo_seco_kg / 60
  const sacas_frete = peso_bruto_kg / 60

  const frete_tabela = input.frete_tabela
  const sub_total_frete = sacas_frete * frete_tabela

  return {
    peso_bruto_kg: round(peso_bruto_kg, 6),
    umidade_desc_pct_sugerida: round(umidade_desc_pct_sugerida, 10),
    umidade_desc_pct: round(umidade_desc_pct_aplicada, 10),
    umidade_desc_pct_manual:
      input.umidade_desc_pct_manual === null ||
      input.umidade_desc_pct_manual === undefined
        ? null
        : round(input.umidade_desc_pct_manual, 10),
    umidade_kg: round(umidade_kg, 6),
    impureza_kg: round(impureza_kg, 6),
    ardidos_kg: round(ardidos_kg, 6),
    queimados_kg: round(queimados_kg, 6),
    avariados_kg: round(avariados_kg, 6),
    esverdiados_kg: round(esverdiados_kg, 6),
    quebrados_kg: round(quebrados_kg, 6),
    peso_limpo_seco_kg: round(peso_limpo_seco_kg, 6),
    sacas: round(sacas, 9),
    sacas_frete: round(sacas_frete, 9),
    frete_tabela: round(frete_tabela, 6),
    sub_total_frete: round(sub_total_frete, 6),
  }
}

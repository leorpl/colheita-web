import { conflict } from '../errors.js'
import { db } from '../db/db.js'

function count(sql, params = {}) {
  return Number(db.prepare(sql).get(params)?.c || 0)
}

const suggestionByKey = {
  fretes: 'Exclua ou ajuste os fretes vinculados antes de excluir este cadastro.',
  colheitas: 'Exclua as colheitas vinculadas ou altere o vínculo nelas antes de excluir este cadastro.',
  regras_destino: 'Exclua ou ajuste as regras de destino vinculadas antes de excluir este cadastro.',
  contratos: 'Exclua ou ajuste os contratos de trava vinculados antes de excluir este cadastro.',
  talhao_safra: 'Limpe os registros de área colhida / talhão-safra antes de excluir este cadastro.',
  acordos: 'Exclua ou ajuste os acordos vinculados antes de excluir este cadastro.',
  vendas: 'Exclua ou ajuste as vendas vinculadas antes de excluir este cadastro.',
  custos: 'Exclua ou ajuste os custos manuais vinculados antes de excluir este cadastro.',
  apuracao: 'Reapure ou limpe os movimentos de apuração vinculados antes de excluir este cadastro.',
  rateios: 'Remova ou ajuste os rateios de colheita vinculados antes de excluir este cadastro.',
  quitacoes: 'Exclua as quitações vinculadas antes de excluir este cadastro.',
  usuarios: 'Desvincule os usuários deste cadastro antes de excluir.',
}

function assertNoDependencies(entityLabel, details) {
  const active = details.filter((d) => Number(d.count || 0) > 0)
  if (!active.length) return

  const deps = active.map((d) => ({
    key: d.key,
    label: d.label,
    count: Number(d.count || 0),
    suggestion: d.suggestion || suggestionByKey[d.key] || 'Resolva os registros vinculados antes de excluir.',
  }))
  const lines = deps.map((d) => `- ${d.label}: ${d.count}`).join('\n')
  throw conflict(
    `${entityLabel} possui registros vinculados e nao pode ser excluido(a) enquanto esses vinculos nao forem resolvidos.\n\n${lines}`,
    {
      code: 'DEPENDENCIAS_VINCULADAS',
      dependencies: deps,
    },
  )
}

export const deleteDependencyService = {
  assertCanDeleteSafra(id) {
    assertNoDependencies('Safra', [
      { key: 'fretes', label: 'Fretes', count: count(`SELECT COUNT(*) c FROM frete WHERE safra_id=@id`, { id }) },
      { key: 'colheitas', label: 'Colheitas', count: count(`SELECT COUNT(*) c FROM viagem WHERE safra_id=@id AND deleted_at IS NULL`, { id }) },
      { key: 'regras_destino', label: 'Regras do destino', count: count(`SELECT COUNT(*) c FROM destino_regra_plantio WHERE safra_id=@id`, { id }) },
      { key: 'contratos', label: 'Contratos de trava', count: count(`SELECT COUNT(*) c FROM contrato_silo WHERE safra_id=@id`, { id }) },
      { key: 'talhao_safra', label: 'Área colhida / Talhão-safra', count: count(`SELECT COUNT(*) c FROM talhao_safra WHERE safra_id=@id`, { id }) },
      { key: 'acordos', label: 'Acordos', count: count(`SELECT COUNT(*) c FROM talhao_acordo WHERE safra_id=@id AND deleted_at IS NULL`, { id }) },
      { key: 'vendas', label: 'Vendas de sacas', count: count(`SELECT COUNT(*) c FROM venda_saca WHERE safra_id=@id AND deleted_at IS NULL`, { id }) },
      { key: 'custos', label: 'Custos manuais', count: count(`SELECT COUNT(*) c FROM custo_lancamento WHERE safra_id=@id AND deleted_at IS NULL`, { id }) },
      { key: 'apuracao', label: 'Movimentos de apuração', count: count(`SELECT COUNT(*) c FROM participante_sacas_mov WHERE safra_id=@id`, { id }) },
    ])
  },

  assertCanDeleteTalhao(id) {
    assertNoDependencies('Talhão', [
      { key: 'colheitas', label: 'Colheitas', count: count(`SELECT COUNT(*) c FROM viagem WHERE talhao_id=@id AND deleted_at IS NULL`, { id }) },
      { key: 'rateios', label: 'Rateios de colheita', count: count(`SELECT COUNT(*) c FROM viagem_talhao WHERE talhao_id=@id`, { id }) },
      { key: 'talhao_safra', label: 'Área colhida / Talhão-safra', count: count(`SELECT COUNT(*) c FROM talhao_safra WHERE talhao_id=@id`, { id }) },
      { key: 'acordos', label: 'Acordos', count: count(`SELECT COUNT(*) c FROM talhao_acordo WHERE talhao_id=@id AND deleted_at IS NULL`, { id }) },
      { key: 'vendas', label: 'Vendas de sacas', count: count(`SELECT COUNT(*) c FROM venda_saca WHERE talhao_id=@id AND deleted_at IS NULL`, { id }) },
      { key: 'custos', label: 'Custos manuais', count: count(`SELECT COUNT(*) c FROM custo_lancamento WHERE talhao_id=@id AND deleted_at IS NULL`, { id }) },
    ])
  },

  assertCanDeleteDestino(id) {
    assertNoDependencies('Destino', [
      { key: 'fretes', label: 'Fretes', count: count(`SELECT COUNT(*) c FROM frete WHERE destino_id=@id`, { id }) },
      { key: 'colheitas', label: 'Colheitas', count: count(`SELECT COUNT(*) c FROM viagem WHERE destino_id=@id AND deleted_at IS NULL`, { id }) },
      { key: 'regras_destino', label: 'Regras do destino', count: count(`SELECT COUNT(*) c FROM destino_regra_plantio WHERE destino_id=@id`, { id }) },
      { key: 'contratos', label: 'Contratos de trava', count: count(`SELECT COUNT(*) c FROM contrato_silo WHERE destino_id=@id`, { id }) },
      { key: 'vendas', label: 'Vendas de sacas', count: count(`SELECT COUNT(*) c FROM venda_saca WHERE destino_id=@id AND deleted_at IS NULL`, { id }) },
    ])
  },

  assertCanDeleteMotorista(id) {
    assertNoDependencies('Motorista', [
      { key: 'fretes', label: 'Fretes', count: count(`SELECT COUNT(*) c FROM frete WHERE motorista_id=@id`, { id }) },
      { key: 'colheitas', label: 'Colheitas', count: count(`SELECT COUNT(*) c FROM viagem WHERE motorista_id=@id AND deleted_at IS NULL`, { id }) },
      { key: 'quitacoes', label: 'Quitações', count: count(`SELECT COUNT(*) c FROM motorista_quitacao WHERE motorista_id=@id`, { id }) },
      { key: 'usuarios', label: 'Usuários vinculados', count: count(`SELECT COUNT(*) c FROM usuario WHERE motorista_id=@id AND deleted_at IS NULL`, { id }) },
    ])
  },

  assertCanDeleteTipoPlantio(nome) {
    const tipo = String(nome || '').trim().toUpperCase()
    assertNoDependencies('Tipo de plantio', [
      { key: 'colheitas', label: 'Colheitas', count: count(`SELECT COUNT(*) c FROM viagem WHERE UPPER(COALESCE(tipo_plantio,''))=@tipo AND deleted_at IS NULL`, { tipo }) },
      { key: 'regras_destino', label: 'Regras do destino', count: count(`SELECT COUNT(*) c FROM destino_regra_plantio WHERE UPPER(tipo_plantio)=@tipo`, { tipo }) },
      { key: 'contratos', label: 'Contratos de trava', count: count(`SELECT COUNT(*) c FROM contrato_silo WHERE UPPER(tipo_plantio)=@tipo`, { tipo }) },
      { key: 'acordos', label: 'Acordos', count: count(`SELECT COUNT(*) c FROM talhao_acordo WHERE UPPER(COALESCE(tipo_plantio,''))=@tipo AND deleted_at IS NULL`, { tipo }) },
    ])
  },

  assertCanDeleteFrete(id) {
    const frete = db.prepare(`SELECT * FROM frete WHERE id=@id`).get({ id })
    if (!frete) return
    assertNoDependencies('Frete', [
      {
        key: 'colheitas',
        label: 'Colheitas que usam esta combinação safra+motorista+destino',
        count: count(
          `SELECT COUNT(*) c
           FROM viagem
           WHERE safra_id=@safra_id AND motorista_id=@motorista_id AND destino_id=@destino_id AND deleted_at IS NULL`,
          frete,
        ),
      },
    ])
  },

  assertCanDeleteParticipante(id) {
    assertNoDependencies('Participante', [
      { key: 'acordos', label: 'Participações em acordos', count: count(`SELECT COUNT(*) c FROM talhao_acordo_participante WHERE participante_id=@id`, { id }) },
      { key: 'vendas', label: 'Vendas de sacas', count: count(`SELECT COUNT(*) c FROM venda_saca WHERE participante_id=@id AND deleted_at IS NULL`, { id }) },
      { key: 'apuracao', label: 'Movimentos de apuração', count: count(`SELECT COUNT(*) c FROM participante_sacas_mov WHERE participante_id=@id`, { id }) },
    ])
  },

  assertCanDeletePoliticaCustos(id) {
    assertNoDependencies('Política de custos', [
      { key: 'acordos', label: 'Acordos vinculados', count: count(`SELECT COUNT(*) c FROM talhao_acordo WHERE politica_custos_id=@id AND deleted_at IS NULL`, { id }) },
    ])
  },
}

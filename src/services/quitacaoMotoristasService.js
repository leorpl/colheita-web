import { db } from '../db/db.js'
import { unprocessable } from '../errors.js'
import { motoristaQuitacaoRepo } from '../repositories/motoristaQuitacaoRepo.js'

function isYmd(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export const quitacaoMotoristasService = {
  resumo({ de, ate }) {
    if (!isYmd(de) || !isYmd(ate)) {
      throw unprocessable('Periodo invalido (use datas no formato YYYY-MM-DD)')
    }
    if (ate < de) throw unprocessable('Periodo invalido (ate < de)')

    const fretes = db
      .prepare(
        `SELECT
           m.id as motorista_id,
           m.nome as motorista_nome,
           m.placa as motorista_placa,
           COUNT(v.id) as quantidade,
           COALESCE(SUM(v.sub_total_frete), 0) as valor_frete
         FROM motorista m
         LEFT JOIN viagem v ON v.motorista_id = m.id
          AND v.data_saida >= @de
          AND v.data_saida <= @ate
         GROUP BY m.id
         ORDER BY m.nome`,
      )
      .all({ de, ate })

    const pagos = db
      .prepare(
        `SELECT motorista_id, COALESCE(SUM(valor), 0) as valor_pago
         FROM motorista_quitacao
         WHERE de >= @de AND ate <= @ate
         GROUP BY motorista_id`,
      )
      .all({ de, ate })

    const pagoMap = new Map(pagos.map((p) => [p.motorista_id, Number(p.valor_pago || 0)]))

    const items = fretes.map((f) => {
      const valor_frete = Number(f.valor_frete || 0)
      const valor_pago = pagoMap.get(f.motorista_id) ?? 0
      return {
        motorista_id: f.motorista_id,
        motorista_nome: f.motorista_nome,
        motorista_placa: f.motorista_placa,
        quantidade: Number(f.quantidade || 0),
        valor_frete,
        valor_pago,
        saldo: valor_frete - valor_pago,
      }
    })

    const quitacoes = motoristaQuitacaoRepo.list({ de, ate })

    return { period: { de, ate }, items, quitacoes }
  },

  create(input) {
    const motorista_id = Number(input.motorista_id)
    const de = input.de
    const ate = input.ate
    const data_pagamento = input.data_pagamento
    const valor = Number(input.valor)

    if (!Number.isInteger(motorista_id) || motorista_id <= 0) {
      throw unprocessable('motorista_id invalido')
    }
    if (!isYmd(de) || !isYmd(ate) || ate < de) {
      throw unprocessable('Periodo invalido')
    }
    if (!isYmd(data_pagamento)) throw unprocessable('data_pagamento invalida')
    if (!Number.isFinite(valor) || valor <= 0) throw unprocessable('valor invalido')

    const data = {
      motorista_id,
      de,
      ate,
      data_pagamento,
      valor,
      forma_pagamento: input.forma_pagamento ? String(input.forma_pagamento) : null,
      observacoes: input.observacoes ? String(input.observacoes) : null,
    }

    if (input.id) {
      return motoristaQuitacaoRepo.update(Number(input.id), data)
    }

    return motoristaQuitacaoRepo.create(data)
  },
}

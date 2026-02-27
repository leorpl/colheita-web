import { Router } from 'express'
import { z } from 'zod'
import { validateQuery } from '../../middleware/validate.js'
import { relatoriosService } from '../../services/relatoriosService.js'

export const relatoriosRouter = Router()

const ColheitaQuery = z.object({
  safra_id: z.coerce.number().int().positive().optional(),
  talhao_id: z.coerce.number().int().positive().optional(),
  destino_id: z.coerce.number().int().positive().optional(),
  motorista_id: z.coerce.number().int().positive().optional(),
  de: z.string().optional(),
  ate: z.string().optional(),
})

relatoriosRouter.get('/colheita', validateQuery(ColheitaQuery), (req, res) => {
  res.json(relatoriosService.colheita(req.query))
})

relatoriosRouter.get('/painel', (_req, res) => {
  res.json(relatoriosService.painel())
})

const ResumoTalhaoQuery = z.object({
  safra_id: z.coerce.number().int().positive(),
})

relatoriosRouter.get(
  '/resumo-talhao',
  validateQuery(ResumoTalhaoQuery),
  (req, res) => {
    res.json(relatoriosService.resumoTalhao({ safra_id: req.query.safra_id }))
  },
)

const PagamentoQuery = z.object({
  de: z.string().optional(),
  ate: z.string().optional(),
})

relatoriosRouter.get(
  '/pagamento-motoristas',
  validateQuery(PagamentoQuery),
  (req, res) => {
    res.json(relatoriosService.pagamentoMotoristas(req.query))
  },
)

const EntregasQuery = z.object({
  safra_id: z.coerce.number().int().positive(),
})

relatoriosRouter.get(
  '/entregas-por-destino',
  validateQuery(EntregasQuery),
  (req, res) => {
    res.json(relatoriosService.entregasPorDestino({ safra_id: req.query.safra_id }))
  },
)

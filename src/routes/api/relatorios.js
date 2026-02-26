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

relatoriosRouter.get('/colheita', validateQuery(ColheitaQuery), async (req, res) => {
  res.json(await relatoriosService.colheita(req.query))
})

relatoriosRouter.get('/painel', async (_req, res) => {
  res.json(await relatoriosService.painel())
})

const ResumoTalhaoQuery = z.object({
  safra_id: z.coerce.number().int().positive(),
})

relatoriosRouter.get(
  '/resumo-talhao',
  validateQuery(ResumoTalhaoQuery),
  async (req, res) => {
    res.json(await relatoriosService.resumoTalhao({ safra_id: req.query.safra_id }))
  },
)

const PagamentoQuery = z.object({
  de: z.string().optional(),
  ate: z.string().optional(),
})

relatoriosRouter.get(
  '/pagamento-motoristas',
  validateQuery(PagamentoQuery),
  async (req, res) => {
    res.json(await relatoriosService.pagamentoMotoristas(req.query))
  },
)

const EntregasQuery = z.object({
  safra_id: z.coerce.number().int().positive(),
})

relatoriosRouter.get(
  '/entregas-por-destino',
  validateQuery(EntregasQuery),
  async (req, res) => {
    res.json(await relatoriosService.entregasPorDestino({ safra_id: req.query.safra_id }))
  },
)

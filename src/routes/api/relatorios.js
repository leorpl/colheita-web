import { Router } from 'express'
import { validateQuery } from '../../middleware/validate.js'
import { relatoriosService } from '../../services/relatoriosService.js'
import { requirePerm } from '../../middleware/auth.js'
import { Permissions } from '../../auth/permissions.js'
import { RelatoriosSchemas } from '../../validation/apiSchemas.js'

export const relatoriosRouter = Router()

const ColheitaQuery = RelatoriosSchemas.ColheitaQuery

relatoriosRouter.get(
  '/colheita',
  requirePerm(Permissions.RELATORIOS_READ),
  validateQuery(ColheitaQuery),
  (req, res) => {
  res.json(relatoriosService.colheita(req.query))
  },
)

relatoriosRouter.get('/painel', requirePerm(Permissions.RELATORIOS_READ), (_req, res) => {
  res.json(relatoriosService.painel())
})

const ResumoTalhaoQuery = RelatoriosSchemas.ResumoTalhaoQuery

relatoriosRouter.get(
  '/resumo-talhao',
  requirePerm(Permissions.RELATORIOS_READ),
  validateQuery(ResumoTalhaoQuery),
  (req, res) => {
    res.json(
      relatoriosService.resumoTalhao({
        safra_id: req.query.safra_id,
        de: req.query.de,
        ate: req.query.ate,
      }),
    )
  },
)

const PagamentoQuery = RelatoriosSchemas.PagamentoQuery

relatoriosRouter.get(
  '/pagamento-motoristas',
  requirePerm(Permissions.RELATORIOS_READ),
  validateQuery(PagamentoQuery),
  (req, res) => {
    res.json(relatoriosService.pagamentoMotoristas(req.query))
  },
)

const EntregasQuery = RelatoriosSchemas.EntregasQuery

relatoriosRouter.get(
  '/entregas-por-destino',
  requirePerm(Permissions.RELATORIOS_READ),
  validateQuery(EntregasQuery),
  (req, res) => {
    res.json(
      relatoriosService.entregasPorDestino({
        safra_id: req.query.safra_id,
        tipo_plantio: req.query.tipo_plantio,
        de: req.query.de,
        ate: req.query.ate,
      }),
    )
  },
)

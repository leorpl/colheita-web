import { Router } from 'express'
import { validateQuery } from '../../middleware/validate.js'
import { relatoriosService } from '../../services/relatoriosService.js'
import { requirePerm } from '../../middleware/auth.js'
import { Actions, Modules } from '../../auth/acl.js'
import { RelatoriosSchemas } from '../../validation/apiSchemas.js'

export const relatoriosRouter = Router()

const ColheitaQuery = RelatoriosSchemas.ColheitaQuery

relatoriosRouter.get(
  '/colheita',
  requirePerm(Modules.RELATORIOS, Actions.VIEW),
  validateQuery(ColheitaQuery),
  (req, res) => {
  res.json(relatoriosService.colheita(req.query))
  },
)

relatoriosRouter.get(
  '/colheitas-completo.xlsx',
  requirePerm(Modules.RELATORIOS, Actions.VIEW),
  validateQuery(ColheitaQuery),
  (req, res) => {
    const buf = relatoriosService.colheitasCompletoXlsx(req.query)
    const safra = req.query?.safra_id ? `-safra-${req.query.safra_id}` : ''
    const de = req.query?.de ? `-${req.query.de}` : ''
    const ate = req.query?.ate ? `-${req.query.ate}` : ''
    const name = `colheitas-completo${safra}${de}${ate}.xlsx`
    res.setHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('content-disposition', `attachment; filename="${name}"`)
    res.send(buf)
  },
)

relatoriosRouter.get(
  '/viagens-bruto.xlsx',
  requirePerm(Modules.RELATORIOS, Actions.VIEW),
  validateQuery(ColheitaQuery),
  (req, res) => {
    const buf = relatoriosService.viagensBrutoXlsx(req.query)
    const safra = req.query?.safra_id ? `-safra-${req.query.safra_id}` : ''
    const de = req.query?.de ? `-${req.query.de}` : ''
    const ate = req.query?.ate ? `-${req.query.ate}` : ''
    const name = `viagens-bruto${safra}${de}${ate}.xlsx`
    res.setHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('content-disposition', `attachment; filename="${name}"`)
    res.send(buf)
  },
)

relatoriosRouter.get('/painel', requirePerm(Modules.RELATORIOS, Actions.VIEW), (_req, res) => {
  res.json(relatoriosService.painel())
})

const ResumoTalhaoQuery = RelatoriosSchemas.ResumoTalhaoQuery

relatoriosRouter.get(
  '/resumo-talhao',
  requirePerm(Modules.RELATORIOS, Actions.VIEW),
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
  requirePerm(Modules.RELATORIOS, Actions.VIEW),
  validateQuery(PagamentoQuery),
  (req, res) => {
    res.json(relatoriosService.pagamentoMotoristas(req.query))
  },
)

const EntregasQuery = RelatoriosSchemas.EntregasQuery

relatoriosRouter.get(
  '/entregas-por-destino',
  requirePerm(Modules.RELATORIOS, Actions.VIEW),
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

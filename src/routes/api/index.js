import { Router } from 'express'
import { safrasRouter } from './safras.js'
import { talhoesRouter } from './talhoes.js'
import { destinosRouter } from './destinos.js'
import { motoristasRouter } from './motoristas.js'
import { fretesRouter } from './fretes.js'
import { viagensRouter } from './viagens.js'
import { relatoriosRouter } from './relatorios.js'
import { destinoRegrasRouter } from './destinoRegras.js'
import { talhaoSafraRouter } from './talhaoSafra.js'
import { tiposPlantioRouter } from './tiposPlantio.js'
import { quitacoesMotoristasRouter } from './quitacoesMotoristas.js'
import { publicRouter } from './public.js'
import { authRouter } from './auth.js'
import { usersRouter } from './users.js'
import { contratosSiloRouter } from './contratosSilo.js'
import { contratosSiloArquivosRouter } from './contratosSiloArquivos.js'
import { auditLogsRouter } from './auditLogs.js'
import { aclRouter } from './acl.js'
import { participantesRouter } from './participantes.js'
import { politicasCustosRouter } from './politicasCustos.js'
import { talhaoAcordosRouter } from './talhaoAcordos.js'
import { vendasSacasRouter } from './vendasSacas.js'
import { custosLancamentosRouter } from './custosLancamentos.js'
import { apuracaoRouter } from './apuracao.js'
import { requireAuth } from '../../middleware/auth.js'

export const apiRouter = Router()

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true })
})

// Public/open routes
apiRouter.use('/auth', authRouter)
apiRouter.use('/public', publicRouter)

// Everything below requires an authenticated session when AUTH_ENABLED=1.
apiRouter.use(requireAuth)

// Admin/management
apiRouter.use('/users', usersRouter)
apiRouter.use('/acl', aclRouter)
  apiRouter.use('/audit-logs', auditLogsRouter)

  // Producao/divisao
  apiRouter.use('/participantes', participantesRouter)
  apiRouter.use('/politicas-custos', politicasCustosRouter)
  apiRouter.use('/talhao-acordos', talhaoAcordosRouter)
  apiRouter.use('/vendas-sacas', vendasSacasRouter)
  apiRouter.use('/custos-lancamentos', custosLancamentosRouter)
  apiRouter.use('/apuracao', apuracaoRouter)

apiRouter.use('/safras', safrasRouter)
apiRouter.use('/talhoes', talhoesRouter)
apiRouter.use('/destinos', destinosRouter)
apiRouter.use('/motoristas', motoristasRouter)
apiRouter.use('/tipos-plantio', tiposPlantioRouter)
apiRouter.use('/fretes', fretesRouter)
apiRouter.use('/destino-regras', destinoRegrasRouter)
  apiRouter.use('/contratos-silo', contratosSiloRouter)
  apiRouter.use('/', contratosSiloArquivosRouter)
apiRouter.use('/talhao-safra', talhaoSafraRouter)
apiRouter.use('/viagens', viagensRouter)
apiRouter.use('/relatorios', relatoriosRouter)
  apiRouter.use('/quitacoes-motoristas', quitacoesMotoristasRouter)

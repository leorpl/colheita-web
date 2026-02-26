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

export const apiRouter = Router()

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true })
})

apiRouter.use('/auth', authRouter)
apiRouter.use('/users', usersRouter)

apiRouter.use('/safras', safrasRouter)
apiRouter.use('/talhoes', talhoesRouter)
apiRouter.use('/destinos', destinosRouter)
apiRouter.use('/motoristas', motoristasRouter)
apiRouter.use('/tipos-plantio', tiposPlantioRouter)
apiRouter.use('/fretes', fretesRouter)
apiRouter.use('/destino-regras', destinoRegrasRouter)
apiRouter.use('/talhao-safra', talhaoSafraRouter)
apiRouter.use('/viagens', viagensRouter)
apiRouter.use('/relatorios', relatoriosRouter)
apiRouter.use('/quitacoes-motoristas', quitacoesMotoristasRouter)
apiRouter.use('/public', publicRouter)

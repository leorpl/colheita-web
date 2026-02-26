import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import compression from 'compression'
import pinoHttp from 'pino-http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { env } from './config/env.js'
import { logger } from './logger.js'
import { requestId } from './middleware/requestId.js'
import { errorHandler } from './middleware/errorHandler.js'
import { apiRouter } from './routes/api/index.js'
import { pagesRouter } from './routes/pages.js'
import { authGate } from './middleware/auth.js'

export function createApp() {
  const app = express()

  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const publicDir = path.join(__dirname, 'public')

  app.disable('x-powered-by')

  app.use(requestId)
  app.use(pinoHttp({ logger, genReqId: (req) => req.id }))

  app.use(
    helmet({
      // Precisamos permitir o embed do Google My Maps (iframe) na pagina publica do talhao.
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          // Permitir exibir fotos externas (talhao.foto_url) via https.
          'img-src': ["'self'", 'data:', 'https:'],
          // Helmet nao seta frame-src por padrao; default-src='self' acabaria bloqueando o iframe.
          'frame-src': [
            "'self'",
            'https://www.google.com',
            'https://www.google.com/maps',
            'https://maps.google.com',
          ],
          // Compatibilidade com navegadores mais antigos.
          'child-src': [
            "'self'",
            'https://www.google.com',
            'https://www.google.com/maps',
            'https://maps.google.com',
          ],
        },
      },
    }),
  )
  app.use(compression())

  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: false,
    }),
  )

  app.use(express.json({ limit: '1mb' }))

  app.use(express.static(publicDir))

  app.use('/', pagesRouter)
  app.use('/api', authGate, apiRouter)

  app.use((req, res) => {
    res.status(404).json({
      error: 'NotFound',
      message: 'Route not found',
      requestId: req.id,
    })
  })

  app.use(errorHandler)
  return app
}

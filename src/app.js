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
import { authenticate, enforcePasswordChange } from './middleware/auth.js'
import { rateLimit } from './middleware/rateLimit.js'
import { enforceSameOrigin } from './middleware/sameOrigin.js'

export function createApp() {
  const app = express()

  if (Number(env.TRUST_PROXY) === 1) {
    app.set('trust proxy', 1)
  }

  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const publicDir = path.join(__dirname, 'public')
  const leafletDir = path.join(__dirname, '..', 'node_modules', 'leaflet', 'dist')

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

  // Defensive: block cross-site state changes (browser requests with Origin)
  app.use(
    '/api',
    enforceSameOrigin({
      allowedOrigins: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    }),
  )

  // Rate limiting (in-memory)
  if (Number(env.RATE_LIMIT_ENABLED) === 1) {
    app.use(
      '/api/auth/login',
      rateLimit({
        id: 'login',
        windowMs: Number(env.RATE_LIMIT_LOGIN_WINDOW_MS),
        max: Number(env.RATE_LIMIT_LOGIN_MAX),
        message: 'Muitas tentativas de login, tente novamente mais tarde.',
      }),
    )

    app.use(
      '/api/auth/forgot',
      rateLimit({
        id: 'forgot',
        windowMs: Number(env.RATE_LIMIT_LOGIN_WINDOW_MS),
        max: Number(env.RATE_LIMIT_LOGIN_MAX),
        message: 'Muitas tentativas, tente novamente mais tarde.',
      }),
    )

    app.use(
      '/api/auth/reset',
      rateLimit({
        id: 'reset',
        windowMs: Number(env.RATE_LIMIT_LOGIN_WINDOW_MS),
        max: Number(env.RATE_LIMIT_LOGIN_MAX),
        message: 'Muitas tentativas, tente novamente mais tarde.',
      }),
    )

    app.use(
      '/api',
      rateLimit({
        id: 'api',
        windowMs: Number(env.RATE_LIMIT_API_WINDOW_MS),
        max: Number(env.RATE_LIMIT_API_MAX),
        skip: (req) => {
          const p = String(req.path || '')
          // health/public nao precisam consumir quota
          if (p.startsWith('/health')) return true
          if (p.startsWith('/public')) return true
          // login tem limit separado
          if (p === '/auth/login') return true
          return false
        },
      }),
    )
  }

  app.use(
    express.static(publicDir, {
      etag: true,
      lastModified: true,
      maxAge: 0,
      setHeaders: (res, filePath) => {
        // Evita cache agressivo no browser para assets do app.
        // (mudancas frequentes de regra/negocio precisam refletir imediatamente)
        if (String(filePath).endsWith('.js') || String(filePath).endsWith('.css')) {
          res.setHeader('Cache-Control', 'no-cache')
        }
      },
    }),
  )
  app.use('/vendor/leaflet', express.static(leafletDir, { maxAge: 0 }))

  app.use('/', pagesRouter)
  // Always try to attach req.user (session cookie); authorization happens inside /api router.
  app.use('/api', authenticate, enforcePasswordChange, apiRouter)

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

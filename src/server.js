import { env } from './config/env.js'
import { logger } from './logger.js'
import { migrate } from './db/migrate.js'
import { createApp } from './app.js'
import { dbPathAbs } from './db/db.js'

migrate()

const app = createApp()

const host = process.env.RENDER ? '0.0.0.0' : env.HOST

app.listen(env.PORT, host, () => {
  logger.info(
    { port: env.PORT, host, node_env: env.NODE_ENV, db: { configured: env.DB_PATH, resolved: dbPathAbs } },
    'server listening',
  )
})

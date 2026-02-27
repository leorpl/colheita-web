import { env } from './config/env.js'
import { logger } from './logger.js'
import { migrate } from './db/migrate.js'
import { createApp } from './app.js'

migrate()

const app = createApp()

app.listen(env.PORT, env.HOST, () => {
  logger.info(
    { port: env.PORT, host: env.HOST, db: env.DB_PATH },
    'server listening',
  )
})

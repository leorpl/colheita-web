import { env } from './config/env.js'
import { logger } from './logger.js'
import { createApp } from './app.js'

function redactDatabaseUrl(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    const db = u.pathname?.replace(/^\//, '') || ''
    return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}/${db}`
  } catch {
    return '[invalid DATABASE_URL]'
  }
}

const app = createApp()

app.listen(env.PORT, env.HOST, () => {
  logger.info(
    {
      port: env.PORT,
      host: env.HOST,
      dbProvider: env.DB_PROVIDER,
      database: redactDatabaseUrl(env.DATABASE_URL),
    },
    'server listening',
  )
})

import 'dotenv/config'
import { z } from 'zod'

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DB_PATH: z.string().default('./data/app.db'),
  UMIDADE_BASE: z.coerce.number().min(0).max(1).default(0.13),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  AUTH_ENABLED: z.coerce.number().int().min(0).max(1).default(1),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  SESSION_COOKIE_NAME: z.string().default('st_session'),
})

export const env = EnvSchema.parse(process.env)

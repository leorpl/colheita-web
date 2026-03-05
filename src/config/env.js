import 'dotenv/config'
import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  // Default defensivo: nao expor na rede sem opt-in.
  HOST: z.string().default('127.0.0.1'),
  DB_PATH: z.string().default('./data/app.db'),
  UMIDADE_BASE: z.coerce.number().min(0).max(1).default(0.13),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Reverse proxy
  TRUST_PROXY: z.coerce.number().int().min(0).max(1).default(0),

  AUTH_ENABLED: z.coerce.number().int().min(0).max(1).default(1),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  SESSION_COOKIE_NAME: z.string().default('st_session'),

  // Cookie hardening
  COOKIE_SECURE: z.coerce.number().int().min(0).max(1).default(0),
  COOKIE_SAMESITE: z.enum(['Lax', 'Strict']).default('Lax'),

  // Rate limiting (in-memory)
  RATE_LIMIT_ENABLED: z.coerce.number().int().min(0).max(1).default(1),
  RATE_LIMIT_API_WINDOW_MS: z.coerce.number().int().min(1000).max(3600_000).default(300_000),
  RATE_LIMIT_API_MAX: z.coerce.number().int().min(50).max(100_000).default(2400),
  RATE_LIMIT_LOGIN_WINDOW_MS: z.coerce.number().int().min(1000).max(3600_000).default(900_000),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().min(3).max(1000).default(25),

  // Dev-only: seed inicial quando DB esta vazio (nunca em production)
  SEED_DEV_ADMIN: z.coerce.number().int().min(0).max(1).default(1),
  DEV_ADMIN_USERNAME: z.string().default('admin@local'),
  DEV_ADMIN_PASSWORD: z.string().default('admin123'),
  SEED_TEST_USERS: z.coerce.number().int().min(0).max(1).default(0),
})

export const env = EnvSchema.parse(process.env)

// Fail-fast: nunca rodar production com auth desabilitada.
if (env.NODE_ENV === 'production' && Number(env.AUTH_ENABLED) !== 1) {
  throw new Error('AUTH_ENABLED deve ser 1 em production')
}

if (env.NODE_ENV === 'production' && Number(env.COOKIE_SECURE) !== 1) {
  // Nao quebra o start: pode rodar atras de proxy/terminacao TLS fora do node.
  // Mas avisa para evitar cookie trafegando sem Secure.
  console.warn('WARN: COOKIE_SECURE=0 em production (recomendado: 1 em HTTPS)')
}

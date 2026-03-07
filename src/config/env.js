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
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(1),
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

  // Password reset
  PUBLIC_BASE_URL: z.string().default(''),

  // SMTP (optional). If unset, reset links are logged in development.
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default(''),

  // Comunicacao (atalho webmail)
  WEBMAIL_URL: z.string().default(''),
  WEBMAIL_LABEL: z.string().default('Webmail da fazenda'),
  WEBMAIL_HINT: z.string().default(''),
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

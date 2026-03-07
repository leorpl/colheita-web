import { z } from 'zod'

// Helpers
export const MAX = {
  code: 60,
  name: 120,
  short: 40,
  placa: 20,
  url: 2048,
  notes: 4000,
  username: 64,
  password: 256,
}

export const emptyToNull = (v) => (v === '' ? null : v)
export const emptyToUndefined = (v) => (v === '' ? undefined : v)
export const firstOfArray = (v) => (Array.isArray(v) ? v[0] : v)

export function isValidDateYMD(s) {
  const m = String(s).match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/)
  if (!m) return false
  const yyyy = Number(m[1])
  const mm = Number(m[2])
  const dd = Number(m[3])
  if (mm < 1 || mm > 12) return false
  if (dd < 1 || dd > 31) return false
  const d = new Date(Date.UTC(yyyy, mm - 1, dd))
  // garante que nao rolou overflow (ex: 2026-02-31)
  return (
    d.getUTCFullYear() === yyyy &&
    d.getUTCMonth() === mm - 1 &&
    d.getUTCDate() === dd
  )
}

// Aceita YYYY-MM-DD ou DD/MM/YYYY e normaliza para YYYY-MM-DD.
export function normalizeDateToYMD(v) {
  if (v === null || v === undefined) return v
  const s = String(v ?? '').trim()
  if (!s) return s
  const m = s.match(/^([0-9]{2})\/([0-9]{2})\/([0-9]{4})$/)
  if (!m) return s
  return `${m[3]}-${m[2]}-${m[1]}`
}

export { z }

export const S = {
  // Params
  IdParam: z.object({ id: z.coerce.number().int().positive() }),

  // Common primitives
  DateYMD: z.preprocess(
    (v) => normalizeDateToYMD(v),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(isValidDateYMD, 'Data invalida (YYYY-MM-DD)'),
  ),

  TimeHM: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora invalida (HH:MM)'),

  // Percent input expected as 0..100 (backend normaliza para fracao)
  Percent100: z.coerce.number().min(0).max(100),

  // Body fields
  Codigo: z.string().trim().min(1).max(MAX.code),
  Nome: z.string().trim().min(1).max(MAX.name),
  OptText40: z.preprocess(emptyToNull, z.string().trim().max(MAX.short).nullable().optional()),
  OptText120: z.preprocess(emptyToNull, z.string().trim().max(MAX.name).nullable().optional()),
  OptNotes: z.preprocess(emptyToNull, z.string().trim().max(MAX.notes).nullable().optional()),
  OptUrl: z.preprocess(
    emptyToNull,
    z.string().trim().url().max(MAX.url).nullable().optional(),
  ),

  // Query helpers (flatten arrays; treat '' as undefined)
  QDate: z
    .preprocess((v) => emptyToUndefined(firstOfArray(v)), z.any())
    .pipe(
      z
        .union([z.undefined(), z.null(), z.string()])
        .transform((v) => (v == null ? undefined : v)),
    )
    .pipe(z.union([z.undefined(), z.null(), z.string()]))
    .optional(),
}

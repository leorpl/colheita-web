import {
  z,
  MAX,
  emptyToUndefined,
  firstOfArray,
  isValidDateYMD,
  normalizeDateToYMD,
} from '../../../validation/schemaPrimitives.js'

import { ViagemSchemas } from '../../harvest/validators/viagemSchemas.js'

export const RelatoriosSchemas = {
  ColheitaQuery: ViagemSchemas.ListQuery,
  ResumoTalhaoQuery: z.object({
    safra_id: z.coerce.number().int().positive(),
    de: z
      .preprocess((v) => {
        const raw = emptyToUndefined(firstOfArray(v))
        if (raw === undefined) return undefined
        return normalizeDateToYMD(raw)
      }, z.any())
      .pipe(
        z.union([
          z.undefined(),
          z.string().refine(isValidDateYMD, 'Data invalida (YYYY-MM-DD)'),
        ]),
      ),
    ate: z
      .preprocess((v) => {
        const raw = emptyToUndefined(firstOfArray(v))
        if (raw === undefined) return undefined
        return normalizeDateToYMD(raw)
      }, z.any())
      .pipe(
        z.union([
          z.undefined(),
          z.string().refine(isValidDateYMD, 'Data invalida (YYYY-MM-DD)'),
        ]),
      ),
  }),
  PagamentoQuery: z.object({
    safra_id: z.coerce.number().int().positive().optional(),
    de: z
      .preprocess((v) => {
        const raw = emptyToUndefined(firstOfArray(v))
        if (raw === undefined) return undefined
        return normalizeDateToYMD(raw)
      }, z.any())
      .pipe(
        z.union([
          z.undefined(),
          z.string().refine(isValidDateYMD, 'Data invalida (YYYY-MM-DD)'),
        ]),
      ),
    ate: z
      .preprocess((v) => {
        const raw = emptyToUndefined(firstOfArray(v))
        if (raw === undefined) return undefined
        return normalizeDateToYMD(raw)
      }, z.any())
      .pipe(
        z.union([
          z.undefined(),
          z.string().refine(isValidDateYMD, 'Data invalida (YYYY-MM-DD)'),
        ]),
      ),
  }),
  EntregasQuery: z.object({
    safra_id: z.coerce.number().int().positive(),
    tipo_plantio: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(MAX.short).optional()),
    de: z
      .preprocess((v) => {
        const raw = emptyToUndefined(firstOfArray(v))
        if (raw === undefined) return undefined
        return normalizeDateToYMD(raw)
      }, z.any())
      .pipe(
        z.union([
          z.undefined(),
          z.string().refine(isValidDateYMD, 'Data invalida (YYYY-MM-DD)'),
        ]),
      ),
    ate: z
      .preprocess((v) => {
        const raw = emptyToUndefined(firstOfArray(v))
        if (raw === undefined) return undefined
        return normalizeDateToYMD(raw)
      }, z.any())
      .pipe(
        z.union([
          z.undefined(),
          z.string().refine(isValidDateYMD, 'Data invalida (YYYY-MM-DD)'),
        ]),
      ),
  }),
}

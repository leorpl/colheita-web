import {
  z,
  MAX,
  S,
  emptyToNull,
  emptyToUndefined,
  firstOfArray,
  isValidDateYMD,
  normalizeDateToYMD,
} from '../../../validation/schemaPrimitives.js'

export const ViagemSchemas = {
  TalhaoItem: z
    .object({
      talhao_id: z.coerce.number().int().positive(),
      pct_rateio: S.Percent100.optional().nullable(),
      kg_rateio: z.coerce.number().min(0).max(500_000).optional().nullable(),
    })
    .superRefine((it, ctx) => {
      const hasPct = !(it.pct_rateio === null || it.pct_rateio === undefined)
      const hasKg = !(it.kg_rateio === null || it.kg_rateio === undefined)
      if (!hasPct && !hasKg) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe percentual (%) ou kg no rateio do talhao',
        })
      }
    }),

  Body: z
    .object({
      ficha: z.union([
        z.string().trim().min(1).max(12).regex(/^[0-9]+$/),
        z.coerce.number().int().positive().max(9_999_999),
      ]),
      safra_id: z.coerce.number().int().positive(),
      tipo_plantio: z.preprocess(emptyToNull, z.string().trim().max(MAX.short).nullable().optional()),
      talhao_id: z.coerce.number().int().positive().optional(),
      talhoes: z.array(z.lazy(() => ViagemSchemas.TalhaoItem)).min(1).max(20).optional(),
      local: z.preprocess(emptyToNull, z.string().trim().max(MAX.name).nullable().optional()),
      destino_id: z.coerce.number().int().positive(),
      motorista_id: z.coerce.number().int().positive(),
      placa: z.preprocess(emptyToNull, z.string().trim().max(MAX.placa).nullable().optional()),

      data_saida: z
        .preprocess((v) => normalizeDateToYMD(emptyToNull(v)), z.string().nullable().optional())
        .refine((v) => v == null || isValidDateYMD(v), 'data_saida invalida (YYYY-MM-DD)'),
      hora_saida: z
        .preprocess(emptyToNull, z.string().nullable().optional())
        .refine((v) => v == null || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), 'hora_saida invalida (HH:MM)'),
      data_entrega: z
        .preprocess((v) => normalizeDateToYMD(emptyToNull(v)), z.string().nullable().optional())
        .refine((v) => v == null || isValidDateYMD(v), 'data_entrega invalida (YYYY-MM-DD)'),
      hora_entrega: z
        .preprocess(emptyToNull, z.string().nullable().optional())
        .refine((v) => v == null || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), 'hora_entrega invalida (HH:MM)'),

      carga_total_kg: z.coerce.number().min(0).max(500_000),
      tara_kg: z.coerce.number().min(0).max(500_000),

      // Custos em sacas (controle fisico; opcional)
      custo_frete_sacas: z.preprocess(
        emptyToNull,
        z.union([z.coerce.number().min(0).max(1_000_000), z.null()]),
      ).optional(),
      custo_secagem_sacas: z.preprocess(
        emptyToNull,
        z.union([z.coerce.number().min(0).max(1_000_000), z.null()]),
      ).optional(),
      custo_silo_sacas: z.preprocess(
        emptyToNull,
        z.union([z.coerce.number().min(0).max(1_000_000), z.null()]),
      ).optional(),
      custo_terceiros_sacas: z.preprocess(
        emptyToNull,
        z.union([z.coerce.number().min(0).max(1_000_000), z.null()]),
      ).optional(),
      custo_outros_sacas: z.preprocess(
        emptyToNull,
        z.union([z.coerce.number().min(0).max(1_000_000), z.null()]),
      ).optional(),

      umidade_pct: S.Percent100.optional().nullable(),
      umidade_desc_pct_manual: S.Percent100.optional().nullable(),
      impureza_pct: S.Percent100.optional().nullable(),
      ardidos_pct: S.Percent100.optional().nullable(),
      queimados_pct: S.Percent100.optional().nullable(),
      avariados_pct: S.Percent100.optional().nullable(),
      esverdiados_pct: S.Percent100.optional().nullable(),
      quebrados_pct: S.Percent100.optional().nullable(),

      impureza_limite_pct: S.Percent100.optional().nullable(),
      ardidos_limite_pct: S.Percent100.optional().nullable(),
      queimados_limite_pct: S.Percent100.optional().nullable(),
      avariados_limite_pct: S.Percent100.optional().nullable(),
      esverdiados_limite_pct: S.Percent100.optional().nullable(),
      quebrados_limite_pct: S.Percent100.optional().nullable(),
      expected_updated_at: z.preprocess(emptyToNull, z.string().trim().max(30).nullable().optional()),
    })
    .superRefine((v, ctx) => {
      if (!(Array.isArray(v.talhoes) && v.talhoes.length) && !v.talhao_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe talhao (ou rateio de talhoes)',
          path: ['talhao_id'],
        })
      }

      if (v.talhoes && Array.isArray(v.talhoes)) {
        const seen = new Set()
        for (let i = 0; i < v.talhoes.length; i++) {
          const id = Number(v.talhoes[i]?.talhao_id)
          if (seen.has(id)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Talhao repetido no rateio',
              path: ['talhoes', i, 'talhao_id'],
            })
          }
          seen.add(id)
        }
      }

      // sanity: tara nao pode passar da carga (quando ambos informados)
      if (Number(v.carga_total_kg) > 0 && Number(v.tara_kg) > 0) {
        if (Number(v.tara_kg) > Number(v.carga_total_kg)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'tara_kg nao pode ser maior que carga_total_kg',
            path: ['tara_kg'],
          })
        }
      }

      // Entrega: se informar hora, precisa informar a data.
      if (v.hora_entrega && !v.data_entrega) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe a data de entrega quando houver hora de entrega.',
          path: ['data_entrega'],
        })
      }
    }),

  // Atualizacao limitada (portal motorista).
  // Nao altera pesos/qualidade/calculos; apenas dados operacionais.
  MotoristaUpdateBody: z
    .object({
      placa: z.preprocess(emptyToNull, z.string().trim().max(MAX.placa).nullable().optional()),
      data_saida: z
        .preprocess((v) => normalizeDateToYMD(emptyToNull(v)), z.string().nullable().optional())
        .refine((v) => v == null || isValidDateYMD(v), 'data_saida invalida (YYYY-MM-DD)'),
      hora_saida: z
        .preprocess(emptyToNull, z.string().nullable().optional())
        .refine((v) => v == null || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), 'hora_saida invalida (HH:MM)'),
      data_entrega: z
        .preprocess((v) => normalizeDateToYMD(emptyToNull(v)), z.string().nullable().optional())
        .refine((v) => v == null || isValidDateYMD(v), 'data_entrega invalida (YYYY-MM-DD)'),
      hora_entrega: z
        .preprocess(emptyToNull, z.string().nullable().optional())
        .refine((v) => v == null || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), 'hora_entrega invalida (HH:MM)'),
    })
    .superRefine((v, ctx) => {
      if (v.hora_entrega && !v.data_entrega) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe a data de entrega quando houver hora de entrega.',
          path: ['data_entrega'],
        })
      }
    }),

  PreviewBody: null,
  CompareBody: null,

  RecalcAllBody: z.object({
    // Se omitir, recalcula tudo.
    safra_id: z.coerce.number().int().positive().optional(),
    destino_id: z.coerce.number().int().positive().optional(),
    tipo_plantio: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(MAX.short).optional()),
  }),

  ListQuery: z.object({
    safra_id: z.coerce.number().int().positive().optional(),
    talhao_id: z.coerce.number().int().positive().optional(),
    destino_id: z.coerce.number().int().positive().optional(),
    motorista_id: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    offset: z.coerce.number().int().min(0).max(200000).optional(),
    view: z.enum(['legacy', 'flat', 'grouped']).optional(),
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

  NextFichaQuery: z.object({
    safra_id: z.coerce.number().int().positive(),
  }),
}

ViagemSchemas.PreviewBody = ViagemSchemas.Body.extend({
  id: z.coerce.number().int().positive().optional(),
})

ViagemSchemas.CompareBody = ViagemSchemas.Body.extend({
  id: z.coerce.number().int().positive().optional(),
})

import { z, MAX, S, emptyToNull, emptyToUndefined } from '../../../validation/schemaPrimitives.js'

export const ProducaoSchemas = {
  ParticipanteBody: z.object({
    nome: z.string().trim().min(1).max(MAX.name),
    tipo: z
      .string()
      .trim()
      .transform((v) => v.toLowerCase())
      .refine(
        (v) => ['proprietario', 'parceiro', 'meeiro', 'empresa', 'outro'].includes(v),
        'tipo invalido',
      )
      .default('outro'),
    documento: z.preprocess(emptyToNull, z.string().trim().max(40).nullable().optional()),
    active: z.coerce.boolean().optional().default(true),
  }),

  PoliticaCustosBody: z.object({
    nome: z.string().trim().min(1).max(80),
    descricao: S.OptNotes,
    regras: z
      .array(
        z.object({
          custo_tipo: z.string().trim().min(1).max(40),
          modo_rateio: z
            .string()
            .trim()
            .refine(
              (v) =>
                [
                  'proporcional_participacao',
                  'somente_produtor',
                  'somente_dono',
                  'custom_percentuais',
                ].includes(v),
              'modo_rateio invalido',
            ),
          momento: z
            .string()
            .trim()
            .refine((v) => ['antes_divisao', 'depois_divisao'].includes(v), 'momento invalido'),
          custom_json: z.preprocess(emptyToNull, z.string().trim().max(4000).nullable().optional()),
        }),
      )
      .max(200)
      .optional()
      .default([]),
  }),

  TalhaoAcordoBody: z
    .object({
      talhao_id: z.coerce.number().int().positive(),
      safra_id: z.coerce.number().int().positive(),
      tipo_plantio: z.preprocess(emptyToUndefined, z.string().trim().max(MAX.short).optional()),
      politica_custos_id: z.coerce.number().int().positive().optional().nullable(),
      observacoes: S.OptNotes,
      participantes: z
        .array(
          z.object({
            participante_id: z.coerce.number().int().positive(),
            papel: z
              .string()
              .trim()
              .refine(
                (v) =>
                  ['dono_terra', 'proprietario', 'produtor', 'meeiro', 'parceiro'].includes(v),
                'papel invalido',
              ),
            percentual_producao: S.Percent100,
          }),
        )
        .min(1)
        .max(20),
    })
    .superRefine((v, ctx) => {
      const sum = (v.participantes || []).reduce(
        (acc, p) => acc + Number(p.percentual_producao || 0),
        0,
      )
      if (Math.abs(sum - 100) > 0.01) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A soma dos percentuais deve ser 100%',
          path: ['participantes'],
        })
      }
    }),

  VendaSacaBody: z
    .object({
      safra_id: z.coerce.number().int().positive(),
      data_venda: S.DateYMD,
      participante_id: z.coerce.number().int().positive(),
      comprador_tipo: z
        .string()
        .trim()
        .refine((v) => ['destino', 'terceiro'].includes(v), 'comprador_tipo invalido'),
      destino_id: z.coerce.number().int().positive().optional().nullable(),
      terceiro_nome: z.preprocess(emptyToNull, z.string().trim().max(MAX.name).nullable().optional()),
      tipo_plantio: z.preprocess(emptyToNull, z.string().trim().max(MAX.short).nullable().optional()),
      talhao_id: z.coerce.number().int().positive().optional().nullable(),
      sacas: z.coerce.number().min(0.0001).max(1_000_000),
      preco_por_saca: z.coerce.number().min(0.0001).max(9_999_999),
      observacoes: S.OptNotes,
    })
    .superRefine((v, ctx) => {
      if (v.comprador_tipo === 'destino' && !v.destino_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'destino_id obrigatorio',
          path: ['destino_id'],
        })
      }
      if (v.comprador_tipo === 'terceiro' && !v.terceiro_nome) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'nome do terceiro obrigatorio',
          path: ['terceiro_nome'],
        })
      }
    }),

  CustoLancamentoBody: z
    .object({
      safra_id: z.coerce.number().int().positive(),
      talhao_id: z.coerce.number().int().positive(),
      data_ref: z.preprocess((v) => emptyToNull(v), z.union([S.DateYMD, z.null()])).optional(),
      custo_tipo: z.string().trim().min(1).max(40),
      valor_rs: z.preprocess(
        emptyToNull,
        z.union([z.coerce.number().min(0).max(9_999_999), z.null()]),
      ).optional(),
      valor_sacas: z.preprocess(
        emptyToNull,
        z.union([z.coerce.number().min(0).max(1_000_000), z.null()]),
      ).optional(),
      observacoes: S.OptNotes,
    })
    .superRefine((v, ctx) => {
      const hasRs = !(v.valor_rs === null || v.valor_rs === undefined)
      const hasSc = !(v.valor_sacas === null || v.valor_sacas === undefined)
      if (!hasRs && !hasSc) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe valor em R$ ou em sacas',
          path: ['valor_rs'],
        })
      }
    }),

  ApuracaoQuery: z.object({
    safra_id: z.coerce.number().int().positive(),
  }),
}

import { z } from 'zod'
import { Roles, Menus } from '../auth/permissions.js'

// Helpers
const MAX = {
  code: 60,
  name: 120,
  short: 40,
  placa: 20,
  url: 2048,
  notes: 4000,
  username: 64,
  password: 256,
}

const emptyToNull = (v) => (v === '' ? null : v)
const emptyToUndefined = (v) => (v === '' ? undefined : v)
const firstOfArray = (v) => (Array.isArray(v) ? v[0] : v)

function isValidDateYMD(s) {
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
function normalizeDateToYMD(v) {
  if (v === null || v === undefined) return v
  const s = String(v ?? '').trim()
  if (!s) return s
  const m = s.match(/^([0-9]{2})\/([0-9]{2})\/([0-9]{4})$/)
  if (!m) return s
  return `${m[3]}-${m[2]}-${m[1]}`
}

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
  QDate: z.preprocess((v) => emptyToUndefined(firstOfArray(v)), z.any()).pipe(
    z.union([z.undefined(), z.null(), z.string()]).transform((v) => (v == null ? undefined : v)),
  ).pipe(z.union([z.undefined(), z.null(), z.string()])).optional(),
}

// Resource schemas

export const AuthSchemas = {
  LoginBody: z.object({
    username: z.string().trim().min(1).max(MAX.username),
    password: z.string().min(1).max(MAX.password),
  }),

  ForgotBody: z.object({
    email: z.string().trim().min(1).max(MAX.username),
  }),

  ResetBody: z.object({
    token: z.string().trim().min(16).max(256),
    password: z.string().min(8).max(MAX.password),
  }),
}

export const SafraSchemas = {
  Body: z.object({
    safra: z.string().trim().min(1).max(MAX.short),
    plantio: z.preprocess(emptyToNull, z.string().trim().max(MAX.short).nullable().optional()),
    data_referencia: z
      .preprocess((v) => normalizeDateToYMD(emptyToNull(v)), z.string().nullable().optional())
      .refine((v) => v == null || isValidDateYMD(v), 'Data invalida (YYYY-MM-DD)'),
    area_ha: z.coerce.number().min(0).max(1_000_000).optional().default(0),
  }),
  PainelBody: z.object({
    painel: z.coerce.boolean().default(true),
  }),
}

export const TalhaoSchemas = {
  Body: z.object({
    codigo: z.string().trim().min(1).max(MAX.code),
    local: S.OptText120,
    nome: S.OptText120,
    situacao: S.OptText40,
    hectares: z.coerce.number().min(0).max(1_000_000),
    posse: S.OptText120,
    contrato: z.preprocess(emptyToNull, z.string().trim().max(240).nullable().optional()),
    observacoes: S.OptNotes,
    irrigacao: S.OptText40,
    foto_url: S.OptUrl,
    maps_url: S.OptUrl,
    tipo_solo: S.OptText120,
    calagem: S.OptText120,
    gessagem: S.OptText120,
    fosforo_corretivo: S.OptText120,
  }),
}

export const DestinoSchemas = {
  Body: z.object({
    codigo: z.string().trim().min(1).max(MAX.code),
    local: z.string().trim().min(1).max(MAX.name),
    maps_url: S.OptUrl,
    distancia_km: z
      .preprocess(emptyToNull, z.union([z.coerce.number().min(0).max(5000), z.null()]))
      .optional()
      .nullable(),
    observacoes: S.OptNotes,
  }),
}

export const MotoristaSchemas = {
  Body: z.object({
    nome: z.string().trim().min(1).max(MAX.name),
    placa: z.preprocess(emptyToNull, z.string().trim().max(MAX.placa).nullable().optional()),
    cpf: z.preprocess(
      emptyToNull,
      z
        .string()
        .trim()
        .max(20)
        .regex(/^[0-9.\-\s]+$/, 'CPF invalido')
        .nullable()
        .optional(),
    ),
    banco: z.preprocess(emptyToNull, z.string().trim().max(80).nullable().optional()),
    pix_conta: z.preprocess(emptyToNull, z.string().trim().max(120).nullable().optional()),
    tipo_veiculo: z.preprocess(emptyToNull, z.string().trim().max(80).nullable().optional()),
    capacidade_kg: z
      .preprocess(emptyToNull, z.union([z.coerce.number().min(0).max(500_000), z.null()]))
      .optional()
      .nullable(),
  }),
}

export const FreteSchemas = {
  UpsertBody: z.object({
    safra_id: z.coerce.number().int().positive(),
    motorista_id: z.coerce.number().int().positive(),
    destino_id: z.coerce.number().int().positive(),
    valor_por_saca: z.coerce.number().min(0).max(999_999),
  }),
  CopySafraBody: z.object({
    from_safra_id: z.coerce.number().int().positive(),
    to_safra_id: z.coerce.number().int().positive(),
  }),
  BulkUpsertBody: z.object({
    safra_id: z.coerce.number().int().positive(),
    items: z
      .array(
        z.object({
          motorista_id: z.coerce.number().int().positive(),
          destino_id: z.coerce.number().int().positive(),
          valor_por_saca: z.coerce.number().min(0).max(999_999),
        }),
      )
      .max(10_000)
      .default([]),
  }),
}

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

      data_saida: z.preprocess((v) => normalizeDateToYMD(emptyToNull(v)), z.string().nullable().optional()).refine(
        (v) => v == null || isValidDateYMD(v),
        'data_saida invalida (YYYY-MM-DD)',
      ),
      hora_saida: z.preprocess(emptyToNull, z.string().nullable().optional()).refine(
        (v) => v == null || /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
        'hora_saida invalida (HH:MM)',
      ),
      data_entrega: z.preprocess((v) => normalizeDateToYMD(emptyToNull(v)), z.string().nullable().optional()).refine(
        (v) => v == null || isValidDateYMD(v),
        'data_entrega invalida (YYYY-MM-DD)',
      ),
      hora_entrega: z.preprocess(emptyToNull, z.string().nullable().optional()).refine(
        (v) => v == null || /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
        'hora_entrega invalida (HH:MM)',
      ),

      carga_total_kg: z.coerce.number().min(0).max(500_000),
      tara_kg: z.coerce.number().min(0).max(500_000),

      // Custos em sacas (controle fisico; opcional)
      custo_frete_sacas: z.preprocess(emptyToNull, z.union([z.coerce.number().min(0).max(1_000_000), z.null()])).optional(),
      custo_secagem_sacas: z.preprocess(emptyToNull, z.union([z.coerce.number().min(0).max(1_000_000), z.null()])).optional(),
      custo_silo_sacas: z.preprocess(emptyToNull, z.union([z.coerce.number().min(0).max(1_000_000), z.null()])).optional(),
      custo_terceiros_sacas: z.preprocess(emptyToNull, z.union([z.coerce.number().min(0).max(1_000_000), z.null()])).optional(),
      custo_outros_sacas: z.preprocess(emptyToNull, z.union([z.coerce.number().min(0).max(1_000_000), z.null()])).optional(),

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

export const UsersSchemas = {
  CreateBody: z.object({
    username: z.string().trim().min(3).max(MAX.username),
    email: z.preprocess(emptyToNull, z.string().trim().email().max(254).nullable().optional()),
    nome: z.preprocess(emptyToNull, z.string().trim().max(MAX.name).nullable().optional()),
    role: z
      .string()
      .trim()
      .transform((v) => v.toLowerCase())
      .refine((v) => Object.values(Roles).includes(v), 'role invalido'),
    motorista_id: z.coerce.number().int().positive().optional().nullable(),
    menus: z
      .array(z.string().trim().min(1).max(60))
      .optional()
      .nullable()
      .refine(
        (arr) => !arr || arr.every((m) => Object.values(Menus).includes(m)),
        'menus invalidos',
      ),
    password: z.string().min(8).max(MAX.password),
  }).superRefine((v, ctx) => {
    const e = v.email || null
    if (!e) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'email obrigatorio', path: ['email'] })
    }
  }),
  UpdateBody: z.object({
    username: z.string().trim().min(3).max(MAX.username),
    email: z.preprocess(emptyToNull, z.string().trim().email().max(254).nullable().optional()),
    nome: z.preprocess(emptyToNull, z.string().trim().max(MAX.name).nullable().optional()),
    role: z
      .string()
      .trim()
      .transform((v) => v.toLowerCase())
      .refine((v) => Object.values(Roles).includes(v), 'role invalido'),
    motorista_id: z.coerce.number().int().positive().optional().nullable(),
    menus: z
      .array(z.string().trim().min(1).max(60))
      .optional()
      .nullable()
      .refine(
        (arr) => !arr || arr.every((m) => Object.values(Menus).includes(m)),
        'menus invalidos',
      ),
    active: z.coerce.boolean().optional().default(true),
  }).superRefine((v, ctx) => {
    // Keep backwards-compat for existing records, but require email for active users.
    const e = v.email || null
    if (v.active && !e) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'email obrigatorio', path: ['email'] })
    }
  }),
  PasswordBody: z.object({
    password: z.string().min(8).max(MAX.password),
  }),
}

export const TiposPlantioSchemas = {
  Body: z.object({
    nome: z.string().trim().min(1).max(MAX.short),
  }),
}

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
      const sum = (v.participantes || []).reduce((acc, p) => acc + Number(p.percentual_producao || 0), 0)
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
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'destino_id obrigatorio', path: ['destino_id'] })
      }
      if (v.comprador_tipo === 'terceiro' && !v.terceiro_nome) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'nome do terceiro obrigatorio', path: ['terceiro_nome'] })
      }
    }),

  CustoLancamentoBody: z
    .object({
      safra_id: z.coerce.number().int().positive(),
      talhao_id: z.coerce.number().int().positive(),
      data_ref: z.preprocess((v) => emptyToNull(v), z.union([S.DateYMD, z.null()])).optional(),
      custo_tipo: z.string().trim().min(1).max(40),
      valor_rs: z.preprocess(emptyToNull, z.union([z.coerce.number().min(0).max(9_999_999), z.null()])).optional(),
      valor_sacas: z.preprocess(emptyToNull, z.union([z.coerce.number().min(0).max(1_000_000), z.null()])).optional(),
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

export const TalhaoSafraSchemas = {
  ListQuery: z.object({ safra_id: z.coerce.number().int().positive() }),
  UpsertBody: z.object({
    safra_id: z.coerce.number().int().positive(),
    talhao_id: z.coerce.number().int().positive(),
    pct_area_colhida: z.coerce.number().min(0).max(1),
  }),
}

export const QuitacoesSchemas = {
  ResumoQuery: z.object({
    de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  CreateBody: z.object({
    motorista_id: z.coerce.number().int().positive(),
    de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    data_pagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    valor: z.coerce.number().positive().max(9_999_999),
    forma_pagamento: z.preprocess(emptyToNull, z.string().trim().max(60).nullable().optional()),
    observacoes: S.OptNotes,
  }),
}

export const PublicSchemas = {
  ResumoQuery: z.object({
    safra_id: z.coerce.number().int().positive().optional(),
    de: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    ate: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  }),
}

export const DestinoRegrasSchemas = {
  ListQuery: z.object({
    safra_id: z.coerce.number().int().positive(),
  }),
  ListPlantioQuery: z.object({
    safra_id: z.coerce.number().int().positive().optional(),
  }),
  DeletePlantioQuery: z.object({
    force: z.coerce.number().int().min(0).max(1).optional(),
  }),
  UpsertBody: z.object({
    safra_id: z.coerce.number().int().positive(),
    destino_id: z.coerce.number().int().positive(),
    tipo_plantio: z.string().trim().min(1).max(MAX.short),

    custo_silo_por_saca: z.coerce.number().min(0).max(999_999).optional().nullable(),
    custo_terceiros_por_saca: z.coerce.number().min(0).max(999_999).optional().nullable(),

    impureza_limite_pct: S.Percent100.optional().nullable(),
    ardidos_limite_pct: S.Percent100.optional().nullable(),
    queimados_limite_pct: S.Percent100.optional().nullable(),
    avariados_limite_pct: S.Percent100.optional().nullable(),
    esverdiados_limite_pct: S.Percent100.optional().nullable(),
    quebrados_limite_pct: S.Percent100.optional().nullable(),

    umidade_faixas: z
      .array(
        z.object({
          umid_gt: S.Percent100,
          umid_lte: S.Percent100,
          desconto_pct: S.Percent100,
          custo_secagem_por_saca: z.coerce.number().min(0).max(999_999).optional(),
        }),
      )
      .max(500)
      .optional(),
  }),
  GetQuery: z.object({
    safra_id: z.coerce.number().int().positive(),
    destino_id: z.coerce.number().int().positive(),
    tipo_plantio: z.string().trim().min(1).max(MAX.short),
  }),
}

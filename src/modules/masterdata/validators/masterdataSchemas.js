import {
  z,
  MAX,
  S,
  emptyToNull,
  emptyToUndefined,
  isValidDateYMD,
  normalizeDateToYMD,
} from '../../../validation/schemaPrimitives.js'

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
    geometry_geojson: z.unknown().optional().nullable(),
    geometry_props_json: z.unknown().optional().nullable(),
    geometry_source_name: z.preprocess(emptyToNull, z.string().trim().max(255).nullable().optional()),
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
  BulkDeleteSafraBody: z.object({
    safra_id: z.coerce.number().int().positive(),
    items: z
      .array(
        z.object({
          motorista_id: z.coerce.number().int().positive(),
          destino_id: z.coerce.number().int().positive(),
        }),
      )
      .max(10_000)
      .default([]),
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
  BulkSaveBody: z.object({
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
    delete_items: z
      .array(
        z.object({
          motorista_id: z.coerce.number().int().positive(),
          destino_id: z.coerce.number().int().positive(),
        }),
      )
      .max(10_000)
      .default([]),
  }),
}

export const TiposPlantioSchemas = {
  Body: z.object({
    nome: z.string().trim().min(1).max(MAX.short),
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

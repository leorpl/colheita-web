import { z, MAX, S, emptyToNull } from '../../../validation/schemaPrimitives.js'
import { Roles, Menus } from '../../../auth/permissions.js'

export { S }

export const UsersSchemas = {
  CreateBody: z
    .object({
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
        .refine((arr) => !arr || arr.every((m) => Object.values(Menus).includes(m)), 'menus invalidos'),
      password: z.string().min(8).max(MAX.password),
    })
    .superRefine((v, ctx) => {
      const e = v.email || null
      if (!e) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'email obrigatorio',
          path: ['email'],
        })
      }
    }),

  UpdateBody: z
    .object({
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
        .refine((arr) => !arr || arr.every((m) => Object.values(Menus).includes(m)), 'menus invalidos'),
      active: z.coerce.boolean().optional().default(true),
    })
    .superRefine((v, ctx) => {
      // Keep backwards-compat for existing records, but require email for active users.
      const e = v.email || null
      if (v.active && !e) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'email obrigatorio',
          path: ['email'],
        })
      }
    }),

  PasswordBody: z.object({
    password: z.string().min(8).max(MAX.password),
  }),
}

export const CreateBody = UsersSchemas.CreateBody
export const UpdateBody = UsersSchemas.UpdateBody
export const PasswordBody = UsersSchemas.PasswordBody

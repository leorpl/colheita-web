import { z, MAX } from '../../../validation/schemaPrimitives.js'

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

export const LoginBody = AuthSchemas.LoginBody
export const ForgotBody = AuthSchemas.ForgotBody
export const ResetBody = AuthSchemas.ResetBody

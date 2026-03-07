import { z } from 'zod'

export const PrefRow = z.object({
  module: z.string().trim().min(1).max(60),
  notify_create: z.coerce.boolean().optional().default(false),
  notify_update: z.coerce.boolean().optional().default(false),
  notify_delete: z.coerce.boolean().optional().default(false),
  notify_status_change: z.coerce.boolean().optional().default(false),
  notify_security_events: z.coerce.boolean().optional().default(false),
  delivery_mode: z.string().trim().optional().default('immediate'),
})

export const UpdatePreferencesBody = z.object({
  prefs: z.array(PrefRow).max(200),
})

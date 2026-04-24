import { z } from 'zod';

export const KeyStatusSchema = z.enum(['active', 'disabled', 'revoked']);

export const KeyStatusResponseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: KeyStatusSchema,
  models: z.array(z.string()),
  rpm_limit: z.number().int().positive().nullable(),
  tpm_limit: z.number().int().positive().nullable(),
  daily_token_limit: z.number().int().positive().nullable(),
  daily_cost_limit: z.number().nonnegative().nullable(),
  used_tokens_today: z.number().int().nonnegative(),
  used_cost_today: z.number().nonnegative(),
  expires_at: z.string().datetime().nullable()
});

export type KeyStatus = z.infer<typeof KeyStatusSchema>;
export type KeyStatusResponse = z.infer<typeof KeyStatusResponseSchema>;

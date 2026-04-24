import { z } from 'zod';

export const GatewayErrorCodeSchema = z.enum([
  'AUTH_ERROR',
  'KEY_DISABLED',
  'KEY_EXPIRED',
  'MODEL_NOT_ALLOWED',
  'MODEL_NOT_FOUND',
  'RATE_LIMITED',
  'BUDGET_EXCEEDED',
  'CONTEXT_TOO_LONG',
  'UPSTREAM_AUTH_ERROR',
  'UPSTREAM_RATE_LIMITED',
  'UPSTREAM_TIMEOUT',
  'UPSTREAM_UNAVAILABLE',
  'UPSTREAM_BAD_RESPONSE'
]);

export const GatewayErrorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string(),
    code: GatewayErrorCodeSchema
  })
});

export type GatewayErrorCode = z.infer<typeof GatewayErrorCodeSchema>;
export type GatewayErrorResponse = z.infer<typeof GatewayErrorResponseSchema>;

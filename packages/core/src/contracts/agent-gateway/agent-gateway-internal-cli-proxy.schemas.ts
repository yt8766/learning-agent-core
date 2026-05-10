import { z } from 'zod';
import { GatewayQuotaStatusSchema } from './agent-gateway.schemas';

export const GatewayClientStatusSchema = z.enum(['active', 'disabled', 'suspended']);
export const GatewayClientSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  ownerEmail: z.string().email().optional(),
  status: GatewayClientStatusSchema,
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string()
});
export const GatewayClientListResponseSchema = z.object({ items: z.array(GatewayClientSchema) });
export const GatewayCreateClientRequestSchema = GatewayClientSchema.pick({
  name: true,
  description: true,
  ownerEmail: true,
  tags: true
}).partial({ description: true, ownerEmail: true, tags: true });
export const GatewayUpdateClientRequestSchema = GatewayCreateClientRequestSchema.partial().extend({
  status: GatewayClientStatusSchema.optional()
});

export const GatewayClientApiKeyStatusSchema = z.enum(['active', 'disabled', 'revoked']);
export const GatewayClientApiKeyScopeSchema = z.enum(['chat.completions', 'models.read']);
export const GatewayClientApiKeySchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  name: z.string().min(1),
  prefix: z.string().min(1),
  status: GatewayClientApiKeyStatusSchema,
  scopes: z.array(GatewayClientApiKeyScopeSchema),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  lastUsedAt: z.string().nullable()
});
export const GatewayClientApiKeyListResponseSchema = z.object({ items: z.array(GatewayClientApiKeySchema) });
export const GatewayCreateClientApiKeyRequestSchema = z.object({
  name: z.string().min(1),
  scopes: z.array(GatewayClientApiKeyScopeSchema).default(['models.read', 'chat.completions']),
  expiresAt: z.string().nullable().optional()
});
export const GatewayUpdateClientApiKeyRequestSchema = z.object({
  name: z.string().min(1).optional(),
  status: GatewayClientApiKeyStatusSchema.optional(),
  scopes: z.array(GatewayClientApiKeyScopeSchema).optional(),
  expiresAt: z.string().nullable().optional()
});
export const GatewayCreateClientApiKeyResponseSchema = z.object({
  apiKey: GatewayClientApiKeySchema,
  secret: z.string().min(1)
});

export const GatewayClientQuotaSchema = z.object({
  clientId: z.string().min(1),
  period: z.literal('monthly'),
  tokenLimit: z.number().int().positive(),
  requestLimit: z.number().int().positive(),
  usedTokens: z.number().int().nonnegative(),
  usedRequests: z.number().int().nonnegative(),
  resetAt: z.string(),
  status: GatewayQuotaStatusSchema
});
export const GatewayUpdateClientQuotaRequestSchema = GatewayClientQuotaSchema.pick({
  tokenLimit: true,
  requestLimit: true,
  resetAt: true
});
export const GatewayClientUsageSummarySchema = z.object({
  clientId: z.string().min(1),
  window: z.literal('current-period'),
  requestCount: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
  lastRequestAt: z.string().nullable()
});
export const GatewayClientRequestLogSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  apiKeyId: z.string().min(1),
  occurredAt: z.string(),
  endpoint: z.enum(['/v1/models', '/v1/chat/completions']),
  model: z.string().nullable(),
  providerId: z.string().nullable(),
  statusCode: z.number().int(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  latencyMs: z.number().nonnegative(),
  errorCode: z.string().optional()
});
export const GatewayClientRequestLogListResponseSchema = z.object({ items: z.array(GatewayClientRequestLogSchema) });

export const GatewayOpenAIChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string()
});
export const GatewayOpenAIChatCompletionRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(GatewayOpenAIChatMessageSchema).min(1),
  stream: z.boolean().optional(),
  temperature: z.number().optional(),
  max_tokens: z.number().int().positive().optional()
});
export const GatewayOpenAIChatCompletionResponseSchema = z.object({
  id: z.string().min(1),
  object: z.literal('chat.completion'),
  created: z.number().int(),
  model: z.string().min(1),
  choices: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      message: z.object({ role: z.literal('assistant'), content: z.string() }),
      finish_reason: z.enum(['stop', 'length', 'error'])
    })
  ),
  usage: z.object({
    prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative(),
    total_tokens: z.number().int().nonnegative()
  })
});
export const GatewayOpenAIModelSchema = z.object({
  id: z.string().min(1),
  object: z.literal('model'),
  created: z.number().int(),
  owned_by: z.string().min(1)
});
export const GatewayOpenAIModelsResponseSchema = z.object({
  object: z.literal('list'),
  data: z.array(GatewayOpenAIModelSchema)
});
export const GatewayOpenAICompatibleErrorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.enum([
      'invalid_request_error',
      'authentication_error',
      'permission_error',
      'rate_limit_error',
      'api_error'
    ]),
    code: z.string()
  })
});

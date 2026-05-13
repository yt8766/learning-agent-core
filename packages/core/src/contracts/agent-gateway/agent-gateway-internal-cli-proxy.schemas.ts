import { z } from 'zod';
import { GatewayQuotaStatusSchema } from './agent-gateway.schemas';
import { GatewayRuntimeProviderKindSchema } from './agent-gateway-runtime-health.schemas';

export const GatewayClientStatusSchema = z.enum(['active', 'disabled', 'suspended']);
export const GatewayClientSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    ownerEmail: z.string().email().optional(),
    status: GatewayClientStatusSchema,
    tags: z.array(z.string()),
    createdAt: z.string(),
    updatedAt: z.string()
  })
  .strict();
export const GatewayClientListResponseSchema = z.object({ items: z.array(GatewayClientSchema) }).strict();
export const GatewayCreateClientRequestSchema = GatewayClientSchema.pick({
  name: true,
  description: true,
  ownerEmail: true,
  tags: true
})
  .partial({ description: true, ownerEmail: true, tags: true })
  .strict();
export const GatewayUpdateClientRequestSchema = GatewayCreateClientRequestSchema.partial()
  .extend({
    status: GatewayClientStatusSchema.optional()
  })
  .strict();

export const GatewayClientApiKeyStatusSchema = z.enum(['active', 'disabled', 'revoked']);
export const GatewayClientApiKeyScopeSchema = z.enum(['chat.completions', 'models.read']);
export const GatewayClientApiKeySchema = z
  .object({
    id: z.string().min(1),
    clientId: z.string().min(1),
    name: z.string().min(1),
    prefix: z.string().min(1),
    status: GatewayClientApiKeyStatusSchema,
    scopes: z.array(GatewayClientApiKeyScopeSchema),
    createdAt: z.string(),
    expiresAt: z.string().nullable(),
    lastUsedAt: z.string().nullable()
  })
  .strict();
export const GatewayClientApiKeyListResponseSchema = z.object({ items: z.array(GatewayClientApiKeySchema) }).strict();
export const GatewayCreateClientApiKeyRequestSchema = z
  .object({
    name: z.string().min(1),
    scopes: z.array(GatewayClientApiKeyScopeSchema).default(['models.read', 'chat.completions']),
    expiresAt: z.string().nullable().optional()
  })
  .strict();
export const GatewayUpdateClientApiKeyRequestSchema = z
  .object({
    name: z.string().min(1).optional(),
    status: GatewayClientApiKeyStatusSchema.optional(),
    scopes: z.array(GatewayClientApiKeyScopeSchema).optional(),
    expiresAt: z.string().nullable().optional()
  })
  .strict();
export const GatewayCreateClientApiKeyResponseSchema = z
  .object({
    apiKey: GatewayClientApiKeySchema,
    secret: z.string().min(1)
  })
  .strict();

export const GatewayClientQuotaSchema = z
  .object({
    clientId: z.string().min(1),
    period: z.literal('monthly'),
    tokenLimit: z.number().int().positive(),
    requestLimit: z.number().int().positive(),
    usedTokens: z.number().int().nonnegative(),
    usedRequests: z.number().int().nonnegative(),
    resetAt: z.string(),
    status: GatewayQuotaStatusSchema
  })
  .strict();
export const GatewayUpdateClientQuotaRequestSchema = GatewayClientQuotaSchema.pick({
  tokenLimit: true,
  requestLimit: true,
  resetAt: true
}).strict();
export const GatewayClientUsageSummarySchema = z
  .object({
    clientId: z.string().min(1),
    window: z.literal('current-period'),
    requestCount: z.number().int().nonnegative(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
    estimatedCostUsd: z.number().nonnegative(),
    lastRequestAt: z.string().nullable()
  })
  .strict();
export const GatewayClientRequestLogSchema = z
  .object({
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
  })
  .strict();
export const GatewayClientRequestLogListResponseSchema = z
  .object({ items: z.array(GatewayClientRequestLogSchema) })
  .strict();

export const GatewayOpenAIChatMessageSchema = z
  .object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.string()
  })
  .strict();
export const GatewayOpenAIChatCompletionRequestSchema = z
  .object({
    model: z.string().min(1),
    messages: z.array(GatewayOpenAIChatMessageSchema).min(1),
    stream: z.boolean().optional(),
    temperature: z.number().optional(),
    max_tokens: z.number().int().positive().optional()
  })
  .strict();
export const GatewayOpenAIChatCompletionResponseSchema = z
  .object({
    id: z.string().min(1),
    object: z.literal('chat.completion'),
    created: z.number().int(),
    model: z.string().min(1),
    choices: z.array(
      z
        .object({
          index: z.number().int().nonnegative(),
          message: z.object({ role: z.literal('assistant'), content: z.string() }).strict(),
          finish_reason: z.enum(['stop', 'length', 'error'])
        })
        .strict()
    ),
    usage: z
      .object({
        prompt_tokens: z.number().int().nonnegative(),
        completion_tokens: z.number().int().nonnegative(),
        total_tokens: z.number().int().nonnegative()
      })
      .strict()
  })
  .strict();
export const GatewayOpenAIModelSchema = z
  .object({ id: z.string().min(1), object: z.literal('model'), created: z.number().int(), owned_by: z.string().min(1) })
  .strict();
export const GatewayOpenAIModelsResponseSchema = z
  .object({ object: z.literal('list'), data: z.array(GatewayOpenAIModelSchema) })
  .strict();
export const GatewayOpenAICompatibleErrorResponseSchema = z
  .object({
    error: z
      .object({
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
      .strict()
  })
  .strict();

export const GatewayRuntimeProtocolSchema = z.enum([
  'openai.chat.completions',
  'openai.responses',
  'claude.messages',
  'gemini.generateContent'
]);

export const GatewayRuntimeMessageContentPartSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }).strict(),
  z.object({ type: z.literal('imageUrl'), imageUrl: z.string() }).strict()
]);

export const GatewayRuntimeMessageSchema = z
  .object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.array(GatewayRuntimeMessageContentPartSchema)
  })
  .strict();

export const GatewayRuntimeInvocationSchema = z
  .object({
    id: z.string().min(1),
    protocol: GatewayRuntimeProtocolSchema,
    model: z.string().min(1),
    stream: z.boolean(),
    messages: z.array(GatewayRuntimeMessageSchema),
    requestedAt: z.string().min(1),
    client: z
      .object({ clientId: z.string().min(1), apiKeyId: z.string().min(1), scopes: z.array(z.string().min(1)) })
      .strict(),
    metadata: z.object({ userId: z.string().optional(), sessionId: z.string().optional() }).strict().default({})
  })
  .strict();

export const GatewayRuntimeRouteDecisionSchema = z
  .object({
    invocationId: z.string().min(1),
    providerKind: GatewayRuntimeProviderKindSchema,
    credentialId: z.string().min(1),
    authIndex: z.string().optional(),
    model: z.string().min(1),
    strategy: z.enum(['round-robin', 'fill-first', 'session-affinity']),
    reason: z.string().min(1),
    decidedAt: z.string().min(1)
  })
  .strict();

export const GatewayRuntimeStreamEventSchema = z.discriminatedUnion('type', [
  z
    .object({
      invocationId: z.string().min(1),
      type: z.literal('delta'),
      sequence: z.number().int().nonnegative(),
      createdAt: z.string().min(1),
      delta: z.object({ text: z.string().default('') }).strict()
    })
    .strict(),
  z
    .object({
      invocationId: z.string().min(1),
      type: z.literal('usage'),
      sequence: z.number().int().nonnegative(),
      createdAt: z.string().min(1),
      usage: z
        .object({
          inputTokens: z.number().int().nonnegative(),
          outputTokens: z.number().int().nonnegative(),
          totalTokens: z.number().int().nonnegative()
        })
        .strict()
    })
    .strict(),
  z
    .object({
      invocationId: z.string().min(1),
      type: z.literal('done'),
      sequence: z.number().int().nonnegative(),
      createdAt: z.string().min(1)
    })
    .strict()
]);

export const GatewayRuntimeErrorSchema = z
  .object({ code: z.string().min(1), type: z.string().min(1), message: z.string().min(1), retryable: z.boolean() })
  .strict();

export {
  GatewayRuntimeCooldownHealthSchema,
  GatewayRuntimeExecutorHealthSchema,
  GatewayRuntimeHealthResponseSchema,
  GatewayRuntimeProviderKindSchema,
  GatewayRuntimeUsageQueueHealthSchema
} from './agent-gateway-runtime-health.schemas';

export const GatewayRuntimeQuotaPolicySchema = z
  .object({
    subjectType: z.enum(['user', 'client', 'apiKey']),
    subjectId: z.string().min(1),
    window: z.enum(['daily', 'monthly', 'rolling']),
    maxTokens: z.number().int().positive().optional(),
    maxRequests: z.number().int().positive().optional(),
    providerKinds: z.array(GatewayRuntimeProviderKindSchema).optional(),
    models: z.array(z.string().min(1)).optional(),
    action: z.enum(['deny', 'warn', 'fallback'])
  })
  .strict();

export const GatewayRuntimeExecutorAdapterKindSchema = z.enum(['deterministic', 'http', 'process', 'native-ts']);

export const GatewayRuntimeExecutorConfigSchema = z
  .object({
    id: z.string().min(1).optional(),
    providerKind: GatewayRuntimeProviderKindSchema,
    enabled: z.boolean(),
    adapterKind: GatewayRuntimeExecutorAdapterKindSchema,
    commandProfile: z.string().min(1).optional(),
    baseUrl: z.string().url().optional(),
    secretRef: z.string().min(1).optional(),
    timeoutMs: z.number().int().positive().optional(),
    concurrencyLimit: z.number().int().positive().optional(),
    modelAliases: z.record(z.string(), z.string()).default({}),
    updatedAt: z.string().min(1).optional()
  })
  .strict();

export const GatewayOAuthCredentialRecordSchema = z
  .object({
    id: z.string().min(1),
    providerKind: GatewayRuntimeProviderKindSchema,
    authFileId: z.string().min(1),
    accountEmail: z.string().email().nullable(),
    projectId: z.string().min(1).nullable(),
    status: z.enum(['pending', 'valid', 'expired', 'revoked', 'error']),
    secretRef: z.string().min(1),
    scopes: z.array(z.string().min(1)),
    expiresAt: z.string().nullable(),
    updatedAt: z.string().min(1),
    lastCheckedAt: z.string().nullable()
  })
  .strict();

export const GatewayProviderQuotaSnapshotSchema = z
  .object({
    id: z.string().min(1),
    providerKind: GatewayRuntimeProviderKindSchema,
    authFileId: z.string().min(1),
    accountEmail: z.string().email().nullable().optional(),
    model: z.string().min(1).nullable().optional(),
    scope: z.enum(['account', 'project', 'model', 'apiKey']),
    window: z.enum(['5h', 'daily', 'weekly', 'monthly', 'rolling']),
    limit: z.number().nonnegative().nullable(),
    used: z.number().nonnegative(),
    remaining: z.number().nonnegative().nullable(),
    resetAt: z.string().nullable(),
    refreshedAt: z.string().min(1),
    status: z.enum(['normal', 'warning', 'exceeded', 'unknown', 'error']),
    source: z.enum(['provider', 'authFile', 'runtime', 'import'])
  })
  .strict();

export {
  GatewayMigrationApplyFailureSchema,
  GatewayMigrationApplyItemSchema,
  GatewayMigrationApplyResponseSchema,
  GatewayMigrationConflictSchema,
  GatewayMigrationPreviewSchema,
  GatewayMigrationResourceActionSchema,
  GatewayMigrationResourceKindSchema,
  GatewayMigrationResourcePreviewSchema
} from './agent-gateway-migration.schemas';

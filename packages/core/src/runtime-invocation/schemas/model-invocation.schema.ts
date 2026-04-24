import { z } from 'zod/v4';

const InvocationMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1)
});

const BudgetDecisionAllowSchema = z
  .object({
    status: z.literal('allow'),
    estimatedInputTokens: z.number().int().nonnegative()
  })
  .strict();

const BudgetDecisionFallbackSchema = z
  .object({
    status: z.literal('fallback'),
    estimatedInputTokens: z.number().int().nonnegative(),
    fallbackModelId: z.string().min(1)
  })
  .strict();

const BudgetDecisionDenySchema = z
  .object({
    status: z.literal('deny'),
    estimatedInputTokens: z.number().int().nonnegative()
  })
  .strict();

const CacheDecisionHitSchema = z
  .object({
    status: z.literal('hit'),
    cacheKey: z.string().min(1),
    cachedText: z.string().min(1)
  })
  .strict();

const CacheDecisionMissSchema = z
  .object({
    status: z.literal('miss'),
    cacheKey: z.string().min(1).optional(),
    cachedText: z.string().min(1).optional()
  })
  .strict();

const CacheDecisionBypassSchema = z
  .object({
    status: z.literal('bypass'),
    cacheKey: z.string().min(1).optional(),
    cachedText: z.string().min(1).optional()
  })
  .strict();

const FinalOutputTextSchema = z
  .object({
    kind: z.literal('text'),
    text: z.string().min(1)
  })
  .strict();

const FinalOutputObjectSchema = z
  .object({
    kind: z.literal('object'),
    object: z.record(z.string(), z.unknown())
  })
  .strict();

export const CapabilityInjectionPlanSchema = z.object({
  selectedSkills: z.array(z.string()).default([]),
  selectedTools: z.array(z.string()).default([]),
  selectedMcpCapabilities: z.array(z.string()).default([]),
  rejectedCandidates: z.array(z.string()).default([]),
  reasons: z.array(z.string()).default([]),
  riskFlags: z.array(z.string()).default([])
});

export const ModelInvocationRequestSchema = z.object({
  invocationId: z.string().min(1),
  taskId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  modeProfile: z.enum(['direct-reply', 'runtime-task']),
  stage: z.string().min(1),
  messages: z.array(InvocationMessageSchema).min(1),
  requestedModelId: z.string().min(1).optional(),
  contextHints: z.record(z.string(), z.unknown()).default({}),
  capabilityHints: z.record(z.string(), z.unknown()).default({}),
  budgetSnapshot: z.object({
    costConsumedCny: z.number().nonnegative().optional(),
    costConsumedUsd: z.number().nonnegative().optional(),
    costBudgetUsd: z.number().nonnegative().optional(),
    tokenConsumed: z.number().int().nonnegative().optional(),
    tokenBudget: z.number().int().nonnegative().optional(),
    fallbackModelId: z.string().min(1).optional()
  }),
  traceContext: z.record(z.string(), z.unknown()).default({})
});

export const PreprocessDecisionSchema = z
  .object({
    allowExecution: z.boolean(),
    denyReason: z.string().min(1).optional(),
    resolvedModelId: z.string().min(1),
    resolvedMessages: z.array(InvocationMessageSchema),
    budgetDecision: z.discriminatedUnion('status', [
      BudgetDecisionAllowSchema,
      BudgetDecisionFallbackSchema,
      BudgetDecisionDenySchema
    ]),
    capabilityInjectionPlan: CapabilityInjectionPlanSchema,
    cacheDecision: z.discriminatedUnion('status', [
      CacheDecisionHitSchema,
      CacheDecisionMissSchema,
      CacheDecisionBypassSchema
    ]),
    traceMeta: z.record(z.string(), z.unknown()).default({})
  })
  .superRefine((decision, ctx) => {
    if (!decision.allowExecution && !decision.denyReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['denyReason'],
        message: 'denyReason is required when allowExecution is false'
      });
    }
  });

export const ModelInvocationResultSchema = z.object({
  finalOutput: z.discriminatedUnion('kind', [FinalOutputTextSchema, FinalOutputObjectSchema]),
  invocationRecordId: z.string().min(1),
  taskUsageSnapshot: z.record(z.string(), z.unknown()).optional(),
  traceSummary: z.record(z.string(), z.unknown()).default({}),
  deliveryMeta: z.record(z.string(), z.unknown()).default({})
});

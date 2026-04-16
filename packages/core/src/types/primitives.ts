import { z } from 'zod';

export const QueueStateRecordSchema = z.object({
  mode: z.enum(['foreground', 'background']),
  backgroundRun: z.boolean(),
  status: z.enum(['queued', 'running', 'waiting_approval', 'blocked', 'completed', 'failed', 'cancelled']),
  enqueuedAt: z.string(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  lastTransitionAt: z.string(),
  attempt: z.number(),
  leaseOwner: z.string().optional(),
  leaseExpiresAt: z.string().optional(),
  lastHeartbeatAt: z.string().optional()
});

export type QueueStateRecord = z.infer<typeof QueueStateRecordSchema>;

export const LlmUsageModelRecordSchema = z.object({
  model: z.string(),
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
  costUsd: z.number().optional(),
  costCny: z.number().optional(),
  pricingSource: z.enum(['provider', 'estimated']).optional(),
  callCount: z.number()
});

export type LlmUsageModelRecord = z.infer<typeof LlmUsageModelRecordSchema>;

export const LlmUsageRecordSchema = z.object({
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
  estimated: z.boolean(),
  measuredCallCount: z.number(),
  estimatedCallCount: z.number(),
  models: z.array(LlmUsageModelRecordSchema),
  updatedAt: z.string()
});

export type LlmUsageRecord = z.infer<typeof LlmUsageRecordSchema>;

export const ModelRouteDecisionSchema = z.object({
  ministry: z.string(),
  workerId: z.string(),
  defaultModel: z.string(),
  selectedModel: z.string(),
  reason: z.string()
});

export type ModelRouteDecision = z.infer<typeof ModelRouteDecisionSchema>;

export const PendingActionRecordSchema = z.object({
  toolName: z.string(),
  intent: z.string(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  requestedBy: z.string()
});

export type PendingActionRecord = z.infer<typeof PendingActionRecordSchema>;

export const PendingApprovalRecordSchema = PendingActionRecordSchema.extend({
  reason: z.string().optional(),
  reasonCode: z.string().optional(),
  feedback: z.string().optional(),
  serverId: z.string().optional(),
  capabilityId: z.string().optional(),
  preview: z.array(z.object({ label: z.string(), value: z.string() })).optional()
});

export type PendingApprovalRecord = z.infer<typeof PendingApprovalRecordSchema>;

export const WorkflowPresetDefinitionSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  command: z.string().optional(),
  version: z.string().optional(),
  intentPatterns: z.array(z.string()),
  requiredMinistries: z.array(z.string()),
  allowedCapabilities: z.array(z.string()),
  approvalPolicy: z.string(),
  webLearningPolicy: z
    .object({
      enabled: z.boolean(),
      preferredSourceTypes: z.array(z.string()),
      acceptedTrustClasses: z.array(z.string())
    })
    .optional(),
  sourcePolicy: z
    .object({
      mode: z.string(),
      preferredUrls: z.array(z.string()).optional()
    })
    .optional(),
  autoPersistPolicy: z
    .object({
      memory: z.enum(['manual', 'high-confidence']),
      rule: z.enum(['manual', 'suggest']),
      skill: z.enum(['manual', 'suggest'])
    })
    .optional(),
  outputContract: z.object({
    type: z.string(),
    requiredSections: z.array(z.string())
  })
});

export type WorkflowPresetDefinition = z.infer<typeof WorkflowPresetDefinitionSchema>;

export const ExecutionStepRecordSchema = z.object({
  id: z.string(),
  route: z.enum(['direct-reply', 'research-first', 'workflow-execute', 'approval-recovery']),
  stage: z.enum([
    'request-received',
    'route-selection',
    'task-planning',
    'research',
    'execution',
    'review',
    'delivery',
    'approval-interrupt',
    'recovery'
  ]),
  label: z.string(),
  owner: z.enum(['session', 'libu', 'hubu', 'gongbu', 'bingbu', 'xingbu', 'libu-docs', 'system']),
  status: z.enum(['pending', 'running', 'completed', 'blocked']),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  detail: z.string().optional(),
  reason: z.string().optional()
});

export type ExecutionStepRecord = z.infer<typeof ExecutionStepRecordSchema>;

export const ChatRouteRecordSchema = z.object({
  graph: z.enum(['workflow', 'approval-recovery', 'learning']),
  flow: z.enum(['supervisor', 'approval', 'learning', 'direct-reply']),
  reason: z.string(),
  adapter: z.enum([
    'workflow-command',
    'approval-recovery',
    'identity-capability',
    'figma-design',
    'modification-intent',
    'general-prompt',
    'research-first',
    'plan-only',
    'readiness-fallback',
    'fallback'
  ]),
  priority: z.number(),
  intent: z.enum(['direct-reply', 'research-first', 'plan-only', 'workflow-execute', 'approval-recovery']).optional(),
  intentConfidence: z.number().optional(),
  executionReadiness: z
    .enum([
      'ready',
      'approval-required',
      'missing-capability',
      'missing-connector',
      'missing-workspace',
      'blocked-by-policy'
    ])
    .optional(),
  matchedSignals: z.array(z.string()).optional(),
  readinessReason: z.string().optional(),
  profileAdjustmentReason: z.string().optional(),
  preferredExecutionMode: z.enum(['direct-reply', 'plan-first', 'execute-first']).optional(),
  stepsSummary: z.array(ExecutionStepRecordSchema).optional()
});

export type ChatRouteRecord = z.infer<typeof ChatRouteRecordSchema>;

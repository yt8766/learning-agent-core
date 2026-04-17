import { z } from 'zod';

export const SkillStatusValues = ['draft', 'lab', 'stable', 'disabled'] as const;
export const SkillStatusSchema = z.enum(SkillStatusValues);

export const TaskStatus = {
  QUEUED: 'queued',
  RUNNING: 'running',
  WAITING_APPROVAL: 'waiting_approval',
  BLOCKED: 'blocked',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const;

export const TaskStatusSchema = z.enum([
  TaskStatus.QUEUED,
  TaskStatus.RUNNING,
  TaskStatus.WAITING_APPROVAL,
  TaskStatus.BLOCKED,
  TaskStatus.CANCELLED,
  TaskStatus.COMPLETED,
  TaskStatus.FAILED
]);

export const ActionIntent = {
  READ_FILE: 'read_file',
  WRITE_FILE: 'write_file',
  DELETE_FILE: 'delete_file',
  SCHEDULE_TASK: 'schedule_task',
  CALL_EXTERNAL_API: 'call_external_api',
  INSTALL_SKILL: 'install_skill',
  PUBLISH_SKILL: 'publish_skill',
  PROMOTE_SKILL: 'promote_skill',
  ENABLE_PLUGIN: 'enable_plugin',
  MODIFY_RULE: 'modify_rule'
} as const;

export const ActionIntentSchema = z.enum([
  ActionIntent.READ_FILE,
  ActionIntent.WRITE_FILE,
  ActionIntent.DELETE_FILE,
  ActionIntent.SCHEDULE_TASK,
  ActionIntent.CALL_EXTERNAL_API,
  ActionIntent.INSTALL_SKILL,
  ActionIntent.PUBLISH_SKILL,
  ActionIntent.PROMOTE_SKILL,
  ActionIntent.ENABLE_PLUGIN,
  ActionIntent.MODIFY_RULE
]);

export const ApprovalDecision = {
  APPROVED: 'approved',
  REJECTED: 'rejected'
} as const;

export const ApprovalDecisionSchema = z.enum([ApprovalDecision.APPROVED, ApprovalDecision.REJECTED]);
export const ApprovalStatusSchema = z.union([ApprovalDecisionSchema, z.literal('pending')]);
export const RiskLevelValues = ['low', 'medium', 'high', 'critical'] as const;
export const RiskLevelSchema = z.enum(RiskLevelValues);
export const LearningSourceTypeValues = ['execution', 'document', 'research'] as const;
export const LearningSourceTypeSchema = z.enum(LearningSourceTypeValues);
export const ReviewDecisionValues = ['approved', 'retry', 'blocked'] as const;
export const ReviewDecisionSchema = z.enum(ReviewDecisionValues);
export const TrustClassValues = ['official', 'curated', 'community', 'unverified', 'internal'] as const;
export const TrustClassSchema = z.enum(TrustClassValues);
export const ApprovalScopeValues = ['once', 'session', 'always'] as const;
export const ApprovalScopeSchema = z.enum(ApprovalScopeValues);
export const ChatRoleValues = ['user', 'assistant', 'system'] as const;
export const ChatRoleSchema = z.enum(ChatRoleValues);
export const ExecutionPlanModeValues = ['plan', 'execute', 'imperial_direct'] as const;
export const ExecutionPlanModeSchema = z.enum(ExecutionPlanModeValues);

export const QueueStateRecordSchema = z.object({
  mode: z.enum(['foreground', 'background']),
  backgroundRun: z.boolean(),
  status: TaskStatusSchema,
  enqueuedAt: z.string(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  lastTransitionAt: z.string(),
  attempt: z.number(),
  leaseOwner: z.string().optional(),
  leaseExpiresAt: z.string().optional(),
  lastHeartbeatAt: z.string().optional()
});

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

export const ModelRouteDecisionSchema = z.object({
  ministry: z.string(),
  workerId: z.string(),
  defaultModel: z.string(),
  selectedModel: z.string(),
  reason: z.string()
});

export const PendingActionRecordSchema = z.object({
  toolName: z.string(),
  intent: z.string(),
  riskLevel: RiskLevelSchema.optional(),
  requestedBy: z.string()
});

export const PendingApprovalRecordSchema = PendingActionRecordSchema.extend({
  reason: z.string().optional(),
  reasonCode: z.string().optional(),
  feedback: z.string().optional(),
  serverId: z.string().optional(),
  capabilityId: z.string().optional(),
  preview: z.array(z.object({ label: z.string(), value: z.string() })).optional()
});

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
      preferredSourceTypes: z.array(LearningSourceTypeSchema),
      acceptedTrustClasses: z.array(TrustClassSchema)
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

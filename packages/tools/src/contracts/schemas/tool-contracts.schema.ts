import { z } from 'zod/v4';

export const ToolKindSchema = z.enum(['agent', 'file', 'command']);
export const ToolRiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
export const ToolApprovalPolicySchema = z.enum(['never', 'on_demand', 'always']);
export const ToolActorSchema = z.enum(['human', 'supervisor', 'agent', 'system']);

const ToolContractBaseSchema = z
  .object({
    toolId: z.string().min(1),
    name: z.string().min(1),
    displayName: z.string().min(1).optional(),
    description: z.string().min(1),
    riskLevel: ToolRiskLevelSchema,
    approvalPolicy: ToolApprovalPolicySchema,
    inputSchemaRef: z.string().min(1).optional(),
    outputSchemaRef: z.string().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).default({})
  })
  .strict();

export const AgentToolContractSchema = ToolContractBaseSchema.extend({
  kind: z.literal('agent'),
  agentDomain: z.string().min(1),
  capabilities: z.array(z.string().min(1)).default([]),
  handoffPolicy: z.enum(['sync', 'async', 'approval_gated']).default('async')
}).strict();

export const FileToolOperationSchema = z.enum([
  'read',
  'write',
  'append',
  'delete',
  'list',
  'stat',
  'mkdir',
  'move',
  'copy'
]);

export const FileToolPathPolicySchema = z
  .object({
    workspaceRoot: z.string().min(1).optional(),
    allowedPaths: z.array(z.string().min(1)).default([]),
    deniedPaths: z.array(z.string().min(1)).default([]),
    allowOutsideWorkspace: z.boolean().default(false)
  })
  .strict();

export const FileToolContractSchema = ToolContractBaseSchema.extend({
  kind: z.literal('file'),
  operations: z.array(FileToolOperationSchema).min(1),
  pathPolicy: FileToolPathPolicySchema
}).strict();

export const SemanticCommandToolContractSchema = ToolContractBaseSchema.extend({
  kind: z.literal('command'),
  commandMode: z.literal('semantic'),
  semanticName: z.string().min(1),
  commandTemplate: z.string().min(1).optional(),
  allowedArguments: z.array(z.string().min(1)).default([])
}).strict();

export const RawCommandToolContractSchema = ToolContractBaseSchema.extend({
  kind: z.literal('command'),
  commandMode: z.literal('raw'),
  allowedCommands: z.array(z.string().min(1)).min(1),
  deniedCommands: z.array(z.string().min(1)).default([]),
  shell: z.string().min(1).optional()
}).strict();

export const CommandToolContractSchema = z.discriminatedUnion('commandMode', [
  SemanticCommandToolContractSchema,
  RawCommandToolContractSchema
]);

export const ToolContractSchema = z.discriminatedUnion('kind', [
  AgentToolContractSchema,
  FileToolContractSchema,
  CommandToolContractSchema
]);

export const SandboxModeSchema = z.enum(['read-only', 'workspace-write', 'danger-full-access']);
export const SandboxNetworkAccessSchema = z.enum(['disabled', 'restricted', 'enabled']);
export const SandboxStatusSchema = z.enum(['planned', 'running', 'succeeded', 'failed', 'cancelled']);

export const SandboxCommandPolicySchema = z
  .object({
    allowedCommands: z.array(z.string().min(1)).default([]),
    deniedCommands: z.array(z.string().min(1)).default([]),
    escalationRequired: z.boolean().default(false)
  })
  .strict();

export const SandboxPlanSchema = z
  .object({
    sandboxId: z.string().min(1),
    taskId: z.string().min(1).optional(),
    mode: SandboxModeSchema,
    writableRoots: z.array(z.string().min(1)).default([]),
    networkAccess: SandboxNetworkAccessSchema.default('restricted'),
    commandPolicy: SandboxCommandPolicySchema.default({
      allowedCommands: [],
      deniedCommands: [],
      escalationRequired: false
    }),
    expiresAt: z.string().min(1).optional(),
    createdAt: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).default({})
  })
  .strict();

export const SandboxArtifactSchema = z
  .object({
    artifactId: z.string().min(1),
    kind: z.enum(['log', 'file', 'diff', 'screenshot', 'trace']),
    uri: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).default({})
  })
  .strict();

export const SandboxResultSchema = z
  .object({
    sandboxId: z.string().min(1),
    status: SandboxStatusSchema.exclude(['planned']),
    startedAt: z.string().min(1).optional(),
    completedAt: z.string().min(1).optional(),
    exitCode: z.number().int().optional(),
    summary: z.string().min(1).optional(),
    artifacts: z.array(SandboxArtifactSchema).default([]),
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
        retryable: z.boolean().default(false)
      })
      .strict()
      .optional(),
    metadata: z.record(z.string(), z.unknown()).default({})
  })
  .strict();

export const AutoReviewFocusSchema = z.enum([
  'behavior_regression',
  'contract_compatibility',
  'security',
  'test_coverage',
  'maintainability'
]);

export const AutoReviewScopeSchema = z
  .object({
    changedFiles: z.array(z.string().min(1)).default([]),
    diffRefs: z.array(z.string().min(1)).default([]),
    notes: z.array(z.string().min(1)).default([])
  })
  .strict();

export const AutoReviewRequestSchema = z
  .object({
    reviewId: z.string().min(1),
    taskId: z.string().min(1).optional(),
    scope: AutoReviewScopeSchema,
    focus: z.array(AutoReviewFocusSchema).default([]),
    requestedBy: ToolActorSchema.optional(),
    requestedAt: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).default({})
  })
  .strict();

export const AutoReviewFindingSchema = z
  .object({
    findingId: z.string().min(1),
    severity: z.enum(['info', 'warning', 'error', 'blocker']),
    category: z.string().min(1),
    title: z.string().min(1),
    message: z.string().min(1),
    file: z.string().min(1).optional(),
    startLine: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional(),
    evidenceIds: z.array(z.string().min(1)).default([]),
    recommendation: z.string().min(1).optional()
  })
  .strict();

export const AutoReviewResultSchema = z
  .object({
    reviewId: z.string().min(1),
    sessionId: z.string().min(1).optional(),
    taskId: z.string().min(1),
    requestId: z.string().min(1).optional(),
    kind: z.string().min(1),
    status: z.enum(['pending', 'running', 'passed', 'warnings', 'blocked', 'failed', 'cancelled']),
    verdict: z.enum(['allow', 'warn', 'block', 'unknown']),
    summary: z.string().min(1),
    findings: z.array(AutoReviewFindingSchema).default([]),
    evidenceIds: z.array(z.string().min(1)).default([]),
    artifactIds: z.array(z.string().min(1)).default([]),
    sandboxRunId: z.string().min(1).optional(),
    policyDecisionId: z.string().min(1).optional(),
    approval: z
      .object({
        approvalId: z.string().min(1),
        interruptId: z.string().min(1),
        resumeEndpoint: z.literal('/api/auto-review/reviews/:reviewId/approval')
      })
      .strict()
      .optional(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    completedAt: z.string().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).default({})
  })
  .strict();

export const ToolApprovalRequesterSchema = z
  .object({
    actor: ToolActorSchema,
    actorId: z.string().min(1).optional()
  })
  .strict();

export const ToolApprovalPreviewSchema = z
  .object({
    approvalId: z.string().min(1),
    toolCallId: z.string().min(1),
    toolId: z.string().min(1),
    riskLevel: ToolRiskLevelSchema,
    title: z.string().min(1),
    summary: z.string().min(1),
    requestedBy: ToolApprovalRequesterSchema,
    preview: z
      .object({
        command: z.string().min(1).optional(),
        affectedPaths: z.array(z.string().min(1)).default([]),
        networkHosts: z.array(z.string().min(1)).default([]),
        payload: z.record(z.string(), z.unknown()).default({})
      })
      .strict(),
    expiresAt: z.string().min(1).optional(),
    createdAt: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).default({})
  })
  .strict();

export const ToolReceiptStatusSchema = z.enum(['succeeded', 'failed', 'cancelled', 'skipped']);

export const ToolReceiptSchema = z
  .object({
    receiptId: z.string().min(1),
    toolCallId: z.string().min(1),
    toolId: z.string().min(1),
    status: ToolReceiptStatusSchema,
    startedAt: z.string().min(1).optional(),
    completedAt: z.string().min(1).optional(),
    durationMs: z.number().int().nonnegative().optional(),
    outputPreview: z.string().optional(),
    artifactIds: z.array(z.string().min(1)).default([]),
    evidenceIds: z.array(z.string().min(1)).default([]),
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
        retryable: z.boolean().default(false)
      })
      .strict()
      .optional(),
    metadata: z.record(z.string(), z.unknown()).default({})
  })
  .strict();

export const ToolRuntimeEventKindSchema = z.enum(['tool', 'sandbox', 'auto_review']);

export const ToolRuntimeToolEventSchema = z
  .object({
    eventId: z.string().min(1),
    emittedAt: z.string().min(1),
    kind: z.literal('tool'),
    type: z.enum(['tool.approval.requested', 'tool.receipt.created', 'tool.failed']),
    taskId: z.string().min(1).optional(),
    toolCallId: z.string().min(1),
    toolId: z.string().min(1).optional(),
    approvalId: z.string().min(1).optional(),
    receiptId: z.string().min(1).optional(),
    status: ToolReceiptStatusSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).default({})
  })
  .strict();

export const ToolRuntimeSandboxEventSchema = z
  .object({
    eventId: z.string().min(1),
    emittedAt: z.string().min(1),
    kind: z.literal('sandbox'),
    type: z.enum(['sandbox.plan.created', 'sandbox.started', 'sandbox.result.created']),
    taskId: z.string().min(1).optional(),
    sandboxId: z.string().min(1),
    status: SandboxStatusSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).default({})
  })
  .strict();

export const ToolRuntimeAutoReviewEventSchema = z
  .object({
    eventId: z.string().min(1),
    emittedAt: z.string().min(1),
    kind: z.literal('auto_review'),
    type: z.enum(['auto_review.requested', 'auto_review.completed', 'auto_review.failed']),
    taskId: z.string().min(1).optional(),
    reviewId: z.string().min(1),
    verdict: z.enum(['allow', 'warn', 'block', 'unknown']).optional(),
    metadata: z.record(z.string(), z.unknown()).default({})
  })
  .strict();

export const ToolRuntimeEventSchema = z.discriminatedUnion('kind', [
  ToolRuntimeToolEventSchema,
  ToolRuntimeSandboxEventSchema,
  ToolRuntimeAutoReviewEventSchema
]);

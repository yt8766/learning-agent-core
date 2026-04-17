import { z } from 'zod';

import { LearningSourceTypeSchema, RiskLevelSchema, SkillStatusSchema } from './primitives';

export const CapabilityOwnerTypeSchema = z.enum([
  'shared',
  'ministry-owned',
  'specialist-owned',
  'imperial-attached',
  'temporary-assignment',
  'user-attached',
  'runtime-derived'
]);

export const CapabilityTierSchema = z.enum([
  'shared',
  'ministry-owned',
  'specialist-owned',
  'imperial-attached',
  'temporary-assignment'
]);

export const CapabilityTypeSchema = z.enum(['skill', 'connector', 'tool']);
export const CapabilityScopeSchema = z.enum(['task', 'session', 'workspace']);
export const CapabilityTriggerSchema = z.enum([
  'bootstrap',
  'user_requested',
  'specialist_requested',
  'capability_gap_detected',
  'workflow_required'
]);

export const CapabilityOwnershipRecordSchema = z.object({
  ownerType: CapabilityOwnerTypeSchema,
  ownerId: z.string().optional(),
  tier: CapabilityTierSchema.optional(),
  capabilityType: CapabilityTypeSchema,
  scope: CapabilityScopeSchema,
  trigger: CapabilityTriggerSchema,
  consumedByMinistry: z.string().optional(),
  consumedBySpecialist: z.string().optional()
});

export const RequestedExecutionHintsSchema = z.object({
  requestedSpecialist: z.string().optional(),
  requestedSkill: z.string().optional(),
  requestedConnectorTemplate: z.enum(['github-mcp-template', 'browser-mcp-template', 'lark-mcp-template']).optional(),
  requestedCapability: z.string().optional(),
  preferredModelId: z.string().optional(),
  preferredMode: z.enum(['direct-reply', 'workflow', 'research-first']).optional(),
  createSkillIntent: z
    .object({
      description: z.string(),
      displayName: z.string().optional()
    })
    .optional()
});

const CapabilityGovernanceOutcomeSchema = z.object({
  taskId: z.string(),
  reviewDecision: z.enum(['pass', 'revise_required', 'block', 'needs_human_approval']),
  trustAdjustment: z.enum(['promote', 'hold', 'downgrade']),
  updatedAt: z.string()
});

export const CapabilityAttachmentRecordSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  kind: CapabilityTypeSchema,
  owner: CapabilityOwnershipRecordSchema,
  enabled: z.boolean(),
  sourceId: z.string().optional(),
  permission: z.enum(['readonly', 'write', 'external-side-effect', 'publish']).optional(),
  riskLevel: RiskLevelSchema.optional(),
  promotionStatus: z.enum(['candidate', 'active', 'stable', 'deprecated']).optional(),
  deprecated_in_favor_of: z.string().optional(),
  stats: z
    .object({
      successCount: z.number().optional(),
      failureCount: z.number().optional(),
      avgTokenCost: z.number().optional(),
      avgCostUsd: z.number().optional()
    })
    .optional(),
  capabilityTrust: z
    .object({
      trustLevel: z.enum(['high', 'medium', 'low']),
      trustTrend: z.enum(['up', 'steady', 'down']),
      lastGovernanceSummary: z.string().optional(),
      lastReason: z.string().optional(),
      updatedAt: z.string()
    })
    .optional(),
  governanceProfile: z
    .object({
      reportCount: z.number(),
      promoteCount: z.number(),
      holdCount: z.number(),
      downgradeCount: z.number(),
      passCount: z.number(),
      reviseRequiredCount: z.number(),
      blockCount: z.number(),
      lastTaskId: z.string().optional(),
      lastReviewDecision: z.enum(['pass', 'revise_required', 'block', 'needs_human_approval']).optional(),
      lastTrustAdjustment: z.enum(['promote', 'hold', 'downgrade']).optional(),
      recentOutcomes: z.array(CapabilityGovernanceOutcomeSchema).optional(),
      updatedAt: z.string()
    })
    .optional(),
  metadata: z
    .object({
      steps: z
        .array(
          z.object({
            title: z.string(),
            instruction: z.string(),
            toolNames: z.array(z.string()).optional()
          })
        )
        .optional(),
      requiredTools: z.array(z.string()).optional(),
      optionalTools: z.array(z.string()).optional(),
      approvalSensitiveTools: z.array(z.string()).optional(),
      preferredConnectors: z.array(z.string()).optional(),
      requiredConnectors: z.array(z.string()).optional()
    })
    .optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional()
});

export const CapabilityGovernanceProfileRecordSchema = z.object({
  capabilityId: z.string(),
  displayName: z.string(),
  ownerType: CapabilityOwnerTypeSchema,
  kind: CapabilityTypeSchema,
  trustLevel: z.enum(['high', 'medium', 'low']),
  trustTrend: z.enum(['up', 'steady', 'down']),
  reportCount: z.number(),
  promoteCount: z.number(),
  holdCount: z.number(),
  downgradeCount: z.number(),
  passCount: z.number(),
  reviseRequiredCount: z.number(),
  blockCount: z.number(),
  lastTaskId: z.string().optional(),
  lastReviewDecision: z.enum(['pass', 'revise_required', 'block', 'needs_human_approval']).optional(),
  lastTrustAdjustment: z.enum(['promote', 'hold', 'downgrade']).optional(),
  lastReason: z.string().optional(),
  lastGovernanceSummary: z.string().optional(),
  recentOutcomes: z.array(CapabilityGovernanceOutcomeSchema).optional(),
  updatedAt: z.string()
});

export const GovernanceProfileRecordSchema = z.object({
  entityId: z.string(),
  displayName: z.string(),
  entityKind: z.enum(['ministry', 'worker', 'specialist']),
  trustLevel: z.enum(['high', 'medium', 'low']),
  trustTrend: z.enum(['up', 'steady', 'down']),
  reportCount: z.number(),
  promoteCount: z.number(),
  holdCount: z.number(),
  downgradeCount: z.number(),
  passCount: z.number(),
  reviseRequiredCount: z.number(),
  blockCount: z.number(),
  lastTaskId: z.string().optional(),
  lastReviewDecision: z.enum(['pass', 'revise_required', 'block', 'needs_human_approval']).optional(),
  lastTrustAdjustment: z.enum(['promote', 'hold', 'downgrade']).optional(),
  lastReason: z.string().optional(),
  lastGovernanceSummary: z.string().optional(),
  recentOutcomes: z.array(CapabilityGovernanceOutcomeSchema).optional(),
  updatedAt: z.string()
});

export const SkillStepSchema = z.object({
  title: z.string(),
  instruction: z.string(),
  toolNames: z.array(z.string())
});

export const SkillToolContractSchema = z.object({
  required: z.array(z.string()),
  optional: z.array(z.string()).optional(),
  approvalSensitive: z.array(z.string()).optional()
});

export const SkillConnectorContractSchema = z.object({
  preferred: z.array(z.string()),
  required: z.array(z.string()).optional(),
  configureIfMissing: z.boolean().optional()
});

export const SkillCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  applicableGoals: z.array(z.string()),
  requiredTools: z.array(z.string()),
  steps: z.array(SkillStepSchema),
  constraints: z.array(z.string()),
  successSignals: z.array(z.string()),
  riskLevel: RiskLevelSchema,
  source: LearningSourceTypeSchema,
  status: SkillStatusSchema,
  previousStatus: SkillStatusSchema.optional(),
  disabledReason: z.string().optional(),
  retiredAt: z.string().optional(),
  restoredAt: z.string().optional(),
  version: z.string().optional(),
  successRate: z.number().optional(),
  promotionState: z.string().optional(),
  governanceRecommendation: z.enum(['promote', 'keep-lab', 'disable', 'retire']).optional(),
  sourceRuns: z.array(z.string()).optional(),
  sourceId: z.string().optional(),
  installReceiptId: z.string().optional(),
  bootstrap: z.boolean().optional(),
  ownership: CapabilityOwnershipRecordSchema.optional(),
  domains: z.array(z.string()).optional(),
  specialistAffinity: z.array(z.string()).optional(),
  preferredMinistries: z.array(z.string()).optional(),
  preferredConnectors: z.array(z.string()).optional(),
  toolContract: SkillToolContractSchema.optional(),
  connectorContract: SkillConnectorContractSchema.optional(),
  requiredCapabilities: z.array(z.string()).optional(),
  requiredConnectors: z.array(z.string()).optional(),
  allowedTools: z.array(z.string()).optional(),
  compatibility: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

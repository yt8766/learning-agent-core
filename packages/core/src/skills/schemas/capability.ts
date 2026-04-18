import { z } from 'zod';

import { RiskLevelSchema } from '../../primitives';

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

export const CapabilityAugmentationRecordSchema = z.object({
  id: z.string(),
  kind: z.enum(['skill', 'connector', 'tool', 'both', 'none']),
  status: z.enum(['suggested', 'waiting_approval', 'installing', 'configuring', 'ready', 'failed', 'blocked']),
  requestedBy: z.enum(['user', 'supervisor', 'specialist', 'workflow']),
  targetKind: CapabilityTypeSchema.optional(),
  target: z.string().optional(),
  reason: z.string(),
  owner: CapabilityOwnershipRecordSchema,
  summary: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
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

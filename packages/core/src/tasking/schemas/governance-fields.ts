import { z } from 'zod';

import { RiskLevelSchema } from '../../primitives';

export const ApprovalRecordSchema = z.object({
  taskId: z.string(),
  intent: z.string(),
  actor: z.string().optional(),
  reason: z.string().optional(),
  decision: z.enum(['approved', 'rejected', 'pending']),
  decidedAt: z.string()
});

export const ApprovalResumeInputSchema = z.object({
  interruptId: z.string().optional(),
  action: z.enum(['approve', 'reject', 'feedback', 'input', 'bypass', 'abort']),
  feedback: z.string().optional(),
  value: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional()
});

const ApprovalScopeMatchInputSchema = z.object({
  intent: z.string().optional(),
  toolName: z.string().optional(),
  riskCode: z.string().optional(),
  requestedBy: z.string().optional(),
  commandPreview: z.string().optional()
});

export const ApprovalScopePolicyRecordSchema = ApprovalScopeMatchInputSchema.extend({
  id: z.string(),
  scope: z.enum(['session', 'always']),
  status: z.enum(['active', 'revoked']),
  matchKey: z.string(),
  actor: z.string().optional(),
  sourceDomain: z.string().optional(),
  approvalScope: z.enum(['once', 'session', 'always']).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  revokedAt: z.string().optional(),
  revokedBy: z.string().optional(),
  lastMatchedAt: z.string().optional(),
  matchCount: z.number().optional()
});

export const ToolExecutionResultSchema = z.object({
  ok: z.boolean(),
  outputSummary: z.string(),
  rawOutput: z.unknown().optional(),
  exitCode: z.number().optional(),
  errorMessage: z.string().optional(),
  durationMs: z.number(),
  serverId: z.string().optional(),
  capabilityId: z.string().optional(),
  transportUsed: z.enum(['local-adapter', 'stdio', 'http', 'cli']).optional(),
  fallbackUsed: z.boolean().optional()
});

export const ToolAttachmentRecordSchema = z.object({
  toolName: z.string(),
  family: z.string(),
  ownerType: z.enum([
    'shared',
    'ministry-owned',
    'specialist-owned',
    'imperial-attached',
    'temporary-assignment',
    'user-attached',
    'runtime-derived'
  ]),
  ownerId: z.string().optional(),
  attachedAt: z.string(),
  attachedBy: z.enum(['bootstrap', 'user', 'runtime', 'workflow', 'specialist']),
  preferred: z.boolean(),
  reason: z.string().optional()
});

export const ToolUsageSummaryRecordSchema = z.object({
  toolName: z.string(),
  family: z.string(),
  capabilityType: z.enum(['local-tool', 'mcp-capability', 'governance-tool']),
  status: z.enum(['selected', 'called', 'blocked', 'approved', 'completed', 'failed']),
  route: z.enum(['local', 'mcp', 'governance']),
  requestedBy: z.string().optional(),
  reason: z.string().optional(),
  blockedReason: z.string().optional(),
  serverId: z.string().optional(),
  capabilityId: z.string().optional(),
  approvalRequired: z.boolean().optional(),
  riskLevel: RiskLevelSchema.optional(),
  usedAt: z.string()
});

export const ToolCapabilityTypeSchema = z.enum(['local-tool', 'mcp-capability', 'governance-tool']);

export const ToolPermissionScopeSchema = z.enum(['readonly', 'workspace-write', 'external-side-effect', 'governance']);

export const ToolFamilyRecordSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  description: z.string(),
  capabilityType: ToolCapabilityTypeSchema,
  ownerType: z.enum(['shared', 'ministry-owned', 'specialist-owned', 'user-attached', 'runtime-derived']),
  ownerId: z.string().optional(),
  bootstrap: z.boolean().optional(),
  preferredMinistries: z.array(z.string()).optional(),
  preferredSpecialists: z.array(z.string()).optional()
});

export const ToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  family: z.string(),
  category: z.enum(['knowledge', 'system', 'action', 'memory']),
  riskLevel: RiskLevelSchema,
  requiresApproval: z.boolean(),
  timeoutMs: z.number(),
  sandboxProfile: z.string(),
  ownerType: z.enum(['shared', 'ministry-owned', 'specialist-owned', 'user-attached', 'runtime-derived']).optional(),
  ownerId: z.string().optional(),
  bootstrap: z.boolean().optional(),
  preferredMinistries: z.array(z.string()).optional(),
  preferredSpecialists: z.array(z.string()).optional(),
  capabilityType: ToolCapabilityTypeSchema,
  isReadOnly: z.boolean(),
  isConcurrencySafe: z.boolean(),
  isDestructive: z.boolean(),
  supportsStreamingDispatch: z.boolean(),
  permissionScope: ToolPermissionScopeSchema,
  inputSchema: z.record(z.string(), z.unknown())
});

export const ToolExecutionRequestSchema = z.object({
  taskId: z.string(),
  toolName: z.string(),
  intent: z.string(),
  input: z.record(z.string(), z.unknown()),
  requestedBy: z.enum(['agent', 'user'])
});

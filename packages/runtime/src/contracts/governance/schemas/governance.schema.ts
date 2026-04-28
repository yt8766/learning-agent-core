import { z } from 'zod';

const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

export const ConnectorHealthRecordSchema = z.object({
  connectorId: z.string(),
  healthState: z.enum(['healthy', 'degraded', 'error', 'unknown', 'disabled']),
  reason: z.string().optional(),
  checkedAt: z.string(),
  transport: z.string().optional(),
  implementedCapabilityCount: z.number().optional(),
  discoveredCapabilityCount: z.number().optional()
});

export const ApprovalPolicyRecordSchema = z.object({
  id: z.string(),
  scope: z.enum(['connector', 'worker', 'skill-source', 'capability']),
  targetId: z.string(),
  mode: z.string(),
  reason: z.string(),
  effect: z.enum(['allow', 'deny', 'require-approval', 'observe']).optional(),
  connectorId: z.string().optional(),
  workerId: z.string().optional(),
  sourceId: z.string().optional(),
  capabilityId: z.string().optional(),
  matchedCount: z.number().optional()
});

export const ApprovalScopeMatchInputSchema = z.object({
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

export const ToolExecutionResultSchema = z.object({
  ok: z.boolean(),
  outputSummary: z.string(),
  rawOutput: z.unknown().optional(),
  exitCode: z.number().optional(),
  errorMessage: z.string().optional(),
  durationMs: z.number(),
  serverId: z.string().optional(),
  capabilityId: z.string().optional(),
  transportUsed: z.enum(['local-adapter', 'stdio', 'http']).optional(),
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

export const PreflightGovernanceDecisionSchema = z.enum(['allow', 'ask', 'deny']);

export const ToolCapabilityTypeSchema = z.enum(['local-tool', 'mcp-capability', 'governance-tool']);

export const ToolPermissionScopeSchema = z.enum(['readonly', 'workspace-write', 'external-side-effect', 'governance']);

export const PermissionCheckResultSchema = z.object({
  decision: PreflightGovernanceDecisionSchema,
  reason: z.string(),
  reasonCode: z.enum([
    'static_policy_allow',
    'static_policy_ask',
    'static_policy_deny',
    'tool_checker_allow',
    'tool_checker_ask',
    'tool_checker_deny',
    'classifier_allow',
    'classifier_ask',
    'classifier_deny'
  ]),
  matchedRuleId: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional()
});

export const StaticPolicyRuleSchema = z.object({
  id: z.string(),
  effect: PreflightGovernanceDecisionSchema,
  priority: z.number(),
  toolNames: z.array(z.string()).optional(),
  families: z.array(z.string()).optional(),
  intents: z.array(z.string()).optional(),
  pathPatterns: z.array(z.string()).optional(),
  commandPatterns: z.array(z.string()).optional(),
  profiles: z.array(z.string()).optional(),
  executionModes: z.array(z.string()).optional(),
  reason: z.string()
});

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

export const McpCapabilitySchema = z.object({
  id: z.string(),
  toolName: z.string(),
  serverId: z.string(),
  displayName: z.string(),
  riskLevel: z.string(),
  requiresApproval: z.boolean(),
  category: z.string(),
  transport: z.string().optional(),
  trustClass: z.string().optional(),
  approvalPolicy: z.string().optional(),
  healthState: z.enum(['healthy', 'degraded', 'error', 'unknown']).optional(),
  argsSchema: z.record(z.string(), z.unknown()).optional(),
  resultSchema: z.record(z.string(), z.unknown()).optional(),
  isPrimaryForTool: z.boolean().optional(),
  fallbackAvailable: z.boolean().optional(),
  dataScope: z.string().optional(),
  writeScope: z.string().optional()
});

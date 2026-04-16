import { z } from 'zod';

export const ConnectorHealthRecordSchema = z.object({
  connectorId: z.string(),
  healthState: z.enum(['healthy', 'degraded', 'error', 'unknown', 'disabled']),
  reason: z.string().optional(),
  checkedAt: z.string(),
  transport: z.string().optional(),
  implementedCapabilityCount: z.number().optional(),
  discoveredCapabilityCount: z.number().optional()
});

export type ConnectorHealthRecord = z.infer<typeof ConnectorHealthRecordSchema>;

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

export type ApprovalPolicyRecord = z.infer<typeof ApprovalPolicyRecordSchema>;

export const ApprovalScopeMatchInputSchema = z.object({
  intent: z.string().optional(),
  toolName: z.string().optional(),
  riskCode: z.string().optional(),
  requestedBy: z.string().optional(),
  commandPreview: z.string().optional()
});

export type ApprovalScopeMatchInput = z.infer<typeof ApprovalScopeMatchInputSchema>;

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

export type ApprovalScopePolicyRecord = z.infer<typeof ApprovalScopePolicyRecordSchema>;

export const ApprovalRecordSchema = z.object({
  taskId: z.string(),
  intent: z.string(),
  actor: z.string().optional(),
  reason: z.string().optional(),
  decision: z.enum(['approved', 'rejected', 'pending']),
  decidedAt: z.string()
});

export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;

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

export type McpCapability = z.infer<typeof McpCapabilitySchema>;

function normalizeApprovalScopeValue(value?: string) {
  return value?.trim().replace(/\s+/g, ' ').toLowerCase() ?? '';
}

export function buildApprovalScopeMatchKey(input: ApprovalScopeMatchInput) {
  return [
    normalizeApprovalScopeValue(input.intent),
    normalizeApprovalScopeValue(input.toolName),
    normalizeApprovalScopeValue(input.riskCode),
    normalizeApprovalScopeValue(input.requestedBy),
    normalizeApprovalScopeValue(input.commandPreview)
  ].join('::');
}

export function matchesApprovalScopePolicy(
  policy: Pick<ApprovalScopePolicyRecord, 'status' | 'matchKey'>,
  input: ApprovalScopeMatchInput
) {
  return policy.status === 'active' && policy.matchKey === buildApprovalScopeMatchKey(input);
}

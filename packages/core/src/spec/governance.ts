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

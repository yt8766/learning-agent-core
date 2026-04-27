import { z } from 'zod/v4';

import { ToolRiskLevelSchema } from './tool-contracts.schema';

export const AgentToolAliasSchema = z.enum(['read', 'list', 'search', 'write', 'edit', 'delete', 'command']);

export const AgentToolApprovalModeSchema = z.enum(['suggest', 'auto_edit', 'full_auto']);

export const AgentToolSurfaceActorSchema = z
  .object({
    actor: z.enum(['human', 'supervisor', 'ministry', 'specialist_agent', 'runtime']),
    actorId: z.string().min(1).optional()
  })
  .strict();

export const AgentToolAliasRequestSchema = z
  .object({
    alias: AgentToolAliasSchema,
    input: z.record(z.string(), z.unknown()).default({}),
    approvalMode: AgentToolApprovalModeSchema.default('suggest'),
    requestedBy: AgentToolSurfaceActorSchema.optional(),
    taskId: z.string().min(1).optional(),
    sessionId: z.string().min(1).optional(),
    intentHint: z.string().min(1).optional(),
    capabilityId: z.string().min(1).optional()
  })
  .strict();

export const AgentToolSurfaceErrorCodeSchema = z.enum([
  'agent_tool_alias_invalid',
  'agent_tool_alias_input_invalid',
  'agent_tool_alias_unresolved',
  'agent_tool_alias_policy_denied',
  'agent_tool_alias_capability_mismatch',
  'agent_tool_alias_approval_mode_denied',
  'agent_tool_alias_auto_approval_downgraded'
]);

export const AgentToolSandboxProfileSchema = z.enum(['workspace-readonly', 'workspace-write', 'release-ops']);

export const AgentToolResolutionSchema = z
  .object({
    alias: AgentToolAliasSchema,
    toolName: z.string().min(1),
    capabilityId: z.string().min(1),
    nodeId: z.string().min(1).optional(),
    riskClass: ToolRiskLevelSchema,
    requiresApproval: z.boolean(),
    approvalMode: AgentToolApprovalModeSchema,
    approvalReasonCode: z.string().min(1).optional(),
    sandboxProfile: AgentToolSandboxProfileSchema,
    input: z.record(z.string(), z.unknown()).default({}),
    inputPreview: z.string().optional(),
    reasonCode: z.string().min(1),
    reason: z.string().min(1)
  })
  .strict();

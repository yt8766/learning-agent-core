import { z } from 'zod';
import {
  AgentRuntimeActionSchema,
  AgentRuntimeBlastRadiusSchema,
  AgentRuntimeDataClassSchema,
  AgentRuntimeEnvironmentSchema
} from './agent-runtime-profile';

export const SyscallTypeSchema = z.enum(['resource', 'mutation', 'execution', 'external', 'control_plane', 'runtime']);
export const PolicyDecisionStatusSchema = z.enum(['allow', 'needs_approval', 'deny']);
export const NormalizedRiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

export const ToolRequestSchema = z.object({
  requestId: z.string().min(1),
  taskId: z.string().min(1),
  agentId: z.string().min(1),
  syscallType: SyscallTypeSchema,
  toolName: z.string().min(1),
  intent: z.string().min(1),
  args: z.unknown(),
  agentRiskHint: z
    .object({
      action: AgentRuntimeActionSchema,
      assetScope: z.array(z.string().min(1)).default([]),
      environment: AgentRuntimeEnvironmentSchema.optional(),
      dataClasses: z.array(AgentRuntimeDataClassSchema).optional(),
      blastRadius: AgentRuntimeBlastRadiusSchema.optional()
    })
    .optional(),
  idempotencyKey: z.string().min(1).optional(),
  expectedEvidence: z.array(z.string().min(1)).default([])
});

export const PolicyDecisionSchema = z.object({
  decision: PolicyDecisionStatusSchema,
  reason: z.string().min(1),
  decidedBy: z.literal('permission_service'),
  requiredApprovalPolicy: z.enum(['human', 'two_person']).optional(),
  normalizedRisk: z.object({
    action: AgentRuntimeActionSchema,
    assetScope: z.array(z.string().min(1)).default([]),
    environment: AgentRuntimeEnvironmentSchema,
    dataClasses: z.array(AgentRuntimeDataClassSchema).default([]),
    blastRadius: AgentRuntimeBlastRadiusSchema,
    level: NormalizedRiskLevelSchema
  })
});

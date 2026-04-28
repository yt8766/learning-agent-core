import type { z } from 'zod/v4';

import type {
  AgentToolAliasRequestSchema,
  AgentToolAliasSchema,
  AgentToolApprovalModeSchema,
  AgentToolResolutionSchema,
  AgentToolSandboxProfileSchema,
  AgentToolSurfaceActorSchema,
  AgentToolSurfaceErrorCodeSchema
} from '../schemas/agent-tool-surface.schema';

export type AgentToolAlias = z.infer<typeof AgentToolAliasSchema>;
export type AgentToolApprovalMode = z.infer<typeof AgentToolApprovalModeSchema>;
export type AgentToolSurfaceActor = z.infer<typeof AgentToolSurfaceActorSchema>;
export type AgentToolAliasRequest = z.infer<typeof AgentToolAliasRequestSchema>;
export type AgentToolSurfaceErrorCode = z.infer<typeof AgentToolSurfaceErrorCodeSchema>;
export type AgentToolSandboxProfile = z.infer<typeof AgentToolSandboxProfileSchema>;
export type AgentToolResolution = z.infer<typeof AgentToolResolutionSchema>;

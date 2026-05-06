import type { z } from 'zod';
import type { AgentRuntimeTaskProjectionSchema, GovernancePhaseSchema } from '../schemas/agent-runtime-projection';

export type GovernancePhase = z.infer<typeof GovernancePhaseSchema>;
export type AgentRuntimeTaskProjection = z.infer<typeof AgentRuntimeTaskProjectionSchema>;

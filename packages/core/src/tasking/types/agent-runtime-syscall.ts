import type { z } from 'zod';
import type { PolicyDecisionSchema, ToolRequestSchema } from '../schemas/agent-runtime-syscall';

export type ToolRequest = z.infer<typeof ToolRequestSchema>;
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;

import type { z } from 'zod';
import type { QualityGateResultSchema, QualityGateSchema } from '../schemas/agent-runtime-quality';

export type QualityGate = z.infer<typeof QualityGateSchema>;
export type QualityGateResult = z.infer<typeof QualityGateResultSchema>;

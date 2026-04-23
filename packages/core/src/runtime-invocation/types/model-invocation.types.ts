import type { z } from 'zod/v4';

import {
  CapabilityInjectionPlanSchema,
  ModelInvocationRequestSchema,
  ModelInvocationResultSchema,
  PreprocessDecisionSchema
} from '../schemas/model-invocation.schema';

export type CapabilityInjectionPlan = z.infer<typeof CapabilityInjectionPlanSchema>;
export type ModelInvocationRequest = z.infer<typeof ModelInvocationRequestSchema>;
export type PreprocessDecision = z.infer<typeof PreprocessDecisionSchema>;
export type ModelInvocationResult = z.infer<typeof ModelInvocationResultSchema>;

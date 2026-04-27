import { z } from 'zod';

import { ExecutionPolicyDecisionSchema, ExecutionRiskClassSchema } from './execution-enums.schema';

const ExecutionIdSchema = z.string().min(1);
const ExecutionTimestampSchema = z.string().datetime();

export const ExecutionPolicyDecisionRecordSchema = z.object({
  decisionId: ExecutionIdSchema,
  requestId: ExecutionIdSchema,
  decision: ExecutionPolicyDecisionSchema,
  reasonCode: z.string().min(1),
  reason: z.string().min(1),
  matchedPolicyIds: z.array(ExecutionIdSchema),
  requiresApproval: z.boolean(),
  approvalScope: z.string().min(1).optional(),
  riskClass: ExecutionRiskClassSchema,
  createdAt: ExecutionTimestampSchema
});

export type ExecutionPolicyDecisionRecord = z.infer<typeof ExecutionPolicyDecisionRecordSchema>;

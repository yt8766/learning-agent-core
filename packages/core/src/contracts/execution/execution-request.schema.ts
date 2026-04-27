import { z } from 'zod';

import {
  ExecutionRequestedByActorSchema,
  ExecutionRequestStatusSchema,
  ExecutionRiskClassSchema
} from './execution-enums.schema';
import { ExecutionPolicyDecisionRecordSchema } from './execution-policy.schema';

const ExecutionIdSchema = z.string().min(1);
const ExecutionTimestampSchema = z.string().datetime();

export const ExecutionRequestedBySchema = z.object({
  actor: ExecutionRequestedByActorSchema,
  actorId: ExecutionIdSchema.optional()
});
export type ExecutionRequestedBy = z.infer<typeof ExecutionRequestedBySchema>;

export const ExecutionRequestRecordSchema = z.object({
  requestId: ExecutionIdSchema,
  taskId: ExecutionIdSchema,
  sessionId: ExecutionIdSchema.optional(),
  nodeId: ExecutionIdSchema,
  capabilityId: ExecutionIdSchema.optional(),
  toolName: ExecutionIdSchema,
  requestedBy: ExecutionRequestedBySchema,
  inputPreview: z.string().optional(),
  riskClass: ExecutionRiskClassSchema,
  policyDecision: ExecutionPolicyDecisionRecordSchema.optional(),
  approvalId: ExecutionIdSchema.optional(),
  status: ExecutionRequestStatusSchema,
  createdAt: ExecutionTimestampSchema,
  startedAt: ExecutionTimestampSchema.optional(),
  finishedAt: ExecutionTimestampSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export type ExecutionRequestRecord = z.infer<typeof ExecutionRequestRecordSchema>;

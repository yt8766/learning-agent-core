import { z } from 'zod';

import { ExecutionCapabilityCategorySchema, ExecutionRiskClassSchema } from './execution-enums.schema';

const ExecutionIdSchema = z.string().min(1);

export const ExecutionCapabilityRecordSchema = z.object({
  capabilityId: ExecutionIdSchema,
  nodeId: ExecutionIdSchema,
  toolName: ExecutionIdSchema,
  category: ExecutionCapabilityCategorySchema,
  riskClass: ExecutionRiskClassSchema,
  requiresApproval: z.boolean(),
  inputSchemaRef: z.string().optional(),
  outputSchemaRef: z.string().optional(),
  permissionHints: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export type ExecutionCapabilityRecord = z.infer<typeof ExecutionCapabilityRecordSchema>;

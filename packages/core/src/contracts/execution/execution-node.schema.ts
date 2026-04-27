import { z } from 'zod';

import { ExecutionCapabilityRecordSchema } from './execution-capability.schema';
import {
  ExecutionNodeKindSchema,
  ExecutionNodeStatusSchema,
  ExecutionRiskClassSchema,
  ExecutionSandboxModeSchema
} from './execution-enums.schema';

const ExecutionIdSchema = z.string().min(1);
const ExecutionTimestampSchema = z.string().datetime();

export const ExecutionPermissionScopeSchema = z.object({
  workspaceRoot: z.string().optional(),
  allowedPaths: z.array(z.string()).optional(),
  deniedPaths: z.array(z.string()).optional(),
  allowedHosts: z.array(z.string()).optional(),
  deniedHosts: z.array(z.string()).optional(),
  allowedCommands: z.array(z.string()).optional(),
  deniedCommands: z.array(z.string()).optional()
});
export type ExecutionPermissionScope = z.infer<typeof ExecutionPermissionScopeSchema>;

export const ExecutionNodeHealthSchema = z.object({
  ok: z.boolean(),
  message: z.string().optional(),
  checkedAt: ExecutionTimestampSchema.optional()
});
export type ExecutionNodeHealth = z.infer<typeof ExecutionNodeHealthSchema>;

export const ExecutionNodeRecordSchema = z.object({
  nodeId: ExecutionIdSchema,
  displayName: z.string().min(1),
  kind: ExecutionNodeKindSchema,
  status: ExecutionNodeStatusSchema,
  sandboxMode: ExecutionSandboxModeSchema,
  riskClass: ExecutionRiskClassSchema,
  capabilities: z.array(ExecutionCapabilityRecordSchema),
  permissionScope: ExecutionPermissionScopeSchema,
  health: ExecutionNodeHealthSchema,
  lastHeartbeatAt: ExecutionTimestampSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: ExecutionTimestampSchema,
  updatedAt: ExecutionTimestampSchema
});

export type ExecutionNodeRecord = z.infer<typeof ExecutionNodeRecordSchema>;

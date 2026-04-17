import { z } from 'zod';

import {
  ApprovalPolicyRecordSchema,
  ApprovalRecordSchema,
  ApprovalScopeMatchInputSchema,
  ApprovalScopePolicyRecordSchema,
  ConnectorHealthRecordSchema,
  McpCapabilitySchema,
  ToolExecutionResultSchema
} from '../spec/governance';

export type ConnectorHealthRecord = z.infer<typeof ConnectorHealthRecordSchema>;
export type ApprovalPolicyRecord = z.infer<typeof ApprovalPolicyRecordSchema>;
export type ApprovalScopeMatchInput = z.infer<typeof ApprovalScopeMatchInputSchema>;
export type ApprovalScopePolicyRecord = z.infer<typeof ApprovalScopePolicyRecordSchema>;
export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;
export type ToolExecutionResult = z.infer<typeof ToolExecutionResultSchema>;
export type McpCapability = z.infer<typeof McpCapabilitySchema>;

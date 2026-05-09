import type { z } from 'zod';

import type {
  ApprovalRecordSchema,
  ApprovalResumeInputSchema,
  ApprovalScopePolicyRecordSchema,
  ToolAttachmentRecordSchema,
  ToolDefinitionSchema,
  ToolExecutionRequestSchema,
  ToolExecutionResultSchema,
  ToolFamilyRecordSchema,
  ToolUsageSummaryRecordSchema
} from '../schemas/governance-fields';

export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;
export type ApprovalResumeInput = z.infer<typeof ApprovalResumeInputSchema>;
export type ApprovalScopePolicyRecord = z.infer<typeof ApprovalScopePolicyRecordSchema>;
export type ToolAttachmentRecord = z.infer<typeof ToolAttachmentRecordSchema>;
export type ToolFamilyRecord = z.infer<typeof ToolFamilyRecordSchema>;
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;
export type ToolExecutionRequest = z.infer<typeof ToolExecutionRequestSchema>;
export type ToolExecutionResult = z.infer<typeof ToolExecutionResultSchema>;
export type ToolUsageSummaryRecord = z.infer<typeof ToolUsageSummaryRecordSchema>;

import type { z } from 'zod';

import type {
  ApprovalRecordSchema,
  ApprovalResumeInputSchema,
  ApprovalScopePolicyRecordSchema,
  ToolAttachmentRecordSchema,
  ToolDefinitionSchema,
  ToolExecutionResultSchema,
  ToolUsageSummaryRecordSchema
} from '../schemas/governance-fields';

export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;
export type ApprovalResumeInput = z.infer<typeof ApprovalResumeInputSchema>;
export type ApprovalScopePolicyRecord = z.infer<typeof ApprovalScopePolicyRecordSchema>;
export type ToolAttachmentRecord = z.infer<typeof ToolAttachmentRecordSchema>;
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;
export type ToolExecutionResult = z.infer<typeof ToolExecutionResultSchema>;
export type ToolUsageSummaryRecord = z.infer<typeof ToolUsageSummaryRecordSchema>;

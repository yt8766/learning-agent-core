import { z } from 'zod';

import {
  ApprovalPolicyRecordSchema,
  ApprovalRecordSchema,
  ApprovalResumeInputSchema,
  ApprovalScopeMatchInputSchema,
  ApprovalScopePolicyRecordSchema,
  ConnectorHealthRecordSchema,
  McpCapabilitySchema,
  PermissionCheckResultSchema,
  PreflightGovernanceDecisionSchema,
  StaticPolicyRuleSchema,
  ToolAttachmentRecordSchema,
  ToolCapabilityTypeSchema,
  ToolDefinitionSchema,
  ToolExecutionRequestSchema,
  ToolExecutionResultSchema,
  ToolFamilyRecordSchema,
  ToolPermissionScopeSchema,
  ToolUsageSummaryRecordSchema
} from '../schemas/governance.schema';

export type ConnectorHealthRecord = z.infer<typeof ConnectorHealthRecordSchema>;
export type ApprovalPolicyRecord = z.infer<typeof ApprovalPolicyRecordSchema>;
export type ApprovalScopeMatchInput = z.infer<typeof ApprovalScopeMatchInputSchema>;
export type ApprovalScopePolicyRecord = z.infer<typeof ApprovalScopePolicyRecordSchema>;
export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;
export type ApprovalResumeInput = z.infer<typeof ApprovalResumeInputSchema>;
export type PreflightGovernanceDecision = z.infer<typeof PreflightGovernanceDecisionSchema>;
export type ToolCapabilityType = z.infer<typeof ToolCapabilityTypeSchema>;
export type ToolPermissionScope = z.infer<typeof ToolPermissionScopeSchema>;
export type PermissionCheckResult = z.infer<typeof PermissionCheckResultSchema>;
export type StaticPolicyRule = z.infer<typeof StaticPolicyRuleSchema>;
export type ToolFamilyRecord = z.infer<typeof ToolFamilyRecordSchema>;
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;
export type ToolExecutionRequest = z.infer<typeof ToolExecutionRequestSchema>;
export type ToolAttachmentRecord = z.infer<typeof ToolAttachmentRecordSchema>;
export type ToolExecutionResult = z.infer<typeof ToolExecutionResultSchema>;
export type ToolUsageSummaryRecord = z.infer<typeof ToolUsageSummaryRecordSchema>;
export type McpCapability = z.infer<typeof McpCapabilitySchema>;

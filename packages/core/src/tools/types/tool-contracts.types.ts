import type { z } from 'zod/v4';

import {
  AgentToolContractSchema,
  AutoReviewFindingSchema,
  AutoReviewFocusSchema,
  AutoReviewRequestSchema,
  AutoReviewResultSchema,
  AutoReviewScopeSchema,
  CommandToolContractSchema,
  FileToolContractSchema,
  FileToolOperationSchema,
  FileToolPathPolicySchema,
  RawCommandToolContractSchema,
  SandboxArtifactSchema,
  SandboxCommandPolicySchema,
  SandboxModeSchema,
  SandboxNetworkAccessSchema,
  SandboxPlanSchema,
  SandboxResultSchema,
  SandboxStatusSchema,
  SemanticCommandToolContractSchema,
  ToolActorSchema,
  ToolApprovalPolicySchema,
  ToolApprovalPreviewSchema,
  ToolApprovalRequesterSchema,
  ToolContractSchema,
  ToolKindSchema,
  ToolReceiptSchema,
  ToolReceiptStatusSchema,
  ToolRiskLevelSchema,
  ToolRuntimeAutoReviewEventSchema,
  ToolRuntimeEventKindSchema,
  ToolRuntimeEventSchema,
  ToolRuntimeSandboxEventSchema,
  ToolRuntimeToolEventSchema
} from '../schemas/tool-contracts.schema';

export type ToolKind = z.infer<typeof ToolKindSchema>;
export type ToolRiskLevel = z.infer<typeof ToolRiskLevelSchema>;
export type ToolApprovalPolicy = z.infer<typeof ToolApprovalPolicySchema>;
export type ToolActor = z.infer<typeof ToolActorSchema>;
export type AgentToolContract = z.infer<typeof AgentToolContractSchema>;
export type FileToolOperation = z.infer<typeof FileToolOperationSchema>;
export type FileToolPathPolicy = z.infer<typeof FileToolPathPolicySchema>;
export type FileToolContract = z.infer<typeof FileToolContractSchema>;
export type SemanticCommandToolContract = z.infer<typeof SemanticCommandToolContractSchema>;
export type RawCommandToolContract = z.infer<typeof RawCommandToolContractSchema>;
export type CommandToolContract = z.infer<typeof CommandToolContractSchema>;
export type ToolContract = z.infer<typeof ToolContractSchema>;
export type SandboxMode = z.infer<typeof SandboxModeSchema>;
export type SandboxNetworkAccess = z.infer<typeof SandboxNetworkAccessSchema>;
export type SandboxStatus = z.infer<typeof SandboxStatusSchema>;
export type SandboxCommandPolicy = z.infer<typeof SandboxCommandPolicySchema>;
export type SandboxPlan = z.infer<typeof SandboxPlanSchema>;
export type SandboxArtifact = z.infer<typeof SandboxArtifactSchema>;
export type SandboxResult = z.infer<typeof SandboxResultSchema>;
export type AutoReviewFocus = z.infer<typeof AutoReviewFocusSchema>;
export type AutoReviewScope = z.infer<typeof AutoReviewScopeSchema>;
export type AutoReviewRequest = z.infer<typeof AutoReviewRequestSchema>;
export type AutoReviewFinding = z.infer<typeof AutoReviewFindingSchema>;
export type AutoReviewResult = z.infer<typeof AutoReviewResultSchema>;
export type ToolApprovalRequester = z.infer<typeof ToolApprovalRequesterSchema>;
export type ToolApprovalPreview = z.infer<typeof ToolApprovalPreviewSchema>;
export type ToolReceiptStatus = z.infer<typeof ToolReceiptStatusSchema>;
export type ToolReceipt = z.infer<typeof ToolReceiptSchema>;
export type ToolRuntimeEventKind = z.infer<typeof ToolRuntimeEventKindSchema>;
export type ToolRuntimeToolEvent = z.infer<typeof ToolRuntimeToolEventSchema>;
export type ToolRuntimeSandboxEvent = z.infer<typeof ToolRuntimeSandboxEventSchema>;
export type ToolRuntimeAutoReviewEvent = z.infer<typeof ToolRuntimeAutoReviewEventSchema>;
export type ToolRuntimeEvent = z.infer<typeof ToolRuntimeEventSchema>;

import { z } from 'zod';

import {
  ActionIntent,
  ActionIntentSchema,
  ApprovalScopeSchema,
  ApprovalScopeValues,
  ApprovalDecision,
  ApprovalDecisionSchema,
  ApprovalStatusSchema,
  ChatRoleSchema,
  ChatRoleValues,
  ChatRouteRecordSchema,
  ExecutionPlanModeSchema,
  ExecutionPlanModeValues,
  ExecutionStepRecordSchema,
  LearningSourceTypeSchema,
  LearningSourceTypeValues,
  LlmUsageModelRecordSchema,
  LlmUsageRecordSchema,
  ModelRouteDecisionSchema,
  PendingActionRecordSchema,
  PendingApprovalRecordSchema,
  QueueStateRecordSchema,
  ReviewDecisionSchema,
  ReviewDecisionValues,
  RiskLevelSchema,
  RiskLevelValues,
  SkillStatusValues,
  SkillStatusSchema,
  TaskStatus,
  TaskStatusSchema,
  TrustClassSchema,
  TrustClassValues,
  WorkflowPresetDefinitionSchema
} from '../spec/primitives';

export {
  ActionIntent,
  ApprovalDecision,
  ApprovalScopeValues,
  ChatRoleValues,
  ExecutionPlanModeValues,
  LearningSourceTypeValues,
  ReviewDecisionValues,
  RiskLevelValues,
  SkillStatusValues,
  TaskStatus,
  TrustClassValues
};

export type SkillStatus = z.infer<typeof SkillStatusSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type ActionIntent = z.infer<typeof ActionIntentSchema>;
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;
export type ApprovalScope = z.infer<typeof ApprovalScopeSchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type LearningSourceType = z.infer<typeof LearningSourceTypeSchema>;
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;
export type TrustClass = z.infer<typeof TrustClassSchema>;
export type ChatRole = z.infer<typeof ChatRoleSchema>;
export type ExecutionPlanMode = z.infer<typeof ExecutionPlanModeSchema>;
export type QueueStateRecord = z.infer<typeof QueueStateRecordSchema>;
export type LlmUsageModelRecord = z.infer<typeof LlmUsageModelRecordSchema>;
export type LlmUsageRecord = z.infer<typeof LlmUsageRecordSchema>;
export type ModelRouteDecision = z.infer<typeof ModelRouteDecisionSchema>;
export type PendingActionRecord = z.infer<typeof PendingActionRecordSchema>;
export type PendingApprovalRecord = z.infer<typeof PendingApprovalRecordSchema>;
export type WorkflowPresetDefinition = z.infer<typeof WorkflowPresetDefinitionSchema>;
export type ExecutionStepRecord = z.infer<typeof ExecutionStepRecordSchema>;
export type ChatRouteRecord = z.infer<typeof ChatRouteRecordSchema>;

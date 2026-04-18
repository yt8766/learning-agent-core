import { z } from 'zod';

import {
  ActionIntentSchema,
  AgentRoleSchema,
  ApprovalScopeSchema,
  ApprovalDecisionSchema,
  ApprovalStatusSchema,
  ChatRoleSchema,
  ChatRouteRecordSchema,
  ExecutionModeSchema,
  ExecutionPlanModeSchema,
  ExecutionStepRecordSchema,
  LearningSourceTypeSchema,
  LlmUsageModelRecordSchema,
  LlmUsageRecordSchema,
  ModelRouteDecisionSchema,
  PendingActionRecordSchema,
  PendingApprovalRecordSchema,
  QueueStateRecordSchema,
  ReviewDecisionSchema,
  RiskLevelSchema,
  SkillStatusSchema,
  SubgraphIdSchema,
  TaskStatusSchema,
  TrustClassSchema,
  WorkflowPresetDefinitionSchema,
  WorkflowVersionRecordSchema
} from '../schemas/primitives.schema';

export type SkillStatus = z.infer<typeof SkillStatusSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type ActionIntent = z.infer<typeof ActionIntentSchema>;
export type AgentRole = z.infer<typeof AgentRoleSchema>;
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;
export type ApprovalScope = z.infer<typeof ApprovalScopeSchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type LearningSourceType = z.infer<typeof LearningSourceTypeSchema>;
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;
export type TrustClass = z.infer<typeof TrustClassSchema>;
export type ChatRole = z.infer<typeof ChatRoleSchema>;
export type ExecutionMode = z.infer<typeof ExecutionModeSchema>;
export type ExecutionPlanMode = z.infer<typeof ExecutionPlanModeSchema>;
export type QueueStateRecord = z.infer<typeof QueueStateRecordSchema>;
export type LlmUsageModelRecord = z.infer<typeof LlmUsageModelRecordSchema>;
export type LlmUsageRecord = z.infer<typeof LlmUsageRecordSchema>;
export type ModelRouteDecision = z.infer<typeof ModelRouteDecisionSchema>;
export type PendingActionRecord = z.infer<typeof PendingActionRecordSchema>;
export type PendingApprovalRecord = z.infer<typeof PendingApprovalRecordSchema>;
export type WorkflowPresetDefinition = z.infer<typeof WorkflowPresetDefinitionSchema>;
export type WorkflowVersionRecord = z.infer<typeof WorkflowVersionRecordSchema>;
export type ExecutionStepRecord = z.infer<typeof ExecutionStepRecordSchema>;
export type ExecutionStepRoute = ExecutionStepRecord['route'];
export type ExecutionStepStage = ExecutionStepRecord['stage'];
export type ExecutionStepStatus = ExecutionStepRecord['status'];
export type ExecutionStepOwner = ExecutionStepRecord['owner'];
export type ChatRouteRecord = z.infer<typeof ChatRouteRecordSchema>;
export type SubgraphId = z.infer<typeof SubgraphIdSchema>;

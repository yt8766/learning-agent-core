import { z } from 'zod';

import {
  AgentExecutionStateSchema,
  AgentMessageRecordSchema,
  AgentTokenEventSchema,
  BlackboardStateRecordSchema,
  BudgetGateStateRecordSchema,
  ComplexTaskPlanRecordSchema,
  ContextFilterRecordSchema,
  ContextSliceRecordSchema,
  CriticStateRecordSchema,
  CritiqueResultRecordSchema,
  CurrentSkillExecutionRecordSchema,
  DispatchInstructionSchema,
  EvaluationReportRecordSchema,
  FinalReviewRecordSchema,
  GuardrailStateRecordSchema,
  GovernanceReportRecordSchema,
  GovernanceScoreRecordSchema,
  InternalSubAgentResultSchema,
  KnowledgeIndexStateRecordSchema,
  KnowledgeIngestionStateRecordSchema,
  ManagerPlanSchema,
  MicroLoopStateRecordSchema,
  ReviewRecordSchema,
  SandboxStateRecordSchema,
  SpecialistFindingRecordSchema,
  SpecialistLeadRecordSchema,
  SpecialistSupportRecordSchema,
  SubTaskRecordSchema
} from '../schemas/orchestration';

export type AgentMessageRecord = z.infer<typeof AgentMessageRecordSchema>;
export type AgentTokenEvent = z.infer<typeof AgentTokenEventSchema>;
export type SubTaskRecord = z.infer<typeof SubTaskRecordSchema>;
export type ManagerPlan = z.infer<typeof ManagerPlanSchema>;
export type ReviewRecord = z.infer<typeof ReviewRecordSchema>;
export type DispatchInstruction = z.infer<typeof DispatchInstructionSchema>;
export type SpecialistLeadRecord = z.infer<typeof SpecialistLeadRecordSchema>;
export type SpecialistSupportRecord = z.infer<typeof SpecialistSupportRecordSchema>;
export type SpecialistFindingRecord = z.infer<typeof SpecialistFindingRecordSchema>;
export type ContextSliceRecord = z.infer<typeof ContextSliceRecordSchema>;
export type CritiqueResultRecord = z.infer<typeof CritiqueResultRecordSchema>;
export type ContextFilterRecord = z.infer<typeof ContextFilterRecordSchema>;
export type FinalReviewRecord = z.infer<typeof FinalReviewRecordSchema>;
export type GuardrailStateRecord = z.infer<typeof GuardrailStateRecordSchema>;
export type CriticStateRecord = z.infer<typeof CriticStateRecordSchema>;
export type SandboxStateRecord = z.infer<typeof SandboxStateRecordSchema>;
export type KnowledgeIngestionStateRecord = z.infer<typeof KnowledgeIngestionStateRecordSchema>;
export type KnowledgeIndexStateRecord = z.infer<typeof KnowledgeIndexStateRecordSchema>;
export type EvaluationReportRecord = z.infer<typeof EvaluationReportRecordSchema>;
export type InternalSubAgentResult = z.infer<typeof InternalSubAgentResultSchema>;
export type GovernanceScoreRecord = z.infer<typeof GovernanceScoreRecordSchema>;
export type GovernanceReportRecord = z.infer<typeof GovernanceReportRecordSchema>;
export type BudgetGateStateRecord = z.infer<typeof BudgetGateStateRecordSchema>;
export type ComplexTaskPlanRecord = z.infer<typeof ComplexTaskPlanRecordSchema>;
export type BlackboardStateRecord = z.infer<typeof BlackboardStateRecordSchema>;
export type MicroLoopStateRecord = z.infer<typeof MicroLoopStateRecordSchema>;
export type CurrentSkillExecutionRecord = z.infer<typeof CurrentSkillExecutionRecordSchema>;
export type AgentExecutionState = z.infer<typeof AgentExecutionStateSchema>;

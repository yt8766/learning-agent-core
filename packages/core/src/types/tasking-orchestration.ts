import { z } from 'zod';

import {
  AgentExecutionStateSchema,
  AgentMessageRecordSchema,
  BlackboardStateRecordSchema,
  BudgetGateStateRecordSchema,
  ComplexTaskPlanRecordSchema,
  ContextSliceRecordSchema,
  CritiqueResultRecordSchema,
  CurrentSkillExecutionRecordSchema,
  DispatchInstructionSchema,
  GovernanceReportRecordSchema,
  GovernanceScoreRecordSchema,
  ManagerPlanSchema,
  MicroLoopStateRecordSchema,
  ReviewRecordSchema,
  SpecialistFindingRecordSchema,
  SpecialistLeadRecordSchema,
  SpecialistSupportRecordSchema,
  SubTaskRecordSchema
} from '../spec/tasking-orchestration';

export type AgentMessageRecord = z.infer<typeof AgentMessageRecordSchema>;
export type SubTaskRecord = z.infer<typeof SubTaskRecordSchema>;
export type ManagerPlan = z.infer<typeof ManagerPlanSchema>;
export type ReviewRecord = z.infer<typeof ReviewRecordSchema>;
export type DispatchInstruction = z.infer<typeof DispatchInstructionSchema>;
export type SpecialistLeadRecord = z.infer<typeof SpecialistLeadRecordSchema>;
export type SpecialistSupportRecord = z.infer<typeof SpecialistSupportRecordSchema>;
export type SpecialistFindingRecord = z.infer<typeof SpecialistFindingRecordSchema>;
export type ContextSliceRecord = z.infer<typeof ContextSliceRecordSchema>;
export type CritiqueResultRecord = z.infer<typeof CritiqueResultRecordSchema>;
export type GovernanceScoreRecord = z.infer<typeof GovernanceScoreRecordSchema>;
export type GovernanceReportRecord = z.infer<typeof GovernanceReportRecordSchema>;
export type BudgetGateStateRecord = z.infer<typeof BudgetGateStateRecordSchema>;
export type ComplexTaskPlanRecord = z.infer<typeof ComplexTaskPlanRecordSchema>;
export type BlackboardStateRecord = z.infer<typeof BlackboardStateRecordSchema>;
export type MicroLoopStateRecord = z.infer<typeof MicroLoopStateRecordSchema>;
export type CurrentSkillExecutionRecord = z.infer<typeof CurrentSkillExecutionRecordSchema>;
export type AgentExecutionState = z.infer<typeof AgentExecutionStateSchema>;

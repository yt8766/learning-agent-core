import { z } from 'zod';

export const ApprovalDecisionRecordSchema = z.object({
  intent: z.string().optional(),
  decision: z.string(),
  reason: z.string().optional()
});

export const PlatformApprovalPreviewItemSchema = z.object({
  label: z.string(),
  value: z.string()
});

export const PlatformApprovalInterruptRecordSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'resolved', 'cancelled']),
  mode: z.enum(['blocking', 'non-blocking']),
  source: z.enum(['graph', 'tool']),
  kind: z.enum(['tool-approval', 'skill-install', 'connector-governance', 'runtime-governance', 'user-input']),
  intent: z.string().optional(),
  toolName: z.string().optional(),
  requestedBy: z.string().optional(),
  reason: z.string().optional(),
  riskLevel: z.string().optional(),
  resumeStrategy: z.enum(['command', 'approval-recovery']),
  preview: z.array(PlatformApprovalPreviewItemSchema).optional(),
  payload: z.record(z.string(), z.unknown()).optional()
});

export const PlatformApprovalQuestionSetRecordSchema = z.object({
  title: z.string().optional(),
  summary: z.string().optional()
});

export const PlatformApprovalMicroBudgetRecordSchema = z.object({
  readOnlyToolLimit: z.number(),
  readOnlyToolsUsed: z.number(),
  tokenBudgetUsd: z.number().optional(),
  budgetTriggered: z.boolean()
});

export const PlatformApprovalPlanDraftRecordSchema = z.object({
  summary: z.string(),
  autoResolved: z.array(z.string()),
  openQuestions: z.array(z.string()),
  assumptions: z.array(z.string()),
  questionSet: PlatformApprovalQuestionSetRecordSchema.optional(),
  microBudget: PlatformApprovalMicroBudgetRecordSchema.optional()
});

export const PlatformApprovalPendingApprovalSchema = z.object({
  toolName: z.string().optional(),
  intent: z.string().optional(),
  riskLevel: z.string().optional(),
  requestedBy: z.string().optional(),
  reason: z.string().optional(),
  reasonCode: z.string().optional(),
  preview: z.array(PlatformApprovalPreviewItemSchema).optional()
});

export const PlatformApprovalInterruptControllerStateSchema = z.object({
  activeInterrupt: z.record(z.string(), z.unknown()).optional(),
  interruptHistory: z.array(z.record(z.string(), z.unknown()))
});

export const PlatformApprovalRecordSchema = z.object({
  taskId: z.string(),
  goal: z.string(),
  status: z.string(),
  sessionId: z.string().optional(),
  currentMinistry: z.string().optional(),
  currentWorker: z.string().optional(),
  executionMode: z.enum(['standard', 'planning-readonly', 'plan', 'execute', 'imperial_direct']).optional(),
  pendingApproval: PlatformApprovalPendingApprovalSchema.optional(),
  activeInterrupt: PlatformApprovalInterruptRecordSchema.optional(),
  entryRouterState: z.record(z.string(), z.unknown()).optional(),
  interruptControllerState: PlatformApprovalInterruptControllerStateSchema.optional(),
  planDraft: PlatformApprovalPlanDraftRecordSchema.optional(),
  approvals: z.array(ApprovalDecisionRecordSchema),
  commandPreview: z.string().optional(),
  riskReason: z.string().optional(),
  riskCode: z.string().optional(),
  approvalScope: z.union([z.literal('once'), z.literal('session'), z.literal('always'), z.string()]).optional(),
  policyMatchStatus: z.string().optional(),
  policyMatchSource: z.string().optional(),
  lastStreamStatusAt: z.string().optional()
});

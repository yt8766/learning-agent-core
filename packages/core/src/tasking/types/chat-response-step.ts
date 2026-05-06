import type { z } from 'zod';

import type {
  ChatAgentOsGroupKindSchema,
  ChatAgentOsGroupSchema,
  ChatResponseStepEventSchema,
  ChatResponseStepAgentScopeSchema,
  ChatResponseStepPhaseSchema,
  ChatResponseStepRecordSchema,
  ChatResponseStepSnapshotSchema,
  ChatResponseStepStatusSchema,
  ChatResponseStepSummarySchema,
  ChatResponseStepTargetSchema,
  ChatTurnDisplayModeSchema
} from '../schemas/chat-response-step';

export type ChatResponseStepPhase = z.infer<typeof ChatResponseStepPhaseSchema>;
export type ChatResponseStepAgentScope = z.infer<typeof ChatResponseStepAgentScopeSchema>;
export type ChatResponseStepStatus = z.infer<typeof ChatResponseStepStatusSchema>;
export type ChatResponseStepTarget = z.infer<typeof ChatResponseStepTargetSchema>;
export type ChatResponseStepRecord = z.infer<typeof ChatResponseStepRecordSchema>;
export type ChatTurnDisplayMode = z.infer<typeof ChatTurnDisplayModeSchema>;
export type ChatAgentOsGroupKind = z.infer<typeof ChatAgentOsGroupKindSchema>;
export type ChatAgentOsGroup = z.infer<typeof ChatAgentOsGroupSchema>;
export type ChatResponseStepSummary = z.infer<typeof ChatResponseStepSummarySchema>;
export type ChatResponseStepSnapshot = z.infer<typeof ChatResponseStepSnapshotSchema>;
export type ChatResponseStepEvent = z.infer<typeof ChatResponseStepEventSchema>;

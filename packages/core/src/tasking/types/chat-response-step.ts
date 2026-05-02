import type { z } from 'zod';

import type {
  ChatResponseStepEventSchema,
  ChatResponseStepPhaseSchema,
  ChatResponseStepRecordSchema,
  ChatResponseStepSnapshotSchema,
  ChatResponseStepStatusSchema,
  ChatResponseStepSummarySchema,
  ChatResponseStepTargetSchema
} from '../schemas/chat-response-step';

export type ChatResponseStepPhase = z.infer<typeof ChatResponseStepPhaseSchema>;
export type ChatResponseStepStatus = z.infer<typeof ChatResponseStepStatusSchema>;
export type ChatResponseStepTarget = z.infer<typeof ChatResponseStepTargetSchema>;
export type ChatResponseStepRecord = z.infer<typeof ChatResponseStepRecordSchema>;
export type ChatResponseStepSummary = z.infer<typeof ChatResponseStepSummarySchema>;
export type ChatResponseStepSnapshot = z.infer<typeof ChatResponseStepSnapshotSchema>;
export type ChatResponseStepEvent = z.infer<typeof ChatResponseStepEventSchema>;

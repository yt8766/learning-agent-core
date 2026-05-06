import { z } from 'zod';

import { KnowledgePreRetrievalPlanSchema } from './knowledge-rag-planning.schema';
import {
  KnowledgeRagErrorSchema,
  KnowledgeRagResultSchema,
  KnowledgeRagRunAnswerSchema,
  KnowledgeRagRetrievalResultSchema
} from './knowledge-rag-result.schema';

export const KnowledgeRagStageSchema = z.enum(['planner', 'retrieval', 'answer']);

const KnowledgeRagRunIdSchema = z.object({
  runId: z.string()
});

export const KnowledgeRagStartedEventSchema = KnowledgeRagRunIdSchema.extend({
  type: z.literal('rag.started')
});

export const KnowledgeRagPlannerStartedEventSchema = KnowledgeRagRunIdSchema.extend({
  type: z.literal('planner.started')
});

export const KnowledgeRagPlannerCompletedEventSchema = KnowledgeRagRunIdSchema.extend({
  type: z.literal('planner.completed'),
  plan: KnowledgePreRetrievalPlanSchema
});

export const KnowledgeRagRetrievalStartedEventSchema = KnowledgeRagRunIdSchema.extend({
  type: z.literal('retrieval.started'),
  plan: KnowledgePreRetrievalPlanSchema.optional()
});

export const KnowledgeRagRetrievalCompletedEventSchema = KnowledgeRagRunIdSchema.extend({
  type: z.literal('retrieval.completed'),
  retrieval: KnowledgeRagRetrievalResultSchema
});

export const KnowledgeRagAnswerStartedEventSchema = KnowledgeRagRunIdSchema.extend({
  type: z.literal('answer.started')
});

export const KnowledgeRagAnswerDeltaEventSchema = KnowledgeRagRunIdSchema.extend({
  type: z.literal('answer.delta'),
  delta: z.string()
});

export const KnowledgeRagAnswerCompletedEventSchema = KnowledgeRagRunIdSchema.extend({
  type: z.literal('answer.completed'),
  answer: KnowledgeRagRunAnswerSchema
});

export const KnowledgeRagCompletedEventSchema = KnowledgeRagRunIdSchema.extend({
  type: z.literal('rag.completed'),
  result: KnowledgeRagResultSchema
});

export const KnowledgeRagErrorEventSchema = KnowledgeRagRunIdSchema.extend({
  type: z.literal('rag.error'),
  stage: KnowledgeRagStageSchema.optional(),
  error: KnowledgeRagErrorSchema
});

export const KnowledgeRagStreamEventSchema = z.discriminatedUnion('type', [
  KnowledgeRagStartedEventSchema,
  KnowledgeRagPlannerStartedEventSchema,
  KnowledgeRagPlannerCompletedEventSchema,
  KnowledgeRagRetrievalStartedEventSchema,
  KnowledgeRagRetrievalCompletedEventSchema,
  KnowledgeRagAnswerStartedEventSchema,
  KnowledgeRagAnswerDeltaEventSchema,
  KnowledgeRagAnswerCompletedEventSchema,
  KnowledgeRagCompletedEventSchema,
  KnowledgeRagErrorEventSchema
]);

export type KnowledgeRagStage = z.infer<typeof KnowledgeRagStageSchema>;
export type KnowledgeRagStartedEvent = z.infer<typeof KnowledgeRagStartedEventSchema>;
export type KnowledgeRagPlannerStartedEvent = z.infer<typeof KnowledgeRagPlannerStartedEventSchema>;
export type KnowledgeRagPlannerCompletedEvent = z.infer<typeof KnowledgeRagPlannerCompletedEventSchema>;
export type KnowledgeRagRetrievalStartedEvent = z.infer<typeof KnowledgeRagRetrievalStartedEventSchema>;
export type KnowledgeRagRetrievalCompletedEvent = z.infer<typeof KnowledgeRagRetrievalCompletedEventSchema>;
export type KnowledgeRagAnswerStartedEvent = z.infer<typeof KnowledgeRagAnswerStartedEventSchema>;
export type KnowledgeRagAnswerDeltaEvent = z.infer<typeof KnowledgeRagAnswerDeltaEventSchema>;
export type KnowledgeRagAnswerCompletedEvent = z.infer<typeof KnowledgeRagAnswerCompletedEventSchema>;
export type KnowledgeRagCompletedEvent = z.infer<typeof KnowledgeRagCompletedEventSchema>;
export type KnowledgeRagErrorEvent = z.infer<typeof KnowledgeRagErrorEventSchema>;
export type KnowledgeRagStreamEvent = z.infer<typeof KnowledgeRagStreamEventSchema>;

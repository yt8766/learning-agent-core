import { z } from 'zod';

import { ExecutionAutoReviewRecordSchema } from './execution-auto-review';
import { ChatPendingInteractionSchema } from './chat-interaction';

export const ChatViewStreamEventTypeSchema = z.enum([
  'ready',
  'session_updated',
  'run_status',
  'fragment_started',
  'fragment_delta',
  'fragment_completed',
  'step_updated',
  'auto_review_completed',
  'interaction_waiting',
  'user_reply_interpreted',
  'interaction_resolved',
  'tool_execution_started',
  'tool_execution_completed',
  'error',
  'close'
]);

const ChatViewReadyDataSchema = z.object({
  requestMessageId: z.string(),
  responseMessageId: z.string().optional(),
  modelId: z.string().optional(),
  thinkingEnabled: z.boolean().optional()
});

const ChatViewFragmentDeltaDataSchema = z.object({
  messageId: z.string(),
  fragmentId: z.string(),
  delta: z.string()
});

const ChatViewAutoReviewCompletedDataSchema = z.object({
  review: ExecutionAutoReviewRecordSchema
});

const ChatViewInteractionWaitingDataSchema = z.object({
  interaction: ChatPendingInteractionSchema,
  naturalLanguageOnly: z.boolean().optional()
});

const ChatViewErrorDataSchema = z.object({
  code: z.string(),
  message: z.string(),
  recoverable: z.boolean().optional()
});

const ChatViewCloseDataSchema = z.object({
  reason: z.enum(['completed', 'error', 'cancelled', 'idle']),
  retryable: z.boolean().optional(),
  autoResume: z.boolean().optional()
});

const ChatViewGenericDataSchema = z.record(z.string(), z.unknown());

const ChatViewStreamEventBaseSchema = z.object({
  id: z.string(),
  seq: z.number(),
  sessionId: z.string(),
  runId: z.string(),
  at: z.string()
});

export const ChatViewReadyEventSchema = ChatViewStreamEventBaseSchema.extend({
  event: z.literal('ready'),
  data: ChatViewReadyDataSchema
});

export const ChatViewFragmentDeltaEventSchema = ChatViewStreamEventBaseSchema.extend({
  event: z.literal('fragment_delta'),
  data: ChatViewFragmentDeltaDataSchema
});

export const ChatViewAutoReviewCompletedEventSchema = ChatViewStreamEventBaseSchema.extend({
  event: z.literal('auto_review_completed'),
  data: ChatViewAutoReviewCompletedDataSchema
});

export const ChatViewInteractionWaitingEventSchema = ChatViewStreamEventBaseSchema.extend({
  event: z.literal('interaction_waiting'),
  data: ChatViewInteractionWaitingDataSchema
});

export const ChatViewErrorEventSchema = ChatViewStreamEventBaseSchema.extend({
  event: z.literal('error'),
  data: ChatViewErrorDataSchema
});

export const ChatViewCloseEventSchema = ChatViewStreamEventBaseSchema.extend({
  event: z.literal('close'),
  data: ChatViewCloseDataSchema
});

const ChatViewGenericEventSchema = ChatViewStreamEventBaseSchema.extend({
  event: z.enum([
    'session_updated',
    'run_status',
    'fragment_started',
    'fragment_completed',
    'step_updated',
    'user_reply_interpreted',
    'interaction_resolved',
    'tool_execution_started',
    'tool_execution_completed'
  ]),
  data: ChatViewGenericDataSchema
});

export const ChatViewStreamEventSchema = z.discriminatedUnion('event', [
  ChatViewReadyEventSchema,
  ChatViewFragmentDeltaEventSchema,
  ChatViewAutoReviewCompletedEventSchema,
  ChatViewInteractionWaitingEventSchema,
  ChatViewErrorEventSchema,
  ChatViewCloseEventSchema,
  ChatViewGenericEventSchema
]);

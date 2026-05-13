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

const ChatViewFragmentKindSchema = z.enum([
  'thinking',
  'response',
  'tool_call',
  'tool_result',
  'evidence',
  'system_note',
  'error'
]);

const ChatViewFragmentStartedDataSchema = z
  .object({
    messageId: z.string(),
    fragmentId: z.string(),
    kind: ChatViewFragmentKindSchema,
    status: z.literal('streaming'),
    title: z.string().optional()
  })
  .strict();

const ChatViewFragmentCompletedDataSchema = z
  .object({
    messageId: z.string(),
    fragmentId: z.string(),
    kind: ChatViewFragmentKindSchema,
    status: z.enum(['completed', 'failed']),
    content: z.string(),
    elapsedMs: z.number().optional()
  })
  .strict();

const ChatViewRunStatusDataSchema = z
  .object({
    status: z.enum([
      'queued',
      'running',
      'thinking',
      'streaming_response',
      'waiting_interaction',
      'completed',
      'failed',
      'cancelled'
    ]),
    completedAt: z.string().optional(),
    reason: z.string().optional()
  })
  .strict();

const ChatViewReferenceDataSchema = z
  .object({
    id: z.string(),
    title: z.string().optional(),
    url: z.string().optional(),
    sourceType: z.string().optional()
  })
  .strict();

const ChatViewToolExecutionDataSchema = z
  .object({
    toolName: z.string(),
    toolDisplayName: z.string().optional(),
    stage: z.string().optional(),
    status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']),
    riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    userFacingSummary: z.string(),
    artifactId: z.string().optional(),
    artifactKind: z.string().optional(),
    artifactTitle: z.string().optional(),
    elapsedMs: z.number().optional(),
    references: z.array(ChatViewReferenceDataSchema).optional()
  })
  .strict();

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
  seq: z.number().int().nonnegative(),
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

export const ChatViewFragmentStartedEventSchema = ChatViewStreamEventBaseSchema.extend({
  event: z.literal('fragment_started'),
  data: ChatViewFragmentStartedDataSchema
});

export const ChatViewFragmentCompletedEventSchema = ChatViewStreamEventBaseSchema.extend({
  event: z.literal('fragment_completed'),
  data: ChatViewFragmentCompletedDataSchema
});

export const ChatViewRunStatusEventSchema = ChatViewStreamEventBaseSchema.extend({
  event: z.literal('run_status'),
  data: ChatViewRunStatusDataSchema
});

export const ChatViewToolExecutionStartedEventSchema = ChatViewStreamEventBaseSchema.extend({
  event: z.literal('tool_execution_started'),
  data: ChatViewToolExecutionDataSchema
});

export const ChatViewToolExecutionCompletedEventSchema = ChatViewStreamEventBaseSchema.extend({
  event: z.literal('tool_execution_completed'),
  data: ChatViewToolExecutionDataSchema
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
  event: z.enum(['session_updated', 'step_updated', 'user_reply_interpreted', 'interaction_resolved']),
  data: ChatViewGenericDataSchema
});

export const ChatViewStreamEventSchema = z.discriminatedUnion('event', [
  ChatViewReadyEventSchema,
  ChatViewFragmentDeltaEventSchema,
  ChatViewFragmentStartedEventSchema,
  ChatViewFragmentCompletedEventSchema,
  ChatViewRunStatusEventSchema,
  ChatViewToolExecutionStartedEventSchema,
  ChatViewToolExecutionCompletedEventSchema,
  ChatViewAutoReviewCompletedEventSchema,
  ChatViewInteractionWaitingEventSchema,
  ChatViewErrorEventSchema,
  ChatViewCloseEventSchema,
  ChatViewGenericEventSchema
]);

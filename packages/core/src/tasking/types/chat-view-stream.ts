import type { z } from 'zod';

import type {
  ChatViewAutoReviewCompletedEventSchema,
  ChatViewCloseEventSchema,
  ChatViewErrorEventSchema,
  ChatViewFragmentCompletedEventSchema,
  ChatViewFragmentDeltaEventSchema,
  ChatViewFragmentStartedEventSchema,
  ChatViewInteractionWaitingEventSchema,
  ChatViewReadyEventSchema,
  ChatViewRunStatusEventSchema,
  ChatViewStreamEventSchema,
  ChatViewStreamEventTypeSchema,
  ChatViewToolExecutionCompletedEventSchema,
  ChatViewToolExecutionStartedEventSchema
} from '../schemas/chat-view-stream';

export type ChatViewStreamEventType = z.infer<typeof ChatViewStreamEventTypeSchema>;
export type ChatViewReadyEvent = z.infer<typeof ChatViewReadyEventSchema>;
export type ChatViewFragmentDeltaEvent = z.infer<typeof ChatViewFragmentDeltaEventSchema>;
export type ChatViewFragmentStartedEvent = z.infer<typeof ChatViewFragmentStartedEventSchema>;
export type ChatViewFragmentCompletedEvent = z.infer<typeof ChatViewFragmentCompletedEventSchema>;
export type ChatViewRunStatusEvent = z.infer<typeof ChatViewRunStatusEventSchema>;
export type ChatViewToolExecutionStartedEvent = z.infer<typeof ChatViewToolExecutionStartedEventSchema>;
export type ChatViewToolExecutionCompletedEvent = z.infer<typeof ChatViewToolExecutionCompletedEventSchema>;
export type ChatViewAutoReviewCompletedEvent = z.infer<typeof ChatViewAutoReviewCompletedEventSchema>;
export type ChatViewInteractionWaitingEvent = z.infer<typeof ChatViewInteractionWaitingEventSchema>;
export type ChatViewErrorEvent = z.infer<typeof ChatViewErrorEventSchema>;
export type ChatViewCloseEvent = z.infer<typeof ChatViewCloseEventSchema>;
export type ChatViewStreamEvent = z.infer<typeof ChatViewStreamEventSchema>;

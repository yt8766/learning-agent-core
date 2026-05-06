import type { z } from 'zod';

import type {
  ChatViewAutoReviewCompletedEventSchema,
  ChatViewCloseEventSchema,
  ChatViewErrorEventSchema,
  ChatViewFragmentDeltaEventSchema,
  ChatViewInteractionWaitingEventSchema,
  ChatViewReadyEventSchema,
  ChatViewStreamEventSchema,
  ChatViewStreamEventTypeSchema
} from '../schemas/chat-view-stream';

export type ChatViewStreamEventType = z.infer<typeof ChatViewStreamEventTypeSchema>;
export type ChatViewReadyEvent = z.infer<typeof ChatViewReadyEventSchema>;
export type ChatViewFragmentDeltaEvent = z.infer<typeof ChatViewFragmentDeltaEventSchema>;
export type ChatViewAutoReviewCompletedEvent = z.infer<typeof ChatViewAutoReviewCompletedEventSchema>;
export type ChatViewInteractionWaitingEvent = z.infer<typeof ChatViewInteractionWaitingEventSchema>;
export type ChatViewErrorEvent = z.infer<typeof ChatViewErrorEventSchema>;
export type ChatViewCloseEvent = z.infer<typeof ChatViewCloseEventSchema>;
export type ChatViewStreamEvent = z.infer<typeof ChatViewStreamEventSchema>;

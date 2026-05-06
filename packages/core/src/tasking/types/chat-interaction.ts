import type { z } from 'zod';

import type {
  ApprovalReplyIntentActionSchema,
  ApprovalReplyIntentConfidenceSchema,
  ApprovalReplyIntentSchema,
  ChatPendingInteractionActionSchema,
  ChatPendingInteractionKindSchema,
  ChatPendingInteractionSchema,
  ChatPendingInteractionStatusSchema
} from '../schemas/chat-interaction';

export type ChatPendingInteractionKind = z.infer<typeof ChatPendingInteractionKindSchema>;
export type ChatPendingInteractionStatus = z.infer<typeof ChatPendingInteractionStatusSchema>;
export type ChatPendingInteractionAction = z.infer<typeof ChatPendingInteractionActionSchema>;
export type ChatPendingInteraction = z.infer<typeof ChatPendingInteractionSchema>;
export type ApprovalReplyIntentAction = z.infer<typeof ApprovalReplyIntentActionSchema>;
export type ApprovalReplyIntentConfidence = z.infer<typeof ApprovalReplyIntentConfidenceSchema>;
export type ApprovalReplyIntent = z.infer<typeof ApprovalReplyIntentSchema>;

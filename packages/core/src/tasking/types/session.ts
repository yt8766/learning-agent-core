import { z } from 'zod';

import {
  ChannelIdentitySchema,
  ChannelKindSchema,
  ChatSessionTitleSourceSchema,
  ChatMessageFeedbackRatingSchema,
  ChatMessageFeedbackReasonCodeSchema,
  ChatMessageFeedbackRecordSchema,
  ChatMessageFeedbackRequestSchema,
  ChatSessionApprovalPoliciesSchema,
  ChatSessionCompressionPreviewMessageSchema,
  ChatSessionCompressionRecordSchema,
  ChatSessionRecordSchema
} from '../schemas/session';

export type ChannelKind = z.infer<typeof ChannelKindSchema>;
export type ChannelIdentity = z.infer<typeof ChannelIdentitySchema>;
export type ChatSessionTitleSource = z.infer<typeof ChatSessionTitleSourceSchema>;
export type ChatMessageFeedbackRating = z.infer<typeof ChatMessageFeedbackRatingSchema>;
export type ChatMessageFeedbackReasonCode = z.infer<typeof ChatMessageFeedbackReasonCodeSchema>;
export type ChatMessageFeedbackRequest = z.infer<typeof ChatMessageFeedbackRequestSchema>;
export type ChatMessageFeedbackRecord = z.infer<typeof ChatMessageFeedbackRecordSchema>;
export type ChatSessionCompressionPreviewMessage = z.infer<typeof ChatSessionCompressionPreviewMessageSchema>;
export type ChatSessionCompressionRecord = z.infer<typeof ChatSessionCompressionRecordSchema>;
export type ChatSessionApprovalPolicies = z.infer<typeof ChatSessionApprovalPoliciesSchema>;
export type ChatSessionRecord = z.infer<typeof ChatSessionRecordSchema>;

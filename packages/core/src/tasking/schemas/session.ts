import { z } from 'zod';

import { ApprovalScopePolicyRecordSchema } from './governance-fields';

export const ChannelKindSchema = z.enum(['web', 'telegram', 'feishu', 'wechat']);
export const ChatSessionTitleSourceSchema = z.enum(['placeholder', 'generated', 'manual']);

export const ChannelIdentitySchema = z.object({
  channel: ChannelKindSchema,
  channelUserId: z.string().optional(),
  channelChatId: z.string().optional(),
  messageId: z.string().optional(),
  displayName: z.string().optional()
});

export const ChatSessionCompressionPreviewMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string()
});

export const ChatSessionCompressionRecordSchema = z.object({
  summary: z.string(),
  periodOrTopic: z.string().optional(),
  focuses: z.array(z.string()).optional(),
  keyDeliverables: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
  nextActions: z.array(z.string()).optional(),
  supportingFacts: z.array(z.string()).optional(),
  decisionSummary: z.string().optional(),
  confirmedPreferences: z.array(z.string()).optional(),
  openLoops: z.array(z.string()).optional(),
  condensedMessageCount: z.number(),
  condensedCharacterCount: z.number(),
  totalCharacterCount: z.number(),
  previewMessages: z.array(ChatSessionCompressionPreviewMessageSchema).optional(),
  trigger: z.enum(['message_count', 'character_count']),
  source: z.enum(['heuristic', 'llm']),
  summaryLength: z.number().optional(),
  heuristicFallback: z.boolean().optional(),
  effectiveThreshold: z.number().optional(),
  compressionProfile: z.enum(['default', 'long-flow', 'light-chat']).optional(),
  updatedAt: z.string()
});

export const ChatMessageFeedbackRatingSchema = z.enum(['helpful', 'unhelpful', 'none']);
export const ChatMessageFeedbackReasonCodeSchema = z.enum([
  'too_shallow',
  'incorrect',
  'missed_point',
  'bad_format',
  'other'
]);

function enforceChatMessageFeedbackReasonCode(
  value: {
    rating: z.infer<typeof ChatMessageFeedbackRatingSchema>;
    reasonCode?: z.infer<typeof ChatMessageFeedbackReasonCodeSchema>;
  },
  ctx: z.RefinementCtx
) {
  if (value.rating === 'unhelpful' && !value.reasonCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reasonCode'],
      message: 'reasonCode is required for unhelpful feedback'
    });
  }
  if (value.rating !== 'unhelpful' && value.reasonCode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reasonCode'],
      message: 'reasonCode is only allowed for unhelpful feedback'
    });
  }
}

export const ChatMessageFeedbackRequestSchema = z
  .object({
    sessionId: z.string().min(1),
    rating: ChatMessageFeedbackRatingSchema,
    reasonCode: ChatMessageFeedbackReasonCodeSchema.optional(),
    comment: z.string().trim().max(1000).optional()
  })
  .superRefine(enforceChatMessageFeedbackReasonCode);

export const ChatMessageFeedbackRecordSchema = z
  .object({
    messageId: z.string().min(1),
    sessionId: z.string().min(1),
    rating: ChatMessageFeedbackRatingSchema,
    reasonCode: ChatMessageFeedbackReasonCodeSchema.optional(),
    comment: z.string().max(1000).optional(),
    updatedAt: z.string().min(1)
  })
  .superRefine(enforceChatMessageFeedbackReasonCode);

export const ChatSessionApprovalPoliciesSchema = z.object({
  sessionAllowRules: z.array(ApprovalScopePolicyRecordSchema).optional()
});

export const ChatSessionRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum([
    'idle',
    'running',
    'waiting_interrupt',
    'waiting_approval',
    'waiting_learning_confirmation',
    'cancelled',
    'completed',
    'failed'
  ]),
  currentTaskId: z.string().optional(),
  titleSource: ChatSessionTitleSourceSchema.optional(),
  channelIdentity: ChannelIdentitySchema.optional(),
  compression: ChatSessionCompressionRecordSchema.optional(),
  approvalPolicies: ChatSessionApprovalPoliciesSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

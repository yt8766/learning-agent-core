import { z } from 'zod';

export const ChatPendingInteractionKindSchema = z.enum([
  'tool_approval',
  'auto_review_block',
  'plan_confirmation',
  'supplemental_input'
]);

export const ChatPendingInteractionStatusSchema = z.enum(['pending', 'resolved', 'cancelled', 'expired']);

export const ChatPendingInteractionActionSchema = z.enum(['approve', 'reject', 'feedback', 'input', 'abort']);

export const ChatPendingInteractionSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  runId: z.string(),
  kind: ChatPendingInteractionKindSchema,
  status: ChatPendingInteractionStatusSchema,
  promptMessageId: z.string(),
  interruptId: z.string().optional(),
  reviewId: z.string().optional(),
  expectedActions: z.array(ChatPendingInteractionActionSchema),
  requiredConfirmationPhrase: z.string().optional(),
  createdAt: z.string(),
  resolvedAt: z.string().optional()
});

export const ApprovalReplyIntentActionSchema = z.enum(['approve', 'reject', 'feedback', 'input', 'unknown']);

export const ApprovalReplyIntentConfidenceSchema = z.enum(['high', 'medium', 'low']);

export const ApprovalReplyIntentSchema = z.object({
  interactionId: z.string(),
  action: ApprovalReplyIntentActionSchema,
  confidence: ApprovalReplyIntentConfidenceSchema,
  originalText: z.string(),
  normalizedText: z.string(),
  matchedConfirmationPhrase: z.string().optional(),
  feedback: z.string().optional()
});

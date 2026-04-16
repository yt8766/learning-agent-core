import { z } from 'zod';

import { ApprovalScopePolicyRecordSchema } from './governance';

export const ChannelKindSchema = z.enum(['web', 'telegram', 'feishu', 'wechat']);

export type ChannelKind = z.infer<typeof ChannelKindSchema>;

export const ChannelIdentitySchema = z.object({
  channel: ChannelKindSchema,
  channelUserId: z.string().optional(),
  channelChatId: z.string().optional(),
  messageId: z.string().optional(),
  displayName: z.string().optional()
});

export type ChannelIdentity = z.infer<typeof ChannelIdentitySchema>;

export const ChatSessionCompressionPreviewMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string()
});

export type ChatSessionCompressionPreviewMessage = z.infer<typeof ChatSessionCompressionPreviewMessageSchema>;

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

export type ChatSessionCompressionRecord = z.infer<typeof ChatSessionCompressionRecordSchema>;

export const ChatSessionApprovalPoliciesSchema = z.object({
  sessionAllowRules: z.array(ApprovalScopePolicyRecordSchema).optional()
});

export type ChatSessionApprovalPolicies = z.infer<typeof ChatSessionApprovalPoliciesSchema>;

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
  channelIdentity: ChannelIdentitySchema.optional(),
  compression: ChatSessionCompressionRecordSchema.optional(),
  approvalPolicies: ChatSessionApprovalPoliciesSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type ChatSessionRecord = z.infer<typeof ChatSessionRecordSchema>;

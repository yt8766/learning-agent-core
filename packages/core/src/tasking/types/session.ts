import { z } from 'zod';

import {
  ChannelIdentitySchema,
  ChannelKindSchema,
  ChatSessionApprovalPoliciesSchema,
  ChatSessionCompressionPreviewMessageSchema,
  ChatSessionCompressionRecordSchema,
  ChatSessionRecordSchema
} from '../schemas/session';

export type ChannelKind = z.infer<typeof ChannelKindSchema>;
export type ChannelIdentity = z.infer<typeof ChannelIdentitySchema>;
export type ChatSessionCompressionPreviewMessage = z.infer<typeof ChatSessionCompressionPreviewMessageSchema>;
export type ChatSessionCompressionRecord = z.infer<typeof ChatSessionCompressionRecordSchema>;
export type ChatSessionApprovalPolicies = z.infer<typeof ChatSessionApprovalPoliciesSchema>;
export type ChatSessionRecord = z.infer<typeof ChatSessionRecordSchema>;

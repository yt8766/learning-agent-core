import { z } from 'zod';

import {
  ChatEventRecordSchema,
  ChatMessageCardSchema,
  ChatMessageRecordSchema,
  ChatThinkStateSchema,
  ChatThoughtChainItemSchema
} from '../schemas/chat';

export type ChatMessageCard = z.infer<typeof ChatMessageCardSchema>;
export type ChatMessageRecord = z.infer<typeof ChatMessageRecordSchema>;
export type ChatEventRecord = z.infer<typeof ChatEventRecordSchema>;
export type ChatThoughtChainItem = z.infer<typeof ChatThoughtChainItemSchema>;
export type ChatThinkState = z.infer<typeof ChatThinkStateSchema>;

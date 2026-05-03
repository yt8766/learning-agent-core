import { z } from 'zod';

import {
  ChatCognitionSnapshotSchema,
  ChatEventRecordSchema,
  ChatMessageCardSchema,
  ChatMessageRecordSchema,
  ChatThinkStateSchema,
  ChatThoughtChainBrowserSchema,
  ChatThoughtChainItemSchema,
  ChatThoughtChainWebSearchSchema
} from '../schemas/chat';

export type ChatMessageCard = z.infer<typeof ChatMessageCardSchema>;
export type ChatMessageRecord = z.infer<typeof ChatMessageRecordSchema>;
export type ChatEventRecord = z.infer<typeof ChatEventRecordSchema>;
export type ChatThoughtChainItem = z.infer<typeof ChatThoughtChainItemSchema>;
export type ChatThoughtChainBrowser = z.infer<typeof ChatThoughtChainBrowserSchema>;
export type ChatThoughtChainWebSearch = z.infer<typeof ChatThoughtChainWebSearchSchema>;
export type ChatThinkState = z.infer<typeof ChatThinkStateSchema>;
export type ChatCognitionSnapshot = z.infer<typeof ChatCognitionSnapshotSchema>;

import { z } from 'zod';

export const ChatMessageFragmentKindSchema = z.enum([
  'thinking',
  'response',
  'tool_call',
  'tool_result',
  'evidence',
  'system_note',
  'error'
]);

export const ChatMessageFragmentStatusSchema = z.enum(['streaming', 'completed', 'failed']);

export const ChatMessageFragmentReferenceSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  url: z.string().optional(),
  sourceType: z.string().optional()
});

export const ChatMessageFragmentSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  runId: z.string(),
  messageId: z.string(),
  kind: ChatMessageFragmentKindSchema,
  content: z.string(),
  status: ChatMessageFragmentStatusSchema,
  stageId: z.string().optional(),
  elapsedMs: z.number().optional(),
  references: z.array(ChatMessageFragmentReferenceSchema).optional()
});

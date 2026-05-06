import { z } from 'zod';

export const ChatRunRouteSchema = z.enum(['direct_reply', 'supervisor', 'workflow', 'artifact']);

export const ChatRunStatusSchema = z.enum([
  'queued',
  'running',
  'thinking',
  'streaming_response',
  'waiting_interaction',
  'completed',
  'failed',
  'cancelled'
]);

export const ChatRunTokenUsageSchema = z.object({
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  totalTokens: z.number().optional()
});

export const ChatRunRecordSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  requestMessageId: z.string(),
  responseMessageId: z.string().optional(),
  taskId: z.string().optional(),
  route: ChatRunRouteSchema,
  status: ChatRunStatusSchema,
  modelId: z.string().optional(),
  tokenUsage: ChatRunTokenUsageSchema.optional(),
  createdAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional()
});

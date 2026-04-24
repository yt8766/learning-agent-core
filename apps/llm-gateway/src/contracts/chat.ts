import { z } from 'zod';

export const ChatCompletionMessageRoleSchema = z.enum(['system', 'user', 'assistant', 'tool']);

export const ChatCompletionMessageSchema = z.object({
  role: ChatCompletionMessageRoleSchema,
  content: z.union([z.string(), z.null()]).optional(),
  name: z.string().optional(),
  tool_call_id: z.string().optional()
});

export const ChatCompletionRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(ChatCompletionMessageSchema).min(1),
  stream: z.boolean().optional().default(false),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  max_tokens: z.number().int().positive().optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  user: z.string().optional()
});

export const ChatCompletionUsageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative()
});

export const ChatCompletionResponseSchema = z.object({
  id: z.string(),
  object: z.literal('chat.completion'),
  created: z.number().int().nonnegative(),
  model: z.string(),
  choices: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      message: ChatCompletionMessageSchema.extend({
        role: z.literal('assistant')
      }),
      finish_reason: z.union([z.literal('stop'), z.literal('length'), z.literal('tool_calls'), z.null()])
    })
  ),
  usage: ChatCompletionUsageSchema
});

export const ChatCompletionStreamChunkSchema = z.object({
  id: z.string(),
  object: z.literal('chat.completion.chunk'),
  created: z.number().int().nonnegative(),
  model: z.string(),
  choices: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      delta: z.object({
        role: z.literal('assistant').optional(),
        content: z.string().optional()
      }),
      finish_reason: z.union([z.literal('stop'), z.literal('length'), z.literal('tool_calls'), z.null()])
    })
  )
});

export type ChatCompletionMessageRole = z.infer<typeof ChatCompletionMessageRoleSchema>;
export type ChatCompletionMessage = z.infer<typeof ChatCompletionMessageSchema>;
export type ChatCompletionRequest = z.infer<typeof ChatCompletionRequestSchema>;
export type ChatCompletionUsage = z.infer<typeof ChatCompletionUsageSchema>;
export type ChatCompletionResponse = z.infer<typeof ChatCompletionResponseSchema>;
export type ChatCompletionStreamChunk = z.infer<typeof ChatCompletionStreamChunkSchema>;

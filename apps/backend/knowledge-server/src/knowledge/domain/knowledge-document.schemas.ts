import { z } from 'zod';

export const CreateDocumentFromUploadRequestSchema = z.object({
  uploadId: z.string().min(1),
  objectKey: z.string().min(1),
  filename: z.string().min(1),
  title: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const OpenAIChatContentPartSchema = z
  .object({
    type: z.literal('text'),
    text: z.string().min(1)
  })
  .passthrough();

export const OpenAIChatMessageSchema = z
  .object({
    role: z.enum(['developer', 'system', 'user', 'assistant', 'tool']),
    content: z.union([z.string().min(1), z.array(OpenAIChatContentPartSchema).min(1)])
  })
  .passthrough();

export const KnowledgeChatMetadataSchema = z
  .object({
    conversationId: z.string().min(1).optional(),
    knowledgeBaseId: z.string().min(1).optional(),
    knowledgeBaseIds: z.union([z.array(z.string().min(1)), z.string().min(1)]).optional(),
    mentions: z
      .array(
        z
          .object({
            type: z.literal('knowledge_base'),
            id: z.string().min(1).optional(),
            label: z.string().min(1).optional()
          })
          .passthrough()
      )
      .optional(),
    debug: z.union([z.boolean(), z.string()]).optional()
  })
  .passthrough();

export const KnowledgeChatRequestSchema = z.object({
  model: z.string().min(1).optional(),
  messages: z.array(OpenAIChatMessageSchema).min(1).optional(),
  metadata: KnowledgeChatMetadataSchema.optional(),
  stream: z.boolean().optional(),
  conversationId: z.string().min(1).optional(),
  knowledgeBaseId: z.string().min(1).optional(),
  knowledgeBaseIds: z.array(z.string().min(1)).optional(),
  message: z.string().trim().min(1).optional(),
  retrievalConfigId: z.string().min(1).optional(),
  promptTemplateId: z.string().min(1).optional(),
  debug: z.boolean().optional()
});

export const CreateKnowledgeMessageFeedbackRequestSchema = z.object({
  rating: z.enum(['positive', 'negative']),
  category: z
    .enum([
      'helpful',
      'not_helpful',
      'wrong_citation',
      'hallucination',
      'missing_knowledge',
      'too_slow',
      'unsafe',
      'other'
    ])
    .optional(),
  comment: z.string().max(2000).optional()
});

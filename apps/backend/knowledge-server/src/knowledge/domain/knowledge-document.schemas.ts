import { z } from 'zod';

export const DocumentProcessingStageSchema = z.enum([
  'uploaded',
  'parsing',
  'chunking',
  'embedding',
  'indexing',
  'succeeded',
  'failed',
  'cancelled'
]);

export const DocumentProcessingStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']);

export const DocumentProcessingJobProgressSchema = z
  .object({
    percent: z.number().min(0).max(100),
    processedChunks: z.number().int().nonnegative().optional(),
    totalChunks: z.number().int().nonnegative().optional()
  })
  .strict();

export const DocumentProcessingJobErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean(),
    stage: DocumentProcessingStageSchema
  })
  .strict();

export const RagModelProfileUseCaseSchema = z.enum(['coding', 'daily', 'balanced']);

export const RagModelProfileSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1).optional(),
    useCase: RagModelProfileUseCaseSchema,
    plannerModelId: z.string().min(1),
    answerModelId: z.string().min(1),
    embeddingModelId: z.string().min(1),
    enabled: z.boolean()
  })
  .strict();

export const RagModelProfileSummarySchema = RagModelProfileSchema.pick({
  id: true,
  label: true,
  description: true,
  useCase: true,
  enabled: true
});

export const KnowledgeChatConversationRecordSchema = z
  .object({
    id: z.string().min(1),
    userId: z.string().min(1),
    title: z.string().min(1),
    activeModelProfileId: z.string().min(1),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1)
  })
  .strict();

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

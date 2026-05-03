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

export const KnowledgeChatMessageRoleSchema = z.enum(['user', 'assistant', 'system']);

export const KnowledgeChatJsonValueSchema: z.ZodType<
  string | number | boolean | null | { [key: string]: unknown } | unknown[]
> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(KnowledgeChatJsonValueSchema),
    z.record(z.string(), KnowledgeChatJsonValueSchema)
  ])
);

export const KnowledgeChatJsonObjectSchema = z.record(z.string(), KnowledgeChatJsonValueSchema);

export const KnowledgeChatRouteReasonSchema = z.enum([
  'explicit_mention',
  'planner_selected',
  'fallback_all',
  'legacy_ids',
  'default'
]);

export const KnowledgeChatRouteSchema = z
  .object({
    requestedMentions: z.array(z.string().min(1)).default([]),
    selectedKnowledgeBaseIds: z.array(z.string().min(1)).default([]),
    reason: KnowledgeChatRouteReasonSchema
  })
  .strict();

export const KnowledgeChatRoutingDecisionSchema = z
  .object({
    knowledgeBaseId: z.string().min(1).optional(),
    decision: z.enum(['selected', 'rejected', 'fallback']).optional(),
    reason: z.string().trim().min(1).optional(),
    confidence: z.number().finite().min(0).max(1).optional()
  })
  .strict();

export const KnowledgeChatPlannerDiagnosticsSchema = z
  .object({
    queryVariants: z.array(z.string().min(1)),
    selectedKnowledgeBaseIds: z.array(z.string().min(1)),
    routingDecisions: z.array(KnowledgeChatRoutingDecisionSchema),
    confidence: z.number().finite().min(0).max(1),
    fallbackApplied: z.boolean(),
    fallbackReason: z.string().trim().min(1).optional()
  })
  .strict();

export const KnowledgeChatExecutedQuerySchema = z
  .object({
    query: z.string().min(1),
    mode: z.enum(['hybrid', 'vector', 'keyword', 'none', 'vector-only', 'keyword-only']),
    hitCount: z.number().int().nonnegative()
  })
  .strict();

export const KnowledgeChatRetrievalDiagnosticsSchema = z
  .object({
    effectiveSearchMode: z.enum(['hybrid', 'vector', 'keyword', 'none', 'vector-only', 'keyword-only']),
    executedQueries: z.array(KnowledgeChatExecutedQuerySchema),
    vectorHitCount: z.number().int().nonnegative(),
    keywordHitCount: z.number().int().nonnegative(),
    finalHitCount: z.number().int().nonnegative()
  })
  .strict();

export const KnowledgeChatGenerationDiagnosticsSchema = z
  .object({
    provider: z.string().trim().min(1),
    model: z.string().trim().min(1),
    tokens: z
      .object({
        input: z.number().int().nonnegative().optional(),
        output: z.number().int().nonnegative().optional(),
        total: z.number().int().nonnegative().optional()
      })
      .strict()
      .optional(),
    durationMs: z.number().finite().nonnegative().optional(),
    duration: z.number().finite().nonnegative().optional()
  })
  .strict();

export const KnowledgeChatDiagnosticsSchema = z
  .object({
    planner: KnowledgeChatPlannerDiagnosticsSchema.optional(),
    retrieval: KnowledgeChatRetrievalDiagnosticsSchema.optional(),
    generation: KnowledgeChatGenerationDiagnosticsSchema.optional()
  })
  .strict();

export const KnowledgeChatCitationSchema = z
  .object({
    id: z.string().min(1),
    documentId: z.string().min(1),
    chunkId: z.string().min(1),
    title: z.string().min(1),
    quote: z.string().min(1),
    score: z.number()
  })
  .strict();

export const KnowledgeChatMessageFeedbackSchema = z
  .object({
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
    comment: z.string().trim().min(1).max(2000).optional()
  })
  .strict();

export const KnowledgeChatMessageRecordSchema = z
  .object({
    id: z.string().min(1),
    conversationId: z.string().min(1),
    userId: z.string().min(1),
    role: KnowledgeChatMessageRoleSchema,
    content: z.string().trim().min(1),
    modelProfileId: z.string().min(1).optional(),
    traceId: z.string().min(1).optional(),
    citations: z.array(KnowledgeChatCitationSchema),
    route: KnowledgeChatRouteSchema.optional(),
    diagnostics: KnowledgeChatDiagnosticsSchema.optional(),
    feedback: KnowledgeChatMessageFeedbackSchema.optional(),
    createdAt: z.string().min(1)
  })
  .strict();

export const CreateKnowledgeChatMessageRecordInputSchema = KnowledgeChatMessageRecordSchema.omit({
  id: true,
  citations: true,
  createdAt: true
}).extend({
  citations: z.array(KnowledgeChatCitationSchema).optional()
});

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

export const CreateKnowledgeMessageFeedbackRequestSchema = KnowledgeChatMessageFeedbackSchema;

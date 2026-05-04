import { z } from 'zod';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema)
  ])
);

export const JsonObjectSchema: z.ZodType<JsonObject> = z.record(z.string(), JsonValueSchema);

export const KnowledgeAgentFlowNodeTypeSchema = z.enum([
  'input',
  'intent_classify',
  'knowledge_retrieve',
  'rerank',
  'llm_generate',
  'approval_gate',
  'connector_action',
  'output'
]);

export const KnowledgeAgentFlowStatusSchema = z.enum(['draft', 'active', 'archived']);

export const KnowledgeAgentFlowRunStatusSchema = z.enum(['queued', 'running', 'completed', 'failed']);

export const KnowledgeAgentFlowPositionSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite()
  })
  .strict();

export const KnowledgeAgentFlowNodeSchema = z
  .object({
    id: z.string().min(1),
    type: KnowledgeAgentFlowNodeTypeSchema,
    label: z.string().min(1),
    description: z.string().optional(),
    position: KnowledgeAgentFlowPositionSchema,
    config: JsonObjectSchema.default({})
  })
  .strict();

export const KnowledgeAgentFlowEdgeSchema = z
  .object({
    id: z.string().min(1),
    source: z.string().min(1),
    target: z.string().min(1),
    sourceHandle: z.string().min(1).optional(),
    targetHandle: z.string().min(1).optional(),
    label: z.string().optional()
  })
  .strict();

export const KnowledgeAgentFlowSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().default(''),
    version: z.number().int().positive(),
    status: KnowledgeAgentFlowStatusSchema,
    nodes: z.array(KnowledgeAgentFlowNodeSchema),
    edges: z.array(KnowledgeAgentFlowEdgeSchema),
    createdAt: z.string(),
    updatedAt: z.string()
  })
  .strict();

export const KnowledgeAgentFlowListRequestSchema = z
  .object({
    page: z.number().int().positive().default(1),
    pageSize: z.number().int().positive().max(100).default(20),
    keyword: z.string().optional(),
    status: KnowledgeAgentFlowStatusSchema.optional()
  })
  .strict();

export const KnowledgeAgentFlowListResponseSchema = z
  .object({
    items: z.array(KnowledgeAgentFlowSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive()
  })
  .strict();

export const KnowledgeAgentFlowSaveRequestSchema = z
  .object({
    flow: KnowledgeAgentFlowSchema
  })
  .strict();

export const KnowledgeAgentFlowSaveResponseSchema = z
  .object({
    flow: KnowledgeAgentFlowSchema
  })
  .strict();

export const KnowledgeAgentFlowRunInputSchema = z
  .object({
    message: z.string().min(1),
    knowledgeBaseIds: z.array(z.string().min(1)).default([]),
    variables: JsonObjectSchema.default({})
  })
  .strict();

export const KnowledgeAgentFlowRunRequestSchema = z
  .object({
    flowId: z.string().min(1),
    input: KnowledgeAgentFlowRunInputSchema
  })
  .strict();

export const KnowledgeAgentFlowRunResponseSchema = z
  .object({
    runId: z.string().min(1),
    flowId: z.string().min(1),
    status: KnowledgeAgentFlowRunStatusSchema,
    output: JsonObjectSchema.optional(),
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1)
      })
      .strict()
      .optional(),
    createdAt: z.string(),
    updatedAt: z.string()
  })
  .strict();

export type KnowledgeAgentFlowNodeType = z.infer<typeof KnowledgeAgentFlowNodeTypeSchema>;
export type KnowledgeAgentFlowStatus = z.infer<typeof KnowledgeAgentFlowStatusSchema>;
export type KnowledgeAgentFlowRunStatus = z.infer<typeof KnowledgeAgentFlowRunStatusSchema>;
export type KnowledgeAgentFlowPosition = z.infer<typeof KnowledgeAgentFlowPositionSchema>;
export type KnowledgeAgentFlowNode = z.infer<typeof KnowledgeAgentFlowNodeSchema>;
export type KnowledgeAgentFlowEdge = z.infer<typeof KnowledgeAgentFlowEdgeSchema>;
export type KnowledgeAgentFlow = z.infer<typeof KnowledgeAgentFlowSchema>;
export type KnowledgeAgentFlowListRequest = z.infer<typeof KnowledgeAgentFlowListRequestSchema>;
export type KnowledgeAgentFlowListResponse = z.infer<typeof KnowledgeAgentFlowListResponseSchema>;
export type KnowledgeAgentFlowSaveRequest = z.infer<typeof KnowledgeAgentFlowSaveRequestSchema>;
export type KnowledgeAgentFlowSaveResponse = z.infer<typeof KnowledgeAgentFlowSaveResponseSchema>;
export type KnowledgeAgentFlowRunInput = z.infer<typeof KnowledgeAgentFlowRunInputSchema>;
export type KnowledgeAgentFlowRunRequest = z.infer<typeof KnowledgeAgentFlowRunRequestSchema>;
export type KnowledgeAgentFlowRunResponse = z.infer<typeof KnowledgeAgentFlowRunResponseSchema>;

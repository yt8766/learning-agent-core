import { z } from 'zod';

import { MemoryScopeTypeSchema, MemoryTypeSchema, MemoryRecordSchema, RuleRecordSchema } from './memory-record.schema';
import { ReflectionRecordSchema } from './reflection-record.schema';

export const MemorySearchRequestSchema = z.object({
  query: z.string(),
  limit: z.number().int().positive().optional(),
  scopeContext: z
    .object({
      actorRole: z.string().optional(),
      scopeType: MemoryScopeTypeSchema.optional(),
      allowedScopeTypes: z.array(MemoryScopeTypeSchema).optional(),
      userId: z.string().optional(),
      workspaceId: z.string().optional(),
      teamId: z.string().optional(),
      orgId: z.string().optional()
    })
    .optional(),
  entityContext: z
    .array(
      z.object({
        entityType: z.enum(['user', 'project', 'repo', 'workspace', 'tool', 'connector']),
        entityId: z.string()
      })
    )
    .optional(),
  memoryTypes: z.array(MemoryTypeSchema).optional(),
  includeRules: z.boolean().optional(),
  includeReflections: z.boolean().optional()
});

export const MemorySearchReasonSchema = z.object({
  id: z.string(),
  kind: z.enum(['memory', 'rule', 'reflection']),
  summary: z.string(),
  score: z.number(),
  reason: z.string()
});

export const MemorySearchResultSchema = z.object({
  coreMemories: z.array(MemoryRecordSchema),
  archivalMemories: z.array(MemoryRecordSchema),
  rules: z.array(RuleRecordSchema),
  reflections: z.array(ReflectionRecordSchema),
  reasons: z.array(MemorySearchReasonSchema)
});

export type MemorySearchRequest = z.infer<typeof MemorySearchRequestSchema>;
export type MemorySearchReason = z.infer<typeof MemorySearchReasonSchema>;
export type MemorySearchResult = z.infer<typeof MemorySearchResultSchema>;

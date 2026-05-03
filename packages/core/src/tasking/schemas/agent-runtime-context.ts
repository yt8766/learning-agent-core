import { z } from 'zod';

export const ContextKindSchema = z.enum([
  'task',
  'plan',
  'recent_messages',
  'evidence',
  'tool_result',
  'memory',
  'rule',
  'skill',
  'knowledge',
  'approval',
  'risk'
]);

export const ContextAuthoritySchema = z.enum(['system', 'user', 'project', 'verified', 'agent', 'external']);
export const ContextTrustLevelSchema = z.enum(['high', 'medium', 'low']);
export const ContextFreshnessSchema = z.enum(['current', 'recent', 'stale', 'unknown']);
export const ContextScopeSchema = z.enum(['task', 'session', 'project', 'team', 'user', 'system']);

export const ContextPageSchema = z.object({
  id: z.string().min(1),
  kind: ContextKindSchema,
  authority: ContextAuthoritySchema,
  trustLevel: ContextTrustLevelSchema,
  freshness: ContextFreshnessSchema,
  scope: ContextScopeSchema,
  owner: z.string().min(1).optional(),
  ttl: z.string().min(1).optional(),
  sourceRefs: z.array(z.string().min(1)).default([]),
  evidenceRefs: z.array(z.string().min(1)).optional(),
  artifactRefs: z.array(z.string().min(1)).optional(),
  tokenCost: z.number().int().nonnegative(),
  readonly: z.boolean(),
  payload: z.object({
    text: z.string().optional(),
    summary: z.string().optional(),
    dataRef: z.string().min(1).optional(),
    data: z.unknown().optional()
  })
});

export const ContextBundleSchema = z.object({
  bundleId: z.string().min(1),
  taskId: z.string().min(1),
  agentId: z.string().min(1),
  pages: z.array(ContextPageSchema).default([])
});

export const ContextManifestSchema = z.object({
  bundleId: z.string().min(1),
  taskId: z.string().min(1),
  agentId: z.string().min(1),
  createdAt: z.string().min(1),
  loadedPages: z
    .array(
      z.object({
        pageId: z.string().min(1),
        kind: ContextKindSchema,
        reason: z.string().min(1),
        tokenCost: z.number().int().nonnegative(),
        authority: ContextAuthoritySchema,
        trustLevel: ContextTrustLevelSchema
      })
    )
    .default([]),
  omittedPages: z
    .array(
      z.object({
        pageId: z.string().min(1),
        reason: z.enum(['low_relevance', 'token_budget', 'low_trust', 'stale', 'permission_denied'])
      })
    )
    .default([]),
  totalTokenCost: z.number().int().nonnegative()
});

export const MissingContextSignalSchema = z.object({
  kind: z.literal('missing_context'),
  taskId: z.string().min(1),
  agentId: z.string().min(1),
  requested: z
    .array(
      z.object({
        contextKind: z.enum(['contract', 'code', 'docs', 'evidence', 'memory', 'user_input']),
        query: z.string().min(1),
        reason: z.string().min(1),
        blocking: z.boolean(),
        expectedAuthority: z.enum(['system', 'user', 'project', 'verified', 'external']).optional()
      })
    )
    .min(1)
});

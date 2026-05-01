import { z } from 'zod';

const KnowledgeSearchStatusSchema = z.object({
  configuredMode: z.enum(['keyword-only', 'vector-only', 'hybrid']),
  effectiveMode: z.enum(['keyword-only', 'vector-only', 'hybrid']),
  vectorProviderId: z.string().optional(),
  vectorConfigured: z.boolean(),
  hybridEnabled: z.boolean(),
  vectorProviderHealth: z
    .object({
      status: z.enum(['healthy', 'degraded', 'unknown']),
      checkedAt: z.string(),
      latencyMs: z.number().nonnegative().optional(),
      message: z.string().optional()
    })
    .optional(),
  diagnostics: z.array(
    z.object({
      code: z.string(),
      severity: z.enum(['info', 'warning']),
      message: z.string()
    })
  ),
  checkedAt: z.string()
});

export const HealthCheckResultSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  now: z.string(),
  knowledgeSearchStatus: KnowledgeSearchStatusSchema.optional()
});

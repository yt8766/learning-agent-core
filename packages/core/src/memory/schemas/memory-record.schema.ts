import { z } from 'zod';

export const MemoryScopeTypeSchema = z.enum(['session', 'user', 'task', 'workspace', 'team', 'org', 'global']);
export type MemoryScopeType = z.infer<typeof MemoryScopeTypeSchema>;

export const MemoryTypeSchema = z.enum([
  'fact',
  'preference',
  'constraint',
  'procedure',
  'reflection',
  'summary',
  'skill-experience',
  'failure-pattern'
]);
export type MemoryType = z.infer<typeof MemoryTypeSchema>;

export const MemoryStatusSchema = z.enum([
  'candidate',
  'active',
  'stale',
  'disputed',
  'superseded',
  'archived',
  'invalidated',
  'retired'
]);
export type MemoryStatus = z.infer<typeof MemoryStatusSchema>;

export const MemoryVerificationStatusSchema = z.enum(['unverified', 'verified', 'disputed']);
export type MemoryVerificationStatus = z.infer<typeof MemoryVerificationStatusSchema>;

export const MemoryRelatedEntitySchema = z.object({
  entityType: z.enum(['user', 'project', 'repo', 'workspace', 'tool', 'connector']),
  entityId: z.string(),
  relation: z.string().optional()
});
export type MemoryRelatedEntity = z.infer<typeof MemoryRelatedEntitySchema>;

export const MemoryUsageMetricsSchema = z.object({
  retrievedCount: z.number().int().nonnegative().default(0),
  injectedCount: z.number().int().nonnegative().default(0),
  adoptedCount: z.number().int().nonnegative().default(0),
  dismissedCount: z.number().int().nonnegative().default(0),
  correctedCount: z.number().int().nonnegative().default(0),
  lastRetrievedAt: z.string().optional(),
  lastAdoptedAt: z.string().optional(),
  lastDismissedAt: z.string().optional(),
  lastCorrectedAt: z.string().optional()
});
export type MemoryUsageMetrics = z.infer<typeof MemoryUsageMetricsSchema>;

export const MemoryRecordSchema = z.object({
  id: z.string(),
  type: z.string(),
  memoryType: MemoryTypeSchema.optional(),
  taskId: z.string().optional(),
  scopeType: MemoryScopeTypeSchema.optional(),
  summary: z.string(),
  content: z.string(),
  title: z.string().optional(),
  tags: z.array(z.string()).default([]),
  contextSignature: z.string().optional(),
  effectiveness: z.number().optional(),
  conflictSetId: z.string().optional(),
  embeddingRef: z.string().optional(),
  qualityScore: z.number().optional(),
  importance: z.number().min(1).max(10).optional(),
  confidence: z.number().min(0).max(1).optional(),
  freshnessScore: z.number().min(0).max(1).optional(),
  sourceEvidenceIds: z.array(z.string()).optional(),
  sourceTaskId: z.string().optional(),
  sourceSessionId: z.string().optional(),
  relatedEntities: z.array(MemoryRelatedEntitySchema).optional(),
  verificationStatus: MemoryVerificationStatusSchema.optional(),
  lastUsedAt: z.string().optional(),
  lastVerifiedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  usageMetrics: MemoryUsageMetricsSchema.optional(),
  status: MemoryStatusSchema.optional(),
  version: z.number().int().positive().optional(),
  invalidatedAt: z.string().optional(),
  invalidationReason: z.string().optional(),
  conflictWithIds: z.array(z.string()).optional(),
  supersededAt: z.string().optional(),
  supersededById: z.string().optional(),
  overrideFor: z.string().optional(),
  retiredAt: z.string().optional(),
  restoredAt: z.string().optional(),
  archivedAt: z.string().optional(),
  quarantined: z.boolean().optional(),
  quarantineReason: z.string().optional(),
  quarantineCategory: z
    .enum(['runtime_noise', 'stale_fact', 'conflicts_with_official_docs', 'unsupported_claim'])
    .optional(),
  quarantineReasonDetail: z.string().optional(),
  quarantineRestoreSuggestion: z.string().optional(),
  quarantineEvidenceRefs: z.array(z.string()).optional(),
  quarantinedAt: z.string().optional(),
  createdAt: z.string()
});
export type MemoryRecord = z.infer<typeof MemoryRecordSchema>;

export const RuleRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string(),
  conditions: z.array(z.string()).default([]),
  action: z.string(),
  sourceTaskId: z.string().optional(),
  contextSignature: z.string().optional(),
  effectiveness: z.number().optional(),
  conflictSetId: z.string().optional(),
  status: z.enum(['active', 'invalidated', 'superseded', 'retired']).optional(),
  invalidatedAt: z.string().optional(),
  invalidationReason: z.string().optional(),
  supersededAt: z.string().optional(),
  supersededById: z.string().optional(),
  retiredAt: z.string().optional(),
  restoredAt: z.string().optional(),
  version: z.number().int().positive().optional(),
  createdAt: z.string()
});
export type RuleRecord = z.infer<typeof RuleRecordSchema>;

export const EvidenceRecordSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  taskGoal: z.string().optional(),
  sourceId: z.string().optional(),
  sourceType: z.string(),
  sourceUrl: z.string().optional(),
  trustClass: z.string(),
  sourceStore: z.enum(['wenyuan', 'cangjing']).optional(),
  summary: z.string(),
  detail: z.record(z.string(), z.unknown()).optional(),
  linkedRunId: z.string().optional(),
  checkpointRef: z
    .object({
      sessionId: z.string(),
      taskId: z.string().optional(),
      checkpointId: z.string(),
      checkpointCursor: z.number(),
      recoverability: z.enum(['safe', 'partial', 'unsafe'])
    })
    .optional(),
  recoverable: z.boolean().optional(),
  createdAt: z.string(),
  fetchedAt: z.string().optional(),
  replay: z
    .object({
      sessionId: z.string().optional(),
      url: z.string().optional(),
      snapshotSummary: z.string().optional(),
      screenshotRef: z.string().optional(),
      artifactRef: z.string().optional(),
      snapshotRef: z.string().optional(),
      stepTrace: z.array(z.string()).optional(),
      steps: z
        .array(
          z.object({
            id: z.string(),
            title: z.string(),
            status: z.enum(['completed', 'failed', 'running']),
            at: z.string(),
            summary: z.string().optional(),
            artifactRef: z.string().optional()
          })
        )
        .optional()
    })
    .optional()
});
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;

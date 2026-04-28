import { z } from 'zod';

export const ReflectionKindSchema = z.enum(['executionReflection', 'strategyReflection', 'failurePattern']);
export type ReflectionKind = z.infer<typeof ReflectionKindSchema>;

export const ReflectionRecordSchema = z.object({
  id: z.string(),
  taskId: z.string().optional(),
  workflowId: z.string().optional(),
  memoryId: z.string().optional(),
  kind: ReflectionKindSchema,
  summary: z.string(),
  whatWorked: z.array(z.string()).default([]),
  whatFailed: z.array(z.string()).default([]),
  nextAttemptAdvice: z.array(z.string()).default([]),
  promotedMemoryIds: z.array(z.string()).default([]),
  promotedRuleIds: z.array(z.string()).default([]),
  relatedEntities: z
    .array(
      z.object({
        entityType: z.enum(['user', 'project', 'repo', 'workspace', 'tool', 'connector']),
        entityId: z.string(),
        relation: z.string().optional()
      })
    )
    .default([]),
  createdAt: z.string()
});

export type ReflectionRecord = z.infer<typeof ReflectionRecordSchema>;

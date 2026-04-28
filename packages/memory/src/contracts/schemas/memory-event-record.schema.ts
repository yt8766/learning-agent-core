import { z } from 'zod';

export const MemoryEventTypeSchema = z.enum([
  'memory.created',
  'memory.updated',
  'memory.status_changed',
  'memory.metrics_recorded',
  'memory.override_applied',
  'memory.retrieved',
  'memory.archived',
  'memory.restored',
  'memory.rollback_applied'
]);

export const MemoryEventRecordSchema = z.object({
  id: z.string(),
  memoryId: z.string(),
  version: z.number().int().positive(),
  type: MemoryEventTypeSchema,
  actor: z.string().optional(),
  scope: z.string().optional(),
  reason: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string()
});

export type MemoryEventRecord = z.infer<typeof MemoryEventRecordSchema>;

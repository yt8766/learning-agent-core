import { z } from 'zod/v4';

import { MemorySearchRequestSchema } from './memory-search.schema';
import { MemoryScopeTypeSchema, MemoryTypeSchema } from './memory-record.schema';

export const CoreMemoryEntryKindSchema = z.enum([
  'user-profile',
  'task-constraint',
  'session-state',
  'override',
  'memory-reuse',
  'rule-reuse',
  'reflection-reuse'
]);

export const CoreMemoryEntrySchema = z.object({
  id: z.string().min(1),
  kind: CoreMemoryEntryKindSchema,
  scopeType: MemoryScopeTypeSchema.extract(['session', 'task']),
  summary: z.string().min(1),
  content: z.string().optional(),
  memoryType: MemoryTypeSchema.optional(),
  relatedMemoryId: z.string().optional(),
  auditReason: z.string().optional(),
  updatedAt: z.string().optional()
});

const CoreMemoryEntryInputSchema = CoreMemoryEntrySchema.omit({
  id: true,
  updatedAt: true
});

export const CoreMemoryAppendInputSchema = z.object({
  action: z.literal('core_memory_append'),
  entry: CoreMemoryEntryInputSchema
});

export const CoreMemoryReplaceInputSchema = z.object({
  action: z.literal('core_memory_replace'),
  targetId: z.string().optional(),
  targetKind: CoreMemoryEntryKindSchema.optional(),
  auditReason: z.string().min(1),
  entry: CoreMemoryEntryInputSchema
});

export const ArchivalMemorySearchInputSchema = z.object({
  action: z.literal('archival_memory_search'),
  request: MemorySearchRequestSchema
});

export type CoreMemoryEntry = z.infer<typeof CoreMemoryEntrySchema>;
export type CoreMemoryAppendInput = z.infer<typeof CoreMemoryAppendInputSchema>;
export type CoreMemoryReplaceInput = z.infer<typeof CoreMemoryReplaceInputSchema>;
export type ArchivalMemorySearchInput = z.infer<typeof ArchivalMemorySearchInputSchema>;

import { z } from 'zod';

export const CheckpointRefSchema = z.object({
  sessionId: z.string(),
  taskId: z.string().optional(),
  checkpointId: z.string(),
  checkpointCursor: z.number(),
  recoverability: z.enum(['safe', 'partial', 'unsafe'])
});

export type CheckpointRef = z.infer<typeof CheckpointRefSchema>;

export const ThoughtGraphNodeSchema = z.object({
  id: z.string(),
  kind: z.enum(['planning', 'research', 'execution', 'approval', 'review', 'recovery', 'finalize', 'failure']),
  label: z.string(),
  ministry: z.string().optional(),
  status: z.enum(['completed', 'running', 'blocked', 'failed', 'pending']),
  at: z.string().optional(),
  errorCode: z.string().optional(),
  checkpointRef: CheckpointRefSchema.optional()
});

export type ThoughtGraphNode = z.infer<typeof ThoughtGraphNodeSchema>;

export const ThoughtGraphEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  reason: z.string()
});

export type ThoughtGraphEdge = z.infer<typeof ThoughtGraphEdgeSchema>;

export const ThoughtGraphRecordSchema = z.object({
  nodes: z.array(ThoughtGraphNodeSchema),
  edges: z.array(ThoughtGraphEdgeSchema)
});

export type ThoughtGraphRecord = z.infer<typeof ThoughtGraphRecordSchema>;

import { z } from 'zod';

import { ExecutionPlanModeSchema, TaskStatusSchema } from '../../primitives';

export const TaskBackgroundLearningStatusSchema = z.enum(['idle', 'queued', 'running', 'completed', 'failed']);
export const TaskBackgroundLearningModeSchema = z.enum(['task-learning', 'dream-task']);
export const TaskCheckpointGraphMicroLoopStatusSchema = z.enum(['idle', 'active', 'completed', 'aborted']);
export const TaskCheckpointGraphMicroLoopStateValueSchema = z.enum(['idle', 'retrying', 'exhausted', 'completed']);
export const TaskCheckpointGraphRevisionStateSchema = z.enum([
  'idle',
  'needs_revision',
  'revising',
  'blocked',
  'completed'
]);

export const TaskModeGateStateSchema = z.object({
  requestedMode: ExecutionPlanModeSchema.optional(),
  activeMode: ExecutionPlanModeSchema,
  reason: z.string(),
  updatedAt: z.string()
});

export const TaskBackgroundLearningStateSchema = z.object({
  status: TaskBackgroundLearningStatusSchema,
  mode: TaskBackgroundLearningModeSchema,
  queuedAt: z.string().optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  summary: z.string().optional(),
  updatedAt: z.string()
});

export const TaskCheckpointGraphMicroLoopStateSchema = z.object({
  stage: z.string().optional(),
  status: TaskCheckpointGraphMicroLoopStatusSchema.optional(),
  iteration: z.number().optional(),
  state: TaskCheckpointGraphMicroLoopStateValueSchema.optional(),
  attempt: z.number().optional(),
  maxAttempts: z.number().optional(),
  exhaustedReason: z.string().optional(),
  updatedAt: z.string().optional()
});

export const TaskCheckpointGraphStateSchema = z.object({
  status: TaskStatusSchema,
  currentStep: z.string().optional(),
  retryCount: z.number().optional(),
  maxRetries: z.number().optional(),
  revisionCount: z.number().optional(),
  maxRevisions: z.number().optional(),
  microLoopCount: z.number().optional(),
  maxMicroLoops: z.number().optional(),
  microLoopState: TaskCheckpointGraphMicroLoopStateSchema.optional(),
  revisionState: TaskCheckpointGraphRevisionStateSchema.optional()
});

export const TaskCheckpointStreamStatusSchema = z.object({
  nodeId: z.string().optional(),
  nodeLabel: z.string().optional(),
  detail: z.string().optional(),
  progressPercent: z.number().optional(),
  updatedAt: z.string()
});

export const TaskCheckpointCursorStateSchema = z.object({
  traceCursor: z.number(),
  messageCursor: z.number(),
  approvalCursor: z.number(),
  learningCursor: z.number()
});

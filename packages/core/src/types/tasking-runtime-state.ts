import { z } from 'zod';

export const TaskModeGateStateSchema = z.object({
  requestedMode: z.enum(['plan', 'execute', 'imperial_direct']).optional(),
  activeMode: z.enum(['plan', 'execute', 'imperial_direct']),
  reason: z.string(),
  updatedAt: z.string()
});

export type TaskModeGateState = z.infer<typeof TaskModeGateStateSchema>;

export const TaskBackgroundLearningStateSchema = z.object({
  status: z.enum(['idle', 'queued', 'running', 'completed', 'failed']),
  mode: z.enum(['task-learning', 'dream-task']),
  queuedAt: z.string().optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  summary: z.string().optional(),
  updatedAt: z.string()
});

export type TaskBackgroundLearningState = z.infer<typeof TaskBackgroundLearningStateSchema>;

export const TaskCheckpointGraphStateSchema = z.object({
  status: z.enum(['queued', 'running', 'waiting_approval', 'blocked', 'cancelled', 'completed', 'failed']),
  currentStep: z.string().optional(),
  retryCount: z.number().optional(),
  maxRetries: z.number().optional(),
  revisionCount: z.number().optional(),
  maxRevisions: z.number().optional(),
  microLoopCount: z.number().optional(),
  maxMicroLoops: z.number().optional(),
  microLoopState: z
    .object({
      stage: z.string().optional(),
      status: z.enum(['idle', 'active', 'completed', 'aborted']).optional(),
      iteration: z.number().optional(),
      state: z.enum(['idle', 'retrying', 'exhausted', 'completed']).optional(),
      attempt: z.number().optional(),
      maxAttempts: z.number().optional(),
      exhaustedReason: z.string().optional(),
      updatedAt: z.string().optional()
    })
    .optional(),
  revisionState: z.enum(['idle', 'needs_revision', 'revising', 'blocked', 'completed']).optional()
});

export type TaskCheckpointGraphState = z.infer<typeof TaskCheckpointGraphStateSchema>;

export const TaskCheckpointStreamStatusSchema = z.object({
  nodeId: z.string().optional(),
  nodeLabel: z.string().optional(),
  detail: z.string().optional(),
  progressPercent: z.number().optional(),
  updatedAt: z.string()
});

export type TaskCheckpointStreamStatus = z.infer<typeof TaskCheckpointStreamStatusSchema>;

export const TaskCheckpointCursorStateSchema = z.object({
  traceCursor: z.number(),
  messageCursor: z.number(),
  approvalCursor: z.number(),
  learningCursor: z.number()
});

export type TaskCheckpointCursorState = z.infer<typeof TaskCheckpointCursorStateSchema>;

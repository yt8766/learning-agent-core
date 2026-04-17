import { z } from 'zod';

import {
  TaskBackgroundLearningStateSchema,
  TaskCheckpointCursorStateSchema,
  TaskCheckpointGraphStateSchema,
  TaskCheckpointStreamStatusSchema,
  TaskModeGateStateSchema
} from '../spec/tasking-runtime-state';

export type TaskModeGateState = z.infer<typeof TaskModeGateStateSchema>;
export type TaskBackgroundLearningState = z.infer<typeof TaskBackgroundLearningStateSchema>;
export type TaskCheckpointGraphState = z.infer<typeof TaskCheckpointGraphStateSchema>;
export type TaskCheckpointStreamStatus = z.infer<typeof TaskCheckpointStreamStatusSchema>;
export type TaskCheckpointCursorState = z.infer<typeof TaskCheckpointCursorStateSchema>;

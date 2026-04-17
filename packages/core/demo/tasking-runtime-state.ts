import {
  QueueStateRecordSchema,
  TaskBackgroundLearningStateSchema,
  TaskCheckpointGraphStateSchema,
  TaskModeGateStateSchema
} from '../src/index.js';

const modeGate = TaskModeGateStateSchema.parse({
  requestedMode: 'plan',
  activeMode: 'plan',
  reason: 'Need to clarify intent before execution.',
  updatedAt: '2026-04-16T00:00:00.000Z'
});

const queueState = QueueStateRecordSchema.parse({
  mode: 'foreground',
  backgroundRun: false,
  status: 'running',
  enqueuedAt: '2026-04-16T00:00:00.000Z',
  lastTransitionAt: '2026-04-16T00:00:00.000Z',
  attempt: 1
});

const graphState = TaskCheckpointGraphStateSchema.parse({
  status: 'running',
  currentStep: 'route-selection',
  retryCount: 0
});

const learningState = TaskBackgroundLearningStateSchema.parse({
  status: 'queued',
  mode: 'task-learning',
  queuedAt: '2026-04-16T00:00:00.000Z',
  updatedAt: '2026-04-16T00:00:00.000Z'
});

console.log('runtime state mode:', modeGate.activeMode);
console.log('runtime state queue:', queueState.status);
console.log('runtime state graph:', graphState.currentStep);
console.log('runtime state learning:', learningState.mode);

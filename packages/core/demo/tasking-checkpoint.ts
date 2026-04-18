import { AgentExecutionStateSchema, ChatCheckpointRecordSchema, TaskRecordSchema } from '../src/index.js';

const agentState = AgentExecutionStateSchema.parse({
  agentId: 'agent-1',
  role: 'executor',
  goal: 'Inspect the repository',
  plan: ['Read docs', 'Summarize findings'],
  toolCalls: [],
  observations: [],
  shortTermMemory: [],
  longTermMemoryRefs: [],
  status: 'running'
});

const checkpoint = ChatCheckpointRecordSchema.parse({
  checkpointId: 'checkpoint-1',
  sessionId: 'session-1',
  taskId: 'task-1',
  createdAt: '2026-04-16T00:00:00.000Z',
  updatedAt: '2026-04-16T00:00:00.000Z',
  traceCursor: 0,
  messageCursor: 0,
  approvalCursor: 0,
  learningCursor: 0,
  graphState: { status: 'running' },
  pendingApprovals: [],
  agentStates: [agentState]
});

const task = TaskRecordSchema.parse({
  id: 'task-1',
  goal: 'Audit runtime contracts',
  status: 'running',
  trace: [],
  approvals: [],
  agentStates: [agentState],
  messages: [],
  createdAt: '2026-04-16T00:00:00.000Z',
  updatedAt: '2026-04-16T00:00:00.000Z'
});

console.log('checkpoint agent states:', checkpoint.agentStates.length);
console.log('checkpoint graph status:', checkpoint.graphState.status);
console.log('task goal:', task.goal);

import { vi } from 'vitest';

import { ActionIntent, TaskStatus } from '@agent/shared';

export const flushAsyncWork = async (times = 3) => {
  for (let index = 0; index < times; index += 1) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
};

export const createRuntimeRepository = () => {
  let snapshot = {
    tasks: [],
    learningJobs: [],
    pendingExecutions: [],
    chatSessions: [],
    chatMessages: [],
    chatEvents: [],
    chatCheckpoints: []
  };

  return {
    load: vi.fn(async () => structuredClone(snapshot)),
    save: vi.fn(async next => {
      snapshot = structuredClone(next);
    })
  };
};

export const createOrchestrator = (): {
  initialize: () => Promise<void>;
  subscribe: (listener: (task: any) => void) => () => boolean;
  subscribeTokens: (listener: (event: any) => void) => () => boolean;
  createTask: ReturnType<typeof vi.fn>;
  getTask: ReturnType<typeof vi.fn>;
  ensureLearningCandidates: ReturnType<typeof vi.fn>;
  confirmLearning: ReturnType<typeof vi.fn>;
  applyApproval: ReturnType<typeof vi.fn>;
  cancelTask: ReturnType<typeof vi.fn>;
} => {
  const listeners = new Set<(task: any) => void>();
  const tokenListeners = new Set<(event: any) => void>();
  const tasks = new Map<string, any>();
  const api = {
    initialize: vi.fn(async () => undefined),
    subscribe: vi.fn((listener: (task: any) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    subscribeTokens: vi.fn((listener: (event: any) => void) => {
      tokenListeners.add(listener);
      return () => tokenListeners.delete(listener);
    }),
    createTask: vi.fn(async dto => {
      const task = {
        id: 'task-1',
        goal: dto.goal,
        sessionId: dto.sessionId,
        status: TaskStatus.COMPLETED,
        trace: [
          {
            node: 'manager_plan',
            at: '2026-03-22T00:00:00.000Z',
            summary: 'manager planned'
          }
        ],
        approvals: [],
        agentStates: [],
        messages: [
          {
            id: 'task-msg-1',
            taskId: 'task-1',
            from: 'research',
            to: 'manager',
            type: 'research_result',
            content: 'Research found package metadata.',
            createdAt: '2026-03-22T00:00:00.000Z'
          },
          {
            id: 'task-msg-2',
            taskId: 'task-1',
            from: 'manager',
            to: 'manager',
            type: 'summary',
            content: 'Execution completed successfully.',
            createdAt: '2026-03-22T00:00:01.000Z'
          }
        ],
        result: 'Execution completed successfully.',
        createdAt: '2026-03-22T00:00:00.000Z',
        updatedAt: '2026-03-22T00:00:00.000Z',
        currentStep: 'finish',
        retryCount: 0,
        maxRetries: 1
      };

      tasks.set(task.id, task);
      listeners.forEach(listener => listener(task));
      return task;
    }),
    getTask: vi.fn((taskId: string) => tasks.get(taskId)),
    ensureLearningCandidates: vi.fn((task: any) => task.learningCandidates ?? []),
    confirmLearning: vi.fn(async (taskId: string, candidateIds?: string[]) => {
      const task = api.getTask(taskId) ?? tasks.get(taskId);
      if (!task) {
        return undefined;
      }

      if (task.learningCandidates?.length) {
        const selected = new Set(candidateIds ?? task.learningCandidates.map((candidate: any) => candidate.id));
        task.learningCandidates = task.learningCandidates.map((candidate: any) =>
          selected.has(candidate.id)
            ? { ...candidate, status: 'confirmed', confirmedAt: '2026-03-22T00:00:00.000Z' }
            : candidate
        );
      }

      return task;
    }),
    applyApproval: vi.fn(),
    cancelTask: vi.fn(async (taskId: string, reason?: string) => {
      const task = tasks.get(taskId);
      if (!task) {
        return undefined;
      }

      const cancelledTask = {
        ...task,
        status: TaskStatus.CANCELLED,
        currentStep: 'cancelled',
        result: reason ? `执行已终止：${reason}` : '执行已手动终止。',
        trace: [
          ...task.trace,
          {
            node: 'run_cancelled',
            at: '2026-03-22T00:00:02.000Z',
            summary: reason ? `执行已终止：${reason}` : '执行已手动终止。',
            data: reason ? { reason } : {}
          }
        ],
        updatedAt: '2026-03-22T00:00:02.000Z'
      };

      tasks.set(taskId, cancelledTask);
      listeners.forEach(listener => listener(cancelledTask));
      return cancelledTask;
    })
  };

  return api;
};

export const createLlmProvider = (): {
  isConfigured: () => boolean;
  generateText: () => Promise<string>;
  streamText: () => Promise<string>;
  generateObject: ReturnType<typeof vi.fn>;
} => ({
  isConfigured: vi.fn(() => false),
  generateText: vi.fn(async () => ''),
  streamText: vi.fn(async () => ''),
  generateObject: vi.fn()
});

export const createStreamingOrchestrator = (): {
  initialize: () => Promise<void>;
  subscribe: (listener: (task: any) => void) => () => boolean;
  subscribeTokens: (listener: (event: any) => void) => () => boolean;
  createTask: ReturnType<typeof vi.fn>;
  getTask: ReturnType<typeof vi.fn>;
  ensureLearningCandidates: ReturnType<typeof vi.fn>;
  confirmLearning: ReturnType<typeof vi.fn>;
  applyApproval: ReturnType<typeof vi.fn>;
} => {
  const listeners = new Set<(task: any) => void>();
  const tokenListeners = new Set<(event: any) => void>();
  let taskCount = 0;
  return {
    initialize: vi.fn(async () => undefined),
    subscribe: vi.fn((listener: (task: any) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    subscribeTokens: vi.fn((listener: (event: any) => void) => {
      tokenListeners.add(listener);
      return () => tokenListeners.delete(listener);
    }),
    createTask: vi.fn(async (dto: any) => {
      taskCount += 1;
      const task = {
        id: `task-${taskCount}`,
        goal: dto.goal,
        sessionId: dto.sessionId,
        status: TaskStatus.COMPLETED,
        trace: [],
        approvals: [],
        agentStates: [],
        messages: [
          {
            id: `task-msg-${taskCount}`,
            taskId: `task-${taskCount}`,
            from: 'manager',
            to: 'manager',
            type: 'summary',
            content: '我是一个多 Agent 协作助手。',
            createdAt: `2026-03-22T00:00:0${taskCount}.000Z`
          }
        ],
        result: '我是一个多 Agent 协作助手。',
        createdAt: `2026-03-22T00:00:0${taskCount}.000Z`,
        updatedAt: `2026-03-22T00:00:0${taskCount}.000Z`,
        currentStep: 'finish',
        retryCount: 0,
        maxRetries: 1
      };

      listeners.forEach(listener => listener(task));
      return task;
    }),
    getTask: vi.fn(() => undefined),
    ensureLearningCandidates: vi.fn((task: any) => task.learningCandidates ?? []),
    confirmLearning: vi.fn(),
    applyApproval: vi.fn()
  };
};

export const approvalIntent = ActionIntent.WRITE_FILE;

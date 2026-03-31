import { vi } from 'vitest';

import { RuntimeService } from '../../../src/runtime/runtime.service';

/** RuntimeService keeps collaborators private; tests assign mocks without intersecting class private fields (TS would yield `never`). */
type RuntimeServiceCollaboratorMocks = {
  orchestrator: any;
  sessionCoordinator: any;
  memoryRepository: any;
  ruleRepository: any;
  skillRegistry: any;
  runtimeStateRepository: any;
  mcpServerRegistry?: any;
  mcpCapabilityRegistry?: any;
  mcpClientManager?: any;
};

export const collaborators = (service: RuntimeService): RuntimeServiceCollaboratorMocks =>
  service as unknown as RuntimeServiceCollaboratorMocks;

export type ConnectorsCenterItem = Awaited<ReturnType<RuntimeService['getConnectorsCenter']>>[number];

export const createService = () => {
  const service = new RuntimeService();
  const c = collaborators(service);

  c.orchestrator = {
    initialize: vi.fn(async () => undefined),
    describeGraph: vi.fn(() => ['Goal Intake']),
    createTask: vi.fn(async dto => ({ id: 'task-1', ...dto })),
    listTasks: vi.fn(() => [
      {
        id: 'task-1',
        connectorRefs: [],
        trace: [],
        goal: 'task-1',
        updatedAt: '2026-03-26T00:00:00.000Z',
        createdAt: '2026-03-26T00:00:00.000Z',
        status: 'completed'
      }
    ]),
    listPendingApprovals: vi.fn(() => [{ id: 'task-pending' }]),
    getTask: vi.fn(id => (id === 'task-1' ? { id, trace: [], agentStates: [], messages: [] } : undefined)),
    getTaskAgents: vi.fn(() => [{ role: 'manager' }]),
    getTaskMessages: vi.fn(() => [{ id: 'msg-1' }]),
    getTaskPlan: vi.fn(id => (id === 'task-1' ? { steps: [], subTasks: [] } : undefined)),
    getTaskReview: vi.fn(id =>
      id === 'task-1'
        ? { taskId: id, decision: 'approved', notes: [], createdAt: '2026-03-22T00:00:00.000Z' }
        : undefined
    ),
    retryTask: vi.fn(async id => (id === 'task-1' ? { id } : undefined)),
    applyApproval: vi.fn(async (id, dto, decision) => (id === 'task-1' ? { id, dto, decision } : undefined)),
    listRules: vi.fn(async () => [{ id: 'rule-1' }]),
    createDocumentLearningJob: vi.fn(async dto => ({ id: 'job-1', status: 'queued', ...dto })),
    createResearchLearningJob: vi.fn(async dto => ({ id: 'job-2', status: 'queued', ...dto })),
    getLearningJob: vi.fn(id => (id === 'job-1' ? { id } : id === 'job-2' ? { id } : undefined)),
    listLearningJobs: vi.fn(() => [])
  };

  c.sessionCoordinator = {
    initialize: vi.fn(async () => undefined),
    listSessions: vi.fn(() => [{ id: 'session-1' }]),
    createSession: vi.fn(async dto => ({ id: 'session-1', ...dto })),
    getSession: vi.fn(id => (id === 'session-1' ? { id } : undefined)),
    getMessages: vi.fn(() => [{ id: 'chat-msg-1' }]),
    getEvents: vi.fn(() => [{ id: 'chat-event-1' }]),
    getCheckpoint: vi.fn(() => ({ sessionId: 'session-1' })),
    appendMessage: vi.fn(async (id, dto) => ({ sessionId: id, ...dto })),
    approve: vi.fn(async (id, dto) => ({ id, ...dto })),
    reject: vi.fn(async (id, dto) => ({ id, ...dto })),
    confirmLearning: vi.fn(async (id, dto) => ({ id, ...dto })),
    recover: vi.fn(async id => ({ id, recovered: true })),
    recoverToCheckpoint: vi.fn(async (_id, dto) => ({ id: dto.sessionId, recovered: true })),
    subscribe: vi.fn(() => vi.fn())
  };

  c.memoryRepository = {
    list: vi.fn(async () => [{ id: 'memory-1', status: 'active' }]),
    search: vi.fn(async () => [{ id: 'memory-1' }]),
    getById: vi.fn(async id => (id === 'memory-1' ? { id } : undefined)),
    invalidate: vi.fn(async (id, reason) =>
      id === 'memory-1' ? { id, status: 'invalidated', invalidationReason: reason } : undefined
    ),
    supersede: vi.fn(async (id, replacementId, reason) =>
      id === 'memory-1'
        ? { id, status: 'superseded', supersededById: replacementId, invalidationReason: reason }
        : undefined
    ),
    retire: vi.fn(async (id, reason) =>
      id === 'memory-1' ? { id, status: 'retired', invalidationReason: reason } : undefined
    ),
    restore: vi.fn(async id => (id === 'memory-1' ? { id, status: 'active' } : undefined))
  };

  c.skillRegistry = {
    list: vi.fn(async () => [{ id: 'skill-1' }]),
    getById: vi.fn(async id => (id === 'skill-1' ? { id } : undefined)),
    promote: vi.fn(async id => ({ id, status: 'stable' })),
    disable: vi.fn(async id => ({ id, status: 'disabled' })),
    restore: vi.fn(async id => ({ id, status: 'lab' })),
    retire: vi.fn(async id => ({ id, status: 'disabled', retiredAt: '2026-03-24T00:00:00.000Z' }))
  };

  c.ruleRepository = {
    list: vi.fn(async () => [{ id: 'rule-1' }]),
    getById: vi.fn(async id => (id === 'rule-1' ? { id } : undefined)),
    invalidate: vi.fn(async (id, reason) =>
      id === 'rule-1' ? { id, status: 'invalidated', invalidationReason: reason } : undefined
    ),
    supersede: vi.fn(async (id, replacementId, reason) =>
      id === 'rule-1'
        ? { id, status: 'superseded', supersededById: replacementId, invalidationReason: reason }
        : undefined
    ),
    retire: vi.fn(async (id, reason) =>
      id === 'rule-1' ? { id, status: 'retired', invalidationReason: reason } : undefined
    ),
    restore: vi.fn(async id => (id === 'rule-1' ? { id, status: 'active' } : undefined))
  };

  c.runtimeStateRepository = {
    load: vi.fn(async () => ({})),
    save: vi.fn(async () => undefined)
  };

  return service;
};

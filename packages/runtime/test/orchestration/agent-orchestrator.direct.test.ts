import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockModules } = vi.hoisted(() => {
  const mockModules = {
    toolRegistry: {},
    workerRegistry: {},
    modelRoutingPolicy: {},
    learningFlow: { ensureCandidates: vi.fn(), confirmCandidates: vi.fn() },
    taskFactory: {},
    taskDrafts: {},
    taskContextRuntime: {},
    runtime: {},
    backgroundRuntime: {},
    executionHelpers: {},
    learningJobsRuntime: { processQueuedLearningJobs: vi.fn() },
    lifecycle: {
      initialize: vi.fn(),
      getTask: vi.fn(),
      listTasks: vi.fn().mockReturnValue([]),
      listPendingApprovals: vi.fn().mockReturnValue([]),
      listWorkers: vi.fn().mockReturnValue([]),
      registerWorker: vi.fn(),
      setWorkerEnabled: vi.fn(),
      isWorkerEnabled: vi.fn(),
      listQueuedBackgroundTasks: vi.fn().mockReturnValue([]),
      acquireBackgroundLease: vi.fn(),
      heartbeatBackgroundLease: vi.fn(),
      releaseBackgroundLease: vi.fn(),
      listExpiredBackgroundLeases: vi.fn().mockReturnValue([]),
      reclaimExpiredBackgroundLease: vi.fn(),
      runBackgroundTask: vi.fn(),
      markBackgroundTaskRunnerFailure: vi.fn(),
      listTaskTraces: vi.fn().mockReturnValue([]),
      getTaskAgents: vi.fn().mockReturnValue([]),
      getTaskMessages: vi.fn().mockReturnValue([]),
      getTaskPlan: vi.fn(),
      getTaskReview: vi.fn(),
      retryTask: vi.fn(),
      cancelTask: vi.fn(),
      deleteSessionState: vi.fn(),
      applyApproval: vi.fn(),
      ensureLearningCandidates: vi.fn().mockReturnValue([]),
      confirmLearning: vi.fn(),
      sweepInterruptTimeouts: vi.fn().mockResolvedValue([]),
      scanLearningConflicts: vi.fn(),
      processLearningQueue: vi.fn(),
      processQueuedLearningJobs: vi.fn(),
      updateLearningConflictStatus: vi.fn(),
      listRules: vi.fn(),
      createDocumentLearningJob: vi.fn(),
      createResearchLearningJob: vi.fn(),
      getLearningJob: vi.fn(),
      listLearningJobs: vi.fn().mockReturnValue([]),
      listLearningQueue: vi.fn().mockReturnValue([]),
      createTask: vi.fn()
    },
    bridge: {},
    initializeGraphCheckpointer: vi.fn(),
    closeGraphCheckpointer: vi.fn(),
    initializeGraphStore: vi.fn(),
    closeGraphStore: vi.fn()
  };
  return { mockModules };
});

vi.mock('../../src/orchestration/main-graph-runtime-modules', () => ({
  createMainGraphRuntimeModules: vi.fn().mockReturnValue(mockModules)
}));

vi.mock('@agent/config', () => ({
  loadSettings: vi.fn().mockReturnValue({
    policy: { budget: {}, suggestionPolicy: {} }
  })
}));

import { AgentOrchestrator } from '../../src/orchestration/agent-orchestrator';

function makeDependencies(): any {
  return {
    llmProvider: { isConfigured: vi.fn() },
    settings: { policy: { budget: {}, suggestionPolicy: {} } }
  };
}

describe('AgentOrchestrator (direct)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes checkpointer, store, and lifecycle', async () => {
    const orchestrator = new AgentOrchestrator(makeDependencies());
    await orchestrator.initialize();
    expect(mockModules.initializeGraphCheckpointer).toHaveBeenCalled();
    expect(mockModules.initializeGraphStore).toHaveBeenCalled();
    expect(mockModules.lifecycle.initialize).toHaveBeenCalled();
  });

  it('closes store and checkpointer', async () => {
    const orchestrator = new AgentOrchestrator(makeDependencies());
    await orchestrator.close();
    expect(mockModules.closeGraphStore).toHaveBeenCalled();
    expect(mockModules.closeGraphCheckpointer).toHaveBeenCalled();
  });

  it('adds and removes listener', () => {
    const orchestrator = new AgentOrchestrator(makeDependencies());
    const listener = vi.fn();
    const unsubscribe = orchestrator.subscribe(listener);
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });

  it('adds and removes token listener', () => {
    const orchestrator = new AgentOrchestrator(makeDependencies());
    const unsubscribe = orchestrator.subscribeTokens(vi.fn());
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });

  it('returns graph descriptions', () => {
    expect(new AgentOrchestrator(makeDependencies()).describeGraph()).toContain('Main Graph Router');
  });

  it('delegates getTask', () => {
    new AgentOrchestrator(makeDependencies()).getTask('task-1');
    expect(mockModules.lifecycle.getTask).toHaveBeenCalledWith('task-1');
  });

  it('delegates listTasks', () => {
    new AgentOrchestrator(makeDependencies()).listTasks();
    expect(mockModules.lifecycle.listTasks).toHaveBeenCalled();
  });

  it('delegates learning operations', () => {
    const o = new AgentOrchestrator(makeDependencies());
    o.ensureLearningCandidates({} as any);
    o.confirmLearning('t1', ['c1']);
    o.sweepInterruptTimeouts();
    o.processLearningQueue(5);
    o.processQueuedLearningJobs(5);
    o.listLearningJobs();
    o.listLearningQueue();
  });

  it('delegates background operations', () => {
    const o = new AgentOrchestrator(makeDependencies());
    o.acquireBackgroundLease('t1', 'owner', 1000);
    o.heartbeatBackgroundLease('t1', 'owner', 1000);
    o.releaseBackgroundLease('t1', 'owner');
    o.listExpiredBackgroundLeases();
    o.reclaimExpiredBackgroundLease('t1', 'owner');
    o.runBackgroundTask('t1');
    o.markBackgroundTaskRunnerFailure('t1', 'reason');
  });

  it('delegates task data accessors', () => {
    const o = new AgentOrchestrator(makeDependencies());
    o.listTaskTraces('t1');
    o.getTaskAgents('t1');
    o.getTaskMessages('t1');
    o.getTaskPlan('t1');
    o.getTaskReview('t1');
  });

  it('delegates task operations', () => {
    const o = new AgentOrchestrator(makeDependencies());
    o.retryTask('t1');
    o.cancelTask('t1', 'reason');
    o.deleteSessionState('s1');
    o.applyApproval('t1', {} as any, 'approved' as any);
  });
});

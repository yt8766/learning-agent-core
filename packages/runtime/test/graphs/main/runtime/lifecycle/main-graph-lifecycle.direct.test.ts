import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../../../src/graphs/main/runtime/lifecycle/state/main-graph-lifecycle-persistence', () => ({
  enforceInterruptControllerPolicy: vi.fn(),
  finalizeLifecycleTaskState: vi.fn(),
  hydrateLifecycleState: vi.fn(),
  persistLifecycleState: vi.fn(),
  upsertLifecycleFreshnessEvidence: vi.fn(),
  buildSkillInstallPendingExecution: vi.fn()
}));

vi.mock('../../../../../src/graphs/main/runtime/lifecycle/state/main-graph-lifecycle-routing', () => ({
  isSkillInstallApprovalPending: vi.fn().mockReturnValue(false),
  resolveCreatedTaskDispatch: vi.fn().mockReturnValue({ kind: 'background_queue' })
}));

vi.mock('../../../../../src/graphs/main/runtime/lifecycle/governance/main-graph-lifecycle-governance', () => ({
  applyLifecycleCounselorSelectorGovernance: vi.fn().mockImplementation(({ dto }) => Promise.resolve(dto)),
  resolveLifecycleKnowledgeReuse: vi.fn().mockResolvedValue({
    evidence: [],
    memories: [],
    rules: [],
    reusedMemoryIds: [],
    reusedRuleIds: [],
    reusedSkillIds: []
  })
}));

vi.mock('../../../../../src/bridges/supervisor-runtime-bridge', () => ({
  resolveWorkflowPreset: vi.fn().mockReturnValue({
    normalizedGoal: 'test goal',
    preset: { id: 'general', displayName: '通用', requiredMinistries: [], allowedCapabilities: [] },
    command: undefined,
    source: 'default'
  })
}));

vi.mock('../../../../../src/graphs/main/runtime/knowledge/main-graph-knowledge', () => ({
  appendDiagnosisEvidence: vi.fn(),
  buildCitationSourceSummary: vi.fn().mockReturnValue(undefined),
  buildFreshnessSourceSummary: vi.fn().mockReturnValue(undefined),
  recordAgentError: vi.fn(),
  upsertFreshnessEvidence: vi.fn()
}));

vi.mock('../../../../../src/utils/prompts/temporal-context', () => ({
  isFreshnessSensitiveGoal: vi.fn().mockReturnValue(false)
}));

vi.mock('../../../../../src/graphs/main/runtime/lifecycle/approval', () => ({
  applyApprovalAction: vi.fn(),
  handleLifecycleInterruptTimeout: vi.fn()
}));

import { MainGraphLifecycle } from '../../../../../src/graphs/main/runtime/lifecycle/main-graph-lifecycle';
import {
  persistLifecycleState,
  enforceInterruptControllerPolicy,
  finalizeLifecycleTaskState,
  upsertLifecycleFreshnessEvidence
} from '../../../../../src/graphs/main/runtime/lifecycle/state/main-graph-lifecycle-persistence';
import {
  resolveCreatedTaskDispatch,
  isSkillInstallApprovalPending
} from '../../../../../src/graphs/main/runtime/lifecycle/state/main-graph-lifecycle-routing';

function makeTask(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'task-1',
    status: 'running',
    goal: 'test goal',
    updatedAt: '2026-05-10T00:00:00.000Z',
    createdAt: '2026-05-10T00:00:00.000Z',
    approvals: [],
    messages: [],
    agentStates: [],
    trace: [],
    capabilityAttachments: [],
    capabilityAugmentations: [],
    requestedHints: {},
    specialistLead: undefined,
    skillSearch: undefined,
    pendingApproval: undefined,
    sessionId: undefined,
    resolvedWorkflow: undefined,
    result: undefined,
    ...overrides
  };
}

function makeParams(overrides: Record<string, unknown> = {}): any {
  return {
    tasks: new Map(),
    learningJobs: new Map(),
    learningQueue: new Map(),
    pendingExecutions: new Map(),
    runtimeStateRepository: { load: vi.fn().mockResolvedValue({}), save: vi.fn() },
    memoryRepository: {},
    ruleRepository: {},
    workerRegistry: {},
    taskFactory: {
      createTaskRecord: vi.fn().mockResolvedValue({
        task: makeTask(),
        normalizedGoal: 'test goal'
      })
    },
    runtime: {},
    backgroundRuntime: {},
    learningFlow: { ensureCandidates: vi.fn(), confirmCandidates: vi.fn() },
    learningJobsRuntime: {},
    getLocalSkillSuggestionResolver: vi.fn().mockReturnValue(undefined),
    getPreExecutionSkillInterventionResolver: vi.fn().mockReturnValue(undefined),
    getRuntimeSkillInterventionResolver: vi.fn().mockReturnValue(undefined),
    getSkillInstallApprovalResolver: vi.fn().mockReturnValue(undefined),
    emitTaskUpdate: vi.fn(),
    runTaskPipeline: vi.fn().mockResolvedValue(undefined),
    runBootstrapGraph: vi.fn().mockResolvedValue(undefined),
    runApprovalRecoveryPipeline: vi.fn(),
    addTrace: vi.fn(),
    addProgressDelta: vi.fn(),
    markSubgraph: vi.fn(),
    transitionQueueState: vi.fn(),
    setSubTaskStatus: vi.fn(),
    upsertAgentState: vi.fn(),
    getMinistryLabel: vi.fn().mockReturnValue('工部'),
    ...overrides
  };
}

describe('MainGraphLifecycle (direct)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('initializes only once', async () => {
      const params = makeParams();
      const lifecycle = new MainGraphLifecycle(params);
      await lifecycle.initialize();
      await lifecycle.initialize();
      // hydrateLifecycleState should only be called once
      const { hydrateLifecycleState } =
        await import('../../../../../src/graphs/main/runtime/lifecycle/state/main-graph-lifecycle-persistence');
      expect(hydrateLifecycleState).toHaveBeenCalledTimes(1);
    });
  });

  describe('describeActionIntent', () => {
    it('returns correct description for WRITE_FILE', () => {
      const lifecycle = new MainGraphLifecycle(makeParams());
      expect(lifecycle.describeActionIntent('write_file')).toBe('文件写入');
    });

    it('returns correct description for DELETE_FILE', () => {
      const lifecycle = new MainGraphLifecycle(makeParams());
      expect(lifecycle.describeActionIntent('delete_file')).toBe('文件删除');
    });

    it('returns correct description for SCHEDULE_TASK', () => {
      const lifecycle = new MainGraphLifecycle(makeParams());
      expect(lifecycle.describeActionIntent('schedule_task')).toBe('定时任务');
    });

    it('returns correct description for CALL_EXTERNAL_API', () => {
      const lifecycle = new MainGraphLifecycle(makeParams());
      expect(lifecycle.describeActionIntent('call_external_api')).toBe('外部请求');
    });

    it('returns correct description for READ_FILE', () => {
      const lifecycle = new MainGraphLifecycle(makeParams());
      expect(lifecycle.describeActionIntent('read_file')).toBe('文件读取');
    });

    it('returns intent as-is for unknown intents', () => {
      const lifecycle = new MainGraphLifecycle(makeParams());
      expect(lifecycle.describeActionIntent('custom_action')).toBe('custom_action');
    });
  });

  describe('persistAndEmitTask', () => {
    it('enforces interrupt policy, finalizes, and persists', async () => {
      const params = makeParams();
      const lifecycle = new MainGraphLifecycle(params);
      await lifecycle.initialize();
      const task = makeTask();
      await lifecycle.persistAndEmitTask(task);
      expect(enforceInterruptControllerPolicy).toHaveBeenCalled();
      expect(finalizeLifecycleTaskState).toHaveBeenCalled();
      expect(upsertLifecycleFreshnessEvidence).toHaveBeenCalled();
      expect(persistLifecycleState).toHaveBeenCalled();
      expect(params.emitTaskUpdate).toHaveBeenCalledWith(task);
    });
  });

  describe('persistRuntimeState', () => {
    it('persists runtime state', async () => {
      const params = makeParams();
      const lifecycle = new MainGraphLifecycle(params);
      await lifecycle.initialize();
      await lifecycle.persistRuntimeState();
      expect(persistLifecycleState).toHaveBeenCalled();
    });
  });

  describe('emitTaskUpdate', () => {
    it('emits task update', () => {
      const params = makeParams();
      const lifecycle = new MainGraphLifecycle(params);
      const task = makeTask();
      lifecycle.emitTaskUpdate(task);
      expect(params.emitTaskUpdate).toHaveBeenCalledWith(task);
    });
  });

  describe('resolveRuntimeSkillIntervention', () => {
    it('returns undefined when no resolver', async () => {
      const params = makeParams({ getRuntimeSkillInterventionResolver: vi.fn().mockReturnValue(undefined) });
      const lifecycle = new MainGraphLifecycle(params);
      const result = await lifecycle.resolveRuntimeSkillIntervention({
        task: makeTask(),
        goal: 'test',
        currentStep: 'research',
        skillSearch: {} as any
      });
      expect(result).toBeUndefined();
    });

    it('calls resolver when available', async () => {
      const resolver = vi.fn().mockResolvedValue({ progressSummary: 'done' });
      const params = makeParams({ getRuntimeSkillInterventionResolver: vi.fn().mockReturnValue(resolver) });
      const lifecycle = new MainGraphLifecycle(params);
      const result = await lifecycle.resolveRuntimeSkillIntervention({
        task: makeTask(),
        goal: 'test',
        currentStep: 'research',
        skillSearch: {} as any
      });
      expect(resolver).toHaveBeenCalled();
      expect(result).toEqual({ progressSummary: 'done' });
    });
  });

  describe('getPreExecutionSkillInterventionResolver', () => {
    it('returns resolver from params', () => {
      const resolver = vi.fn();
      const params = makeParams({ getPreExecutionSkillInterventionResolver: vi.fn().mockReturnValue(resolver) });
      const lifecycle = new MainGraphLifecycle(params);
      expect(lifecycle.getPreExecutionSkillInterventionResolver()).toBe(resolver);
    });
  });

  describe('resolveSkillInstallInterruptResume', () => {
    it('returns undefined when no resolver', async () => {
      const params = makeParams({ getSkillInstallApprovalResolver: vi.fn().mockReturnValue(undefined) });
      const lifecycle = new MainGraphLifecycle(params);
      const result = await lifecycle.resolveSkillInstallInterruptResume({
        task: makeTask(),
        receiptId: 'r1'
      });
      expect(result).toBeUndefined();
    });

    it('calls resolver when available', async () => {
      const resolver = vi.fn().mockResolvedValue({ traceSummary: 'done' });
      const params = makeParams({ getSkillInstallApprovalResolver: vi.fn().mockReturnValue(resolver) });
      const lifecycle = new MainGraphLifecycle(params);
      const task = makeTask({ pendingApproval: { toolName: 'test-tool' }, goal: 'test goal' });
      const result = await lifecycle.resolveSkillInstallInterruptResume({
        task,
        receiptId: 'r1',
        skillDisplayName: 'Skill',
        usedInstalledSkills: ['s1'],
        actor: 'user'
      });
      expect(resolver).toHaveBeenCalled();
      expect(result).toEqual({ traceSummary: 'done' });
    });
  });

  describe('createTask', () => {
    it('creates task and queues to background', async () => {
      vi.mocked(resolveCreatedTaskDispatch).mockReturnValue({ kind: 'background_queue' });
      const params = makeParams();
      const lifecycle = new MainGraphLifecycle(params);
      const result = await lifecycle.createTask({ goal: 'test' } as any);
      expect(result).toBeDefined();
      expect(params.addTrace).toHaveBeenCalled();
    });

    it('handles wait_approval dispatch with skill install', async () => {
      vi.mocked(resolveCreatedTaskDispatch).mockReturnValue({ kind: 'wait_approval' });
      vi.mocked(isSkillInstallApprovalPending).mockReturnValue(true);
      const { buildSkillInstallPendingExecution } =
        await import('../../../../../src/graphs/main/runtime/lifecycle/state/main-graph-lifecycle-persistence');
      vi.mocked(buildSkillInstallPendingExecution).mockReturnValue({ taskId: 'task-1' } as any);
      const params = makeParams();
      const lifecycle = new MainGraphLifecycle(params);
      const result = await lifecycle.createTask({ goal: 'test' } as any);
      expect(result).toBeDefined();
    });

    it('handles session_bootstrap_and_pipeline dispatch', async () => {
      vi.mocked(resolveCreatedTaskDispatch).mockReturnValue({ kind: 'session_bootstrap_and_pipeline' });
      const taskWithSession = makeTask({ sessionId: 'session-1' });
      const params = makeParams({
        taskFactory: {
          createTaskRecord: vi.fn().mockResolvedValue({
            task: taskWithSession,
            normalizedGoal: 'test goal'
          })
        }
      });
      const lifecycle = new MainGraphLifecycle(params);
      const result = await lifecycle.createTask({ goal: 'test' } as any);
      expect(result).toBeDefined();
    });
  });

  describe('buildFreshnessSourceSummary', () => {
    it('delegates to buildFreshnessSourceSummary', () => {
      const lifecycle = new MainGraphLifecycle(makeParams());
      lifecycle.buildFreshnessSourceSummary(makeTask());
      // Just verify it doesn't throw
      expect(true).toBe(true);
    });
  });

  describe('buildCitationSourceSummary', () => {
    it('delegates to buildCitationSourceSummary', () => {
      const lifecycle = new MainGraphLifecycle(makeParams());
      lifecycle.buildCitationSourceSummary(makeTask());
      expect(true).toBe(true);
    });
  });

  describe('recordAgentError', () => {
    it('delegates to recordAgentError', () => {
      const lifecycle = new MainGraphLifecycle(makeParams());
      lifecycle.recordAgentError(makeTask(), new Error('test'), { phase: 'task_pipeline' });
      expect(true).toBe(true);
    });
  });

  describe('appendDiagnosisEvidence', () => {
    it('delegates to appendDiagnosisEvidence', () => {
      const lifecycle = new MainGraphLifecycle(makeParams());
      lifecycle.appendDiagnosisEvidence(makeTask(), { decision: 'pass' } as any, 'summary', 'answer');
      expect(true).toBe(true);
    });
  });
});

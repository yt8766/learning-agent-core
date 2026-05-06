import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  getApprovalsCenter: vi.fn(),
  getCompanyAgentsCenter: vi.fn(),
  getConnectorsCenter: vi.fn(),
  getEvidenceCenter: vi.fn(),
  getEvalsCenterFiltered: vi.fn(),
  getLearningCenter: vi.fn(),
  getPlatformConsole: vi.fn(),
  getPlatformConsoleShell: vi.fn(),
  getRules: vi.fn(),
  getRuntimeCenterFiltered: vi.fn(),
  getSkills: vi.fn(),
  getSkillSourcesCenter: vi.fn(),
  getTaskBundle: vi.fn(),
  isAbortedAdminRequestError: vi.fn()
}));

vi.mock('@/api/admin-api', () => apiMocks);

import { createAdminDashboardRefreshActions } from '@/hooks/admin-dashboard/admin-dashboard-refresh-actions';

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function createContext(overrides: Record<string, unknown> = {}) {
  const queryClient = {
    fetchQuery: vi.fn(async ({ queryFn }: { queryFn: () => Promise<unknown> }) => queryFn())
  };
  const state = {
    loading: [] as boolean[],
    errors: [] as string[],
    consoleData: {
      runtime: { recentRuns: [{ id: 'task-1' }] }
    } as any,
    bundle: { task: { id: 'task-1', status: 'running' } } as any,
    events: [] as Array<Record<string, unknown>>
  };

  return {
    state,
    context: {
      queryClient,
      getPage: () => 'runtime',
      getActiveTaskId: () => 'task-selected',
      getRuntimeHistoryDays: () => 30,
      getEvalsHistoryDays: () => 14,
      getRuntimeFilters: () => ({
        status: 'running',
        model: 'gpt-5.4',
        pricingSource: 'provider',
        executionMode: 'execute',
        interactionKind: 'approval'
      }),
      getApprovalFilters: () => ({
        executionMode: 'plan',
        interactionKind: 'plan-question'
      }),
      getEvalFilters: () => ({ scenario: 'scenario-1', outcome: 'passed' }),
      getBundle: () => state.bundle,
      getConsoleData: () => state.consoleData,
      setPage: vi.fn(),
      setActiveTaskId: vi.fn(),
      setObservatoryFocusTarget: vi.fn(),
      setRuntimeCompareTaskId: vi.fn(),
      setLoading: vi.fn((value: boolean) => state.loading.push(value)),
      setError: vi.fn((value: string) => state.errors.push(value)),
      setConsoleData: vi.fn((value: any) => {
        state.consoleData = typeof value === 'function' ? value(state.consoleData) : value;
      }),
      setBundle: vi.fn((value: any) => {
        state.bundle = value;
      }),
      reportRefresh: vi.fn((event: Record<string, unknown>) => state.events.push(event)),
      ...overrides
    }
  };
}

describe('admin-dashboard-refresh-actions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-01T09:00:00.000Z'));
    Object.values(apiMocks).forEach(mock => mock.mockReset());
    apiMocks.getPlatformConsoleShell.mockResolvedValue({
      runtime: { recentRuns: [{ id: 'task-2' }], activeTaskCount: 1 },
      tasks: [{ id: 'task-2' }]
    });
    apiMocks.getTaskBundle.mockResolvedValue({ task: { id: 'task-2', status: 'queued' } });
    apiMocks.getRuntimeCenterFiltered.mockResolvedValue({ recentRuns: [], activeTaskCount: 2 });
    apiMocks.getApprovalsCenter.mockResolvedValue([{ id: 'approval-1' }]);
    apiMocks.getLearningCenter.mockResolvedValue({ totalCandidates: 1 });
    apiMocks.getEvalsCenterFiltered.mockResolvedValue({ scenarioCount: 2 });
    apiMocks.getEvidenceCenter.mockResolvedValue([{ id: 'evidence-1' }]);
    apiMocks.getConnectorsCenter.mockResolvedValue([{ id: 'connector-1' }]);
    apiMocks.getSkillSourcesCenter.mockResolvedValue({ sources: [{ id: 'source-1' }] });
    apiMocks.getCompanyAgentsCenter.mockResolvedValue([{ id: 'worker-1' }]);
    apiMocks.getSkills.mockResolvedValue([{ id: 'skill-1' }]);
    apiMocks.getRules.mockResolvedValue([{ id: 'rule-1' }]);
    apiMocks.isAbortedAdminRequestError.mockReturnValue(false);
  });

  it('refreshes all console data and dedupes/throttles repeated refreshes', async () => {
    const { context, state } = createContext();
    const actions = createAdminDashboardRefreshActions(context as any);

    await actions.refreshAll();
    await actions.refreshAll();

    expect(apiMocks.getPlatformConsoleShell).toHaveBeenCalledWith(30, {
      status: 'running',
      model: 'gpt-5.4',
      pricingSource: 'provider',
      runtimeExecutionMode: 'execute',
      runtimeInteractionKind: 'approval',
      approvalsExecutionMode: 'plan',
      approvalsInteractionKind: 'plan-question'
    });
    expect(apiMocks.getTaskBundle).toHaveBeenCalledWith('task-selected');
    expect(context.setActiveTaskId).toHaveBeenCalledWith('task-selected');
    expect(state.loading).toEqual([true, false]);
    expect(apiMocks.getRuntimeCenterFiltered).toHaveBeenCalledWith({
      days: 30,
      status: 'running',
      model: 'gpt-5.4',
      pricingSource: 'provider',
      executionMode: 'execute',
      interactionKind: 'approval'
    });
    expect(state.consoleData.runtime.activeTaskCount).toBe(2);
    expect(state.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scope: 'all', outcome: 'started' }),
        expect.objectContaining({ scope: 'all', outcome: 'completed' }),
        expect.objectContaining({ scope: 'all', outcome: 'throttled' })
      ])
    );
  });

  it('loads shell and active page center in parallel during full refresh', async () => {
    const shellDeferred = createDeferred<any>();
    const runtimeDeferred = createDeferred<any>();
    const bundleDeferred = createDeferred<any>();
    apiMocks.getPlatformConsoleShell.mockReturnValueOnce(shellDeferred.promise);
    apiMocks.getRuntimeCenterFiltered.mockReturnValueOnce(runtimeDeferred.promise);
    apiMocks.getTaskBundle.mockReturnValueOnce(bundleDeferred.promise);

    const { context, state } = createContext();
    const actions = createAdminDashboardRefreshActions(context as any);
    const refreshPromise = actions.refreshAll();

    expect(apiMocks.getPlatformConsoleShell).toHaveBeenCalledTimes(1);
    expect(apiMocks.getRuntimeCenterFiltered).toHaveBeenCalledTimes(1);
    expect(apiMocks.getTaskBundle).not.toHaveBeenCalled();

    runtimeDeferred.resolve({ recentRuns: [{ id: 'task-runtime' }], activeTaskCount: 3 });
    shellDeferred.resolve({ runtime: { recentRuns: [{ id: 'task-shell' }], activeTaskCount: 1 }, tasks: [] });
    bundleDeferred.resolve({ task: { id: 'task-selected', status: 'running' } });

    await refreshPromise;

    expect(apiMocks.getTaskBundle).toHaveBeenCalledWith('task-selected');
    expect(state.consoleData.runtime).toEqual(
      expect.objectContaining({
        recentRuns: [{ id: 'task-runtime' }],
        activeTaskCount: 3
      })
    );
  });

  it('refreshes page centers across runtime, approvals and eval branches', async () => {
    const { context, state } = createContext();
    const actions = createAdminDashboardRefreshActions(context as any);

    await actions.refreshPageCenter('runtime', { runtimeDays: 7 });
    await actions.refreshPageCenter('approvals');
    await actions.refreshPageCenter('evals', { evalsDays: 5 });

    expect(apiMocks.getRuntimeCenterFiltered).toHaveBeenCalledWith({
      days: 7,
      status: 'running',
      model: 'gpt-5.4',
      pricingSource: 'provider',
      executionMode: 'execute',
      interactionKind: 'approval'
    });
    expect(apiMocks.getApprovalsCenter).toHaveBeenCalledWith({
      executionMode: 'plan',
      interactionKind: 'plan-question'
    });
    expect(apiMocks.getEvalsCenterFiltered).toHaveBeenCalledWith({
      days: 5,
      scenarioId: 'scenario-1',
      outcome: 'passed'
    });
    expect(state.consoleData).toEqual(
      expect.objectContaining({
        runtime: expect.objectContaining({ activeTaskCount: 2 }),
        approvals: [{ id: 'approval-1' }],
        evals: expect.objectContaining({ scenarioCount: 2 })
      })
    );
  });

  it('includes approval filters in the center refresh request key', async () => {
    let approvalFilters: {
      executionMode: 'all' | 'plan' | 'execute' | 'imperial_direct';
      interactionKind:
        | 'all'
        | 'approval'
        | 'plan-question'
        | 'supplemental-input'
        | 'revise-required'
        | 'micro-loop-exhausted'
        | 'mode-transition';
    } = {
      executionMode: 'plan',
      interactionKind: 'plan-question'
    };
    const { context } = createContext({
      getApprovalFilters: () => approvalFilters
    });
    const actions = createAdminDashboardRefreshActions(context as any);

    await actions.refreshPageCenter('approvals');
    approvalFilters = {
      executionMode: 'execute',
      interactionKind: 'approval'
    };
    await actions.refreshPageCenter('approvals');

    expect(apiMocks.getApprovalsCenter).toHaveBeenCalledTimes(2);
    expect(apiMocks.getApprovalsCenter).toHaveBeenNthCalledWith(1, {
      executionMode: 'plan',
      interactionKind: 'plan-question'
    });
    expect(apiMocks.getApprovalsCenter).toHaveBeenNthCalledWith(2, {
      executionMode: 'execute',
      interactionKind: 'approval'
    });
  });

  it('loads archive page center by fetching runtime and evals in parallel', async () => {
    const { context, state } = createContext({
      getPage: () => 'archives'
    });
    const actions = createAdminDashboardRefreshActions(context as any);

    await actions.refreshAll();

    expect(apiMocks.getRuntimeCenterFiltered).toHaveBeenCalledWith({
      days: 30,
      status: 'running',
      model: 'gpt-5.4',
      pricingSource: 'provider',
      executionMode: 'execute',
      interactionKind: 'approval'
    });
    expect(apiMocks.getEvalsCenterFiltered).toHaveBeenCalledWith({
      days: 14,
      scenarioId: 'scenario-1',
      outcome: 'passed'
    });
    expect(state.consoleData).toEqual(
      expect.objectContaining({
        runtime: expect.objectContaining({ activeTaskCount: 2 }),
        evals: expect.objectContaining({ scenarioCount: 2 })
      })
    );
  });

  it('loads skill lab page center by fetching skills and rules', async () => {
    const { context, state } = createContext({
      getPage: () => 'skills'
    });
    const actions = createAdminDashboardRefreshActions(context as any);

    await actions.refreshAll();

    expect(apiMocks.getSkills).toHaveBeenCalledWith(undefined);
    expect(apiMocks.getRules).toHaveBeenCalled();
    expect(state.consoleData).toEqual(
      expect.objectContaining({
        skills: [{ id: 'skill-1' }],
        rules: [{ id: 'rule-1' }]
      })
    );
  });

  it('refreshes a task and reports failures or aborts without breaking state', async () => {
    const { context, state } = createContext();
    const actions = createAdminDashboardRefreshActions(context as any);

    await actions.refreshTask('task-1', false);

    apiMocks.getTaskBundle.mockRejectedValueOnce(new Error('refresh failed'));
    await actions.refreshTask('task-2');

    apiMocks.getTaskBundle.mockRejectedValueOnce(new Error('aborted'));
    apiMocks.isAbortedAdminRequestError.mockImplementationOnce(error => (error as Error).message === 'aborted');
    await actions.refreshTask('task-3');

    expect(apiMocks.getTaskBundle).toHaveBeenNthCalledWith(1, 'task-1');
    expect(apiMocks.getTaskBundle).toHaveBeenNthCalledWith(2, 'task-2');
    expect(apiMocks.getPlatformConsoleShell).toHaveBeenCalled();
    expect(context.setActiveTaskId).toHaveBeenCalledWith('task-1');
    expect(state.bundle).toEqual(expect.objectContaining({ task: expect.objectContaining({ id: 'task-2' }) }));
    expect(state.errors).toContain('refresh failed');
    expect(state.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scope: 'task', target: 'task-1', outcome: 'completed' }),
        expect.objectContaining({ scope: 'task', target: 'task-2', outcome: 'failed' }),
        expect.objectContaining({ scope: 'task', target: 'task-3', outcome: 'aborted' })
      ])
    );
  });
});

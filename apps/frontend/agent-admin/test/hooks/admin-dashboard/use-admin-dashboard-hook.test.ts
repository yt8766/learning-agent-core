import { beforeEach, describe, expect, it, vi } from 'vitest';

type EffectSlot = {
  deps?: unknown[];
  callback: () => void | (() => void);
  cleanup?: (() => void) | undefined;
};

type CapturedDashboardContext = {
  queryClient: { fetchQuery: ReturnType<typeof vi.fn> };
  getPage: () => string;
  getActiveTaskId: () => string | undefined;
  getRuntimeFilters: () => Record<string, unknown>;
  getApprovalFilters: () => Record<string, unknown>;
  getRuntimeHistoryDays: () => number;
  getEvalsHistoryDays: () => number;
  getEvalFilters: () => Record<string, unknown>;
  getBundle: () => unknown;
  getConsoleData: () => unknown;
  setActiveTaskId: (taskId?: string) => void;
  setObservatoryFocusTarget: (target?: { kind: 'checkpoint' | 'span' | 'evidence'; id: string }) => void;
  setRuntimeCompareTaskId: (taskId?: string) => void;
  setRuntimeGraphNodeId: (nodeId?: string) => void;
  reportRefresh: (event: { scope: 'all'; target: string; reason: string; outcome: string }) => void;
};

function createReactHookHarness(initialState: Record<number, unknown> = {}) {
  const stateSlots: unknown[] = [];
  const refSlots: Array<{ current: unknown }> = [];
  const effectSlots: EffectSlot[] = [];
  let stateCursor = 0;
  let refCursor = 0;
  let memoCursor = 0;
  let effectCursor = 0;
  let pendingEffects: number[] = [];

  const reactModule = {
    useState<T>(initial: T | (() => T)) {
      const index = stateCursor++;
      if (!(index in stateSlots)) {
        stateSlots[index] =
          index in initialState
            ? initialState[index]
            : typeof initial === 'function'
              ? (initial as () => T)()
              : initial;
      }
      const setState = (next: T | ((value: T) => T)) => {
        const current = stateSlots[index] as T;
        stateSlots[index] = typeof next === 'function' ? (next as (value: T) => T)(current) : next;
      };
      return [stateSlots[index] as T, setState] as const;
    },
    useRef<T>(initial: T) {
      const index = refCursor++;
      if (!(index in refSlots)) {
        refSlots[index] = { current: initial };
      }
      return refSlots[index] as { current: T };
    },
    useMemo<T>(factory: () => T) {
      memoCursor += 1;
      return factory();
    },
    useReducer<S, A>(reducer: (state: S, action: A) => S, initial: S) {
      const index = stateCursor++;
      if (!(index in stateSlots)) {
        stateSlots[index] = initial;
      }
      const dispatch = (action: A) => {
        stateSlots[index] = reducer(stateSlots[index] as S, action);
      };
      return [stateSlots[index] as S, dispatch] as const;
    },
    useEffect(callback: () => void | (() => void), deps?: unknown[]) {
      const index = effectCursor++;
      const previous = effectSlots[index];
      const changed =
        !previous ||
        !deps ||
        !previous.deps ||
        deps.length !== previous.deps.length ||
        deps.some((value, depIndex) => value !== previous.deps?.[depIndex]);
      effectSlots[index] = {
        ...previous,
        deps,
        callback
      };
      if (changed) {
        pendingEffects.push(index);
      }
    }
  };

  async function runEffects() {
    const nextEffects = [...pendingEffects];
    pendingEffects = [];
    for (const effectIndex of nextEffects) {
      effectSlots[effectIndex]?.cleanup?.();
      const cleanup = effectSlots[effectIndex]?.callback();
      effectSlots[effectIndex].cleanup = typeof cleanup === 'function' ? cleanup : undefined;
    }
    await Promise.resolve();
    await Promise.resolve();
  }

  function render<T>(hook: () => T) {
    stateCursor = 0;
    refCursor = 0;
    memoCursor = 0;
    effectCursor = 0;
    pendingEffects = [];
    return hook();
  }

  function unmount() {
    effectSlots.forEach(slot => slot?.cleanup?.());
  }

  return { reactModule, stateSlots, render, runEffects, unmount };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('use-admin-dashboard hook coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('loads dashboard data, syncs the path route, and reacts to browser navigation', async () => {
    const harness = createReactHookHarness();
    const listeners = new Map<string, EventListener>();
    const pushState = vi.fn();
    const replaceState = vi.fn();
    const dispatchEvent = vi.fn();
    let capturedContext: CapturedDashboardContext | undefined;
    const queryClient = {
      fetchQuery: vi.fn()
    };
    const actions = {
      refreshAll: vi.fn().mockResolvedValue(undefined),
      refreshPageCenter: vi.fn().mockResolvedValue(undefined),
      refreshTask: vi.fn().mockResolvedValue(undefined)
    };
    const initialRouteState = {
      page: 'runtime',
      runtimeTaskId: 'task-selected-1',
      runtimeFocusKind: 'checkpoint',
      runtimeFocusId: 'cp-1',
      runtimeCompareTaskId: 'task-compare-1',
      runtimeGraphNodeId: 'worker-gongbu-code',
      runtimeStatusFilter: 'running',
      runtimeModelFilter: 'gpt-5.4',
      runtimePricingSourceFilter: 'provider',
      runtimeExecutionModeFilter: 'plan',
      runtimeInteractionKindFilter: 'approval',
      approvalsExecutionModeFilter: 'all',
      approvalsInteractionKindFilter: 'all'
    };
    const changedRouteState = {
      page: 'approvals',
      runtimeTaskId: 'task-selected-2',
      runtimeFocusKind: 'span',
      runtimeFocusId: 'span-2',
      runtimeCompareTaskId: 'task-compare-2',
      runtimeGraphNodeId: 'worker-hubu-search',
      runtimeStatusFilter: 'failed',
      runtimeModelFilter: 'gpt-5.4-mini',
      runtimePricingSourceFilter: 'estimated',
      runtimeExecutionModeFilter: 'execute',
      runtimeInteractionKindFilter: 'mode-transition',
      approvalsExecutionModeFilter: 'imperial_direct',
      approvalsInteractionKindFilter: 'plan-question'
    };
    let currentRouteState = initialRouteState;
    const readDashboardStateFromRoute = vi.fn(() => currentRouteState);

    vi.stubGlobal('window', {
      location: {
        hash: '',
        origin: 'https://example.com',
        pathname: '/runtime',
        search: ''
      },
      history: {
        pushState,
        replaceState
      },
      dispatchEvent,
      addEventListener: vi.fn((type: string, listener: EventListener) => listeners.set(type, listener)),
      removeEventListener: vi.fn((type: string) => listeners.delete(type)),
      setInterval,
      clearInterval
    });

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('@tanstack/react-query', () => ({
      useQueryClient: () => queryClient,
      useQuery: () => ({
        data: { status: 'healthy', now: '12:00' },
        error: null
      })
    }));
    vi.doMock('@/api/admin-query', () => ({
      adminQueryKeys: {
        platformConsoleLogAnalysis: vi.fn((days: number) => ['admin', 'platform-console-log-analysis', days])
      },
      fetchAdminHealth: vi.fn(),
      fetchPlatformConsoleLogAnalysis: vi.fn()
    }));
    vi.doMock('@/hooks/admin-dashboard/admin-dashboard-actions', () => ({
      createAdminDashboardActions: (context: CapturedDashboardContext) => {
        capturedContext = context;
        return actions;
      }
    }));
    vi.doMock('@/hooks/admin-dashboard/admin-dashboard-constants', () => ({
      PAGE_TITLES: {
        runtime: '运行中枢',
        approvals: '审批中枢'
      },
      buildDashboardRoute: vi.fn(
        (state: { page: string }) =>
          state.page === 'learning'
            ? '/learning'
            :
          '/runtime?runtimeTaskId=task-selected-1&runtimeFocusKind=checkpoint&runtimeFocusId=cp-1&runtimeCompareTaskId=task-compare-1&runtimeGraphNodeId=worker-gongbu-code&runtimeStatus=running&runtimeModel=gpt-5.4&runtimePricingSource=provider&runtimeExecutionMode=plan'
      ),
      buildDashboardShareUrl: vi.fn(() => 'https://example.com/admin/runtime'),
      readDashboardStateFromRoute,
      shouldPollTask: vi.fn(() => false),
      toApprovalItems: vi.fn(() => ['approval-1'])
    }));

    const { useAdminDashboard } = await import('@/hooks/use-admin-dashboard');

    let result = harness.render(() => useAdminDashboard());
    await harness.runEffects();
    await flushAsyncWork();

    expect(actions.refreshAll).toHaveBeenCalledTimes(1);
    expect(harness.stateSlots[1]).toBe('healthy 路 12:00');
    expect(replaceState).toHaveBeenCalledWith(
      null,
      '',
      '/runtime?runtimeTaskId=task-selected-1&runtimeFocusKind=checkpoint&runtimeFocusId=cp-1&runtimeCompareTaskId=task-compare-1&runtimeGraphNodeId=worker-gongbu-code&runtimeStatus=running&runtimeModel=gpt-5.4&runtimePricingSource=provider&runtimeExecutionMode=plan'
    );
    expect(result.pendingApprovals).toEqual(['approval-1']);
    expect(result.activeTaskId).toBe('task-selected-1');
    expect(result.observatoryFocusTarget).toEqual({ kind: 'checkpoint', id: 'cp-1' });
    expect(result.runtimeCompareTaskId).toBe('task-compare-1');
    expect(result.runtimeGraphNodeId).toBe('worker-gongbu-code');

    currentRouteState = changedRouteState;
    listeners.get('popstate')?.(new Event('popstate'));
    result = harness.render(() => useAdminDashboard());
    await harness.runEffects();

    expect(result.page).toBe('approvals');
    expect(result.activeTaskId).toBe('task-selected-2');
    expect(result.observatoryFocusTarget).toEqual({ kind: 'span', id: 'span-2' });
    expect(result.runtimeCompareTaskId).toBe('task-compare-2');
    expect(result.runtimeGraphNodeId).toBe('worker-hubu-search');
    expect(result.runtimeStatusFilter).toBe('failed');
    expect(result.runtimeModelFilter).toBe('gpt-5.4-mini');
    expect(result.runtimePricingSourceFilter).toBe('estimated');
    expect(result.runtimeExecutionModeFilter).toBe('execute');
    expect(result.approvalsExecutionModeFilter).toBe('imperial_direct');
    expect(result.approvalsInteractionKindFilter).toBe('plan-question');
    expect(capturedContext?.getPage()).toBe('approvals');
    expect(capturedContext?.queryClient).toBe(queryClient);
    expect(capturedContext?.getActiveTaskId()).toBe('task-selected-2');
    expect(capturedContext?.getRuntimeFilters()).toEqual({
      status: 'failed',
      model: 'gpt-5.4-mini',
      pricingSource: 'estimated',
      executionMode: 'execute',
      interactionKind: 'mode-transition'
    });
    expect(capturedContext?.getApprovalFilters()).toEqual({
      executionMode: 'imperial_direct',
      interactionKind: 'plan-question'
    });
    expect(capturedContext?.getRuntimeHistoryDays()).toBe(30);
    expect(capturedContext?.getEvalsHistoryDays()).toBe(30);
    expect(capturedContext?.getEvalFilters()).toEqual({ scenario: '', outcome: '' });
    expect(capturedContext?.getBundle()).toBeNull();
    expect(capturedContext?.getConsoleData()).toBeNull();

    capturedContext?.reportRefresh({
      scope: 'all',
      target: 'runtime',
      reason: 'manual',
      outcome: 'started'
    });
    capturedContext?.reportRefresh({
      scope: 'all',
      target: 'runtime',
      reason: 'manual',
      outcome: 'completed'
    });

    result = harness.render(() => useAdminDashboard());
    await harness.runEffects();
    expect(result.refreshDiagnostics).toMatchObject({ target: 'runtime', outcome: 'completed' });
    expect(result.activeRefreshTargets).toEqual([]);

    result.setPage('learning');
    result = harness.render(() => useAdminDashboard());
    await harness.runEffects();
    expect(result.page).toBe('learning');
    expect(pushState).toHaveBeenCalledWith(null, '', '/learning');
    expect(dispatchEvent).toHaveBeenCalledWith(expect.any(Event));
    expect(actions.refreshPageCenter).not.toHaveBeenCalledWith('learning');

    harness.unmount();
  });

  it('refreshes runtime center when console data exists and polls running tasks', async () => {
    const harness = createReactHookHarness({
      0: 'runtime',
      2: {
        runtime: {
          recentRuns: [{ id: 'task-1' }]
        }
      },
      3: {
        task: {
          id: 'task-1',
          status: 'running'
        }
      },
      9: 'running',
      10: 'gpt-5.4',
      11: 'provider',
      12: 'execute',
      13: 'approval'
    });
    const intervalCallbacks: Array<() => void> = [];
    const queryClient = {
      fetchQuery: vi.fn()
    };
    const actions = {
      refreshAll: vi.fn().mockResolvedValue(undefined),
      refreshPageCenter: vi.fn().mockResolvedValue(undefined),
      refreshTask: vi.fn().mockResolvedValue(undefined)
    };

    vi.stubGlobal('window', {
      location: {
        hash: '',
        origin: 'https://example.com',
        pathname: '/runtime',
        search: ''
      },
      history: {
        replaceState: vi.fn()
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setInterval: vi.fn((callback: () => void) => {
        intervalCallbacks.push(callback);
        return intervalCallbacks.length;
      }),
      clearInterval: vi.fn()
    });

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('@tanstack/react-query', () => ({
      useQueryClient: () => queryClient,
      useQuery: () => ({
        data: { status: 'healthy', now: '12:00' },
        error: null
      })
    }));
    vi.doMock('@/api/admin-query', () => ({
      adminQueryKeys: {
        platformConsoleLogAnalysis: vi.fn((days: number) => ['admin', 'platform-console-log-analysis', days])
      },
      fetchAdminHealth: vi.fn(),
      fetchPlatformConsoleLogAnalysis: vi.fn()
    }));
    vi.doMock('@/hooks/admin-dashboard/admin-dashboard-actions', () => ({
      createAdminDashboardActions: () => actions
    }));
    vi.doMock('@/hooks/admin-dashboard/admin-dashboard-constants', () => ({
      PAGE_TITLES: {
        runtime: '运行中枢'
      },
      buildDashboardRoute: vi.fn(() => '/runtime'),
      buildDashboardShareUrl: vi.fn(() => 'https://example.com/admin/runtime'),
      readDashboardStateFromRoute: vi.fn(() => ({
        page: 'runtime',
        runtimeTaskId: 'task-1',
        runtimeFocusKind: undefined,
        runtimeFocusId: undefined,
        runtimeCompareTaskId: undefined,
        runtimeGraphNodeId: undefined,
        runtimeStatusFilter: '',
        runtimeModelFilter: '',
        runtimePricingSourceFilter: '',
        runtimeExecutionModeFilter: 'all',
        runtimeInteractionKindFilter: 'all',
        approvalsExecutionModeFilter: 'all',
        approvalsInteractionKindFilter: 'all'
      })),
      shouldPollTask: vi.fn(() => true),
      toApprovalItems: vi.fn(() => [])
    }));

    const { useAdminDashboard } = await import('@/hooks/use-admin-dashboard');

    harness.render(() => useAdminDashboard());
    await harness.runEffects();
    await flushAsyncWork();

    expect(actions.refreshPageCenter).toHaveBeenCalledWith('runtime');
    expect(actions.refreshPageCenter).toHaveBeenCalledTimes(1);
    expect(window.setInterval).toHaveBeenCalledWith(expect.any(Function), 4000);

    intervalCallbacks[0]?.();
    expect(actions.refreshTask).toHaveBeenCalledWith('task-1', false);

    actions.refreshPageCenter.mockClear();
    const result = harness.render(() => useAdminDashboard());
    result.setPage('approvals');
    harness.render(() => useAdminDashboard());
    await harness.runEffects();

    expect(actions.refreshPageCenter).toHaveBeenCalledTimes(1);
    expect(actions.refreshPageCenter).toHaveBeenCalledWith('approvals');

    harness.unmount();
    expect(window.clearInterval).toHaveBeenCalled();
  });

  it('refreshes approvals and evals centers on their respective pages', async () => {
    const approvalsHarness = createReactHookHarness({
      0: 'approvals',
      2: {
        runtime: {
          recentRuns: [{ id: 'task-2' }]
        }
      },
      14: 'plan',
      15: 'plan-question'
    });
    const evalsHarness = createReactHookHarness({
      0: 'evals',
      2: {
        runtime: {
          recentRuns: [{ id: 'task-3' }]
        }
      },
      16: 'scenario-1',
      17: 'passed'
    });
    const actions = {
      refreshAll: vi.fn().mockResolvedValue(undefined),
      refreshPageCenter: vi.fn().mockResolvedValue(undefined),
      refreshTask: vi.fn().mockResolvedValue(undefined)
    };
    const approvalsQueryClient = {
      fetchQuery: vi.fn()
    };
    const evalsQueryClient = {
      fetchQuery: vi.fn()
    };

    vi.stubGlobal('window', {
      location: {
        hash: '',
        origin: 'https://example.com',
        pathname: '/approvals',
        search: ''
      },
      history: {
        replaceState: vi.fn()
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setInterval,
      clearInterval
    });

    vi.doMock('react', () => approvalsHarness.reactModule);
    vi.doMock('@tanstack/react-query', () => ({
      useQueryClient: () => approvalsQueryClient,
      useQuery: () => ({
        data: undefined,
        error: new Error('offline')
      })
    }));
    vi.doMock('@/api/admin-query', () => ({
      adminQueryKeys: {
        platformConsoleLogAnalysis: vi.fn((days: number) => ['admin', 'platform-console-log-analysis', days])
      },
      fetchAdminHealth: vi.fn(),
      fetchPlatformConsoleLogAnalysis: vi.fn()
    }));
    vi.doMock('@/hooks/admin-dashboard/admin-dashboard-actions', () => ({
      createAdminDashboardActions: () => actions
    }));
    vi.doMock('@/hooks/admin-dashboard/admin-dashboard-constants', () => ({
      PAGE_TITLES: {
        approvals: '审批中枢',
        evals: '评测基线'
      },
      buildDashboardRoute: vi.fn(() => '/approvals'),
      buildDashboardShareUrl: vi.fn(() => 'https://example.com/admin/approvals'),
      readDashboardStateFromRoute: vi.fn(() => ({
        page: 'approvals',
        runtimeTaskId: undefined,
        runtimeFocusKind: undefined,
        runtimeFocusId: undefined,
        runtimeCompareTaskId: undefined,
        runtimeGraphNodeId: undefined,
        runtimeStatusFilter: '',
        runtimeModelFilter: '',
        runtimePricingSourceFilter: '',
        runtimeExecutionModeFilter: 'all',
        runtimeInteractionKindFilter: 'all',
        approvalsExecutionModeFilter: 'all',
        approvalsInteractionKindFilter: 'all'
      })),
      shouldPollTask: vi.fn(() => false),
      toApprovalItems: vi.fn(() => [])
    }));

    const { useAdminDashboard } = await import('@/hooks/use-admin-dashboard');

    approvalsHarness.render(() => useAdminDashboard());
    await approvalsHarness.runEffects();
    await flushAsyncWork();

    vi.resetModules();
    vi.doMock('react', () => evalsHarness.reactModule);
    vi.doMock('@tanstack/react-query', () => ({
      useQueryClient: () => evalsQueryClient,
      useQuery: () => ({
        data: undefined,
        error: new Error('offline')
      })
    }));
    vi.doMock('@/api/admin-query', () => ({
      adminQueryKeys: {
        platformConsoleLogAnalysis: vi.fn((days: number) => ['admin', 'platform-console-log-analysis', days])
      },
      fetchAdminHealth: vi.fn(),
      fetchPlatformConsoleLogAnalysis: vi.fn()
    }));
    vi.doMock('@/hooks/admin-dashboard/admin-dashboard-actions', () => ({
      createAdminDashboardActions: () => actions
    }));
    vi.doMock('@/hooks/admin-dashboard/admin-dashboard-constants', () => ({
      PAGE_TITLES: {
        approvals: '审批中枢',
        evals: '评测基线'
      },
      buildDashboardRoute: vi.fn(() => '/evals'),
      buildDashboardShareUrl: vi.fn(() => 'https://example.com/admin/evals'),
      readDashboardStateFromRoute: vi.fn(() => ({
        page: 'evals',
        runtimeTaskId: undefined,
        runtimeFocusKind: undefined,
        runtimeFocusId: undefined,
        runtimeCompareTaskId: undefined,
        runtimeGraphNodeId: undefined,
        runtimeStatusFilter: '',
        runtimeModelFilter: '',
        runtimePricingSourceFilter: '',
        runtimeExecutionModeFilter: 'all',
        runtimeInteractionKindFilter: 'all',
        approvalsExecutionModeFilter: 'all',
        approvalsInteractionKindFilter: 'all'
      })),
      shouldPollTask: vi.fn(() => false),
      toApprovalItems: vi.fn(() => [])
    }));

    const { useAdminDashboard: useAdminDashboardOnEvals } = await import('@/hooks/use-admin-dashboard');

    evalsHarness.render(() => useAdminDashboardOnEvals());
    await evalsHarness.runEffects();
    await flushAsyncWork();

    expect(actions.refreshPageCenter).toHaveBeenCalledWith('approvals');
    expect(actions.refreshPageCenter).toHaveBeenCalledWith('evals');
    expect(actions.refreshPageCenter).toHaveBeenCalledTimes(2);
    expect(approvalsHarness.stateSlots[1]).toBe('离线');
    expect(evalsHarness.stateSlots[1]).toBe('离线');
  });
});

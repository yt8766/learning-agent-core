import { beforeEach, describe, expect, it, vi } from 'vitest';

type EffectSlot = {
  deps?: unknown[];
  callback: () => void | (() => void);
  cleanup?: (() => void) | undefined;
};

type CapturedDashboardContext = {
  getPage: () => string;
  getRuntimeFilters: () => Record<string, unknown>;
  getApprovalFilters: () => Record<string, unknown>;
  getRuntimeHistoryDays: () => number;
  getEvalsHistoryDays: () => number;
  getEvalFilters: () => Record<string, unknown>;
  getBundle: () => unknown;
  getConsoleData: () => unknown;
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

  it('loads dashboard data, syncs the hash, and reacts to hash changes', async () => {
    const harness = createReactHookHarness();
    const listeners = new Map<string, EventListener>();
    const replaceState = vi.fn();
    let capturedContext: CapturedDashboardContext | undefined;
    const actions = {
      refreshAll: vi.fn().mockResolvedValue(undefined),
      refreshPageCenter: vi.fn().mockResolvedValue(undefined),
      refreshTask: vi.fn().mockResolvedValue(undefined)
    };
    const initialHashState = {
      page: 'runtime',
      runtimeExecutionModeFilter: 'plan',
      runtimeInteractionKindFilter: 'approval',
      approvalsExecutionModeFilter: 'all',
      approvalsInteractionKindFilter: 'all'
    };
    const changedHashState = {
      page: 'approvals',
      runtimeExecutionModeFilter: 'execute',
      runtimeInteractionKindFilter: 'mode-transition',
      approvalsExecutionModeFilter: 'imperial_direct',
      approvalsInteractionKindFilter: 'plan-question'
    };
    let currentHashState = initialHashState;
    const readDashboardStateFromHash = vi.fn(() => currentHashState);

    vi.stubGlobal('window', {
      location: {
        hash: '#/runtime',
        origin: 'https://example.com',
        pathname: '/admin'
      },
      history: {
        replaceState
      },
      addEventListener: vi.fn((type: string, listener: EventListener) => listeners.set(type, listener)),
      removeEventListener: vi.fn((type: string) => listeners.delete(type)),
      setInterval,
      clearInterval
    });

    vi.doMock('react', () => harness.reactModule);
    vi.doMock('@/api/admin-api', () => ({
      getHealth: vi.fn().mockResolvedValue({ status: 'healthy', now: '12:00' })
    }));
    vi.doMock('@/hooks/admin-dashboard/admin-dashboard-actions', () => ({
      createAdminDashboardActions: (context: CapturedDashboardContext) => {
        capturedContext = context;
        return actions;
      }
    }));
    vi.doMock('@/hooks/admin-dashboard/admin-dashboard-constants', () => ({
      PAGE_TITLES: {
        runtime: 'Runtime Center',
        approvals: 'Approvals Center'
      },
      buildDashboardHash: vi.fn(() => '#/runtime?runtimeExecutionMode=plan'),
      buildDashboardShareUrl: vi.fn(() => 'https://example.com/admin#/runtime'),
      readDashboardStateFromHash,
      shouldPollTask: vi.fn(() => false),
      toApprovalItems: vi.fn(() => ['approval-1'])
    }));

    const { useAdminDashboard } = await import('@/hooks/use-admin-dashboard');

    let result = harness.render(() => useAdminDashboard());
    await harness.runEffects();
    await flushAsyncWork();

    expect(actions.refreshAll).toHaveBeenCalledTimes(1);
    expect(harness.stateSlots[1]).toBe('healthy 路 12:00');
    expect(replaceState).toHaveBeenCalledWith(null, '', '#/runtime?runtimeExecutionMode=plan');
    expect(result.pendingApprovals).toEqual(['approval-1']);

    currentHashState = changedHashState;
    listeners.get('hashchange')?.(new Event('hashchange'));
    result = harness.render(() => useAdminDashboard());
    await harness.runEffects();

    expect(result.page).toBe('approvals');
    expect(result.runtimeExecutionModeFilter).toBe('execute');
    expect(result.approvalsExecutionModeFilter).toBe('imperial_direct');
    expect(result.approvalsInteractionKindFilter).toBe('plan-question');
    expect(capturedContext?.getPage()).toBe('approvals');
    expect(capturedContext?.getRuntimeFilters()).toEqual({
      status: '',
      model: '',
      pricingSource: '',
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

    result.setPage('runtime');
    result = harness.render(() => useAdminDashboard());
    await harness.runEffects();
    expect(result.page).toBe('runtime');

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
    const actions = {
      refreshAll: vi.fn().mockResolvedValue(undefined),
      refreshPageCenter: vi.fn().mockResolvedValue(undefined),
      refreshTask: vi.fn().mockResolvedValue(undefined)
    };

    vi.stubGlobal('window', {
      location: {
        hash: '#/runtime',
        origin: 'https://example.com',
        pathname: '/admin'
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
    vi.doMock('@/api/admin-api', () => ({
      getHealth: vi.fn().mockResolvedValue({ status: 'healthy', now: '12:00' })
    }));
    vi.doMock('@/hooks/admin-dashboard/admin-dashboard-actions', () => ({
      createAdminDashboardActions: () => actions
    }));
    vi.doMock('@/hooks/admin-dashboard/admin-dashboard-constants', () => ({
      PAGE_TITLES: {
        runtime: 'Runtime Center'
      },
      buildDashboardHash: vi.fn(() => '#/runtime'),
      buildDashboardShareUrl: vi.fn(() => 'https://example.com/admin#/runtime'),
      readDashboardStateFromHash: vi.fn(() => ({
        page: 'runtime',
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
    expect(window.setInterval).toHaveBeenCalledWith(expect.any(Function), 4000);

    intervalCallbacks[0]?.();
    expect(actions.refreshTask).toHaveBeenCalledWith('task-1', false);
    expect(harness.stateSlots[5]).toBe(true);

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

    vi.stubGlobal('window', {
      location: {
        hash: '#/approvals',
        origin: 'https://example.com',
        pathname: '/admin'
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
    vi.doMock('@/api/admin-api', () => ({
      getHealth: vi.fn().mockRejectedValue(new Error('offline'))
    }));
    vi.doMock('@/hooks/admin-dashboard/admin-dashboard-actions', () => ({
      createAdminDashboardActions: () => actions
    }));
    vi.doMock('@/hooks/admin-dashboard/admin-dashboard-constants', () => ({
      PAGE_TITLES: {
        approvals: 'Approvals Center',
        evals: 'Evals'
      },
      buildDashboardHash: vi.fn(() => '#/approvals'),
      buildDashboardShareUrl: vi.fn(() => 'https://example.com/admin#/approvals'),
      readDashboardStateFromHash: vi.fn(() => ({
        page: 'approvals',
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
    vi.doMock('@/api/admin-api', () => ({
      getHealth: vi.fn().mockRejectedValue(new Error('offline'))
    }));
    vi.doMock('@/hooks/admin-dashboard/admin-dashboard-actions', () => ({
      createAdminDashboardActions: () => actions
    }));
    vi.doMock('@/hooks/admin-dashboard/admin-dashboard-constants', () => ({
      PAGE_TITLES: {
        approvals: 'Approvals Center',
        evals: 'Evals'
      },
      buildDashboardHash: vi.fn(() => '#/evals'),
      buildDashboardShareUrl: vi.fn(() => 'https://example.com/admin#/evals'),
      readDashboardStateFromHash: vi.fn(() => ({
        page: 'evals',
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
    expect(approvalsHarness.stateSlots[1]).toBe('离线');
    expect(evalsHarness.stateSlots[1]).toBe('离线');
  });
});

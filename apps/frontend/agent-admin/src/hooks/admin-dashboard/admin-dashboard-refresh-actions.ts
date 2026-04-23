import { isAbortedAdminRequestError } from '@/api/admin-api';
import { fetchPlatformConsoleShell, fetchTaskBundle } from '@/api/admin-query';
import type { DashboardPageKey } from '@/types/admin';
import type { AdminDashboardActionContext } from './admin-dashboard-actions.types';
import { loadPageCenter } from './admin-dashboard-page-loaders';

interface RefreshActions {
  refreshAll: () => Promise<void>;
  refreshPageCenter: (
    targetPage: DashboardPageKey,
    options?: { runtimeDays?: number; evalsDays?: number }
  ) => Promise<void>;
  refreshTask: (taskId: string, withLoading?: boolean) => Promise<void>;
}

export function createAdminDashboardRefreshActions(context: AdminDashboardActionContext): RefreshActions {
  const inFlightCenterRefreshes = new Map<string, Promise<void>>();
  const inFlightTaskRefreshes = new Map<string, Promise<void>>();
  const lastCenterRefreshAt = new Map<string, number>();
  const lastTaskRefreshAt = new Map<string, number>();
  let inFlightRefreshAll: Promise<void> | null = null;
  let lastRefreshAllAt = 0;
  const refreshThrottleMs = 400;

  const getPlatformConsoleShellFilters = () => {
    const runtimeFilters = context.getRuntimeFilters();
    const approvalFilters = context.getApprovalFilters();

    return {
      status: runtimeFilters.status || undefined,
      model: runtimeFilters.model || undefined,
      pricingSource: runtimeFilters.pricingSource || undefined,
      runtimeExecutionMode: runtimeFilters.executionMode === 'all' ? undefined : runtimeFilters.executionMode,
      runtimeInteractionKind: runtimeFilters.interactionKind === 'all' ? undefined : runtimeFilters.interactionKind,
      approvalsExecutionMode: approvalFilters.executionMode === 'all' ? undefined : approvalFilters.executionMode,
      approvalsInteractionKind: approvalFilters.interactionKind === 'all' ? undefined : approvalFilters.interactionKind
    };
  };

  const refreshAll = async () => {
    context.reportRefresh({
      scope: 'all',
      target: 'platform-console',
      reason: 'full refresh requested',
      outcome: 'started'
    });
    if (Date.now() - lastRefreshAllAt < refreshThrottleMs) {
      context.reportRefresh({
        scope: 'all',
        target: 'platform-console',
        reason: 'full refresh throttled',
        outcome: 'throttled'
      });
      return inFlightRefreshAll ?? Promise.resolve();
    }
    if (inFlightRefreshAll) {
      context.reportRefresh({
        scope: 'all',
        target: 'platform-console',
        reason: 'full refresh deduped to in-flight request',
        outcome: 'deduped'
      });
      return inFlightRefreshAll;
    }

    const request = (async () => {
      try {
        context.setLoading(true);
        context.setError('');
        const [nextShell, nextCenter] = await Promise.all([
          fetchPlatformConsoleShell(
            context.queryClient,
            Math.max(context.getRuntimeHistoryDays(), context.getEvalsHistoryDays()),
            getPlatformConsoleShellFilters()
          ),
          loadPageCenter(context.getPage(), context)
        ]);
        const nextConsole = nextCenter ? { ...nextShell, ...nextCenter } : nextShell;
        context.setConsoleData(nextConsole);

        const nextTaskId =
          context.getActiveTaskId() ?? context.getBundle()?.task.id ?? nextConsole.runtime.recentRuns[0]?.id;
        context.setActiveTaskId(nextTaskId);
        context.setBundle(nextTaskId ? await fetchTaskBundle(context.queryClient, nextTaskId) : null);
      } catch (nextError) {
        if (isAbortedAdminRequestError(nextError)) {
          context.reportRefresh({
            scope: 'all',
            target: 'platform-console',
            reason: 'full refresh aborted by newer request',
            outcome: 'aborted'
          });
          return;
        }
        context.reportRefresh({
          scope: 'all',
          target: 'platform-console',
          reason: 'full refresh failed',
          outcome: 'failed'
        });
        context.setError(nextError instanceof Error ? nextError.message : '刷新平台控制台失败');
      } finally {
        context.setLoading(false);
      }
    })();

    lastRefreshAllAt = Date.now();
    inFlightRefreshAll = request;
    try {
      await request;
      context.reportRefresh({
        scope: 'all',
        target: 'platform-console',
        reason: 'full refresh completed',
        outcome: 'completed'
      });
    } finally {
      if (inFlightRefreshAll === request) {
        inFlightRefreshAll = null;
      }
    }
  };

  const refreshPageCenter = async (
    targetPage: DashboardPageKey,
    options?: { runtimeDays?: number; evalsDays?: number }
  ) => {
    if (!context.getConsoleData()) {
      return;
    }
    context.reportRefresh({
      scope: 'center',
      target: targetPage,
      reason: 'page center refresh requested',
      outcome: 'started'
    });

    const runtimeFilters = context.getRuntimeFilters();
    const evalFilters = context.getEvalFilters();
    const requestKey = JSON.stringify({
      targetPage,
      runtimeDays: options?.runtimeDays ?? context.getRuntimeHistoryDays(),
      evalsDays: options?.evalsDays ?? context.getEvalsHistoryDays(),
      runtimeFilters,
      evalFilters
    });
    const currentRequest = inFlightCenterRefreshes.get(requestKey);
    if (currentRequest) {
      context.reportRefresh({
        scope: 'center',
        target: targetPage,
        reason: 'center refresh deduped to in-flight request',
        outcome: 'deduped'
      });
      return currentRequest;
    }
    const lastRequestedAt = lastCenterRefreshAt.get(requestKey) ?? 0;
    if (Date.now() - lastRequestedAt < refreshThrottleMs) {
      context.reportRefresh({
        scope: 'center',
        target: targetPage,
        reason: 'center refresh throttled',
        outcome: 'throttled'
      });
      return Promise.resolve();
    }

    const request = (async () => {
      try {
        const nextValue = await loadPageCenter(targetPage, context, options);
        if (nextValue) {
          context.setConsoleData(current => (current ? { ...current, ...nextValue } : current));
        }
      } catch (nextError) {
        if (isAbortedAdminRequestError(nextError)) {
          context.reportRefresh({
            scope: 'center',
            target: targetPage,
            reason: 'center refresh aborted by newer request',
            outcome: 'aborted'
          });
          return;
        }
        context.reportRefresh({
          scope: 'center',
          target: targetPage,
          reason: 'center refresh failed',
          outcome: 'failed'
        });
        context.setError(nextError instanceof Error ? nextError.message : '刷新中心数据失败');
      }
    })();

    lastCenterRefreshAt.set(requestKey, Date.now());
    inFlightCenterRefreshes.set(requestKey, request);
    try {
      await request;
      context.reportRefresh({
        scope: 'center',
        target: targetPage,
        reason: 'center refresh completed',
        outcome: 'completed'
      });
    } finally {
      if (inFlightCenterRefreshes.get(requestKey) === request) {
        inFlightCenterRefreshes.delete(requestKey);
      }
    }
  };

  const refreshTask = async (taskId: string, withLoading = true) => {
    context.reportRefresh({
      scope: 'task',
      target: taskId,
      reason: withLoading ? 'task refresh with loading' : 'task polling refresh',
      outcome: 'started'
    });
    const requestKey = `${taskId}:${withLoading ? 'loading' : 'silent'}`;
    const currentRequest = inFlightTaskRefreshes.get(requestKey);
    if (currentRequest) {
      context.reportRefresh({
        scope: 'task',
        target: taskId,
        reason: 'task refresh deduped to in-flight request',
        outcome: 'deduped'
      });
      return currentRequest;
    }
    const lastRequestedAt = lastTaskRefreshAt.get(requestKey) ?? 0;
    if (Date.now() - lastRequestedAt < refreshThrottleMs) {
      context.reportRefresh({
        scope: 'task',
        target: taskId,
        reason: 'task refresh throttled',
        outcome: 'throttled'
      });
      return Promise.resolve();
    }

    const request = (async () => {
      try {
        if (withLoading) {
          context.setLoading(true);
        }
        context.setError('');
        const [nextShell, nextBundle, nextCenter] = await Promise.all([
          fetchPlatformConsoleShell(
            context.queryClient,
            Math.max(context.getRuntimeHistoryDays(), context.getEvalsHistoryDays()),
            getPlatformConsoleShellFilters()
          ),
          fetchTaskBundle(context.queryClient, taskId),
          loadPageCenter(context.getPage(), context)
        ]);
        context.setConsoleData(nextCenter ? { ...nextShell, ...nextCenter } : nextShell);
        context.setActiveTaskId(taskId);
        context.setBundle(nextBundle);
      } catch (nextError) {
        if (isAbortedAdminRequestError(nextError)) {
          context.reportRefresh({
            scope: 'task',
            target: taskId,
            reason: 'task refresh aborted by newer request',
            outcome: 'aborted'
          });
          return;
        }
        context.reportRefresh({
          scope: 'task',
          target: taskId,
          reason: 'task refresh failed',
          outcome: 'failed'
        });
        context.setError(nextError instanceof Error ? nextError.message : '刷新任务详情失败');
      } finally {
        if (withLoading) {
          context.setLoading(false);
        }
      }
    })();

    lastTaskRefreshAt.set(requestKey, Date.now());
    inFlightTaskRefreshes.set(requestKey, request);
    try {
      await request;
      context.reportRefresh({
        scope: 'task',
        target: taskId,
        reason: 'task refresh completed',
        outcome: 'completed'
      });
    } finally {
      if (inFlightTaskRefreshes.get(requestKey) === request) {
        inFlightTaskRefreshes.delete(requestKey);
      }
    }
  };

  return {
    refreshAll,
    refreshPageCenter,
    refreshTask
  };
}

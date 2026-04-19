import type { QueryClient } from '@tanstack/react-query';

import type { DashboardPageKey, PlatformConsoleRecord, TaskBundle } from '@/types/admin';
import type { RuntimeReplayLaunchReceipt } from '@/features/runtime-overview/components/runtime-run-workbench-support';

export interface AdminDashboardActionContext {
  queryClient: QueryClient;
  getPage: () => DashboardPageKey;
  getActiveTaskId: () => string | undefined;
  getRuntimeHistoryDays: () => number;
  getEvalsHistoryDays: () => number;
  getRuntimeFilters: () => {
    status: string;
    model: string;
    pricingSource: string;
    executionMode: string;
    interactionKind: string;
  };
  getApprovalFilters: () => {
    executionMode: 'all' | 'plan' | 'execute' | 'imperial_direct';
    interactionKind:
      | 'all'
      | 'approval'
      | 'plan-question'
      | 'supplemental-input'
      | 'revise-required'
      | 'micro-loop-exhausted'
      | 'mode-transition';
  };
  getEvalFilters: () => { scenario: string; outcome: string };
  getBundle: () => TaskBundle | null;
  getConsoleData: () => PlatformConsoleRecord | null;
  setPage: (page: DashboardPageKey) => void;
  setActiveTaskId: (taskId?: string) => void;
  setObservatoryFocusTarget: (target?: { kind: 'checkpoint' | 'span' | 'evidence'; id: string }) => void;
  setRuntimeCompareTaskId: (taskId?: string) => void;
  setRuntimeGraphNodeId: (nodeId?: string) => void;
  setRuntimeReplayReceipt: (receipt?: RuntimeReplayLaunchReceipt) => void;
  setLoading: (value: boolean) => void;
  setError: (value: string) => void;
  setConsoleData: (
    value: PlatformConsoleRecord | ((current: PlatformConsoleRecord | null) => PlatformConsoleRecord | null) | null
  ) => void;
  setBundle: (value: TaskBundle | null) => void;
  reportRefresh: (event: {
    scope: 'all' | 'center' | 'task';
    target: string;
    reason: string;
    outcome: 'started' | 'deduped' | 'throttled' | 'aborted' | 'completed' | 'failed';
  }) => void;
}

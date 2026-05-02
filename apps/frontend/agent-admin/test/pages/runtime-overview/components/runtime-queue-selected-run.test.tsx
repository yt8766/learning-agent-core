import { describe, expect, it, vi } from 'vitest';

const runtimeQueueSelectedRunTestState = vi.hoisted(() => ({
  getAgentToolExecutionProjection: vi.fn(async () => ({ requests: [] })),
  getRunObservatory: vi.fn(async () => []),
  getRunObservatoryDetail: vi.fn(async () => ({
    run: {
      taskId: 'task-selected',
      goal: 'Inspect projection scope',
      status: 'running',
      startedAt: '2026-04-26T00:00:00.000Z',
      hasInterrupt: false,
      hasFallback: false,
      hasRecoverableCheckpoint: false,
      hasEvidenceWarning: false,
      diagnosticFlags: []
    },
    timeline: [],
    traces: [],
    checkpoints: [],
    interrupts: [],
    diagnostics: [],
    artifacts: [],
    evidence: []
  })),
  useEffect: vi.fn((effect: () => void | (() => void)) => {
    effect();
  }),
  useState: vi.fn((initialValue: unknown) => [initialValue, vi.fn()] as const)
}));

vi.mock('react', () => {
  return {
    Fragment: 'Fragment',
    useEffect: runtimeQueueSelectedRunTestState.useEffect,
    useState: runtimeQueueSelectedRunTestState.useState
  };
});

vi.mock('react/jsx-runtime', () => {
  return {
    Fragment: 'Fragment',
    jsx: (type: unknown, props: unknown) => ({ type, props }),
    jsxs: (type: unknown, props: unknown) => ({ type, props })
  };
});

vi.mock('@/api/admin-api', () => ({
  getAgentToolExecutionProjection: runtimeQueueSelectedRunTestState.getAgentToolExecutionProjection,
  getRunObservatory: runtimeQueueSelectedRunTestState.getRunObservatory,
  getRunObservatoryDetail: runtimeQueueSelectedRunTestState.getRunObservatoryDetail,
  isAbortedAdminRequestError: () => false
}));

vi.mock('@/pages/run-observatory/run-observatory-compare-card', () => ({
  RunObservatoryCompareCard: () => null
}));

vi.mock('@/pages/run-observatory/run-observatory-panel', () => ({
  RunObservatoryPanel: () => null
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: () => null
}));

vi.mock('@/components/ui/card', () => ({
  Card: () => null,
  CardContent: () => null,
  CardHeader: () => null,
  CardTitle: () => null
}));

vi.mock('@/pages/runtime-overview/components/runtime-agent-graph-overlay-card', () => ({
  RuntimeAgentGraphOverlayCard: () => null
}));

vi.mock('@/pages/runtime-overview/components/runtime-node-activity-ledger-card', () => ({
  RuntimeNodeActivityLedgerCard: () => null
}));

vi.mock('@/pages/runtime-overview/components/runtime-execution-story-card', () => ({
  RuntimeExecutionStoryCard: () => null
}));

vi.mock('@/pages/runtime-overview/components/runtime-run-workbench-card', () => ({
  RuntimeRunWorkbenchCard: () => null
}));

vi.mock('@/pages/runtime-overview/components/runtime-run-session-timeline-card', () => ({
  RuntimeRunSessionTimelineCard: () => null
}));

vi.mock('@/pages/runtime-overview/components/runtime-workflow-execution-map-card', () => ({
  RuntimeWorkflowExecutionMapCard: () => null
}));

vi.mock('@/pages/runtime-overview/components/runtime-queue-selected-run-summary', () => ({
  RuntimeQueueSelectedRunSummary: () => null
}));

vi.mock('@/pages/runtime-overview/components/runtime-queue-trace-panels', () => ({
  RuntimeQueueTracePanels: () => null
}));

import { RuntimeQueueSelectedRun } from '@/pages/runtime-overview/components/runtime-queue-selected-run';

describe('RuntimeQueueSelectedRun', () => {
  it('loads the selected run agent tool projection by task id', async () => {
    runtimeQueueSelectedRunTestState.getAgentToolExecutionProjection.mockClear();
    runtimeQueueSelectedRunTestState.getRunObservatory.mockClear();
    runtimeQueueSelectedRunTestState.getRunObservatoryDetail.mockClear();
    runtimeQueueSelectedRunTestState.useEffect.mockClear();
    runtimeQueueSelectedRunTestState.useState.mockClear();

    RuntimeQueueSelectedRun({
      bundle: {
        task: {
          id: 'task-selected',
          goal: 'Inspect projection scope',
          status: 'running'
        },
        agents: [],
        messages: [],
        traces: []
      } as any,
      statusFilter: '',
      modelFilter: '',
      pricingSourceFilter: '',
      executionModeFilter: 'all',
      interactionKindFilter: 'all',
      observatoryFocusTarget: undefined,
      onObservatoryFocusTargetChange: vi.fn(),
      compareTaskId: undefined,
      onCompareTaskIdChange: vi.fn(),
      graphNodeId: undefined,
      onGraphNodeIdChange: vi.fn(),
      replayLaunchReceipt: undefined,
      onRetryTask: vi.fn(),
      onLaunchWorkflowTask: vi.fn()
    });

    await Promise.resolve();

    expect(runtimeQueueSelectedRunTestState.getAgentToolExecutionProjection).toHaveBeenCalledWith({
      taskId: 'task-selected'
    });
  });
});

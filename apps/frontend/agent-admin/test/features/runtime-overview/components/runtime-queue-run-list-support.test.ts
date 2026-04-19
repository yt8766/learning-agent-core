import { describe, expect, it } from 'vitest';

import {
  buildFallbackRunsFromRuntime,
  filterObservabilityRunsWithRuntimeTasks,
  type RuntimeQueueRunFilters
} from '@/features/runtime-overview/components/runtime-queue-run-list-support';

const baseFilters: RuntimeQueueRunFilters = {
  statusFilter: '',
  modelFilter: '',
  pricingSourceFilter: '',
  executionModeFilter: 'all',
  interactionKindFilter: 'all'
};

describe('runtime queue run list support', () => {
  it('filters fallback runs with execution mode, interaction kind, model, and pricing source', () => {
    const runs = buildFallbackRunsFromRuntime(
      {
        recentRuns: [
          {
            id: 'task-plan',
            goal: 'Plan safely',
            status: 'waiting_approval',
            createdAt: '2026-04-19T10:00:00.000Z',
            updatedAt: '2026-04-19T10:05:00.000Z',
            executionMode: 'plan',
            activeInterrupt: {
              id: 'interrupt-1',
              status: 'pending',
              mode: 'blocking',
              source: 'graph',
              kind: 'user-input',
              resumeStrategy: 'approval-recovery',
              payload: { interactionKind: 'plan-question' }
            },
            llmUsage: {
              promptTokens: 10,
              completionTokens: 20,
              totalTokens: 30,
              estimated: false,
              measuredCallCount: 1,
              estimatedCallCount: 0,
              updatedAt: '2026-04-19T10:05:00.000Z',
              models: [
                {
                  model: 'gpt-5.4',
                  promptTokens: 10,
                  completionTokens: 20,
                  totalTokens: 30,
                  callCount: 1,
                  pricingSource: 'provider'
                }
              ]
            }
          },
          {
            id: 'task-execute',
            goal: 'Execute quickly',
            status: 'running',
            createdAt: '2026-04-19T10:00:00.000Z',
            updatedAt: '2026-04-19T10:05:00.000Z',
            executionMode: 'execute',
            llmUsage: {
              promptTokens: 10,
              completionTokens: 20,
              totalTokens: 30,
              estimated: true,
              measuredCallCount: 0,
              estimatedCallCount: 1,
              updatedAt: '2026-04-19T10:05:00.000Z',
              models: [
                {
                  model: 'gpt-5.4-mini',
                  promptTokens: 10,
                  completionTokens: 20,
                  totalTokens: 30,
                  callCount: 1,
                  pricingSource: 'estimated'
                }
              ]
            }
          }
        ]
      } as never,
      {
        ...baseFilters,
        executionModeFilter: 'plan',
        interactionKindFilter: 'plan-question',
        modelFilter: 'gpt-5.4',
        pricingSourceFilter: 'provider'
      }
    );

    expect(runs).toEqual([
      expect.objectContaining({
        taskId: 'task-plan',
        executionMode: 'plan',
        interactionKind: 'plan-question'
      })
    ]);
  });

  it('keeps empty observability results empty instead of falling back to all runtime runs', () => {
    const runs = filterObservabilityRunsWithRuntimeTasks(
      [],
      {
        recentRuns: [
          {
            id: 'task-1',
            goal: 'Task one',
            status: 'running',
            createdAt: '2026-04-19T10:00:00.000Z',
            updatedAt: '2026-04-19T10:05:00.000Z'
          }
        ]
      } as never,
      {
        ...baseFilters,
        statusFilter: 'failed'
      }
    );

    expect(runs).toEqual([]);
  });

  it('applies local model and pricing filters to observability runs using runtime task data', () => {
    const runs = filterObservabilityRunsWithRuntimeTasks(
      [
        {
          taskId: 'task-1',
          goal: 'Observe one',
          status: 'running',
          startedAt: '2026-04-19T10:00:00.000Z',
          hasInterrupt: false,
          hasFallback: false,
          hasRecoverableCheckpoint: false,
          hasEvidenceWarning: false,
          diagnosticFlags: []
        },
        {
          taskId: 'task-2',
          goal: 'Observe two',
          status: 'running',
          startedAt: '2026-04-19T10:00:00.000Z',
          hasInterrupt: false,
          hasFallback: false,
          hasRecoverableCheckpoint: false,
          hasEvidenceWarning: false,
          diagnosticFlags: []
        }
      ],
      {
        recentRuns: [
          {
            id: 'task-1',
            goal: 'Observe one',
            status: 'running',
            createdAt: '2026-04-19T10:00:00.000Z',
            updatedAt: '2026-04-19T10:05:00.000Z',
            llmUsage: {
              promptTokens: 10,
              completionTokens: 20,
              totalTokens: 30,
              estimated: false,
              measuredCallCount: 1,
              estimatedCallCount: 0,
              updatedAt: '2026-04-19T10:05:00.000Z',
              models: [
                {
                  model: 'gpt-5.4',
                  promptTokens: 10,
                  completionTokens: 20,
                  totalTokens: 30,
                  callCount: 1,
                  pricingSource: 'provider'
                }
              ]
            }
          },
          {
            id: 'task-2',
            goal: 'Observe two',
            status: 'running',
            createdAt: '2026-04-19T10:00:00.000Z',
            updatedAt: '2026-04-19T10:05:00.000Z',
            llmUsage: {
              promptTokens: 10,
              completionTokens: 20,
              totalTokens: 30,
              estimated: true,
              measuredCallCount: 0,
              estimatedCallCount: 1,
              updatedAt: '2026-04-19T10:05:00.000Z',
              models: [
                {
                  model: 'gpt-5.4-mini',
                  promptTokens: 10,
                  completionTokens: 20,
                  totalTokens: 30,
                  callCount: 1,
                  pricingSource: 'estimated'
                }
              ]
            }
          }
        ]
      } as never,
      {
        ...baseFilters,
        modelFilter: 'gpt-5.4',
        pricingSourceFilter: 'provider'
      }
    );

    expect(runs).toEqual([expect.objectContaining({ taskId: 'task-1' })]);
  });
});

import { describe, expect, it } from 'vitest';

import {
  buildRunDetailComparison,
  buildRunSummaryComparison,
  filterRunBundleByGraphFilter,
  formatDurationDelta
} from '@/pages/run-observatory/run-observatory-compare-support';

describe('run observatory compare support', () => {
  it('builds diff badges from run summary flags, diagnostics, and models', () => {
    expect(
      buildRunSummaryComparison(
        {
          taskId: 'task-current',
          goal: 'Current run',
          status: 'failed',
          startedAt: '2026-04-19T10:00:00.000Z',
          durationMs: 90000,
          currentStage: 'interrupt',
          modelRoute: [{ selectedModel: 'gpt-5.4-mini' }],
          hasInterrupt: true,
          hasFallback: true,
          hasRecoverableCheckpoint: true,
          hasEvidenceWarning: false,
          diagnosticFlags: ['approval_blocked', 'fallback']
        },
        {
          taskId: 'task-baseline',
          goal: 'Baseline run',
          status: 'completed',
          startedAt: '2026-04-19T09:00:00.000Z',
          durationMs: 60000,
          currentStage: 'delivery',
          modelRoute: [{ selectedModel: 'gpt-5.4' }],
          hasInterrupt: false,
          hasFallback: false,
          hasRecoverableCheckpoint: true,
          hasEvidenceWarning: true,
          diagnosticFlags: ['evidence_insufficient']
        }
      )
    ).toEqual({
      baselineTaskId: 'task-baseline',
      baselineGoal: 'Baseline run',
      baselineStatus: 'completed',
      currentStatus: 'failed',
      durationDeltaMs: 30000,
      stageChanged: true,
      currentStage: 'interrupt',
      baselineStage: 'delivery',
      currentModels: ['gpt-5.4-mini'],
      baselineModels: ['gpt-5.4'],
      addedFlags: ['interrupt', 'fallback'],
      removedFlags: ['evidence_warning'],
      addedDiagnostics: ['approval_blocked', 'fallback'],
      removedDiagnostics: ['evidence_insufficient']
    });
  });

  it('formats duration delta labels', () => {
    expect(formatDurationDelta(12000)).toBe('+12s slower');
    expect(formatDurationDelta(-4000)).toBe('4s faster');
    expect(formatDurationDelta(0)).toBe('same duration');
  });

  it('builds detail-level diff from run bundles', () => {
    expect(
      buildRunDetailComparison(
        {
          run: {
            taskId: 'task-current',
            goal: 'Current run',
            status: 'failed',
            startedAt: '2026-04-19T10:00:00.000Z',
            hasInterrupt: true,
            hasFallback: true,
            hasRecoverableCheckpoint: true,
            hasEvidenceWarning: false,
            diagnosticFlags: ['approval_blocked']
          },
          timeline: [
            {
              id: 'tl-1',
              stage: 'execution',
              status: 'failed',
              title: 'Execution',
              summary: 'summary'
            },
            {
              id: 'tl-2',
              stage: 'interrupt',
              status: 'running',
              title: 'Interrupt',
              summary: 'summary'
            }
          ],
          traces: [
            {
              spanId: 'span-1',
              node: 'route',
              stage: 'route',
              status: 'failed',
              summary: 'route changed',
              startedAt: '2026-04-19T10:00:00.000Z',
              latencyMs: 1800,
              modelUsed: 'gpt-5.4-mini'
            },
            {
              spanId: 'span-2',
              node: 'review',
              stage: 'review',
              status: 'failed',
              summary: 'review',
              startedAt: '2026-04-19T10:00:01.000Z'
            }
          ],
          checkpoints: [
            {
              checkpointId: 'cp-1',
              summary: 'checkpoint changed',
              createdAt: '2026-04-19T10:00:02.000Z',
              recoverable: false,
              recoverability: 'partial'
            }
          ],
          interrupts: [
            {
              id: 'int-1',
              kind: 'approval',
              status: 'resolved',
              title: 'Approval',
              summary: 'interrupt updated',
              createdAt: '2026-04-19T10:00:03.000Z'
            }
          ],
          diagnostics: [
            {
              id: 'diag-1',
              kind: 'approval_blocked',
              severity: 'critical',
              title: 'Approval blocked',
              summary: 'diagnostic changed',
              detectedAt: '2026-04-19T10:00:04.000Z'
            }
          ],
          artifacts: [],
          evidence: [
            {
              id: 'ev-2',
              title: 'Spec doc',
              summary: 'evidence refreshed',
              sourceType: 'runtime-log',
              trustLevel: 'medium'
            },
            {
              id: 'ev-1',
              title: 'Runtime log',
              summary: 'evidence',
              sourceType: 'runtime-log'
            }
          ]
        },
        {
          run: {
            taskId: 'task-baseline',
            goal: 'Baseline run',
            status: 'completed',
            startedAt: '2026-04-19T09:00:00.000Z',
            hasInterrupt: false,
            hasFallback: false,
            hasRecoverableCheckpoint: true,
            hasEvidenceWarning: false,
            diagnosticFlags: []
          },
          timeline: [
            {
              id: 'tl-1',
              stage: 'execution',
              status: 'completed',
              title: 'Execution',
              summary: 'summary'
            }
          ],
          traces: [
            {
              spanId: 'span-1',
              node: 'route',
              stage: 'route',
              status: 'completed',
              summary: 'route',
              startedAt: '2026-04-19T09:00:00.000Z',
              latencyMs: 1000,
              modelUsed: 'gpt-5.4'
            },
            {
              spanId: 'span-3',
              node: 'delivery',
              stage: 'delivery',
              status: 'completed',
              summary: 'delivery',
              startedAt: '2026-04-19T09:00:02.000Z'
            }
          ],
          checkpoints: [
            {
              checkpointId: 'cp-1',
              summary: 'checkpoint',
              createdAt: '2026-04-19T09:00:02.000Z',
              recoverable: true,
              recoverability: 'safe'
            }
          ],
          interrupts: [
            {
              id: 'int-1',
              kind: 'approval',
              status: 'pending',
              title: 'Approval',
              summary: 'interrupt',
              createdAt: '2026-04-19T09:00:03.000Z'
            }
          ],
          diagnostics: [
            {
              id: 'diag-1',
              kind: 'approval_blocked',
              severity: 'warning',
              title: 'Approval blocked',
              summary: 'diagnostic',
              detectedAt: '2026-04-19T09:00:04.000Z'
            }
          ],
          artifacts: [],
          evidence: [
            {
              id: 'ev-2',
              title: 'Spec doc',
              summary: 'evidence',
              sourceType: 'doc'
            }
          ]
        }
      )
    ).toEqual({
      traceDelta: 0,
      checkpointDelta: 0,
      interruptDelta: 0,
      evidenceDelta: 1,
      diagnosticDelta: 0,
      timelineDelta: 1,
      addedTraceNodes: ['review'],
      removedTraceNodes: ['delivery'],
      addedDiagnosticKinds: [],
      removedDiagnosticKinds: [],
      addedInterruptKinds: [],
      removedInterruptKinds: [],
      addedEvidenceSources: ['runtime-log'],
      removedEvidenceSources: ['doc'],
      itemDiffs: {
        addedTraces: [
          {
            id: 'span-2',
            label: 'review',
            summary: 'review / failed'
          }
        ],
        removedTraces: [
          {
            id: 'span-3',
            label: 'delivery',
            summary: 'delivery / completed'
          }
        ],
        addedCheckpoints: [],
        removedCheckpoints: [],
        addedDiagnostics: [],
        removedDiagnostics: [],
        addedEvidence: [
          {
            id: 'ev-1',
            label: 'Runtime log',
            summary: 'runtime-log / evidence'
          }
        ],
        removedEvidence: [],
        addedInterrupts: [],
        removedInterrupts: []
      },
      fieldDiffs: {
        traces: [
          {
            id: 'span-1',
            label: 'route',
            changes: [
              { field: 'status', baseline: 'completed', current: 'failed' },
              { field: 'model', baseline: 'gpt-5.4', current: 'gpt-5.4-mini' },
              { field: 'summary', baseline: 'route', current: 'route changed' },
              { field: 'latencyMs', baseline: '1000', current: '1800' }
            ]
          }
        ],
        checkpoints: [
          {
            id: 'cp-1',
            label: 'cp-1',
            changes: [
              { field: 'recoverability', baseline: 'safe', current: 'partial' },
              { field: 'recoverable', baseline: 'true', current: 'false' },
              { field: 'summary', baseline: 'checkpoint', current: 'checkpoint changed' }
            ]
          }
        ],
        diagnostics: [
          {
            id: 'diag-1',
            label: 'Approval blocked',
            changes: [
              { field: 'severity', baseline: 'warning', current: 'critical' },
              { field: 'summary', baseline: 'diagnostic', current: 'diagnostic changed' }
            ]
          }
        ],
        evidence: [
          {
            id: 'ev-2',
            label: 'Spec doc',
            changes: [
              { field: 'sourceType', baseline: 'doc', current: 'runtime-log' },
              { field: 'trustLevel', baseline: 'n/a', current: 'medium' },
              { field: 'summary', baseline: 'evidence', current: 'evidence refreshed' }
            ]
          }
        ],
        interrupts: [
          {
            id: 'int-1',
            label: 'Approval',
            changes: [
              { field: 'status', baseline: 'pending', current: 'resolved' },
              { field: 'summary', baseline: 'interrupt', current: 'interrupt updated' }
            ]
          }
        ]
      }
    });
  });

  it('filters a run bundle to the selected graph node scope', () => {
    expect(
      filterRunBundleByGraphFilter(
        {
          run: {
            taskId: 'task-current',
            goal: 'Current run',
            status: 'failed',
            startedAt: '2026-04-19T10:00:00.000Z',
            hasInterrupt: true,
            hasFallback: true,
            hasRecoverableCheckpoint: true,
            hasEvidenceWarning: false,
            diagnosticFlags: ['approval_blocked']
          },
          timeline: [
            { id: 'tl-1', stage: 'execution', status: 'failed', title: 'Execution', summary: 'execution summary' },
            { id: 'tl-2', stage: 'review', status: 'completed', title: 'Review', summary: 'review summary' }
          ],
          traces: [
            {
              spanId: 'span-1',
              node: 'gongbu_execute',
              stage: 'execution',
              status: 'failed',
              summary: 'execution trace',
              startedAt: '2026-04-19T10:00:00.000Z'
            },
            {
              spanId: 'span-2',
              node: 'xingbu_review',
              stage: 'review',
              status: 'completed',
              summary: 'review trace',
              startedAt: '2026-04-19T10:00:02.000Z'
            }
          ],
          checkpoints: [
            {
              checkpointId: 'cp-1',
              summary: 'execution checkpoint',
              createdAt: '2026-04-19T10:00:01.000Z',
              recoverable: true,
              recoverability: 'safe',
              stage: 'execution'
            },
            {
              checkpointId: 'cp-2',
              summary: 'review checkpoint',
              createdAt: '2026-04-19T10:00:03.000Z',
              recoverable: true,
              recoverability: 'partial',
              stage: 'review'
            }
          ],
          interrupts: [
            {
              id: 'int-1',
              kind: 'approval',
              status: 'pending',
              title: 'Approval',
              summary: 'interrupt',
              createdAt: '2026-04-19T10:00:04.000Z',
              stage: 'execution'
            }
          ],
          diagnostics: [
            {
              id: 'diag-1',
              kind: 'approval_blocked',
              severity: 'warning',
              title: 'Execution diag',
              summary: 'execution diagnostic',
              detectedAt: '2026-04-19T10:00:05.000Z',
              linkedStage: 'execution'
            },
            {
              id: 'diag-2',
              kind: 'fallback',
              severity: 'warning',
              title: 'Review diag',
              summary: 'review diagnostic',
              detectedAt: '2026-04-19T10:00:06.000Z',
              linkedStage: 'review'
            }
          ],
          artifacts: [],
          evidence: [
            { id: 'ev-1', title: 'Execution evidence', summary: 'execution evidence', stage: 'execution' },
            { id: 'ev-2', title: 'Review evidence', summary: 'review evidence', stage: 'review' }
          ]
        },
        {
          nodeId: 'worker-gongbu',
          label: 'gongbu_execute',
          stages: ['execution'],
          spanIds: ['span-1'],
          checkpointIds: ['cp-1'],
          evidenceIds: ['ev-1'],
          diagnosticIds: ['diag-1'],
          interruptIds: ['int-1']
        }
      )
    ).toEqual(
      expect.objectContaining({
        timeline: [expect.objectContaining({ id: 'tl-1' })],
        traces: [expect.objectContaining({ spanId: 'span-1' })],
        checkpoints: [expect.objectContaining({ checkpointId: 'cp-1' })],
        interrupts: [expect.objectContaining({ id: 'int-1' })],
        diagnostics: [expect.objectContaining({ id: 'diag-1' })],
        evidence: [expect.objectContaining({ id: 'ev-1' })]
      })
    );
  });
});

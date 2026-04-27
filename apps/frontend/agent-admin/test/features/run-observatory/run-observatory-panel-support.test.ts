import { describe, expect, it } from 'vitest';

import {
  buildAgentToolObservatoryDetail,
  buildFocusDetail,
  buildFocusDomId,
  buildFocusTarget,
  isFocusedTarget
} from '@/features/run-observatory/run-observatory-panel-support';

describe('run observatory panel support', () => {
  it('prefers checkpoint targets over span and evidence when building focus target', () => {
    expect(
      buildFocusTarget({
        checkpointId: 'cp-1',
        spanId: 'span-1',
        evidenceId: 'ev-1'
      })
    ).toEqual({
      kind: 'checkpoint',
      id: 'cp-1'
    });
  });

  it('falls back to span and then evidence when checkpoint is absent', () => {
    expect(
      buildFocusTarget({
        spanId: 'span-1',
        evidenceId: 'ev-1'
      })
    ).toEqual({
      kind: 'span',
      id: 'span-1'
    });

    expect(
      buildFocusTarget({
        evidenceId: 'ev-1'
      })
    ).toEqual({
      kind: 'evidence',
      id: 'ev-1'
    });
  });

  it('matches focus targets by both kind and id', () => {
    expect(isFocusedTarget({ kind: 'checkpoint', id: 'cp-1' }, { kind: 'checkpoint', id: 'cp-1' })).toBe(true);
    expect(isFocusedTarget({ kind: 'checkpoint', id: 'cp-1' }, { kind: 'span', id: 'cp-1' })).toBe(false);
    expect(isFocusedTarget({ kind: 'checkpoint', id: 'cp-1' }, { kind: 'checkpoint', id: 'cp-2' })).toBe(false);
  });

  it('builds stable dom ids for focus targets', () => {
    expect(buildFocusDomId({ kind: 'checkpoint', id: 'cp-1' })).toBe('run-observatory-checkpoint-cp-1');
    expect(buildFocusDomId({ kind: 'span', id: 'span/1' })).toBe('run-observatory-span-span%2F1');
  });

  it('builds focused context details with related targets for spans', () => {
    expect(
      buildFocusDetail(
        {
          run: {
            taskId: 'task-1',
            goal: 'Goal',
            status: 'running',
            startedAt: '2026-04-19T10:00:00.000Z',
            hasInterrupt: true,
            hasFallback: false,
            hasRecoverableCheckpoint: true,
            hasEvidenceWarning: false,
            diagnosticFlags: []
          },
          timeline: [
            {
              id: 'tl-1',
              stage: 'execution',
              status: 'running',
              title: 'Execution',
              summary: 'summary',
              linkedSpanIds: ['span-1']
            }
          ],
          traces: [
            {
              spanId: 'span-1',
              node: 'worker.run',
              stage: 'execution',
              status: 'failed',
              summary: 'span summary',
              startedAt: '2026-04-19T10:00:00.000Z',
              checkpointId: 'cp-1',
              evidenceIds: ['ev-1'],
              modelUsed: 'gpt-5.4-mini'
            }
          ],
          checkpoints: [
            {
              checkpointId: 'cp-1',
              summary: 'checkpoint summary',
              createdAt: '2026-04-19T10:00:01.000Z',
              recoverable: true,
              recoverability: 'safe'
            }
          ],
          interrupts: [
            {
              id: 'int-1',
              kind: 'approval',
              status: 'pending',
              title: 'Approval needed',
              summary: 'interrupt summary',
              createdAt: '2026-04-19T10:00:02.000Z',
              relatedSpanId: 'span-1'
            }
          ],
          diagnostics: [
            {
              id: 'diag-1',
              kind: 'approval_blocked',
              severity: 'warning',
              title: 'Blocked',
              summary: 'diagnostic summary',
              detectedAt: '2026-04-19T10:00:03.000Z',
              linkedSpanId: 'span-1'
            }
          ],
          artifacts: [],
          evidence: [
            {
              id: 'ev-1',
              title: 'Build log',
              summary: 'evidence summary',
              linkedSpanId: 'span-1'
            }
          ]
        },
        { kind: 'span', id: 'span-1' }
      )
    ).toEqual(
      expect.objectContaining({
        title: 'Span worker.run',
        summary: 'span summary',
        metadata: ['execution', 'failed', 'gpt-5.4-mini'],
        relatedCounts: {
          timeline: 1,
          interrupts: 1,
          diagnostics: 1,
          evidence: 1,
          spans: 1,
          checkpoints: 1
        },
        relatedTargets: [
          {
            label: 'checkpoint cp-1',
            target: {
              kind: 'checkpoint',
              id: 'cp-1'
            }
          },
          {
            label: 'evidence Build log',
            target: {
              kind: 'evidence',
              id: 'ev-1'
            }
          }
        ]
      })
    );
  });

  it('builds task-scoped agent tool observatory detail without raw payload content', () => {
    const detail = buildAgentToolObservatoryDetail(
      {
        requests: [
          {
            requestId: 'req-1',
            taskId: 'task-1',
            toolName: 'terminal.exec',
            nodeId: 'worker-gongbu',
            status: 'pending_approval',
            riskClass: 'high',
            requestedAt: '2026-04-19T10:00:00.000Z',
            metadata: {
              sandboxRunId: 'sandbox-observatory-1',
              sandboxDecision: 'requires_review',
              sandboxProfile: 'workspace-write',
              autoReviewId: 'review-observatory-1',
              autoReviewVerdict: 'changes_requested',
              rawInput: 'SECRET_REQUEST_INPUT'
            }
          },
          {
            requestId: 'req-2',
            taskId: 'task-2',
            toolName: 'browser.open',
            status: 'running',
            riskClass: 'low',
            requestedAt: '2026-04-19T10:01:00.000Z'
          }
        ],
        results: [
          {
            requestId: 'req-1',
            resultId: 'result-1',
            status: 'failed',
            completedAt: '2026-04-19T10:02:00.000Z'
          }
        ],
        policyDecisions: [
          {
            requestId: 'req-1',
            decisionId: 'policy-1',
            decision: 'require_approval',
            riskClass: 'high',
            reason: 'shell write requires approval'
          }
        ],
        events: [
          {
            id: 'event-1',
            sessionId: 'session-1',
            type: 'execution_step_blocked',
            at: '2026-04-19T10:03:00.000Z',
            payload: {
              taskId: 'task-1',
              requestId: 'req-1',
              toolName: 'terminal.exec',
              nodeId: 'worker-gongbu',
              status: 'blocked',
              outputPreview: 'SECRET_VENDOR_PAYLOAD'
            }
          },
          {
            id: 'event-2',
            sessionId: 'session-1',
            type: 'execution_step_resumed',
            at: '2026-04-19T10:04:00.000Z',
            payload: {
              taskId: 'task-2',
              requestId: 'req-2',
              toolName: 'browser.open',
              status: 'resumed'
            }
          }
        ]
      },
      'task-1',
      'blocked'
    );

    expect(detail.counts).toEqual({
      requests: 1,
      results: 1,
      events: 1,
      policyDecisions: 1
    });
    expect(detail.latestItems).toEqual([
      expect.objectContaining({
        kind: 'event',
        id: 'event:event-1',
        title: 'execution_step_blocked',
        summary: 'blocked · terminal.exec · worker-gongbu'
      }),
      expect.objectContaining({
        kind: 'result',
        id: 'result:result-1',
        title: 'result failed',
        summary: 'request req-1'
      }),
      expect.objectContaining({
        kind: 'request',
        id: 'request:req-1',
        title: 'terminal.exec',
        summary: 'pending_approval · risk high · worker-gongbu',
        badges: [
          'sandbox sandbox-observatory-1',
          'sandbox decision requires_review',
          'sandbox profile workspace-write',
          'review review-observatory-1',
          'review verdict changes_requested'
        ]
      }),
      expect.objectContaining({
        kind: 'policy',
        id: 'policy:policy-1',
        title: 'policy require_approval',
        summary: 'risk high · shell write requires approval'
      })
    ]);
    expect(JSON.stringify(detail.latestItems)).not.toContain('SECRET_VENDOR_PAYLOAD');
    expect(JSON.stringify(detail.latestItems)).not.toContain('SECRET_REQUEST_INPUT');
  });
});

import { describe, expect, it } from 'vitest';

import {
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
});

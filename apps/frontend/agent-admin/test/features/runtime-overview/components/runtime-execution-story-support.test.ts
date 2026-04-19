import { describe, expect, it } from 'vitest';

import { buildRuntimeExecutionStory } from '@/features/runtime-overview/components/runtime-execution-story-support';

describe('runtime execution story support', () => {
  it('builds an ordered execution storyline across timeline, trace, checkpoint, evidence and interrupt events', () => {
    const steps = buildRuntimeExecutionStory({
      detail: {
        run: {
          taskId: 'task-1',
          goal: '/review audit runtime pipeline',
          status: 'running',
          startedAt: '2026-04-19T10:00:00.000Z',
          currentStage: 'review',
          currentNode: 'xingbu-review',
          currentMinistry: 'xingbu-review',
          hasInterrupt: true,
          hasFallback: false,
          hasRecoverableCheckpoint: true,
          hasEvidenceWarning: false,
          diagnosticFlags: []
        },
        timeline: [
          {
            id: 'tl-review',
            stage: 'review',
            status: 'running',
            title: 'Review',
            summary: 'review started',
            startedAt: '2026-04-19T10:00:01.000Z',
            actor: { type: 'ministry', id: 'xingbu-review', displayName: '刑部评审' }
          }
        ],
        traces: [
          {
            spanId: 'span-review',
            node: 'xingbu-review',
            stage: 'review',
            status: 'running',
            summary: 'review findings are being consolidated',
            startedAt: '2026-04-19T10:00:02.000Z',
            ministry: 'xingbu-review',
            worker: 'worker-xingbu-review',
            modelUsed: 'gpt-5.4',
            latencyMs: 1200
          }
        ],
        checkpoints: [
          {
            checkpointId: 'cp-review',
            stage: 'review',
            summary: 'review checkpoint saved',
            createdAt: '2026-04-19T10:00:03.000Z',
            recoverability: 'safe',
            recoverable: true,
            linkedSpanIds: ['span-review']
          }
        ],
        evidence: [
          {
            id: 'evidence-review',
            title: 'spec',
            summary: 'spec evidence collected',
            sourceType: 'doc',
            trustLevel: 'high',
            stage: 'review',
            citedAt: '2026-04-19T10:00:04.000Z',
            linkedSpanId: 'span-review',
            linkedCheckpointId: 'cp-review'
          }
        ],
        diagnostics: [],
        interrupts: [
          {
            id: 'interrupt-review',
            kind: 'approval',
            status: 'pending',
            title: 'approval needed',
            summary: 'needs approval before continuing',
            createdAt: '2026-04-19T10:00:05.000Z',
            stage: 'review',
            relatedSpanId: 'span-review'
          }
        ],
        artifacts: [
          {
            id: 'artifact-review',
            type: 'review_summary',
            title: 'review summary',
            summary: 'summary generated',
            createdAt: '2026-04-19T10:00:06.000Z'
          }
        ]
      } as any
    });

    expect(steps.map(item => item.kind)).toEqual([
      'timeline',
      'trace',
      'checkpoint',
      'evidence',
      'interrupt',
      'artifact'
    ]);
    expect(steps[1]).toEqual(
      expect.objectContaining({
        id: 'trace:span-review',
        nodeLabel: 'xingbu-review',
        focusTarget: { kind: 'span', id: 'span-review' }
      })
    );
    expect(steps[2]).toEqual(
      expect.objectContaining({
        id: 'checkpoint:cp-review',
        nodeLabel: 'xingbu-review',
        focusTarget: { kind: 'checkpoint', id: 'cp-review' }
      })
    );
    expect(steps[1]?.replayDraftSeed).toEqual(
      expect.objectContaining({
        workflowCommand: '/review',
        sourceLabel: 'trace · xingbu-review'
      })
    );
  });

  it('scopes the storyline to the current graph node filter', () => {
    const steps = buildRuntimeExecutionStory({
      detail: {
        run: {
          taskId: 'task-1',
          goal: 'review runtime pipeline',
          status: 'running',
          startedAt: '2026-04-19T10:00:00.000Z',
          currentStage: 'review',
          hasInterrupt: false,
          hasFallback: false,
          hasRecoverableCheckpoint: true,
          hasEvidenceWarning: false,
          diagnosticFlags: []
        },
        timeline: [
          {
            id: 'tl-plan',
            stage: 'plan',
            status: 'completed',
            title: 'Plan',
            summary: 'plan done',
            startedAt: '2026-04-19T10:00:01.000Z'
          }
        ],
        traces: [
          {
            spanId: 'span-review',
            node: 'xingbu-review',
            stage: 'review',
            status: 'completed',
            summary: 'review done',
            startedAt: '2026-04-19T10:00:02.000Z'
          }
        ],
        checkpoints: [
          {
            checkpointId: 'cp-review',
            stage: 'review',
            summary: 'checkpoint',
            createdAt: '2026-04-19T10:00:03.000Z',
            recoverable: true,
            recoverability: 'safe',
            linkedSpanIds: ['span-review']
          }
        ],
        evidence: [],
        diagnostics: [],
        interrupts: [],
        artifacts: []
      } as any,
      graphFilter: {
        nodeId: 'worker-xingbu-review',
        label: 'xingbu-review',
        stages: ['review'],
        spanIds: ['span-review'],
        checkpointIds: ['cp-review'],
        evidenceIds: [],
        diagnosticIds: [],
        interruptIds: []
      }
    });

    expect(steps.map(item => item.id)).toEqual(['trace:span-review', 'checkpoint:cp-review']);
  });
});

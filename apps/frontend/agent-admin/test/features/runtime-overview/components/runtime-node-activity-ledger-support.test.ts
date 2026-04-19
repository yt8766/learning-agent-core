import { describe, expect, it } from 'vitest';

import { buildNodeActivityLedger } from '@/features/runtime-overview/components/runtime-node-activity-ledger-support';

describe('runtime node activity ledger support', () => {
  it('builds node-scoped chronological activity rows from run detail', () => {
    const rows = buildNodeActivityLedger({
      detail: {
        run: {
          taskId: 'task-1',
          goal: 'review runtime pipeline',
          status: 'running',
          startedAt: '2026-04-19T10:00:00.000Z',
          currentStage: 'review',
          currentMinistry: 'xingbu-review',
          hasInterrupt: true,
          hasFallback: false,
          hasRecoverableCheckpoint: true,
          hasEvidenceWarning: false,
          diagnosticFlags: []
        },
        timeline: [],
        traces: [
          {
            spanId: 'span-review',
            node: 'xingbu-review',
            stage: 'review',
            status: 'running',
            summary: 'review findings are being consolidated',
            startedAt: '2026-04-19T10:00:10.000Z',
            latencyMs: 1500,
            modelUsed: 'gpt-5.4'
          }
        ],
        checkpoints: [
          {
            checkpointId: 'cp-review',
            summary: 'review checkpoint',
            createdAt: '2026-04-19T10:00:12.000Z',
            recoverability: 'safe',
            stage: 'review',
            linkedSpanIds: ['span-review']
          }
        ],
        interrupts: [
          {
            id: 'interrupt-review',
            stage: 'review',
            status: 'pending',
            summary: 'needs approval before continuing',
            createdAt: '2026-04-19T10:00:14.000Z',
            relatedSpanId: 'span-review'
          }
        ],
        diagnostics: [
          {
            id: 'diag-review',
            kind: 'warning',
            title: 'warning',
            summary: 'latency is above the expected budget',
            detectedAt: '2026-04-19T10:00:13.000Z',
            linkedStage: 'review',
            linkedSpanId: 'span-review'
          }
        ],
        artifacts: [],
        evidence: [
          {
            id: 'evidence-review',
            sourceType: 'code',
            summary: 'linked code reference',
            citedAt: '2026-04-19T10:00:11.000Z',
            stage: 'review',
            linkedSpanId: 'span-review',
            linkedCheckpointId: 'cp-review'
          }
        ]
      } as any
    });

    expect(rows).toEqual([
      expect.objectContaining({
        id: 'span:span-review',
        kind: 'trace',
        node: 'xingbu-review',
        stage: 'review',
        title: 'xingbu-review',
        summary: 'review findings are being consolidated',
        at: '2026-04-19T10:00:10.000Z'
      }),
      expect.objectContaining({
        id: 'evidence:evidence-review',
        kind: 'evidence',
        node: 'xingbu-review',
        title: 'code',
        at: '2026-04-19T10:00:11.000Z'
      }),
      expect.objectContaining({
        id: 'checkpoint:cp-review',
        kind: 'checkpoint',
        node: 'xingbu-review',
        title: 'cp-review',
        at: '2026-04-19T10:00:12.000Z'
      }),
      expect.objectContaining({
        id: 'diagnostic:diag-review',
        kind: 'diagnostic',
        node: 'xingbu-review',
        title: 'warning',
        at: '2026-04-19T10:00:13.000Z'
      }),
      expect.objectContaining({
        id: 'interrupt:interrupt-review',
        kind: 'interrupt',
        node: 'xingbu-review',
        title: 'pending',
        at: '2026-04-19T10:00:14.000Z'
      })
    ]);
  });
});

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { RuntimeNodeActivityLedgerCard } from '@/features/runtime-overview/components/runtime-node-activity-ledger-card';

describe('RuntimeNodeActivityLedgerCard', () => {
  it('renders node activity rows and focus actions for the selected run', () => {
    const html = renderToStaticMarkup(
      <RuntimeNodeActivityLedgerCard
        detail={
          {
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
            interrupts: [],
            diagnostics: [],
            artifacts: [],
            evidence: []
          } as any
        }
        onFocusTargetChange={vi.fn()}
      />
    );

    expect(html).toContain('Node Activity Ledger');
    expect(html).toContain('xingbu-review');
    expect(html).toContain('review findings are being consolidated');
    expect(html).toContain('trace');
    expect(html).toContain('checkpoint');
    expect(html).toContain('gpt-5.4');
    expect(html).toContain('1500ms');
    expect(html).toContain('聚焦');
  });
});

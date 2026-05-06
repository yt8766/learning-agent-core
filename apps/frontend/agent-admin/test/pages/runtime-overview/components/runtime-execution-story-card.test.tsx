import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { RuntimeExecutionStoryCard } from '@/pages/runtime-overview/components/runtime-execution-story-card';

describe('RuntimeExecutionStoryCard', () => {
  it('renders ordered execution storyline steps for the selected run', () => {
    const html = renderToStaticMarkup(
      <RuntimeExecutionStoryCard
        detail={
          {
            run: {
              taskId: 'task-1',
              goal: '/review audit runtime pipeline',
              status: 'running',
              startedAt: '2026-04-19T10:00:00.000Z',
              currentStage: 'review',
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
                actor: { type: 'ministry', displayName: '刑部评审' }
              }
            ],
            traces: [
              {
                spanId: 'span-review',
                node: 'xingbu-review',
                stage: 'review',
                status: 'running',
                summary: 'review findings are being consolidated',
                startedAt: '2026-04-19T10:00:02.000Z'
              }
            ],
            checkpoints: [
              {
                checkpointId: 'cp-review',
                stage: 'review',
                summary: 'checkpoint saved',
                createdAt: '2026-04-19T10:00:03.000Z',
                recoverable: true,
                recoverability: 'safe',
                linkedSpanIds: ['span-review']
              }
            ],
            evidence: [],
            diagnostics: [],
            interrupts: [
              {
                id: 'interrupt-review',
                kind: 'approval',
                status: 'pending',
                title: 'approval needed',
                summary: 'needs approval before continuing',
                createdAt: '2026-04-19T10:00:04.000Z',
                stage: 'review',
                relatedSpanId: 'span-review'
              }
            ],
            artifacts: []
          } as any
        }
        onFocusTargetChange={vi.fn()}
        onRequestReplayDraft={vi.fn()}
      />
    );

    expect(html).toContain('Execution Storyline');
    expect(html).toContain('#1');
    expect(html).toContain('timeline');
    expect(html).toContain('trace');
    expect(html).toContain('checkpoint');
    expect(html).toContain('interrupt');
    expect(html).toContain('node xingbu-review');
    expect(html).toContain('review findings are being consolidated');
    expect(html).toContain('送到 Replay Draft');
    expect(html).toContain('聚焦');
  });
});

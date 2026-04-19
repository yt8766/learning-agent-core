import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RuntimeWorkflowExecutionMapCard } from '@/features/runtime-overview/components/runtime-workflow-execution-map-card';

describe('RuntimeWorkflowExecutionMapCard', () => {
  it('renders workflow blueprint stages without runtime detail', () => {
    const html = renderToStaticMarkup(
      <RuntimeWorkflowExecutionMapCard
        workflow={{
          id: 'review',
          displayName: '代码审查流程',
          requiredMinistries: ['libu-governance', 'hubu-search', 'gongbu-code', 'xingbu-review']
        }}
        title="Workflow Blueprint"
      />
    );

    expect(html).toContain('Workflow Blueprint');
    expect(html).toContain('代码审查流程 / review');
    expect(html).toContain('Plan');
    expect(html).toContain('Route');
    expect(html).toContain('Review');
  });

  it('renders runtime traces and checkpoints on mapped stages', () => {
    const html = renderToStaticMarkup(
      <RuntimeWorkflowExecutionMapCard
        workflow={{
          id: 'review',
          displayName: '代码审查流程',
          requiredMinistries: ['libu-governance', 'gongbu-code', 'xingbu-review']
        }}
        detail={{
          run: {
            taskId: 'task-1',
            goal: '/review review runtime pipeline',
            status: 'running',
            startedAt: '2026-04-19T10:00:00.000Z',
            hasInterrupt: false,
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
              summary: 'review in progress'
            }
          ],
          traces: [
            {
              spanId: 'span-review',
              node: 'xingbu-review',
              stage: 'review',
              status: 'failed',
              summary: 'review findings are being consolidated',
              startedAt: '2026-04-19T10:00:10.000Z',
              latencyMs: 1500
            }
          ],
          checkpoints: [
            {
              checkpointId: 'cp-review',
              summary: 'review checkpoint',
              createdAt: '2026-04-19T10:00:12.000Z',
              recoverable: true,
              recoverability: 'safe',
              stage: 'review'
            }
          ],
          interrupts: [],
          diagnostics: [],
          artifacts: [],
          evidence: []
        }}
        onRequestReplayDraft={() => undefined}
      />
    );

    expect(html).toContain('Workflow Execution Map');
    expect(html).toContain('Review');
    expect(html).toContain('review in progress');
    expect(html).toContain('xingbu-review');
    expect(html).toContain('1500ms');
    expect(html).toContain('cp-review');
    expect(html).toContain('safe');
    expect(html).toContain('送到 Replay Draft');
  });
});

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RuntimeRunSessionTimelineCard } from '@/pages/runtime-overview/components/runtime-run-session-timeline-card';

describe('RuntimeRunSessionTimelineCard', () => {
  it('renders a lineage timeline across baseline, replay receipt and current run', () => {
    const html = renderToStaticMarkup(
      <RuntimeRunSessionTimelineCard
        baselineRun={
          {
            taskId: 'task-baseline',
            goal: 'Baseline review run',
            status: 'completed',
            startedAt: '2026-04-18T10:00:00.000Z',
            currentStage: 'review',
            hasInterrupt: false,
            hasFallback: false,
            hasRecoverableCheckpoint: false,
            hasEvidenceWarning: false,
            diagnosticFlags: []
          } as any
        }
        replayLaunchReceipt={{
          sourceLabel: 'trace · xingbu-review',
          scoped: true,
          baselineTaskId: 'task-baseline'
        }}
        currentRun={
          {
            taskId: 'task-current',
            goal: '/review audit runtime pipeline',
            status: 'running',
            startedAt: '2026-04-19T10:00:00.000Z',
            currentStage: 'review',
            currentNode: 'xingbu-review',
            hasInterrupt: false,
            hasFallback: false,
            hasRecoverableCheckpoint: true,
            hasEvidenceWarning: false,
            diagnosticFlags: []
          } as any
        }
      />
    );

    expect(html).toContain('Run Session Timeline');
    expect(html).toContain('Baseline review run');
    expect(html).toContain('Scoped Replay Launch');
    expect(html).toContain('trace · xingbu-review');
    expect(html).toContain('/review audit runtime pipeline');
    expect(html).toContain('task-current');
    expect(html).toContain('baseline');
    expect(html).toContain('replay');
    expect(html).toContain('current');
  });
});

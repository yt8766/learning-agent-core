import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { RunObservatoryCompareCard } from '@/features/run-observatory/run-observatory-compare-card';

describe('RunObservatoryCompareCard', () => {
  it('renders summary differences for the selected baseline run', () => {
    const html = renderToStaticMarkup(
      <RunObservatoryCompareCard
        currentDetail={{
          run: {
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
        }}
        baselineRun={{
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
        }}
        baselineDetail={{
          run: {
            taskId: 'task-baseline',
            goal: 'Baseline run',
            status: 'completed',
            startedAt: '2026-04-19T09:00:00.000Z',
            durationMs: 60000,
            currentStage: 'delivery',
            hasInterrupt: false,
            hasFallback: false,
            hasRecoverableCheckpoint: true,
            hasEvidenceWarning: true,
            diagnosticFlags: ['evidence_insufficient']
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
        }}
        baselineCandidates={[
          {
            taskId: 'task-baseline',
            goal: 'Baseline run',
            status: 'completed',
            startedAt: '2026-04-19T09:00:00.000Z',
            hasInterrupt: false,
            hasFallback: false,
            hasRecoverableCheckpoint: true,
            hasEvidenceWarning: true,
            diagnosticFlags: ['evidence_insufficient']
          }
        ]}
        compareTaskId="task-baseline"
        onCompareTaskIdChange={vi.fn()}
        graphFilter={{
          nodeId: 'worker-review',
          label: 'review',
          stages: ['review'],
          spanIds: ['span-2'],
          checkpointIds: [],
          evidenceIds: [],
          diagnosticIds: [],
          interruptIds: []
        }}
      />
    );

    expect(html).toContain('Compare / Diff');
    expect(html).toContain('node review');
    expect(html).toContain('Node Inspector');
    expect(html).toContain('当前 compare 已收缩到节点');
    expect(html).toContain('added objects 1');
    expect(html).toContain('changed fields 0');
    expect(html).toContain('Baseline run');
    expect(html).toContain('status completed → failed');
    expect(html).toContain('stage delivery → interrupt');
    expect(html).toContain('+30s slower');
    expect(html).toContain('+flag interrupt');
    expect(html).toContain('+diag approval_blocked');
    expect(html).toContain('timeline +0');
    expect(html).toContain('traces +1');
    expect(html).toContain('checkpoints +0');
    expect(html).toContain('+trace review');
    expect(html).not.toContain('-trace delivery');
    expect(html).not.toContain('+evidence runtime-log');
    expect(html).toContain('Added Traces');
    expect(html).toContain('span-2');
    expect(html).toContain('review / failed');
    expect(html).not.toContain('span-1');
    expect(html).not.toContain('Changed Traces');
    expect(html).not.toContain('>status</span>: completed → failed');
    expect(html).not.toContain('Changed Checkpoints');
    expect(html).not.toContain('Changed Diagnostics');
    expect(html).not.toContain('Changed Evidence');
    expect(html).not.toContain('Changed Interrupts');
  });
});

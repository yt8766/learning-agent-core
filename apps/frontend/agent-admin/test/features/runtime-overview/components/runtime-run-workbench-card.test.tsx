import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { RuntimeRunWorkbenchCard } from '@/features/runtime-overview/components/runtime-run-workbench-card';

describe('RuntimeRunWorkbenchCard', () => {
  it('renders workflow, input, stage, graph filter and baseline context for the selected run', () => {
    const html = renderToStaticMarkup(
      <RuntimeRunWorkbenchCard
        bundle={
          {
            task: {
              id: 'task-1',
              goal: '/review audit runtime pipeline',
              status: 'running',
              currentMinistry: 'xingbu-review',
              resolvedWorkflow: {
                id: 'review',
                displayName: '代码审查流程',
                version: '1.0.0'
              }
            }
          } as any
        }
        detail={
          {
            run: {
              taskId: 'task-1',
              goal: '/review audit runtime pipeline',
              status: 'running',
              startedAt: '2026-04-19T10:00:00.000Z',
              currentStage: 'review',
              currentNode: 'xingbu-review',
              currentMinistry: 'xingbu-review',
              hasInterrupt: false,
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
                startedAt: '2026-04-19T10:00:10.000Z'
              }
            ],
            checkpoints: [
              {
                checkpointId: 'cp-review',
                stage: 'review',
                summary: 'review checkpoint',
                createdAt: '2026-04-19T10:00:12.000Z',
                recoverable: true,
                recoverability: 'safe'
              }
            ],
            interrupts: [
              {
                id: 'interrupt-review',
                kind: 'approval',
                status: 'pending',
                title: 'approval needed',
                summary: 'needs approval before continuing',
                createdAt: '2026-04-19T10:00:14.000Z',
                stage: 'review',
                relatedSpanId: 'span-review'
              }
            ],
            diagnostics: [],
            artifacts: [],
            evidence: []
          } as any
        }
        focusTarget={{ kind: 'span', id: 'span-review' }}
        graphFilter={{
          nodeId: 'worker-xingbu-review',
          label: 'xingbu-review',
          stages: ['review'],
          spanIds: ['span-review'],
          checkpointIds: ['cp-review'],
          evidenceIds: [],
          diagnosticIds: [],
          interruptIds: []
        }}
        compareTaskId="task-baseline"
        baselineRun={
          {
            taskId: 'task-baseline',
            goal: 'Baseline review run',
            status: 'completed',
            startedAt: '2026-04-18T10:00:00.000Z',
            hasInterrupt: false,
            hasFallback: false,
            hasRecoverableCheckpoint: false,
            hasEvidenceWarning: false,
            diagnosticFlags: []
          } as any
        }
        replayDraftSeed={{
          key: 'trace:span-review:2026-04-19T10:00:10.000Z',
          workflowCommand: '/review',
          goal: 'audit runtime pipeline\n\n请重点复盘阶段 review / 节点 xingbu-review。',
          sourceLabel: 'trace · xingbu-review',
          sourceKind: 'story',
          baseGoal: 'audit runtime pipeline',
          scopeChips: ['kind trace', 'stage review', 'node xingbu-review'],
          scopeSections: ['请重点复盘阶段 review / 节点 xingbu-review。']
        }}
        replayLaunchReceipt={{
          sourceLabel: 'trace · xingbu-review',
          scoped: true,
          baselineTaskId: 'task-baseline'
        }}
        onRetryTask={vi.fn()}
        onRerunFromSnapshot={vi.fn()}
        onFocusTargetChange={vi.fn()}
        onClearGraphFilter={vi.fn()}
        onClearCompare={vi.fn()}
      />
    );

    expect(html).toContain('Run Workbench');
    expect(html).toContain('/review');
    expect(html).toContain('audit runtime pipeline');
    expect(html).toContain('Input Snapshot');
    expect(html).toContain('Replay Receipt');
    expect(html).toContain('scoped replay launched');
    expect(html).toContain('Replay Draft');
    expect(html).toContain('Diff Preview Before Replay');
    expect(html).toContain('Launch Intent Summary');
    expect(html).toContain('command unchanged');
    expect(html).toContain('input changed');
    expect(html).toContain('Snapshot Goal');
    expect(html).toContain('Replay Goal');
    expect(html).toContain('stage review');
    expect(html).toContain('node xingbu-review');
    expect(html).toContain('Workflow Command');
    expect(html).toContain('Input Goal');
    expect(html).toContain('Launch Replay Draft');
    expect(html).toContain('from trace · xingbu-review');
    expect(html).toContain('kind trace');
    expect(html).toContain('scope attached');
    expect(html).toContain('scoped replay');
    expect(html).toContain('Predicted Stages');
    expect(html).toContain('Predicted Nodes');
    expect(html).toContain('Intent Scope');
    expect(html).toContain('保留范围');
    expect(html).toContain('清空范围');
    expect(html).toContain('代码审查流程');
    expect(html).toContain('review');
    expect(html).toContain('xingbu-review');
    expect(html).toContain('node xingbu-review');
    expect(html).toContain('baseline Baseline review run');
    expect(html).toContain('task-baseline');
    expect(html).toContain('Rerun From Snapshot');
    expect(html).toContain('Retry Run');
    expect(html).toContain('Debug Scope');
    expect(html).toContain('focus span:span-review');
    expect(html).toContain('baseline task-baseline');
    expect(html).toContain('diff node-scoped:xingbu-review');
    expect(html).toContain('Launch Replay Draft');
    expect(html).toContain('Current Node Slice');
    expect(html).toContain('trace xingbu-review');
    expect(html).toContain('checkpoint cp-review');
    expect(html).toContain('interrupt approval');
    expect(html).toContain('聚焦');
    expect(html).toContain('清除节点过滤');
    expect(html).toContain('清除基线');
  });
});

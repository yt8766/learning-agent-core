import { describe, expect, it } from 'vitest';

import {
  buildReplayDraftSeedFromGraphNode,
  buildReplayDraftSeedFromStage,
  buildReplayDraftSeedFromStoryStep,
  inferWorkflowCommand,
  stripWorkflowCommand
} from '@/features/runtime-overview/components/runtime-run-workbench-support';

describe('runtime run workbench support', () => {
  it('extracts workflow command and strips the input goal', () => {
    expect(inferWorkflowCommand('/review audit runtime pipeline')).toBe('/review');
    expect(stripWorkflowCommand('/review audit runtime pipeline', '/review')).toBe('audit runtime pipeline');
  });

  it('builds a replay draft seed from an execution story step', () => {
    const seed = buildReplayDraftSeedFromStoryStep({
      runGoal: '/review audit runtime pipeline',
      step: {
        id: 'trace:span-review',
        kind: 'trace',
        at: '2026-04-19T10:00:02.000Z',
        title: 'xingbu-review',
        summary: 'review findings are being consolidated',
        stage: 'review',
        nodeLabel: 'xingbu-review'
      }
    });

    expect(seed).toEqual(
      expect.objectContaining({
        key: 'trace:span-review:2026-04-19T10:00:02.000Z',
        workflowCommand: '/review',
        sourceLabel: 'trace · xingbu-review',
        sourceKind: 'story',
        baseGoal: 'audit runtime pipeline'
      })
    );
    expect(seed.scopeChips).toEqual(['kind trace', 'stage review', 'node xingbu-review']);
    expect(seed.goal).toContain('audit runtime pipeline');
    expect(seed.goal).toContain('阶段 review / 节点 xingbu-review');
    expect(seed.goal).toContain('review findings are being consolidated');
  });

  it('builds replay draft seeds from stage and graph node entry points', () => {
    const stageSeed = buildReplayDraftSeedFromStage({
      runGoal: '/review audit runtime pipeline',
      stage: {
        id: 'review',
        title: 'Review',
        summary: 'review in progress',
        status: 'running'
      }
    });
    const nodeSeed = buildReplayDraftSeedFromGraphNode({
      runGoal: '/review audit runtime pipeline',
      node: {
        id: 'worker-xingbu-review',
        label: 'xingbu-review',
        summary: 'review findings consolidated',
        status: 'current',
        subgraphTitle: 'Dispatch'
      }
    });

    expect(stageSeed).toEqual(
      expect.objectContaining({
        workflowCommand: '/review',
        sourceLabel: 'stage · Review',
        sourceKind: 'stage',
        baseGoal: 'audit runtime pipeline'
      })
    );
    expect(stageSeed.scopeChips).toEqual(['stage review', 'status running']);
    expect(stageSeed.goal).toContain('请重点重放阶段 Review');

    expect(nodeSeed).toEqual(
      expect.objectContaining({
        workflowCommand: '/review',
        sourceLabel: 'graph · xingbu-review',
        sourceKind: 'graph',
        baseGoal: 'audit runtime pipeline'
      })
    );
    expect(nodeSeed.scopeChips).toEqual(['node xingbu-review', 'status current', 'subgraph Dispatch']);
    expect(nodeSeed.goal).toContain('请重点复盘节点 xingbu-review');
    expect(nodeSeed.goal).toContain('所在子图：Dispatch');
  });
});

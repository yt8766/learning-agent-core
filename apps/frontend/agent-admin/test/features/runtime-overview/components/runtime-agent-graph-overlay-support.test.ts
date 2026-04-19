import { describe, expect, it } from 'vitest';

import {
  buildAgentGraphOverlay,
  buildAgentGraphOverlayFilter,
  resolveGraphFilterForFocusTarget
} from '@/features/runtime-overview/components/runtime-agent-graph-overlay-support';

describe('runtime agent graph overlay support', () => {
  it('maps current workflow and runtime stages onto agent architecture nodes', () => {
    const overlay = buildAgentGraphOverlay({
      diagram: {
        id: 'agent',
        title: 'Agent 架构图',
        generatedAt: '2026-04-19T10:00:00.000Z',
        version: '1.0.0',
        sourceDescriptors: [],
        mermaid: 'flowchart TD',
        descriptor: {
          id: 'agent-architecture',
          title: 'Agent 架构图',
          scope: 'agent',
          direction: 'TD',
          sourceDescriptors: [],
          subgraphs: [
            { id: 'main-chain', title: 'Main Runtime Chain' },
            { id: 'dispatch', title: 'Strategy / Ministry / Fallback' },
            { id: 'state', title: 'Blackboard / Sandbox / Workflow Context' }
          ],
          nodes: [
            { id: 'entry-router', label: 'EntryRouter', subgraphId: 'main-chain' },
            { id: 'dispatch-planner', label: 'DispatchPlanner', subgraphId: 'main-chain' },
            { id: 'worker-xingbu-review', label: 'xingbu-review', subgraphId: 'dispatch' },
            { id: 'workflow-review', label: 'review workflow', subgraphId: 'state' }
          ],
          edges: []
        }
      },
      detail: {
        run: {
          taskId: 'task-1',
          goal: 'review runtime pipeline',
          status: 'running',
          startedAt: '2026-04-19T10:00:00.000Z',
          currentStage: 'review',
          currentMinistry: 'xingbu-review',
          workflow: {
            id: 'review',
            displayName: '代码审查流程'
          },
          modelRoute: [{ ministry: 'xingbu-review', selectedModel: 'gpt-5.4' }],
          hasInterrupt: false,
          hasFallback: false,
          hasRecoverableCheckpoint: true,
          hasEvidenceWarning: false,
          diagnosticFlags: []
        },
        timeline: [
          {
            id: 'tl-route',
            stage: 'route',
            status: 'completed',
            title: 'Route',
            summary: 'workflow route selected'
          },
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
            status: 'completed',
            summary: 'review findings consolidated',
            startedAt: '2026-04-19T10:00:10.000Z',
            ministry: 'xingbu-review'
          }
        ],
        checkpoints: [],
        interrupts: [],
        diagnostics: [],
        artifacts: [],
        evidence: []
      }
    });

    expect(overlay).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'workflow-review', status: 'current' }),
        expect.objectContaining({
          id: 'worker-xingbu-review',
          status: 'current',
          focusTarget: { kind: 'span', id: 'span-review' },
          replayDraftSeed: expect.objectContaining({
            workflowCommand: undefined,
            sourceLabel: 'graph · xingbu-review'
          })
        }),
        expect.objectContaining({ id: 'dispatch-planner', status: 'active' })
      ])
    );
  });

  it('rebuilds a node filter from a persisted graph node id', () => {
    const filter = buildAgentGraphOverlayFilter({
      nodeId: 'worker-xingbu-review',
      detail: {
        run: {
          taskId: 'task-1',
          goal: 'review runtime pipeline',
          status: 'running',
          startedAt: '2026-04-19T10:00:00.000Z',
          currentStage: 'review',
          currentMinistry: 'xingbu-review',
          workflow: {
            id: 'review',
            displayName: '代码审查流程'
          },
          modelRoute: [{ ministry: 'xingbu-review', selectedModel: 'gpt-5.4' }],
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
            status: 'completed',
            summary: 'review findings consolidated',
            startedAt: '2026-04-19T10:00:10.000Z',
            ministry: 'xingbu-review'
          }
        ],
        checkpoints: [
          {
            checkpointId: 'cp-review',
            stage: 'review',
            linkedSpanIds: ['span-review']
          }
        ],
        interrupts: [
          {
            id: 'interrupt-review',
            stage: 'review',
            relatedSpanId: 'span-review'
          }
        ],
        diagnostics: [
          {
            id: 'diag-review',
            linkedStage: 'review',
            linkedSpanId: 'span-review'
          }
        ],
        artifacts: [],
        evidence: [
          {
            id: 'evidence-review',
            stage: 'review',
            linkedSpanId: 'span-review',
            linkedCheckpointId: 'cp-review'
          }
        ]
      } as any
    });

    expect(filter).toEqual({
      nodeId: 'worker-xingbu-review',
      label: 'worker-xingbu-review',
      stages: [],
      spanIds: ['span-review'],
      checkpointIds: ['cp-review'],
      evidenceIds: ['evidence-review'],
      diagnosticIds: ['diag-review'],
      interruptIds: ['interrupt-review']
    });
  });

  it('resolves a focused span back to the best matching graph node filter', () => {
    const filter = resolveGraphFilterForFocusTarget({
      target: { kind: 'span', id: 'span-review' },
      detail: {
        run: {
          taskId: 'task-1',
          goal: 'review runtime pipeline',
          status: 'running',
          startedAt: '2026-04-19T10:00:00.000Z',
          currentStage: 'review',
          currentMinistry: 'xingbu-review',
          workflow: {
            id: 'review',
            displayName: '代码审查流程'
          },
          modelRoute: [{ ministry: 'xingbu-review', selectedModel: 'gpt-5.4' }],
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
            status: 'completed',
            summary: 'review findings consolidated',
            startedAt: '2026-04-19T10:00:10.000Z',
            ministry: 'xingbu-review'
          }
        ],
        checkpoints: [
          {
            checkpointId: 'cp-review',
            stage: 'review',
            linkedSpanIds: ['span-review']
          }
        ],
        interrupts: [],
        diagnostics: [],
        artifacts: [],
        evidence: []
      } as any
    });

    expect(filter).toEqual(
      expect.objectContaining({
        nodeId: 'worker-xingbu-review',
        spanIds: ['span-review'],
        checkpointIds: ['cp-review']
      })
    );
  });
});

import { describe, expect, it } from 'vitest';

import { buildWorkflowExecutionMap } from '@/pages/runtime-overview/components/runtime-workflow-execution-map-support';

describe('runtime workflow execution map support', () => {
  it('builds a static workflow skeleton from ministries when detail is missing', () => {
    expect(
      buildWorkflowExecutionMap({
        workflow: {
          id: 'review',
          displayName: '代码审查流程',
          requiredMinistries: ['libu-governance', 'hubu-search', 'gongbu-code', 'xingbu-review']
        }
      }).map(item => item.id)
    ).toEqual(['plan', 'route', 'research', 'execution', 'review', 'delivery']);
  });

  it('projects runtime detail onto workflow stages', () => {
    const stages = buildWorkflowExecutionMap({
      workflow: {
        id: 'review',
        displayName: '代码审查流程',
        requiredMinistries: ['libu-governance', 'gongbu-code', 'xingbu-review']
      },
      detail: {
        run: {
          taskId: 'task-1',
          goal: 'review the runtime pipeline',
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
            summary: 'xingbu is reviewing findings'
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
      }
    });

    expect(stages.find(item => item.id === 'review')).toEqual(
      expect.objectContaining({
        status: 'running',
        summary: 'xingbu is reviewing findings'
      })
    );
    expect(stages.find(item => item.id === 'review')?.traces).toHaveLength(1);
    expect(stages.find(item => item.id === 'review')?.checkpoints).toHaveLength(1);
  });
});

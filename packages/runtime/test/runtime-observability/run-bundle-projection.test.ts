import { describe, expect, it } from 'vitest';

import { buildRunBundle, resolveRunStage } from '../../src/runtime-observability';

describe('runtime observability projection', () => {
  it('resolves canonical stages from runtime node semantics', () => {
    expect(resolveRunStage({ node: 'hubu_search' })).toBe('research');
    expect(resolveRunStage({ node: 'gongbu_execute' })).toBe('execution');
    expect(resolveRunStage({ node: 'xingbu_review' })).toBe('review');
    expect(resolveRunStage({ node: 'approval_interrupt' })).toBe('interrupt');
    expect(resolveRunStage({ node: 'learning_flow' })).toBe('learning');
  });

  it('builds a run bundle with timeline, traces, checkpoint summaries, and diagnostics', () => {
    const bundle = buildRunBundle(
      {
        id: 'task-1',
        goal: 'Diagnose execution regression',
        status: 'failed',
        sessionId: 'session-1',
        currentNode: 'approval_interrupt',
        currentMinistry: 'gongbu',
        currentWorker: 'worker-1',
        createdAt: '2026-04-19T09:59:00.000Z',
        updatedAt: '2026-04-19T10:03:00.000Z',
        retryCount: 1,
        maxRetries: 3,
        resolvedWorkflow: {
          id: 'runtime-workflow',
          displayName: 'Runtime Workflow',
          version: '1.0.0'
        },
        subgraphTrail: ['execution', 'review'],
        trace: [
          {
            spanId: 'span-root',
            node: 'hubu_search',
            at: '2026-04-19T10:00:00.000Z',
            summary: '户部收集证据',
            status: 'success',
            latencyMs: 1200,
            modelUsed: 'gpt-5.4'
          },
          {
            spanId: 'span-child',
            parentSpanId: 'span-root',
            node: 'gongbu_execute',
            at: '2026-04-19T10:01:00.000Z',
            summary: '工部执行方案回退到后备模型',
            status: 'failed',
            latencyMs: 3200,
            modelUsed: 'gpt-5.4-mini',
            isFallback: true,
            fallbackReason: 'budget guard triggered'
          }
        ],
        activeInterrupt: {
          id: 'interrupt-1',
          kind: 'approval',
          status: 'pending',
          reason: 'High-risk command requires approval',
          intent: '执行生产环境回滚脚本',
          toolName: 'terminal',
          requestedBy: 'gongbu',
          createdAt: '2026-04-19T10:02:00.000Z'
        },
        interruptHistory: [
          {
            id: 'interrupt-0',
            kind: 'approval',
            status: 'resolved',
            reason: '需要先确认诊断范围',
            createdAt: '2026-04-19T10:01:30.000Z',
            updatedAt: '2026-04-19T10:01:40.000Z'
          }
        ],
        externalSources: [
          {
            id: 'ev-1',
            title: 'CI Retry Storm',
            summary: 'CI log indicates a retry storm',
            sourceType: 'runtime-log',
            trustClass: 'verified',
            createdAt: '2026-04-19T10:00:30.000Z'
          }
        ],
        learningEvaluation: {
          governanceWarnings: ['Need stronger evidence before auto delivery']
        }
      } as never,
      {
        checkpointId: 'cp-1',
        sessionId: 'session-1',
        taskId: 'task-1',
        recoverability: 'safe',
        currentNode: 'approval_interrupt',
        currentWorker: 'worker-1',
        currentMinistry: 'gongbu',
        graphState: {
          status: 'failed',
          currentStep: 'approval_interrupt'
        },
        pendingApprovals: [{ id: 'approval-1' }],
        agentStates: [{ id: 'agent-1' }],
        thoughtChain: [{ title: '等待审批' }],
        externalSources: [{ id: 'ev-1', summary: 'CI log indicates a retry storm' }],
        createdAt: '2026-04-19T10:02:30.000Z',
        updatedAt: '2026-04-19T10:02:45.000Z'
      } as never
    );

    expect(bundle.run).toMatchObject({
      taskId: 'task-1',
      currentStage: 'interrupt',
      executionMode: 'execute',
      interactionKind: 'approval',
      hasInterrupt: true,
      hasFallback: true,
      hasRecoverableCheckpoint: true,
      diagnosticFlags: expect.arrayContaining(['approval_blocked', 'fallback', 'recoverable_failure'])
    });
    expect(bundle.timeline.map(item => item.stage)).toEqual(['research', 'execution', 'interrupt']);
    expect(bundle.traces[1]).toMatchObject({
      spanId: 'span-child',
      stage: 'execution',
      status: 'failed',
      isFallback: true
    });
    expect(bundle.checkpoints[0]).toMatchObject({
      checkpointId: 'cp-1',
      recoverable: true,
      recoverability: 'safe'
    });
    expect(bundle.interrupts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'interrupt-1',
          kind: 'approval',
          stage: 'interrupt',
          relatedCheckpointId: 'cp-1',
          relatedSpanId: 'span-child',
          title: '审批中断',
          summary: expect.stringContaining('执行生产环境回滚脚本')
        }),
        expect.objectContaining({
          id: 'interrupt-0',
          status: 'resolved',
          relatedSpanId: 'span-child'
        })
      ])
    );
    expect(bundle.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'approval_blocked',
          severity: 'warning',
          linkedCheckpointId: 'cp-1',
          linkedSpanId: 'span-child'
        }),
        expect.objectContaining({ kind: 'fallback', severity: 'warning', linkedSpanId: 'span-child' }),
        expect.objectContaining({ kind: 'recoverable_failure', severity: 'error', linkedCheckpointId: 'cp-1' }),
        expect.objectContaining({ kind: 'evidence_insufficient', severity: 'warning' })
      ])
    );
    expect(bundle.evidence).toEqual([
      expect.objectContaining({
        id: 'ev-1',
        title: 'CI Retry Storm',
        stage: 'research',
        linkedSpanId: 'span-root',
        linkedCheckpointId: 'cp-1'
      })
    ]);
  });

  it('normalizes execution mode and interaction kind from task payloads', () => {
    const bundle = buildRunBundle({
      id: 'task-2',
      goal: 'Replay the failed review stage',
      status: 'running',
      executionMode: 'planning-readonly',
      activeInterrupt: {
        id: 'interrupt-2',
        kind: 'user-input',
        status: 'pending',
        payload: {
          interactionKind: 'plan-question'
        }
      },
      createdAt: '2026-04-19T11:00:00.000Z',
      updatedAt: '2026-04-19T11:02:00.000Z'
    } as never);

    expect(bundle.run.executionMode).toBe('plan');
    expect(bundle.run.interactionKind).toBe('plan-question');
  });
});

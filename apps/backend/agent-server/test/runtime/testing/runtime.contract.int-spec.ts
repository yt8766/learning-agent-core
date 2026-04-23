import { describe, expect, it } from 'vitest';

import { collaborators, createService } from './runtime.service.test-helpers';

describe('Runtime canonical contract', () => {
  it('exposes canonical session checkpoint fields for chat/admin consumers', () => {
    const service = createService();
    collaborators(service).sessionCoordinator.getCheckpoint.mockReturnValue({
      sessionId: 'session-1',
      taskId: 'task-1',
      modeGateState: {
        requestedMode: 'execute',
        activeMode: 'execute',
        reason: '模式门已切到 execute，允许按角色装载全量执行能力。',
        updatedAt: '2026-03-31T00:00:00.000Z'
      },
      contextFilterState: {
        node: 'context_filter',
        status: 'completed',
        filteredContextSlice: {
          summary: '已过滤系统战报与无关历史',
          historyTraceCount: 4,
          evidenceCount: 1,
          specialistCount: 1,
          ministryCount: 2,
          compressionApplied: true,
          compressionSource: 'llm',
          compressedMessageCount: 12
        },
        audienceSlices: {
          strategy: { summary: '先整理策略约束', dispatchCount: 1 },
          ministry: { summary: '再派六部执行', dispatchCount: 1 },
          fallback: { summary: '当前无需兜底', dispatchCount: 0 }
        },
        dispatchOrder: ['strategy', 'ministry', 'fallback'],
        updatedAt: '2026-03-31T00:00:00.000Z',
        createdAt: '2026-03-31T00:00:00.000Z'
      },
      dispatches: [
        {
          taskId: 'task-1',
          subTaskId: 'sub-1',
          from: 'manager',
          to: 'research',
          kind: 'strategy',
          objective: '整理策略约束'
        }
      ],
      governanceScore: {
        ministry: 'libu-governance',
        score: 88,
        status: 'healthy',
        summary: '治理评分稳定。',
        rationale: ['刑部终审通过。'],
        recommendedLearningTargets: ['memory'],
        trustAdjustment: 'promote',
        updatedAt: '2026-03-31T00:00:00.000Z'
      },
      graphState: {
        status: 'running',
        microLoopState: {
          state: 'retrying',
          attempt: 1,
          maxAttempts: 2,
          updatedAt: '2026-03-31T00:00:00.000Z'
        }
      },
      streamStatus: {
        nodeId: 'context_filter',
        nodeLabel: '文书科',
        detail: '正在压缩历史上下文并整理给工部',
        progressPercent: 45,
        updatedAt: '2026-03-31T00:00:00.000Z'
      },
      finalReviewState: {
        node: 'final_review',
        ministry: 'xingbu-review',
        decision: 'pass',
        summary: '终审通过',
        interruptRequired: false,
        deliveryStatus: 'delivered',
        deliveryMinistry: 'libu-delivery',
        createdAt: '2026-03-31T00:00:00.000Z',
        updatedAt: '2026-03-31T00:00:00.000Z'
      },
      traceCursor: 12,
      recoverability: 'partial',
      updatedAt: '2026-03-31T00:00:00.000Z'
    });

    expect(service.getSessionCheckpoint('session-1')).toEqual(
      expect.objectContaining({
        sessionId: 'session-1',
        taskId: 'task-1',
        modeGateState: expect.objectContaining({ activeMode: 'execute' }),
        contextFilterState: expect.objectContaining({
          dispatchOrder: ['strategy', 'ministry', 'fallback'],
          filteredContextSlice: expect.objectContaining({
            compressionApplied: true,
            compressionSource: 'llm',
            compressedMessageCount: 12
          }),
          audienceSlices: expect.objectContaining({
            strategy: expect.objectContaining({ dispatchCount: 1 })
          })
        }),
        streamStatus: expect.objectContaining({ nodeLabel: '文书科' }),
        dispatches: [expect.objectContaining({ kind: 'strategy' })],
        governanceScore: expect.objectContaining({ score: 88, trustAdjustment: 'promote' }),
        finalReviewState: expect.objectContaining({ decision: 'pass', deliveryStatus: 'delivered' }),
        graphState: expect.objectContaining({
          status: 'running',
          microLoopState: expect.objectContaining({ state: 'retrying', attempt: 1 })
        }),
        traceCursor: expect.any(Number),
        recoverability: expect.any(String)
      })
    );
  });

  it('keeps runtime/approvals/evals exports on canonical column names', async () => {
    const service = createService();

    const runtimeExport = await service.exportRuntimeCenter({
      days: 7,
      executionMode: 'plan',
      interactionKind: 'plan-question',
      format: 'csv'
    });
    const approvalsExport = await service.exportApprovalsCenter({
      executionMode: 'plan',
      interactionKind: 'plan-question',
      format: 'csv'
    });
    const evalsExport = await service.exportEvalsCenter({ days: 7, format: 'csv' });

    expect(runtimeExport.content).toContain(
      'taskId,status,executionMode,currentMinistry,requestedBy,interruptSource,interactionKind,currentWorker,selectedAgents,selectionSources,streamNode,streamDetail,streamProgressPercent,compressionApplied,compressionSource,compressedMessageCount,updatedAt'
    );
    expect(approvalsExport.content).toContain(
      'taskId,status,executionMode,currentMinistry,requestedBy,interruptSource,interactionKind,currentWorker,selectedAgents,selectionSources,intent,toolName,riskLevel,reason,commandPreview,riskReason,riskCode,approvalScope,policyMatchStatus,policyMatchSource,lastStreamStatusAt'
    );
    expect(evalsExport.content).toContain('day,runCount,passCount,passRate');
  });
});

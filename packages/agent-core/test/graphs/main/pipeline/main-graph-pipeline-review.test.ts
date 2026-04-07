import { describe, expect, it, vi } from 'vitest';

import { AgentRole, TaskStatus, type TaskRecord } from '@agent/shared';

import { runReviewStage } from '../../../../src/flows/ministries/review-stage-nodes';

function createTask(): TaskRecord {
  const now = '2026-03-31T00:00:00.000Z';
  return {
    id: 'task-review-1',
    goal: '完成终审链回归',
    status: TaskStatus.RUNNING,
    trace: [],
    messages: [],
    approvals: [],
    agentStates: [],
    checkpoints: [],
    externalSources: [
      {
        id: 'src-1',
        taskId: 'task-review-1',
        sourceId: 'doc-1',
        sourceType: 'document',
        summary: '来自藏经阁的文档证据',
        createdAt: now,
        fetchedAt: now
      } as never
    ],
    capabilityAttachments: [
      {
        id: 'skill:test',
        displayName: 'Test Capability',
        kind: 'skill',
        owner: {
          ownerType: 'runtime-derived',
          ownerId: 'runtime',
          capabilityType: 'skill',
          scope: 'task',
          trigger: 'workflow_required'
        },
        enabled: true,
        createdAt: now,
        updatedAt: now
      }
    ] as never,
    createdAt: now,
    updatedAt: now,
    queueState: {
      mode: 'foreground',
      backgroundRun: false,
      status: 'running',
      enqueuedAt: now,
      lastTransitionAt: now,
      attempt: 1
    }
  } as unknown as TaskRecord;
}

function createCallbacks(task: TaskRecord) {
  return {
    ensureTaskNotCancelled: vi.fn(),
    syncTaskRuntime: vi.fn(),
    markSubgraph: vi.fn(),
    markWorkerUsage: vi.fn(),
    addTrace: vi.fn((currentTask: TaskRecord, node: string, summary: string, data?: Record<string, unknown>) => {
      currentTask.trace.push({ node, at: '2026-03-31T00:00:00.000Z', summary, data } as never);
    }),
    addProgressDelta: vi.fn(),
    addMessage: vi.fn(
      (currentTask: TaskRecord, type: 'review_result' | 'summary', content: string, from: AgentRole) => {
        currentTask.messages.push({
          id: `${type}-${currentTask.messages.length + 1}`,
          taskId: currentTask.id,
          type,
          content,
          from,
          to: AgentRole.MANAGER,
          createdAt: '2026-03-31T00:00:00.000Z'
        } as never);
      }
    ),
    upsertAgentState: vi.fn(),
    persistAndEmitTask: vi.fn(async () => undefined),
    transitionQueueState: vi.fn((currentTask: TaskRecord, status: TaskRecord['queueState']['status']) => {
      currentTask.queueState = {
        ...(currentTask.queueState as NonNullable<TaskRecord['queueState']>),
        status
      };
    }),
    resolveReviewMinistry: vi.fn(() => 'xingbu-review' as const),
    getMinistryLabel: vi.fn(() => '刑部'),
    reviewExecution: vi.fn(),
    persistReviewArtifacts: vi.fn(async () => undefined),
    enqueueTaskLearning: vi.fn(),
    shouldRunLibuDocsDelivery: vi.fn(() => true),
    buildFreshnessSourceSummary: vi.fn(() => 'freshness'),
    buildCitationSourceSummary: vi.fn(() => 'citations'),
    appendDiagnosisEvidence: vi.fn()
  };
}

describe('main-graph-pipeline-review', () => {
  it('passes Critic -> Xingbu -> Libu and emits governance report plus capability trust', async () => {
    const task = createTask();
    const callbacks = createCallbacks(task);
    callbacks.reviewExecution.mockResolvedValue({
      review: {
        taskId: task.id,
        decision: 'approved',
        notes: [],
        createdAt: '2026-03-31T00:00:00.000Z'
      },
      evaluation: {
        success: true,
        score: 91,
        shouldRetry: false,
        shouldWriteMemory: true,
        shouldCreateRule: false,
        shouldExtractSkill: true,
        notes: ['终审通过']
      },
      critiqueResult: {
        decision: 'pass',
        summary: '刑部审查通过。',
        blockingIssues: [],
        constraints: [],
        evidenceRefs: ['src-1']
      },
      contractMeta: {
        contractName: 'review-decision',
        contractVersion: 'review-decision.v1',
        parseStatus: 'success',
        fallbackUsed: false
      }
    });

    const libu = {
      finalize: vi.fn(async () => '最终答复'),
      getState: vi.fn(() => ({ role: AgentRole.MANAGER, status: 'completed' }))
    };
    const libuDocs = {
      buildDelivery: vi.fn(() => '礼部整理交付文书。')
    };

    const next = await runReviewStage(
      task,
      task.goal,
      {
        retryCount: 0,
        maxRetries: 2,
        executionSummary: '执行完成',
        executionResult: { summary: '执行完成' }
      } as any,
      libu as any,
      libuDocs as any,
      {} as any,
      callbacks as any
    );

    expect(next.shouldRetry).toBe(false);
    expect(task.criticState).toEqual(expect.objectContaining({ decision: 'pass_through' }));
    expect(task.finalReviewState).toEqual(expect.objectContaining({ decision: 'pass', deliveryStatus: 'delivered' }));
    expect(task.status).toBe(TaskStatus.COMPLETED);
    expect(task.governanceScore).toEqual(expect.objectContaining({ status: 'healthy' }));
    expect(task.governanceReport).toEqual(
      expect.objectContaining({
        reviewOutcome: expect.objectContaining({ decision: 'pass' }),
        recommendedLearningTargets: expect.arrayContaining(['memory', 'skill'])
      })
    );
    expect(task.capabilityAttachments?.[0]?.capabilityTrust).toEqual(
      expect.objectContaining({
        trustLevel: 'high',
        trustTrend: 'up'
      })
    );
    expect(task.capabilityAttachments?.[0]?.governanceProfile).toEqual(
      expect.objectContaining({
        reportCount: 1,
        promoteCount: 1,
        holdCount: 0,
        downgradeCount: 0,
        passCount: 1,
        lastTaskId: task.id,
        lastReviewDecision: 'pass',
        lastTrustAdjustment: 'promote'
      })
    );
  });

  it('forces rewrite_required to return through DispatchPlanner instead of delivering directly', async () => {
    const task = createTask();
    const callbacks = createCallbacks(task);
    callbacks.reviewExecution.mockResolvedValue({
      review: {
        taskId: task.id,
        decision: 'approved',
        notes: ['仍需修订'],
        createdAt: '2026-03-31T00:00:00.000Z'
      },
      evaluation: {
        success: false,
        score: 62,
        shouldRetry: true,
        shouldWriteMemory: false,
        shouldCreateRule: false,
        shouldExtractSkill: false,
        notes: ['回流调度链']
      },
      critiqueResult: {
        decision: 'revise_required',
        summary: '批判层要求继续修订。',
        blockingIssues: ['需要修订证据链'],
        constraints: [],
        evidenceRefs: ['src-1']
      },
      contractMeta: {
        contractName: 'review-decision',
        contractVersion: 'review-decision.v1',
        parseStatus: 'success',
        fallbackUsed: false
      }
    });

    const next = await runReviewStage(
      task,
      task.goal,
      {
        retryCount: 0,
        maxRetries: 2,
        executionSummary: '执行完成',
        executionResult: { summary: '执行完成' }
      } as any,
      { finalize: vi.fn(), getState: vi.fn(() => ({ role: AgentRole.MANAGER, status: 'running' })) } as any,
      { buildDelivery: vi.fn() } as any,
      {} as any,
      callbacks as any
    );

    expect(next.shouldRetry).toBe(true);
    expect(next.retryCount).toBe(1);
    expect(task.criticState).toEqual(expect.objectContaining({ decision: 'rewrite_required' }));
    expect(task.mainChainNode).toBe('interrupt_controller');
    expect(task.finalReviewState).toEqual(
      expect.objectContaining({ decision: 'revise_required', deliveryStatus: 'interrupted' })
    );
    expect(task.status).toBe(TaskStatus.RUNNING);
    expect(task.result).toBeUndefined();
  });
});

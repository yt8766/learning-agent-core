import { describe, expect, it, vi, beforeEach } from 'vitest';

import { TaskStatus } from '@agent/core';

vi.mock('../../../src/bridges/supervisor-runtime-bridge', () => ({
  markExecutionStepBlocked: vi.fn(),
  markExecutionStepCompleted: vi.fn(),
  markExecutionStepStarted: vi.fn()
}));

vi.mock('../../../src/flows/ministries/governance-stage-helpers', () => ({
  applyCapabilityTrustFromGovernance: vi.fn(),
  buildGovernanceReport: vi.fn(() => ({ report: 'test' })),
  buildGovernanceScore: vi.fn(() => ({ score: 80 }))
}));

vi.mock('../../../src/flows/review-stage/review-stage-persistence', () => ({
  resolveExecutionSummaryForPersistence: vi.fn((task, summary) => ({
    summary,
    wasCompacted: false,
    compression: {
      reactiveRetryCount: 0,
      compactedCharacterCount: summary.length,
      originalCharacterCount: summary.length
    }
  }))
}));

vi.mock('../../../src/flows/review-stage/review-stage-state', () => ({
  applyReviewOutcomeState: vi.fn(task => {
    task.critiqueResult = {
      decision: 'pass',
      summary: 'review passed',
      interruptRequired: false
    };
    task.finalReviewState = {
      decision: 'pass',
      interruptRequired: false,
      summary: 'review passed',
      deliveryStatus: 'pending',
      deliveryMinistry: 'libu-delivery',
      updatedAt: new Date().toISOString()
    };
    return 'pass';
  }),
  recordReviewSpecialistFindings: vi.fn()
}));

import { runReviewStage } from '../../../src/flows/review-stage/review-stage-nodes';
import { applyReviewOutcomeState } from '../../../src/flows/review-stage/review-stage-state';

function mockReviewOutcome(overrides: Record<string, unknown>) {
  vi.mocked(applyReviewOutcomeState).mockImplementation((task: any) => {
    task.critiqueResult = {
      decision: overrides.decision ?? 'pass',
      summary: overrides.summary ?? 'review passed',
      interruptRequired: overrides.interruptRequired ?? false
    };
    task.finalReviewState = {
      decision: overrides.decision ?? 'pass',
      interruptRequired: overrides.interruptRequired ?? false,
      summary: overrides.summary ?? 'review passed',
      deliveryStatus: overrides.deliveryStatus ?? 'pending',
      deliveryMinistry: overrides.deliveryMinistry ?? 'libu-delivery',
      updatedAt: new Date().toISOString()
    };
    return overrides.decision ?? 'pass';
  });
}

function makeTask(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'task-1',
    status: TaskStatus.RUNNING,
    goal: 'test goal',
    result: 'execution result',
    currentMinistry: 'xingbu-review',
    currentWorker: 'worker-1',
    mainChainNode: undefined,
    currentNode: undefined,
    resolvedWorkflow: {
      displayName: 'general',
      requiredMinistries: ['xingbu-review'],
      outputContract: { type: 'text' }
    },
    modelRoute: [{ ministry: 'xingbu-review', workerId: 'worker-1' }],
    executionPlan: { strategyCounselors: [], executionMinistries: [] },
    revisionCount: 0,
    maxRevisions: 2,
    microLoopCount: 0,
    maxMicroLoops: 2,
    revisionState: 'idle',
    microLoopState: undefined,
    sandboxState: undefined,
    skillStage: undefined,
    evaluationReport: undefined,
    libuEvaluationReportId: undefined,
    learningEvaluation: undefined,
    governanceScore: undefined,
    governanceReport: undefined,
    backgroundLearningState: undefined,
    learningQueueItemId: undefined,
    finalReviewState: undefined,
    critiqueResult: undefined,
    approvals: [],
    trace: [],
    ...overrides
  };
}

function makeState(overrides: Record<string, unknown> = {}): any {
  return {
    retryCount: 0,
    maxRetries: 2,
    executionSummary: 'execution completed',
    executionResult: {},
    ...overrides
  };
}

function makeCallbacks(overrides: Record<string, unknown> = {}): any {
  return {
    ensureTaskNotCancelled: vi.fn(),
    syncTaskRuntime: vi.fn(),
    markSubgraph: vi.fn(),
    markWorkerUsage: vi.fn(),
    addTrace: vi.fn(),
    addProgressDelta: vi.fn(),
    addMessage: vi.fn(),
    upsertAgentState: vi.fn(),
    persistAndEmitTask: vi.fn().mockResolvedValue(undefined),
    transitionQueueState: vi.fn(),
    resolveReviewMinistry: vi.fn(() => 'xingbu-review'),
    getMinistryLabel: vi.fn(() => '刑部'),
    reviewExecution: vi.fn().mockResolvedValue({
      review: { decision: 'approved', notes: ['good'] },
      evaluation: { shouldRetry: false, notes: ['well done'], score: 90 },
      contractMeta: {
        contractName: 'review-decision',
        contractVersion: 'review-decision.v1',
        parseStatus: 'success',
        fallbackUsed: false
      }
    }),
    persistReviewArtifacts: vi.fn().mockResolvedValue(undefined),
    enqueueTaskLearning: vi.fn(),
    shouldRunLibuDocsDelivery: vi.fn(() => false),
    buildFreshnessSourceSummary: vi.fn(() => 'fresh sources'),
    buildCitationSourceSummary: vi.fn(() => 'citations'),
    appendDiagnosisEvidence: vi.fn(),
    ...overrides
  };
}

function makeLibu() {
  return {
    finalize: vi.fn().mockResolvedValue('final answer'),
    getState: vi.fn(() => ({ state: 'libu' })),
    review: vi.fn(() => ({
      review: { decision: 'approved', notes: ['good'] },
      evaluation: { shouldRetry: false, notes: ['well done'], score: 90 }
    })),
    buildDelivery: vi.fn(() => 'delivery summary')
  };
}

function makeXingbu() {
  return {
    review: vi.fn()
  };
}

describe('runReviewStage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default mock implementation
    vi.mocked(applyReviewOutcomeState).mockImplementation((task: any) => {
      task.critiqueResult = {
        decision: 'pass',
        summary: 'review passed',
        interruptRequired: false
      };
      task.finalReviewState = {
        decision: 'pass',
        interruptRequired: false,
        summary: 'review passed',
        deliveryStatus: 'pending',
        deliveryMinistry: 'libu-delivery',
        updatedAt: new Date().toISOString()
      };
      return 'pass';
    });
  });

  it('runs review and returns result for approved review', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks();
    const libu = makeLibu();
    const xingbu = makeXingbu();

    const result = await runReviewStage(
      task,
      'test goal',
      makeState(),
      libu as any,
      {} as any,
      xingbu as any,
      callbacks
    );

    expect(result.currentStep).toBe('review');
    expect(result.reviewDecision).toBe('approved');
    expect(result.shouldRetry).toBe(false);
    expect(result.finalAnswer).toBe('final answer');
  });

  it('sets task status to COMPLETED on approved review', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks();
    const libu = makeLibu();
    const xingbu = makeXingbu();

    await runReviewStage(task, 'test goal', makeState(), libu as any, {} as any, xingbu as any, callbacks);

    expect(task.status).toBe(TaskStatus.COMPLETED);
    expect(task.skillStage).toBe('completed');
  });

  it('sets task status to FAILED on rejected review', async () => {
    const callbacks = makeCallbacks({
      reviewExecution: vi.fn().mockResolvedValue({
        review: { decision: 'rejected', notes: ['needs work'] },
        evaluation: { shouldRetry: false, notes: ['rejected'], score: 30 },
        contractMeta: { parseStatus: 'success', fallbackUsed: false }
      })
    });
    mockReviewOutcome({ decision: 'block', interruptRequired: true, summary: 'blocked' });

    const task = makeTask();
    const libu = makeLibu();
    const xingbu = makeXingbu();

    const result = await runReviewStage(
      task,
      'test goal',
      makeState(),
      libu as any,
      {} as any,
      xingbu as any,
      callbacks
    );

    expect(task.status).toBe(TaskStatus.FAILED);
  });

  it('retries when shouldRetry is true and within limits', async () => {
    const callbacks = makeCallbacks({
      reviewExecution: vi.fn().mockResolvedValue({
        review: { decision: 'needs_revision', notes: ['improve'] },
        evaluation: { shouldRetry: true, notes: ['retry needed'], score: 60 },
        contractMeta: { parseStatus: 'success', fallbackUsed: false }
      })
    });
    mockReviewOutcome({ decision: 'revise_required', summary: 'revision needed' });

    const task = makeTask();
    const libu = makeLibu();
    const xingbu = makeXingbu();
    const state = makeState({ retryCount: 0, maxRetries: 2 });

    const result = await runReviewStage(task, 'test goal', state, libu as any, {} as any, xingbu as any, callbacks);

    expect(result.shouldRetry).toBe(true);
    expect(result.retryCount).toBe(1);
    expect(task.revisionState).toBe('revising');
  });

  it('blocks when max retries exceeded', async () => {
    const callbacks = makeCallbacks({
      reviewExecution: vi.fn().mockResolvedValue({
        review: { decision: 'needs_revision', notes: ['improve'] },
        evaluation: { shouldRetry: true, notes: ['retry needed'], score: 60 },
        contractMeta: { parseStatus: 'success', fallbackUsed: false }
      })
    });
    mockReviewOutcome({ decision: 'revise_required', summary: 'revision needed' });

    const task = makeTask();
    const libu = makeLibu();
    const xingbu = makeXingbu();
    const state = makeState({ retryCount: 2, maxRetries: 2 });

    const result = await runReviewStage(task, 'test goal', state, libu as any, {} as any, xingbu as any, callbacks);

    expect(task.revisionState).toBe('blocked');
    expect(result.finalAnswer).toBeDefined();
  });

  it('uses libuDocs for review when ministry is libu-delivery', async () => {
    const callbacks = makeCallbacks({ resolveReviewMinistry: () => 'libu-delivery' });
    const libu = makeLibu();
    const libuDocs = {
      review: vi.fn(() => ({
        review: { decision: 'approved', notes: ['good'] },
        evaluation: { shouldRetry: false, notes: ['ok'], score: 80 }
      })),
      buildDelivery: vi.fn(() => 'docs delivery'),
      getState: vi.fn(() => ({ state: 'docs' }))
    };

    const task = makeTask();
    const result = await runReviewStage(
      task,
      'test goal',
      makeState(),
      libu as any,
      libuDocs as any,
      {} as any,
      callbacks
    );

    expect(libuDocs.review).toHaveBeenCalled();
    expect(result.currentStep).toBe('review');
  });

  it('handles micro-loop exhaustion', async () => {
    const callbacks = makeCallbacks({
      reviewExecution: vi.fn().mockResolvedValue({
        review: { decision: 'needs_revision', notes: ['improve'] },
        evaluation: { shouldRetry: true, notes: ['retry'], score: 60 },
        contractMeta: { parseStatus: 'success', fallbackUsed: false }
      })
    });
    mockReviewOutcome({ decision: 'revise_required', summary: 'revision needed' });

    const task = makeTask({ microLoopCount: 2, maxMicroLoops: 2 });
    const state = makeState({ retryCount: 2, maxRetries: 2 });

    await runReviewStage(task, 'test goal', state, makeLibu() as any, {} as any, makeXingbu() as any, callbacks);

    expect(task.revisionState).toBe('blocked');
    expect(task.microLoopState?.state).toBe('exhausted');
  });

  it('builds evaluation report', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks();
    await runReviewStage(task, 'test goal', makeState(), makeLibu() as any, {} as any, makeXingbu() as any, callbacks);

    expect(task.evaluationReport).toBeDefined();
    expect(task.evaluationReport.ministry).toBe('libu-governance');
    expect(task.governanceScore).toBeDefined();
    expect(task.governanceReport).toBeDefined();
  });

  it('adds guard note when max revisions exceeded', async () => {
    const callbacks = makeCallbacks({
      reviewExecution: vi.fn().mockResolvedValue({
        review: { decision: 'needs_revision', notes: ['improve'] },
        evaluation: { shouldRetry: true, notes: ['retry'], score: 60 },
        contractMeta: { parseStatus: 'success', fallbackUsed: false }
      })
    });
    mockReviewOutcome({ decision: 'revise_required', summary: 'revision needed' });

    const task = makeTask({ revisionCount: 2, maxRevisions: 2 });
    const state = makeState({ retryCount: 2, maxRetries: 2 });

    await runReviewStage(task, 'test goal', state, makeLibu() as any, {} as any, makeXingbu() as any, callbacks);

    expect(task.result).toContain('核心审查未通过');
  });

  it('runs docs delivery when finalReviewState is pass and libuDocs is needed', async () => {
    const callbacks = makeCallbacks({
      shouldRunLibuDocsDelivery: () => true,
      resolveReviewMinistry: () => 'libu-delivery'
    });
    const libu = makeLibu();
    const libuDocs = {
      review: vi.fn(() => ({
        review: { decision: 'approved', notes: ['good'] },
        evaluation: { shouldRetry: false, notes: ['ok'], score: 80 }
      })),
      buildDelivery: vi.fn(() => 'delivery docs summary'),
      getState: vi.fn(() => ({ state: 'docs' }))
    };

    const task = makeTask({
      resolvedWorkflow: {
        displayName: 'general',
        requiredMinistries: ['libu-delivery'],
        outputContract: { type: 'text' }
      }
    });
    await runReviewStage(task, 'test goal', makeState(), libu as any, libuDocs as any, {} as any, callbacks);

    expect(libuDocs.buildDelivery).toHaveBeenCalled();
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockRunTaskPipeline = vi.fn().mockResolvedValue(undefined);
const mockRunApprovalRecovery = vi.fn().mockResolvedValue(undefined);
const mockBuildBootstrapGraph = vi.fn(() => ({
  invoke: vi.fn().mockResolvedValue({})
}));

vi.mock('@langchain/langgraph', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    Command: class Command {
      constructor(public data: unknown) {}
    }
  };
});

vi.mock('../../../../../../src/graphs/main/execution/orchestration/pipeline/main-graph-pipeline-orchestrator', () => ({
  runTaskPipelineWithGraph: vi.fn((...args: any[]) => mockRunTaskPipeline(...args)),
  runApprovalRecoveryPipelineWithGraph: vi.fn((...args: any[]) => mockRunApprovalRecovery(...args))
}));

vi.mock('../../../../../../src/graphs/main/execution/pipeline/task-bootstrap-interrupt-graph', () => ({
  buildTaskBootstrapInterruptGraph: vi.fn((...args: any[]) => mockBuildBootstrapGraph(...args))
}));

import { MainGraphBridge } from '../../../../../../src/graphs/main/execution/orchestration/bridge/main-graph-bridge';
import { runTaskPipelineWithGraph } from '../../../../../../src/graphs/main/execution/orchestration/pipeline/main-graph-pipeline-orchestrator';

function makeBridgeParams(overrides: Record<string, unknown> = {}): any {
  return {
    pendingExecutions: new Map(),
    llmConfigured: vi.fn(() => true),
    sourcePolicyMode: vi.fn(() => undefined),
    lifecycle: {
      persistAndEmitTask: vi.fn().mockResolvedValue(undefined),
      describeActionIntent: vi.fn(() => 'test action'),
      resolveRuntimeSkillIntervention: vi.fn(),
      resolveSkillInstallInterruptResume: vi.fn(),
      buildFreshnessSourceSummary: vi.fn(),
      buildCitationSourceSummary: vi.fn(),
      appendDiagnosisEvidence: vi.fn(),
      enqueueTaskLearning: vi.fn(),
      recordAgentError: vi.fn(),
      getPreExecutionSkillInterventionResolver: vi.fn(() => undefined)
    },
    learningFlow: {
      persistReviewArtifacts: vi.fn().mockResolvedValue(undefined)
    },
    taskDrafts: {
      buildMemoryRecord: vi.fn(() => ({ id: 'mem-1' })),
      buildRuleRecord: vi.fn(() => ({ id: 'rule-1' })),
      buildSkillDraft: vi.fn(() => ({ id: 'skill-1' }))
    },
    taskContextRuntime: {
      createAgentContext: vi.fn(() => ({ context: 'test' }))
    },
    runtime: {
      markWorkerUsage: vi.fn(),
      markSubgraph: vi.fn(),
      attachTool: vi.fn(),
      recordToolUsage: vi.fn(),
      shouldRunLibuDocsDelivery: vi.fn(() => false),
      resolveTaskFlow: vi.fn(() => ({ flow: 'full-pipeline' })),
      resolveWorkflowRoutes: vi.fn(() => []),
      recordDispatches: vi.fn(),
      syncTaskRuntime: vi.fn(),
      updateBudgetState: vi.fn(),
      createQueueState: vi.fn(() => ({ status: 'queued' })),
      transitionQueueState: vi.fn(),
      addMessage: vi.fn(),
      addProgressDelta: vi.fn(),
      upsertAgentState: vi.fn(),
      setSubTaskStatus: vi.fn(),
      addTrace: vi.fn(),
      ensureTaskNotCancelled: vi.fn()
    },
    executionHelpers: {
      runApprovalRecoveryPipeline: vi.fn().mockResolvedValue(undefined),
      createGraphStartState: vi.fn(() => ({})),
      reviewExecution: vi.fn(),
      resolveResearchMinistry: vi.fn(() => 'hubu-search'),
      resolveExecutionMinistry: vi.fn(() => 'gongbu-code'),
      resolveReviewMinistry: vi.fn(() => 'xingbu-review'),
      getMinistryLabel: vi.fn(() => 'test'),
      runDirectReplyTask: vi.fn().mockResolvedValue(undefined)
    },
    graphCheckpointer: {},
    graphStore: {},
    ...overrides
  };
}

function makeTask(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'task-1',
    runId: 'run-1',
    trace: [],
    ...overrides
  };
}

describe('MainGraphBridge', () => {
  let bridge: MainGraphBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRunTaskPipeline.mockResolvedValue(undefined);
    mockRunApprovalRecovery.mockResolvedValue(undefined);
    bridge = new MainGraphBridge(makeBridgeParams());
  });

  it('delegates runTaskPipeline to runTaskPipelineWithGraph', async () => {
    const task = makeTask();
    const dto = { goal: 'test goal' } as any;

    await bridge.runTaskPipeline(task, dto, { mode: 'initial' });

    expect(runTaskPipelineWithGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        task,
        dto,
        options: { mode: 'initial' }
      })
    );
  });

  it('delegates markWorkerUsage to runtime', () => {
    const task = makeTask();
    bridge.markWorkerUsage(task, 'worker-1');
    expect(bridge['params'].runtime.markWorkerUsage).toHaveBeenCalledWith(task, 'worker-1');
  });

  it('delegates markSubgraph to runtime', () => {
    const task = makeTask();
    bridge.markSubgraph(task, 'research');
    expect(bridge['params'].runtime.markSubgraph).toHaveBeenCalledWith(task, 'research');
  });

  it('delegates shouldRunLibuDocsDelivery to runtime', () => {
    bridge.shouldRunLibuDocsDelivery({ requiredMinistries: ['libu-delivery'] } as any);
    expect(bridge['params'].runtime.shouldRunLibuDocsDelivery).toHaveBeenCalled();
  });

  it('resolves graph thread id from task.runId', () => {
    const task = makeTask({ runId: 'run-1' });
    expect(bridge.resolveGraphThreadId(task)).toBe('run-1');
  });

  it('falls back to task.id for graph thread id', () => {
    const task = makeTask({ runId: undefined });
    expect(bridge.resolveGraphThreadId(task)).toBe('task-1');
  });

  it('delegates createAgentContext to taskContextRuntime', () => {
    bridge.createAgentContext('task-1', 'goal', 'chat');
    expect(bridge['params'].taskContextRuntime.createAgentContext).toHaveBeenCalledWith('task-1', 'goal', 'chat');
  });

  it('delegates buildMemoryRecord to taskDrafts', () => {
    const result = bridge.buildMemoryRecord('task-1', 'goal', {} as any, {} as any, 'summary');
    expect(bridge['params'].taskDrafts.buildMemoryRecord).toHaveBeenCalled();
    expect(result).toEqual({ id: 'mem-1' });
  });

  it('delegates buildRuleRecord to taskDrafts', () => {
    const result = bridge.buildRuleRecord('task-1', 'summary');
    expect(bridge['params'].taskDrafts.buildRuleRecord).toHaveBeenCalled();
    expect(result).toEqual({ id: 'rule-1' });
  });

  it('delegates buildSkillDraft to taskDrafts', () => {
    const result = bridge.buildSkillDraft('goal', 'execution');
    expect(bridge['params'].taskDrafts.buildSkillDraft).toHaveBeenCalled();
    expect(result).toEqual({ id: 'skill-1' });
  });

  it('delegates transitionQueueState to runtime', () => {
    const task = makeTask();
    bridge.transitionQueueState(task, 'running');
    expect(bridge['params'].runtime.transitionQueueState).toHaveBeenCalledWith(task, 'running');
  });

  it('delegates addMessage to runtime', () => {
    const task = makeTask();
    bridge.addMessage(task, 'research_result', 'content', 'research');
    expect(bridge['params'].runtime.addMessage).toHaveBeenCalled();
  });

  it('delegates addProgressDelta to runtime', () => {
    const task = makeTask();
    bridge.addProgressDelta(task, 'progress');
    expect(bridge['params'].runtime.addProgressDelta).toHaveBeenCalled();
  });

  it('delegates ensureTaskNotCancelled to runtime', () => {
    const task = makeTask();
    bridge.ensureTaskNotCancelled(task);
    expect(bridge['params'].runtime.ensureTaskNotCancelled).toHaveBeenCalledWith(task);
  });

  it('delegates resolveResearchMinistry to executionHelpers', () => {
    const task = makeTask();
    bridge.resolveResearchMinistry(task);
    expect(bridge['params'].executionHelpers.resolveResearchMinistry).toHaveBeenCalledWith(task, undefined);
  });

  it('delegates resolveExecutionMinistry to executionHelpers', () => {
    const task = makeTask();
    bridge.resolveExecutionMinistry(task);
    expect(bridge['params'].executionHelpers.resolveExecutionMinistry).toHaveBeenCalledWith(task, undefined);
  });

  it('delegates resolveReviewMinistry to executionHelpers', () => {
    const task = makeTask();
    bridge.resolveReviewMinistry(task);
    expect(bridge['params'].executionHelpers.resolveReviewMinistry).toHaveBeenCalledWith(task, undefined);
  });

  it('delegates reviewExecution to executionHelpers', () => {
    const task = makeTask();
    bridge.reviewExecution(task, {} as any, {}, 'summary');
    expect(bridge['params'].executionHelpers.reviewExecution).toHaveBeenCalled();
  });

  it('delegates runDirectReplyTask to executionHelpers', async () => {
    const task = makeTask();
    await bridge.runDirectReplyTask(task, {} as any);
    expect(bridge['params'].executionHelpers.runDirectReplyTask).toHaveBeenCalled();
  });

  it('delegates recordDispatches to runtime', () => {
    const task = makeTask();
    bridge.recordDispatches(task, []);
    expect(bridge['params'].runtime.recordDispatches).toHaveBeenCalled();
  });

  it('delegates syncTaskRuntime to runtime', () => {
    const task = makeTask();
    bridge.syncTaskRuntime(task, { currentStep: 'research', retryCount: 0, maxRetries: 2 });
    expect(bridge['params'].runtime.syncTaskRuntime).toHaveBeenCalled();
  });

  it('delegates updateBudgetState to runtime', () => {
    const task = makeTask();
    bridge.updateBudgetState(task, {});
    expect(bridge['params'].runtime.updateBudgetState).toHaveBeenCalled();
  });

  it('delegates createQueueState to runtime', () => {
    bridge.createQueueState('sess-1', '2026-05-10');
    expect(bridge['params'].runtime.createQueueState).toHaveBeenCalled();
  });

  it('delegates upsertAgentState to runtime', () => {
    const task = makeTask();
    bridge.upsertAgentState(task, {} as any);
    expect(bridge['params'].runtime.upsertAgentState).toHaveBeenCalled();
  });

  it('delegates setSubTaskStatus to runtime', () => {
    const task = makeTask();
    bridge.setSubTaskStatus(task, 'executor', 'completed');
    expect(bridge['params'].runtime.setSubTaskStatus).toHaveBeenCalled();
  });

  it('delegates addTrace to runtime', () => {
    const task = makeTask();
    bridge.addTrace(task.trace, 'node', 'summary');
    expect(bridge['params'].runtime.addTrace).toHaveBeenCalled();
  });
});

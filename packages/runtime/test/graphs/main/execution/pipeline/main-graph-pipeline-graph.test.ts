import { describe, expect, it, vi } from 'vitest';

const mockCompile = vi.fn(() => 'compiled-graph');
const mockCreateAgentGraph = vi.fn(() => ({ compile: mockCompile }));

vi.mock('../../../../../src/flows/review-stage/review-stage-nodes', () => ({
  runReviewStage: vi.fn().mockResolvedValue({ currentStep: 'review' })
}));

vi.mock('../../../../../src/flows/runtime-stage/runtime-stage-nodes', () => ({
  runExecuteStage: vi.fn().mockResolvedValue({ currentStep: 'execute' }),
  runResearchStage: vi.fn().mockResolvedValue({ currentStep: 'research' })
}));

vi.mock('../../../../../src/bridges/supervisor-runtime-bridge', () => ({
  runDispatchStage: vi.fn().mockResolvedValue({ currentStep: 'dispatch' }),
  runGoalIntakeStage: vi.fn().mockResolvedValue({ currentStep: 'goal_intake' }),
  runManagerPlanStage: vi.fn().mockResolvedValue({ currentStep: 'manager_plan' }),
  runRouteStage: vi.fn().mockResolvedValue({ currentStep: 'route' })
}));

vi.mock('../../../../../src/graphs/chat/chat.graph', () => ({
  createAgentGraph: vi.fn(() => ({
    compile: vi.fn(() => 'compiled-graph')
  }))
}));

import { buildTaskPipelineGraph } from '../../../../../src/graphs/main/execution/pipeline/main-graph-pipeline-graph';
import { createAgentGraph } from '../../../../../src/graphs/chat/chat.graph';

function makeParams(overrides: Record<string, unknown> = {}): any {
  return {
    task: { id: 'task-1', result: 'test result' },
    dto: { goal: 'test goal' },
    options: { mode: 'initial' },
    libu: {},
    hubu: {},
    gongbu: {},
    bingbu: {},
    xingbu: {},
    libuDocs: {},
    pendingExecutions: new Map(),
    llmConfigured: true,
    sourcePolicyMode: undefined,
    callbacks: {
      ensureTaskNotCancelled: vi.fn(),
      syncTaskRuntime: vi.fn(),
      markSubgraph: vi.fn(),
      markWorkerUsage: vi.fn(),
      attachTool: vi.fn(),
      recordToolUsage: vi.fn(),
      addTrace: vi.fn(),
      addProgressDelta: vi.fn(),
      setSubTaskStatus: vi.fn(),
      addMessage: vi.fn(),
      upsertAgentState: vi.fn(),
      persistAndEmitTask: vi.fn().mockResolvedValue(undefined),
      updateBudgetState: vi.fn(),
      recordDispatches: vi.fn(),
      transitionQueueState: vi.fn(),
      registerPendingExecution: vi.fn(),
      resolveWorkflowRoutes: vi.fn(),
      resolveResearchMinistry: vi.fn(),
      resolveExecutionMinistry: vi.fn(),
      resolveReviewMinistry: vi.fn(),
      getMinistryLabel: vi.fn(),
      describeActionIntent: vi.fn(),
      createAgentContext: vi.fn(),
      reviewExecution: vi.fn(),
      persistReviewArtifacts: vi.fn(),
      enqueueTaskLearning: vi.fn(),
      shouldRunLibuDocsDelivery: vi.fn(),
      buildFreshnessSourceSummary: vi.fn(),
      buildCitationSourceSummary: vi.fn(),
      appendDiagnosisEvidence: vi.fn(),
      resolveRuntimeSkillIntervention: vi.fn(),
      resolveSkillInstallInterruptResume: vi.fn()
    },
    checkpointer: {},
    store: {},
    ...overrides
  };
}

describe('buildTaskPipelineGraph', () => {
  it('creates and compiles a graph', () => {
    const result = buildTaskPipelineGraph(makeParams());
    expect(result).toBe('compiled-graph');
  });

  it('calls createAgentGraph with all node functions', () => {
    buildTaskPipelineGraph(makeParams());

    expect(createAgentGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        goalIntake: expect.any(Function),
        route: expect.any(Function),
        managerPlan: expect.any(Function),
        dispatch: expect.any(Function),
        research: expect.any(Function),
        execute: expect.any(Function),
        review: expect.any(Function),
        finish: expect.any(Function)
      })
    );
  });

  it('calls compile with checkpointer and store', () => {
    const params = makeParams();
    buildTaskPipelineGraph(params);

    const compileMock = (createAgentGraph as any).mock.results[0]?.value?.compile;
    if (compileMock) {
      expect(compileMock).toHaveBeenCalledWith({
        checkpointer: params.checkpointer,
        store: params.store
      });
    }
  });
});

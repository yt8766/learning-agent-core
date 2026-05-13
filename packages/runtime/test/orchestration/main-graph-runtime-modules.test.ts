import { describe, expect, it, vi } from 'vitest';

vi.mock('@agent/config', () => ({
  loadSettings: vi.fn().mockReturnValue({})
}));

vi.mock('@agent/adapters', () => ({
  createRuntimeEmbeddingProvider: vi.fn().mockReturnValue({})
}));

vi.mock('@agent/tools', () => ({
  createDefaultToolRegistry: vi.fn().mockReturnValue({ tools: [] }),
  ToolRegistry: vi.fn()
}));

vi.mock('../../src/flows/learning', () => ({
  LearningFlow: class MockLearningFlow {}
}));

vi.mock('../../src/governance/worker-registry', () => ({
  createDefaultWorkerRegistry: vi.fn().mockReturnValue({ workers: [] }),
  WorkerRegistry: class MockWorkerRegistry {}
}));

vi.mock('../../src/governance/model-routing-policy', () => ({
  ModelRoutingPolicy: class MockModelRoutingPolicy {}
}));

vi.mock('../../src/graphs/main/runtime/background/main-graph-background', () => ({
  MainGraphBackgroundRuntime: class MockMainGraphBackgroundRuntime {}
}));

vi.mock('../../src/graphs/main/runtime/background/main-graph-learning-jobs', () => ({
  MainGraphLearningJobsRuntime: class MockMainGraphLearningJobsRuntime {}
}));

vi.mock('../../src/graphs/main/runtime/lifecycle', () => ({
  MainGraphLifecycle: class MockMainGraphLifecycle {
    initialize = vi.fn().mockResolvedValue(undefined);
  }
}));

vi.mock('../../src/graphs/main/execution/orchestration/bridge', () => ({
  MainGraphBridge: class MockMainGraphBridge {}
}));

vi.mock('../../src/graphs/main/execution/orchestration/recovery', () => ({
  MainGraphExecutionHelpers: class MockMainGraphExecutionHelpers {}
}));

vi.mock('../../src/graphs/main/execution/orchestration/pipeline/main-graph-pipeline-orchestrator-graph', () => ({
  createApprovalRecoveryMinistry: vi.fn()
}));

vi.mock('../../src/graphs/main/tasking', () => ({
  MainGraphTaskContextRuntime: class MockMainGraphTaskContextRuntime {},
  MainGraphTaskDrafts: class MockMainGraphTaskDrafts {},
  MainGraphTaskFactory: class MockMainGraphTaskFactory {},
  MainGraphTaskRuntime: class MockMainGraphTaskRuntime {}
}));

vi.mock('../../src/runtime/langgraph-checkpointer', () => ({
  createLangGraphCheckpointer: vi.fn().mockReturnValue({
    checkpointer: {},
    initialize: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined)
  })
}));

vi.mock('../../src/runtime/langgraph-store', () => ({
  createLangGraphStore: vi.fn().mockReturnValue({
    store: {},
    initialize: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined)
  })
}));

import { createMainGraphRuntimeModules } from '../../src/orchestration/main-graph-runtime-modules';

function makeParams(overrides: Record<string, any> = {}) {
  return {
    dependencies: {
      memoryRepository: {},
      memorySearchService: {},
      ruleRepository: {},
      runtimeStateRepository: {},
      skillRegistry: {},
      mcpClientManager: undefined,
      toolRegistry: undefined,
      workerRegistry: undefined,
      settings: {
        langGraphCheckpointer: {},
        langGraphStore: { semanticSearch: { enabled: false } },
        embeddings: { dimensions: 0 },
        routing: {},
        zhipuThinking: { manager: {} },
        policy: {},
        profile: 'test'
      }
    },
    settings: {
      langGraphCheckpointer: {},
      langGraphStore: { semanticSearch: { enabled: false } },
      embeddings: { dimensions: 0 },
      routing: {},
      zhipuThinking: { manager: {} },
      policy: {},
      profile: 'test'
    },
    llm: { isConfigured: vi.fn().mockReturnValue(true) },
    tasks: new Map(),
    learningJobs: new Map(),
    learningQueue: new Map(),
    pendingExecutions: new Map(),
    cancelledTasks: new Set(),
    emitToken: vi.fn(),
    emitTaskUpdate: vi.fn(),
    getLocalSkillSuggestionResolver: vi.fn().mockReturnValue(undefined),
    getPreExecutionSkillInterventionResolver: vi.fn().mockReturnValue(undefined),
    getRuntimeSkillInterventionResolver: vi.fn().mockReturnValue(undefined),
    getSkillInstallApprovalResolver: vi.fn().mockReturnValue(undefined),
    ...overrides
  } as any;
}

describe('createMainGraphRuntimeModules', () => {
  it('creates all required modules', () => {
    const result = createMainGraphRuntimeModules(makeParams());

    expect(result.toolRegistry).toBeDefined();
    expect(result.workerRegistry).toBeDefined();
    expect(result.modelRoutingPolicy).toBeDefined();
    expect(result.learningFlow).toBeDefined();
    expect(result.taskFactory).toBeDefined();
    expect(result.taskDrafts).toBeDefined();
    expect(result.taskContextRuntime).toBeDefined();
    expect(result.runtime).toBeDefined();
    expect(result.backgroundRuntime).toBeDefined();
    expect(result.executionHelpers).toBeDefined();
    expect(result.learningJobsRuntime).toBeDefined();
    expect(result.lifecycle).toBeDefined();
    expect(result.bridge).toBeDefined();
  });

  it('provides checkpointer and store lifecycle functions', () => {
    const result = createMainGraphRuntimeModules(makeParams());

    expect(typeof result.initializeGraphCheckpointer).toBe('function');
    expect(typeof result.closeGraphCheckpointer).toBe('function');
    expect(typeof result.initializeGraphStore).toBe('function');
    expect(typeof result.closeGraphStore).toBe('function');
  });

  it('uses provided toolRegistry when available', () => {
    const customToolRegistry = { tools: ['custom'] };
    const params = makeParams();
    params.dependencies.toolRegistry = customToolRegistry;

    const result = createMainGraphRuntimeModules(params);
    expect(result.toolRegistry).toBe(customToolRegistry);
  });

  it('uses provided workerRegistry when available', () => {
    const customWorkerRegistry = { workers: ['custom'] };
    const params = makeParams();
    params.dependencies.workerRegistry = customWorkerRegistry;

    const result = createMainGraphRuntimeModules(params);
    expect(result.workerRegistry).toBe(customWorkerRegistry);
  });

  it('creates default registries when not provided', () => {
    const result = createMainGraphRuntimeModules(makeParams());
    expect(result.toolRegistry).toBeDefined();
    expect(result.workerRegistry).toBeDefined();
  });
});

import { LearningJob, LearningQueueItem, TaskRecord } from '@agent/shared';
import { createDefaultToolRegistry } from '@agent/tools';
import { MemorySaver } from '@langchain/langgraph';

import { LearningFlow } from '../../flows/learning';
import type { PendingExecutionContext } from '../../flows/approval';
import { createDefaultWorkerRegistry, WorkerRegistry } from '../../governance/worker-registry';
import { ModelRoutingPolicy } from '../../governance/model-routing-policy';
import { MainGraphBackgroundRuntime } from './background/main-graph-background';
import { MainGraphLearningJobsRuntime } from './background/main-graph-learning-jobs';
import { MainGraphLifecycle } from './lifecycle/main-graph-lifecycle';
import { MainGraphBridge } from './orchestration/main-graph-bridge';
import { MainGraphExecutionHelpers } from './orchestration/main-graph-execution-helpers';
import { createApprovalRecoveryMinistry } from './orchestration/main-graph-pipeline-orchestrator-graph';
import { MainGraphTaskContextRuntime } from './task/main-graph-task-context';
import { MainGraphTaskDrafts } from './task/main-graph-task-drafts';
import { MainGraphTaskFactory } from './task/main-graph-task-factory';
import { MainGraphTaskRuntime } from './task/main-graph-task-runtime';
import type {
  AgentOrchestratorDependencies,
  AgentRuntimeSettings,
  LocalSkillSuggestionResolver,
  PreExecutionSkillInterventionResolver,
  RuntimeSkillInterventionResolver,
  SkillInstallApprovalResolver
} from './main-graph.types';

interface MainGraphRuntimeModuleParams {
  dependencies: AgentOrchestratorDependencies;
  settings: AgentOrchestratorDependencies['settings'] & AgentRuntimeSettings;
  llm: AgentOrchestratorDependencies['llmProvider'];
  tasks: Map<string, TaskRecord>;
  learningJobs: Map<string, LearningJob>;
  learningQueue: Map<string, LearningQueueItem>;
  pendingExecutions: Map<string, PendingExecutionContext>;
  cancelledTasks: Set<string>;
  emitToken: (event: import('@agent/shared').AgentTokenEvent) => void;
  emitTaskUpdate: (task: TaskRecord) => void;
  getLocalSkillSuggestionResolver: () => LocalSkillSuggestionResolver | undefined;
  getPreExecutionSkillInterventionResolver: () => PreExecutionSkillInterventionResolver | undefined;
  getRuntimeSkillInterventionResolver: () => RuntimeSkillInterventionResolver | undefined;
  getSkillInstallApprovalResolver: () => SkillInstallApprovalResolver | undefined;
}

export interface MainGraphRuntimeModuleBundle {
  toolRegistry: NonNullable<AgentOrchestratorDependencies['toolRegistry']>;
  workerRegistry: WorkerRegistry;
  modelRoutingPolicy: ModelRoutingPolicy;
  learningFlow: LearningFlow;
  taskFactory: MainGraphTaskFactory;
  taskDrafts: MainGraphTaskDrafts;
  taskContextRuntime: MainGraphTaskContextRuntime;
  runtime: MainGraphTaskRuntime;
  backgroundRuntime: MainGraphBackgroundRuntime;
  executionHelpers: MainGraphExecutionHelpers;
  learningJobsRuntime: MainGraphLearningJobsRuntime;
  lifecycle: MainGraphLifecycle;
  bridge: MainGraphBridge;
}

export function createMainGraphRuntimeModules(params: MainGraphRuntimeModuleParams): MainGraphRuntimeModuleBundle {
  const toolRegistry = params.dependencies.toolRegistry ?? createDefaultToolRegistry();
  const workerRegistry = params.dependencies.workerRegistry ?? createDefaultWorkerRegistry();
  const modelRoutingPolicy = new ModelRoutingPolicy(workerRegistry);
  const graphCheckpointer = new MemorySaver();
  const refs: {
    lifecycle?: MainGraphLifecycle;
    bridge?: MainGraphBridge;
  } = {};

  const requireLifecycle = (): MainGraphLifecycle => {
    if (!refs.lifecycle) {
      throw new Error('MainGraphLifecycle is not initialized yet.');
    }
    return refs.lifecycle;
  };

  const requireBridge = (): MainGraphBridge => {
    if (!refs.bridge) {
      throw new Error('MainGraphBridge is not initialized yet.');
    }
    return refs.bridge;
  };

  const learningFlow = new LearningFlow({
    memoryRepository: params.dependencies.memoryRepository,
    memorySearchService: params.dependencies.memorySearchService,
    ruleRepository: params.dependencies.ruleRepository,
    skillRegistry: params.dependencies.skillRegistry,
    llmProvider: params.llm,
    thinking: params.settings.zhipuThinking.manager,
    settings: params.settings,
    localSkillSuggestionResolver: async task => {
      const resolver = params.getLocalSkillSuggestionResolver();
      return resolver
        ? resolver({
            goal: task.goal,
            usedInstalledSkills: task.usedInstalledSkills,
            requestedHints: task.requestedHints,
            specialistDomain: task.specialistLead?.domain
          })
        : undefined;
    }
  });

  const taskFactory: MainGraphTaskFactory = new MainGraphTaskFactory(
    params.settings,
    (...args) => requireBridge().createQueueState(...args),
    (task, node, summary, data) => requireBridge().addTrace(task.trace, node, summary, data),
    (...args) => requireBridge().addProgressDelta(...args),
    (...args) => requireBridge().markSubgraph(...args),
    (...args) => requireBridge().attachTool(...args),
    (...args) => requireBridge().recordToolUsage(...args)
  );
  const taskDrafts = new MainGraphTaskDrafts(params.tasks);
  const taskContextRuntime = new MainGraphTaskContextRuntime(
    params.dependencies,
    params.settings,
    params.llm,
    toolRegistry,
    workerRegistry,
    params.tasks,
    (task, node, summary, data) => requireBridge().addTrace(task.trace, node, summary, data, task),
    (...args) => requireBridge().updateBudgetState(...args),
    params.emitToken,
    task => requireLifecycle().persistAndEmitTask(task)
  );
  const runtime = new MainGraphTaskRuntime(
    params.dependencies,
    params.settings,
    workerRegistry,
    modelRoutingPolicy,
    params.cancelledTasks,
    task => requireLifecycle().emitTaskUpdate(task)
  );
  const backgroundRuntime: MainGraphBackgroundRuntime = new MainGraphBackgroundRuntime(
    params.tasks,
    params.pendingExecutions,
    params.cancelledTasks,
    (...args) => requireBridge().updateBudgetState(...args),
    (...args) => requireBridge().transitionQueueState(...args),
    (task, node, summary, data) => requireBridge().addTrace(task.trace, node, summary, data),
    (...args) => requireBridge().addProgressDelta(...args),
    (...args) => requireBridge().markSubgraph(...args),
    task => requireLifecycle().persistAndEmitTask(task),
    () => requireLifecycle().persistRuntimeState(),
    () => requireBridge().runBootstrapGraph.bind(requireBridge()),
    () => requireBridge().runTaskPipeline.bind(requireBridge())
  );
  const executionHelpers = new MainGraphExecutionHelpers(
    (...args) => requireBridge().createAgentContext(...args),
    task => requireLifecycle().persistAndEmitTask(task),
    (...args) => requireBridge().ensureTaskNotCancelled(...args),
    (...args) => requireBridge().syncTaskRuntime(...args),
    (...args) => requireBridge().transitionQueueState(...args),
    (...args) => requireBridge().setSubTaskStatus(...args),
    (...args) => requireBridge().upsertAgentState(...args),
    (...args) => requireBridge().addMessage(...args),
    (task, node, summary, data) => requireBridge().addTrace(task.trace, node, summary, data),
    (...args) => requireBridge().addProgressDelta(...args),
    (taskId, goal) => createApprovalRecoveryMinistry(requireBridge(), taskId, goal),
    () => requireBridge().runTaskPipeline.bind(requireBridge())
  );
  const learningJobsRuntime = new MainGraphLearningJobsRuntime(
    params.settings,
    params.learningJobs,
    learningFlow,
    params.dependencies.skillRegistry,
    params.dependencies.mcpClientManager,
    (...args) => requireBridge().buildSkillDraft(...args),
    () => requireLifecycle().persistRuntimeState()
  );

  const lifecycle = new MainGraphLifecycle({
    tasks: params.tasks,
    learningJobs: params.learningJobs,
    learningQueue: params.learningQueue,
    pendingExecutions: params.pendingExecutions,
    runtimeStateRepository: params.dependencies.runtimeStateRepository,
    memoryRepository: params.dependencies.memoryRepository,
    memorySearchService: params.dependencies.memorySearchService,
    ruleRepository: params.dependencies.ruleRepository,
    workerRegistry,
    taskFactory,
    runtime,
    backgroundRuntime,
    learningFlow,
    learningJobsRuntime,
    getLocalSkillSuggestionResolver: params.getLocalSkillSuggestionResolver,
    getPreExecutionSkillInterventionResolver: params.getPreExecutionSkillInterventionResolver,
    getRuntimeSkillInterventionResolver: params.getRuntimeSkillInterventionResolver,
    getSkillInstallApprovalResolver: params.getSkillInstallApprovalResolver,
    emitTaskUpdate: params.emitTaskUpdate,
    runBootstrapGraph: (...args) => requireBridge().runBootstrapGraph(...args),
    runTaskPipeline: (...args) => requireBridge().runTaskPipeline(...args),
    runApprovalRecoveryPipeline: (...args) => requireBridge().runApprovalRecoveryPipeline(...args),
    addTrace: (...args) => requireBridge().addTrace(...args),
    addProgressDelta: (...args) => requireBridge().addProgressDelta(...args),
    markSubgraph: (...args) => requireBridge().markSubgraph(...args),
    transitionQueueState: (...args) => requireBridge().transitionQueueState(...args),
    setSubTaskStatus: (...args) => requireBridge().setSubTaskStatus(...args),
    upsertAgentState: (...args) => requireBridge().upsertAgentState(...args),
    getMinistryLabel: (...args) => requireBridge().getMinistryLabel(...args)
  });
  refs.lifecycle = lifecycle;

  const bridge = new MainGraphBridge({
    pendingExecutions: params.pendingExecutions,
    llmConfigured: () => params.llm.isConfigured(),
    sourcePolicyMode: () => params.settings.policy?.sourcePolicyMode,
    lifecycle,
    learningFlow,
    taskDrafts,
    taskContextRuntime,
    runtime,
    executionHelpers,
    graphCheckpointer
  });
  refs.bridge = bridge;

  return {
    toolRegistry,
    workerRegistry,
    modelRoutingPolicy,
    learningFlow,
    taskFactory,
    taskDrafts,
    taskContextRuntime,
    runtime,
    backgroundRuntime,
    executionHelpers,
    learningJobsRuntime,
    lifecycle,
    bridge
  };
}

import { randomUUID } from 'node:crypto';

import { loadSettings } from '@agent/config';
import type {
  AgentExecutionState,
  AgentMessageRecord as AgentMessage,
  CapabilityOwnerType,
  ExecutionTrace,
  ModelRouteDecision,
  QueueStateRecord,
  ToolUsageSummaryRecord,
  WorkerDomain,
  WorkflowPresetDefinition
} from '@agent/core';
import { TaskStatus } from '@agent/core';
import { McpClientManager, ToolRegistry } from '@agent/tools';
import { buildWorkerSelectionPreferences } from '../../../../capabilities/capability-pool';
import { normalizeMinistryId } from '../../../../capabilities/capability-pool.shared';
import { WorkerRegistry, WorkerSelectionConstraints } from '../../../../governance/worker-registry';
import { ModelRoutingPolicy } from '../../../../governance/model-routing-policy';
import { describeConnectorProfilePolicy } from '../../../../governance/profile-policy';
import { resolveWorkflowRoute } from '../../../../bridges/supervisor-runtime-bridge';
import type { RuntimeAgentGraphState } from '../../../../types/chat-graph';
import type { MainGraphTaskAggregate as TaskRecord } from '../main-graph-task.types';
import { AgentRole } from '../task-architecture-helpers';
import type { SubgraphIdValue as SubgraphId } from '../task-architecture-helpers';
import {
  assertTaskBudgetAllowsProgress,
  createTaskQueueState,
  estimateRuntimeStepsConsumed,
  transitionTaskQueueState,
  updateTaskBudgetState
} from './main-graph-task-runtime-budget';
import {
  addRuntimeMessage,
  addRuntimeProgressDelta,
  addRuntimeTrace,
  attachRuntimeTool,
  recordRuntimeToolUsage,
  setRuntimeSubTaskStatus,
  upsertRuntimeAgentState
} from './main-graph-task-runtime-trace';
import { TaskBudgetExceededError, TaskCancelledError } from './main-graph-task-runtime-errors';

interface MainGraphTaskRuntimeDependencies {
  mcpClientManager?: McpClientManager;
  toolRegistry?: ToolRegistry;
}

type RuntimeSettings = ReturnType<typeof loadSettings> & {
  zhipuThinking: {
    manager: boolean;
    research: boolean;
    executor: boolean;
    reviewer: boolean;
  };
};

export class MainGraphTaskRuntime {
  constructor(
    private readonly dependencies: MainGraphTaskRuntimeDependencies,
    private readonly settings: RuntimeSettings,
    private readonly workerRegistry: WorkerRegistry,
    private readonly modelRoutingPolicy: ModelRoutingPolicy,
    private readonly cancelledTasks: Set<string>,
    private readonly emitTaskUpdate: (task: TaskRecord) => void
  ) {}

  markWorkerUsage(task: TaskRecord, workerId?: string) {
    if (!workerId) {
      return;
    }
    const worker = this.workerRegistry.get(workerId);
    if (!worker) {
      return;
    }
    task.connectorRefs = Array.from(new Set([...(task.connectorRefs ?? []), ...(worker.requiredConnectors ?? [])]));
    if (worker.kind === 'company') {
      task.usedCompanyWorkers = Array.from(new Set([...(task.usedCompanyWorkers ?? []), workerId]));
    }
    if (worker.kind === 'installed-skill') {
      task.usedInstalledSkills = Array.from(new Set([...(task.usedInstalledSkills ?? []), workerId]));
    }
  }

  markSubgraph(task: TaskRecord, subgraphId: SubgraphId) {
    task.subgraphTrail = Array.from(new Set([...(task.subgraphTrail ?? []), subgraphId]));
  }

  shouldRunLibuDocsDelivery(workflow?: WorkflowPresetDefinition): boolean {
    return Boolean(
      workflow?.requiredMinistries.includes('libu-delivery') || workflow?.requiredMinistries.includes('libu-docs')
    );
  }

  resolveTaskFlow(task: TaskRecord, goal: string, mode: 'initial' | 'retry' | 'approval_resume') {
    if (mode === 'approval_resume') {
      return {
        graph: 'approval-recovery' as const,
        flow: 'approval' as const,
        reason: 'approval_resume',
        adapter: 'approval-recovery' as const,
        priority: 95
      };
    }
    if (mode === 'initial' && task.chatRoute) {
      return task.chatRoute;
    }
    return resolveWorkflowRoute({
      goal,
      context: task.context,
      workflow: task.resolvedWorkflow,
      requestedMode: task.entryDecision?.requestedMode,
      requestedHints: task.requestedHints,
      capabilityAttachments: task.capabilityAttachments,
      connectorRefs: task.connectorRefs
    });
  }

  resolveWorkflowRoutes(task: TaskRecord, workflow?: WorkflowPresetDefinition): ModelRouteDecision[] {
    const ministries: WorkerDomain[] = workflow?.requiredMinistries
      ? workflow.requiredMinistries.reduce<WorkerDomain[]>((list, ministry) => {
          const normalized = normalizeMinistryId(ministry);
          if (normalized) {
            list.push(normalized);
          }
          return list;
        }, [])
      : ['libu-governance', 'hubu-search', 'gongbu-code', 'xingbu-review'];
    const selectionConstraints = this.buildWorkerSelectionConstraints(task);
    const routes = ministries
      .map(ministry =>
        this.modelRoutingPolicy.resolveRoute(
          ministry,
          workflow?.displayName ?? 'general workflow',
          selectionConstraints,
          task.requestedHints?.preferredModelId
        )
      )
      .filter((item): item is ModelRouteDecision => Boolean(item));

    if (!routes.some(item => item.ministry === 'libu-governance')) {
      const routerRoute = this.modelRoutingPolicy.resolveRoute(
        'libu-governance',
        workflow?.displayName ?? 'general workflow',
        selectionConstraints,
        task.requestedHints?.preferredModelId
      );
      if (routerRoute) {
        routes.unshift(routerRoute);
      }
    }
    return routes;
  }

  recordDispatches(task: TaskRecord, dispatches: RuntimeAgentGraphState['dispatches']): void {
    task.dispatches = dispatches;
    for (const dispatch of dispatches) {
      const dispatchTarget = dispatch.selectedAgentId ?? dispatch.agentId ?? dispatch.to;
      this.addMessage(task, 'dispatch', dispatch.objective, AgentRole.MANAGER, dispatch.to);
      this.addTrace(task.trace, 'dispatch', `Manager dispatched ${dispatchTarget} for ${dispatch.objective}`, {
        to: dispatch.to,
        selectedAgentId: dispatch.selectedAgentId,
        agentId: dispatch.agentId,
        selectionSource: dispatch.selectionSource
      });
      this.addProgressDelta(task, `已分派给 ${dispatchTarget}：${dispatch.objective}`);
    }
  }

  syncTaskRuntime(
    task: TaskRecord,
    state: Pick<RuntimeAgentGraphState, 'currentStep' | 'retryCount' | 'maxRetries'>
  ): void {
    task.currentStep = state.currentStep;
    task.retryCount = state.retryCount;
    task.maxRetries = state.maxRetries;
    const stepsConsumed = Math.max(
      task.budgetState?.stepsConsumed ?? 0,
      estimateRuntimeStepsConsumed(state.currentStep)
    );
    task.budgetState = this.updateBudgetState(task, {
      stepsConsumed,
      retryBudget: task.budgetState?.retryBudget ?? state.maxRetries,
      retriesConsumed: state.retryCount
    });
    assertTaskBudgetAllowsProgress(task, state);
    task.blackboardState = {
      node: 'blackboard_state',
      taskId: task.id,
      sessionId: task.sessionId,
      visibleScopes: ['supervisor', 'strategy', 'ministry', 'fallback', 'governance'],
      refs: {
        traceCount: task.trace.length,
        evidenceCount: task.externalSources?.length ?? 0,
        activeInterruptId: task.activeInterrupt?.id
      },
      updatedAt: new Date().toISOString()
    };
    task.updatedAt = new Date().toISOString();
    this.emitTaskUpdate(task);
  }

  updateBudgetState(
    task: TaskRecord,
    overrides: Partial<NonNullable<TaskRecord['budgetState']>>
  ): NonNullable<TaskRecord['budgetState']> {
    return updateTaskBudgetState(task, this.settings, overrides);
  }

  createQueueState(sessionId: string | undefined, now: string): QueueStateRecord {
    return createTaskQueueState(sessionId, now);
  }

  transitionQueueState(task: TaskRecord, status: QueueStateRecord['status']): void {
    transitionTaskQueueState(task, status);
  }

  addMessage(
    task: TaskRecord,
    type: AgentMessage['type'],
    content: string,
    from: AgentRole,
    to: AgentRole = AgentRole.MANAGER
  ): void {
    addRuntimeMessage(task, type, content, from, to);
  }

  addProgressDelta(task: TaskRecord, content: string, from: AgentRole = AgentRole.MANAGER): void {
    addRuntimeProgressDelta(task, content, from);
  }

  upsertAgentState(task: TaskRecord, nextState: AgentExecutionState): void {
    if (upsertRuntimeAgentState(task, nextState)) {
      this.emitTaskUpdate(task);
      return;
    }
    this.emitTaskUpdate(task);
  }

  setSubTaskStatus(task: TaskRecord, role: AgentRole, status: 'pending' | 'running' | 'completed' | 'blocked'): void {
    if (setRuntimeSubTaskStatus(task, role, status)) {
      this.emitTaskUpdate(task);
    }
  }

  addTrace(
    trace: ExecutionTrace[],
    node: string,
    summary: string,
    data?: Record<string, unknown>,
    task?: TaskRecord
  ): void {
    addRuntimeTrace(trace, node, summary, data, task);
    if (task) {
      this.emitTaskUpdate(task);
    }
  }

  ensureTaskNotCancelled(task: TaskRecord): void {
    if (!this.cancelledTasks.has(task.id) && task.status !== TaskStatus.CANCELLED) {
      return;
    }
    throw new TaskCancelledError(task.id);
  }

  attachTool(
    task: TaskRecord,
    params: {
      toolName: string;
      attachedBy: 'bootstrap' | 'user' | 'runtime' | 'workflow' | 'specialist';
      preferred?: boolean;
      reason?: string;
      ownerType?: CapabilityOwnerType;
      ownerId?: string;
      family?: string;
    }
  ) {
    attachRuntimeTool(task, this.dependencies.toolRegistry, params);
    this.emitTaskUpdate(task);
  }

  recordToolUsage(
    task: TaskRecord,
    params: {
      toolName: string;
      status: ToolUsageSummaryRecord['status'];
      requestedBy?: string;
      reason?: string;
      blockedReason?: string;
      serverId?: string;
      capabilityId?: string;
      approvalRequired?: boolean;
      riskLevel?: ToolUsageSummaryRecord['riskLevel'];
      route?: ToolUsageSummaryRecord['route'];
      family?: string;
      capabilityType?: ToolUsageSummaryRecord['capabilityType'];
    }
  ) {
    recordRuntimeToolUsage(task, this.dependencies.toolRegistry, params);
    this.emitTaskUpdate(task);
  }

  private buildWorkerSelectionConstraints(task: TaskRecord): WorkerSelectionConstraints {
    const disallowedConnectorIds = this.dependencies.mcpClientManager
      ? this.dependencies.mcpClientManager
          .describeServers()
          .filter(
            (server: { id: string }) =>
              !describeConnectorProfilePolicy(server.id, this.settings.profile).enabledByProfile
          )
          .map((server: { id: string }) => server.id)
      : [];
    const capabilityPreferences = buildWorkerSelectionPreferences(task);

    return {
      profile: this.settings.profile,
      disallowedConnectorIds,
      ...capabilityPreferences
    };
  }
}

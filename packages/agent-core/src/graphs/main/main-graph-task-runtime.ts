import { randomUUID } from 'node:crypto';

import {
  AgentExecutionState,
  AgentMessage,
  AgentRole,
  CapabilityOwnerType,
  ExecutionTrace,
  ModelRouteDecision,
  QueueStateRecord,
  SubgraphId,
  TaskRecord,
  TaskStatus,
  ToolUsageSummaryRecord,
  WorkflowPresetDefinition
} from '@agent/shared';
import { loadSettings } from '@agent/config';
import { McpClientManager, ToolRegistry } from '@agent/tools';
import { buildWorkerSelectionPreferences } from '../../capabilities/capability-pool';
import { WorkerRegistry, WorkerSelectionConstraints } from '../../governance/worker-registry';
import { ModelRoutingPolicy } from '../../governance/model-routing-policy';
import { describeConnectorProfilePolicy } from '../../governance/profile-policy';
import { RuntimeAgentGraphState } from '../chat.graph';
import { resolveWorkflowRoute } from '../../workflows/workflow-route-registry';

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
    return resolveWorkflowRoute({
      goal,
      workflow: task.resolvedWorkflow
    });
  }

  resolveWorkflowRoutes(task: TaskRecord, workflow?: WorkflowPresetDefinition): ModelRouteDecision[] {
    const ministries = workflow?.requiredMinistries ?? [
      'libu-governance',
      'hubu-search',
      'gongbu-code',
      'xingbu-review'
    ];
    const selectionConstraints = this.buildWorkerSelectionConstraints(task);
    const routes = ministries
      .map(ministry =>
        this.modelRoutingPolicy.resolveRoute(
          ministry,
          workflow?.displayName ?? 'general workflow',
          selectionConstraints
        )
      )
      .filter((item): item is ModelRouteDecision => Boolean(item));

    if (!routes.some(item => item.ministry === 'libu-governance')) {
      const routerRoute = this.modelRoutingPolicy.resolveRoute(
        'libu-governance',
        workflow?.displayName ?? 'general workflow',
        selectionConstraints
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
      this.addMessage(task, 'dispatch', dispatch.objective, AgentRole.MANAGER, dispatch.to);
      this.addTrace(task.trace, 'dispatch', `Manager dispatched ${dispatch.to} for ${dispatch.objective}`);
      this.addProgressDelta(task, `已分派给 ${dispatch.to}：${dispatch.objective}`);
    }
  }

  syncTaskRuntime(
    task: TaskRecord,
    state: Pick<RuntimeAgentGraphState, 'currentStep' | 'retryCount' | 'maxRetries'>
  ): void {
    task.currentStep = state.currentStep;
    task.retryCount = state.retryCount;
    task.maxRetries = state.maxRetries;
    const stepsConsumed = Math.max(task.budgetState?.stepsConsumed ?? 0, this.estimateStepsConsumed(state.currentStep));
    task.budgetState = this.updateBudgetState(task, {
      stepsConsumed,
      retryBudget: task.budgetState?.retryBudget ?? state.maxRetries,
      retriesConsumed: state.retryCount
    });
    if (stepsConsumed > (task.budgetState.stepBudget ?? 8)) {
      throw new TaskBudgetExceededError(
        `当前任务已耗尽 step budget，已在 ${state.currentStep ?? 'unknown'} 阶段暂停。`,
        {
          stepBudget: task.budgetState.stepBudget,
          stepsConsumed,
          currentStep: state.currentStep
        }
      );
    }
    const budgetInterruptState = task.budgetState?.budgetInterruptState;
    if (budgetInterruptState?.status === 'hard-threshold-triggered') {
      throw new TaskBudgetExceededError(
        budgetInterruptState.reason ?? '当前任务已超过预算硬阈值，系统已强制终止执行。',
        {
          tokenBudget: task.budgetState?.tokenBudget,
          tokenConsumed: task.budgetState?.tokenConsumed,
          costBudgetUsd: task.budgetState?.costBudgetUsd,
          costConsumedUsd: task.budgetState?.costConsumedUsd,
          currentStep: state.currentStep
        }
      );
    }
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
    const nextBudget = {
      stepBudget: task.budgetState?.stepBudget ?? this.settings.policy?.budget.stepBudget ?? 8,
      stepsConsumed: task.budgetState?.stepsConsumed ?? 0,
      retryBudget: task.budgetState?.retryBudget ?? this.settings.policy?.budget.retryBudget ?? 1,
      retriesConsumed: task.budgetState?.retriesConsumed ?? 0,
      sourceBudget: task.budgetState?.sourceBudget ?? this.settings.policy?.budget.sourceBudget ?? 8,
      sourcesConsumed: task.budgetState?.sourcesConsumed ?? 0,
      tokenBudget: task.budgetState?.tokenBudget ?? 10000,
      tokenConsumed: task.budgetState?.tokenConsumed ?? 0,
      costBudgetUsd: task.budgetState?.costBudgetUsd ?? this.settings.policy?.budget.maxCostPerTaskUsd ?? 0,
      costConsumedUsd: task.budgetState?.costConsumedUsd ?? 0,
      costConsumedCny: task.budgetState?.costConsumedCny ?? 0,
      softBudgetThreshold: task.budgetState?.softBudgetThreshold ?? 0.8,
      hardBudgetThreshold: task.budgetState?.hardBudgetThreshold ?? 1,
      budgetInterruptState: task.budgetState?.budgetInterruptState ?? { status: 'idle' as const },
      fallbackModelId: task.budgetState?.fallbackModelId ?? this.settings.policy?.budget.fallbackModelId,
      overBudget: task.budgetState?.overBudget ?? false,
      ...overrides
    };
    const tokenBudget = nextBudget.tokenBudget ?? Number.POSITIVE_INFINITY;
    const costBudget = nextBudget.costBudgetUsd ?? Number.POSITIVE_INFINITY;
    const tokenRatio = tokenBudget > 0 ? (nextBudget.tokenConsumed ?? 0) / tokenBudget : 0;
    const costRatio = costBudget > 0 ? (nextBudget.costConsumedUsd ?? 0) / costBudget : 0;
    const budgetRatio = Math.max(tokenRatio, costRatio);
    if (budgetRatio >= (nextBudget.hardBudgetThreshold ?? 1)) {
      nextBudget.budgetInterruptState = {
        status: 'hard-threshold-triggered',
        interactionKind: 'supplemental-input',
        triggeredAt: new Date().toISOString(),
        reason: '成本超限，请简化问题或提高预算。'
      };
    } else if (
      budgetRatio >= (nextBudget.softBudgetThreshold ?? 0.8) &&
      nextBudget.budgetInterruptState?.status !== 'soft-threshold-triggered'
    ) {
      nextBudget.budgetInterruptState = {
        status: 'soft-threshold-triggered',
        interactionKind: 'supplemental-input',
        triggeredAt: new Date().toISOString(),
        reason: '当前任务已接近预算阈值，建议缩小范围或确认是否继续。'
      };
    }
    nextBudget.overBudget =
      nextBudget.overBudget ||
      (nextBudget.costConsumedUsd ?? 0) >= (nextBudget.costBudgetUsd ?? Number.POSITIVE_INFINITY);
    task.budgetGateState = {
      node: 'budget_gate',
      status:
        nextBudget.budgetInterruptState?.status === 'hard-threshold-triggered'
          ? 'hard_blocked'
          : nextBudget.budgetInterruptState?.status === 'soft-threshold-triggered'
            ? 'soft_blocked'
            : task.queueState?.status === 'queued'
              ? 'throttled'
              : 'open',
      summary:
        nextBudget.budgetInterruptState?.reason ??
        (task.queueState?.status === 'queued' ? '预算门当前按队列节流等待执行。' : '预算门已放行当前任务继续执行。'),
      queueDepth: task.queueState?.status === 'queued' ? 1 : 0,
      rateLimitKey: task.sessionId ?? task.id,
      triggeredAt:
        nextBudget.budgetInterruptState?.status === 'idle' ? undefined : nextBudget.budgetInterruptState?.triggeredAt,
      updatedAt: new Date().toISOString()
    };
    return nextBudget;
  }

  createQueueState(sessionId: string | undefined, now: string): QueueStateRecord {
    return {
      mode: sessionId ? 'foreground' : 'background',
      backgroundRun: !sessionId,
      status: 'queued',
      enqueuedAt: now,
      lastTransitionAt: now,
      attempt: 1
    };
  }

  transitionQueueState(task: TaskRecord, status: QueueStateRecord['status']): void {
    const now = new Date().toISOString();
    const previous = task.queueState ?? this.createQueueState(task.sessionId, now);
    const shouldReleaseLease = status !== 'queued' && status !== 'running';
    task.queueState = {
      ...previous,
      status,
      lastTransitionAt: now,
      startedAt: status === 'running' ? (previous.startedAt ?? now) : previous.startedAt,
      finishedAt: ['completed', 'failed', 'cancelled'].includes(status) ? now : previous.finishedAt,
      leaseOwner: shouldReleaseLease ? undefined : previous.leaseOwner,
      leaseExpiresAt: shouldReleaseLease ? undefined : previous.leaseExpiresAt,
      lastHeartbeatAt: shouldReleaseLease ? undefined : previous.lastHeartbeatAt
    };
  }

  addMessage(
    task: TaskRecord,
    type: AgentMessage['type'],
    content: string,
    from: AgentRole,
    to: AgentRole = AgentRole.MANAGER
  ): void {
    task.messages.push({
      id: `msg_${Date.now()}_${task.messages.length}`,
      taskId: task.id,
      from,
      to,
      type,
      content,
      createdAt: new Date().toISOString()
    });
  }

  addProgressDelta(task: TaskRecord, content: string, from: AgentRole = AgentRole.MANAGER): void {
    const normalized = content.trim();
    if (!normalized) {
      return;
    }
    task.messages.push({
      id: `progress_${task.id}`,
      taskId: task.id,
      from,
      to: AgentRole.MANAGER,
      type: 'summary_delta',
      content: `${normalized}\n`,
      createdAt: new Date().toISOString()
    });
  }

  upsertAgentState(task: TaskRecord, nextState: AgentExecutionState): void {
    const index = task.agentStates.findIndex(item => item.role === nextState.role);
    if (index >= 0) {
      task.agentStates[index] = { ...nextState };
      this.emitTaskUpdate(task);
      return;
    }
    task.agentStates.push({ ...nextState });
    this.emitTaskUpdate(task);
  }

  setSubTaskStatus(task: TaskRecord, role: AgentRole, status: 'pending' | 'running' | 'completed' | 'blocked'): void {
    const target = task.plan?.subTasks.find(subTask => subTask.assignedTo === role);
    if (target) {
      target.status = status;
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
    const traceId = task?.traceId ?? randomUUID();
    if (task && !task.traceId) {
      task.traceId = traceId;
    }
    const spanId = typeof data?.spanId === 'string' ? data.spanId : randomUUID();
    const parentSpanId =
      typeof data?.parentSpanId === 'string' ? data.parentSpanId : this.resolveParentSpanId(trace, node);
    trace.push({
      traceId,
      spanId,
      parentSpanId,
      node,
      at: new Date().toISOString(),
      summary,
      data,
      specialistId: typeof data?.specialistId === 'string' ? data.specialistId : undefined,
      role: this.toSpanRole(data?.role),
      latencyMs: typeof data?.latencyMs === 'number' ? data.latencyMs : undefined,
      status: this.toTraceStatus(data?.status),
      revisionCount: typeof data?.revisionCount === 'number' ? data.revisionCount : undefined,
      modelUsed: typeof data?.modelUsed === 'string' ? data.modelUsed : undefined,
      isFallback: typeof data?.isFallback === 'boolean' ? data.isFallback : undefined,
      fallbackReason: typeof data?.fallbackReason === 'string' ? data.fallbackReason : undefined,
      tokenUsage:
        data?.tokenUsage && typeof data.tokenUsage === 'object'
          ? (data.tokenUsage as ExecutionTrace['tokenUsage'])
          : undefined
    });
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
    const tool = this.dependencies.toolRegistry?.get(params.toolName);
    const now = new Date().toISOString();
    const attachment = {
      toolName: params.toolName,
      family: params.family ?? tool?.family ?? 'runtime-governance',
      ownerType: params.ownerType ?? tool?.ownerType ?? 'runtime-derived',
      ownerId: params.ownerId ?? tool?.ownerId,
      attachedAt: now,
      attachedBy: params.attachedBy,
      preferred: params.preferred ?? false,
      reason: params.reason
    };
    task.toolAttachments = dedupeByToolName([...(task.toolAttachments ?? []), attachment]);
    task.updatedAt = now;
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
    const tool = this.dependencies.toolRegistry?.get(params.toolName);
    const now = new Date().toISOString();
    const item: ToolUsageSummaryRecord = {
      toolName: params.toolName,
      family: params.family ?? tool?.family ?? 'runtime-governance',
      capabilityType: params.capabilityType ?? tool?.capabilityType ?? 'governance-tool',
      status: params.status,
      route:
        params.route ??
        (params.serverId || tool?.capabilityType === 'mcp-capability'
          ? 'mcp'
          : tool?.capabilityType === 'governance-tool'
            ? 'governance'
            : 'local'),
      requestedBy: params.requestedBy,
      reason: params.reason,
      blockedReason: params.blockedReason,
      serverId: params.serverId,
      capabilityId: params.capabilityId,
      approvalRequired: params.approvalRequired,
      riskLevel: params.riskLevel ?? tool?.riskLevel,
      usedAt: now
    };
    task.toolUsageSummary = dedupeUsage([...(task.toolUsageSummary ?? []), item]).slice(-50);
    task.updatedAt = now;
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

  private estimateStepsConsumed(currentStep?: string): number {
    switch (currentStep) {
      case 'manager_plan':
        return 1;
      case 'research':
        return 2;
      case 'execute':
        return 3;
      case 'review':
        return 4;
      default:
        return 0;
    }
  }

  private resolveParentSpanId(trace: ExecutionTrace[], node: string): string | undefined {
    if (!trace.length) {
      return undefined;
    }
    const scopedParent = [...trace]
      .reverse()
      .find(item => item.node === node || this.belongsToSameStage(item.node, node));
    return scopedParent?.spanId ?? trace[trace.length - 1]?.spanId;
  }

  private belongsToSameStage(previousNode: string, nextNode: string): boolean {
    const groups = [
      ['goal_intake', 'route', 'libu_routed', 'specialist_routed', 'dispatch'],
      ['research', 'budget_exhausted', 'ministry_started', 'ministry_reported'],
      ['execute', 'approval_gate'],
      ['review', 'critique_guard_triggered', 'final_response_completed', 'finish']
    ];
    return groups.some(group => group.includes(previousNode) && group.includes(nextNode));
  }

  private toSpanRole(value: unknown): ExecutionTrace['role'] | undefined {
    if (value === 'lead' || value === 'support' || value === 'ministry') {
      return value;
    }
    return undefined;
  }

  private toTraceStatus(value: unknown): ExecutionTrace['status'] | undefined {
    if (
      value === 'running' ||
      value === 'failed' ||
      value === 'rejected' ||
      value === 'success' ||
      value === 'timeout'
    ) {
      return value;
    }
    return undefined;
  }
}

function dedupeByToolName<T extends { toolName: string }>(items: T[]) {
  return Array.from(new Map(items.map(item => [item.toolName, item])).values());
}

function dedupeUsage(items: ToolUsageSummaryRecord[]) {
  return Array.from(new Map(items.map(item => [`${item.toolName}:${item.status}:${item.usedAt}`, item])).values());
}

export class TaskCancelledError extends Error {
  constructor(taskId: string) {
    super(`Task ${taskId} was cancelled.`);
  }
}

export class TaskBudgetExceededError extends Error {
  constructor(
    message: string,
    public readonly detail?: Record<string, unknown>
  ) {
    super(message);
  }
}

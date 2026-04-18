import { TaskStatus } from '@agent/core';
import type { ApprovalResumeInput, QueueStateRecord, SubgraphIdValue as SubgraphId } from '@agent/core';

import type { PendingExecutionContext } from '../../../flows/approval';
import type { RuntimeTaskRecord } from '../../../runtime/runtime-task.types';

export class MainGraphBackgroundRuntime {
  constructor(
    private readonly tasks: Map<string, RuntimeTaskRecord>,
    private readonly pendingExecutions: Map<string, PendingExecutionContext>,
    private readonly cancelledTasks: Set<string>,
    private readonly updateBudgetState: (
      task: RuntimeTaskRecord,
      overrides: Partial<NonNullable<RuntimeTaskRecord['budgetState']>>
    ) => NonNullable<RuntimeTaskRecord['budgetState']>,
    private readonly transitionQueueState: (task: RuntimeTaskRecord, status: QueueStateRecord['status']) => void,
    private readonly addTrace: (
      task: RuntimeTaskRecord,
      node: string,
      summary: string,
      data?: Record<string, unknown>
    ) => void,
    private readonly addProgressDelta: (task: RuntimeTaskRecord, content: string) => void,
    private readonly markSubgraph: (task: RuntimeTaskRecord, subgraphId: SubgraphId) => void,
    private readonly persistAndEmitTask: (task: RuntimeTaskRecord) => Promise<void>,
    private readonly persistRuntimeState: () => Promise<void>,
    private readonly getRunBootstrapGraph: () => (
      task: RuntimeTaskRecord,
      dto: { goal: string; context?: string; constraints: string[] },
      options: { mode: 'initial' | 'interrupt_resume'; resume?: ApprovalResumeInput }
    ) => Promise<void>,
    private readonly getRunTaskPipeline: () => (
      task: RuntimeTaskRecord,
      dto: { goal: string; context?: string; constraints: string[] },
      options: { mode: 'initial' | 'retry' | 'approval_resume' }
    ) => Promise<void>
  ) {}

  listQueuedBackgroundTasks(listTasks: () => RuntimeTaskRecord[]): RuntimeTaskRecord[] {
    const now = Date.now();
    return listTasks().filter(task => {
      const queueState = task.queueState;
      if (!queueState?.backgroundRun || queueState.status !== 'queued') {
        return false;
      }
      if (!queueState.leaseExpiresAt) {
        return true;
      }
      return new Date(queueState.leaseExpiresAt).getTime() <= now;
    });
  }

  listExpiredBackgroundLeases(listTasks: () => RuntimeTaskRecord[]): RuntimeTaskRecord[] {
    const now = Date.now();
    return listTasks().filter(task => {
      const queueState = task.queueState;
      return Boolean(
        queueState?.backgroundRun &&
        queueState.status === 'running' &&
        queueState.leaseOwner &&
        queueState.leaseExpiresAt &&
        new Date(queueState.leaseExpiresAt).getTime() <= now
      );
    });
  }

  async acquireBackgroundLease(taskId: string, owner: string, ttlMs: number): Promise<RuntimeTaskRecord | undefined> {
    const task = this.tasks.get(taskId);
    if (!task?.queueState?.backgroundRun || task.queueState.status !== 'queued') {
      return undefined;
    }

    const now = new Date();
    if (task.queueState.leaseExpiresAt && new Date(task.queueState.leaseExpiresAt).getTime() > now.getTime()) {
      return undefined;
    }

    task.queueState = {
      ...task.queueState,
      leaseOwner: owner,
      leaseExpiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      lastHeartbeatAt: now.toISOString()
    };
    task.updatedAt = now.toISOString();
    this.addTrace(task, 'background_lease_acquired', `后台 runner 已为任务获取 lease：${owner}`, { owner, ttlMs });
    this.markSubgraph(task, 'background-runner');
    await this.persistAndEmitTask(task);
    return task;
  }

  async heartbeatBackgroundLease(taskId: string, owner: string, ttlMs: number): Promise<RuntimeTaskRecord | undefined> {
    const task = this.tasks.get(taskId);
    if (!task?.queueState?.backgroundRun || task.queueState.leaseOwner !== owner) {
      return undefined;
    }

    const now = new Date();
    task.queueState = {
      ...task.queueState,
      leaseExpiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      lastHeartbeatAt: now.toISOString()
    };
    task.updatedAt = now.toISOString();
    await this.persistAndEmitTask(task);
    return task;
  }

  async releaseBackgroundLease(taskId: string, owner: string): Promise<RuntimeTaskRecord | undefined> {
    const task = this.tasks.get(taskId);
    if (!task?.queueState?.backgroundRun || task.queueState.leaseOwner !== owner) {
      return undefined;
    }

    task.queueState = {
      ...task.queueState,
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      lastHeartbeatAt: undefined
    };
    task.updatedAt = new Date().toISOString();
    await this.persistAndEmitTask(task);
    return task;
  }

  async reclaimExpiredBackgroundLease(taskId: string, owner: string): Promise<RuntimeTaskRecord | undefined> {
    const task = this.tasks.get(taskId);
    if (!task?.queueState?.backgroundRun || task.queueState.status !== 'running') {
      return undefined;
    }

    const now = new Date();
    if (!task.queueState.leaseExpiresAt || new Date(task.queueState.leaseExpiresAt).getTime() > now.getTime()) {
      return undefined;
    }

    const retryBudget = task.budgetState?.retryBudget ?? task.maxRetries ?? 1;
    const retriesConsumed = task.budgetState?.retriesConsumed ?? task.retryCount ?? 0;
    const nextRetriesConsumed = retriesConsumed + 1;

    if (nextRetriesConsumed <= retryBudget) {
      task.status = TaskStatus.QUEUED;
      task.currentNode = 'background_requeued';
      task.currentStep = 'queued';
      task.retryCount = nextRetriesConsumed;
      task.maxRetries = Math.max(task.maxRetries ?? retryBudget, retryBudget);
      task.budgetState = this.updateBudgetState(task, {
        retryBudget,
        retriesConsumed: nextRetriesConsumed
      });
      task.queueState = {
        mode: task.queueState.mode,
        backgroundRun: true,
        status: 'queued',
        enqueuedAt: now.toISOString(),
        startedAt: undefined,
        finishedAt: undefined,
        lastTransitionAt: now.toISOString(),
        attempt: (task.queueState.attempt ?? 1) + 1,
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
        lastHeartbeatAt: undefined
      };
      task.updatedAt = now.toISOString();
      this.addTrace(task, 'background_lease_reclaimed', `后台 lease 已过期，任务重新入队（owner: ${owner}）。`, {
        owner,
        retriesConsumed: nextRetriesConsumed,
        retryBudget
      });
      this.markSubgraph(task, 'background-runner');
      this.addProgressDelta(task, '后台执行 lease 已过期，任务已重新入队等待重试。');
      await this.persistAndEmitTask(task);
      return task;
    }

    task.status = TaskStatus.FAILED;
    task.currentNode = 'background_reclaim_failed';
    task.currentStep = 'background_runner_failed';
    task.result = '后台 lease 多次过期且已耗尽 retry budget，任务已终止。';
    task.retryCount = nextRetriesConsumed;
    task.budgetState = this.updateBudgetState(task, {
      retryBudget,
      retriesConsumed: nextRetriesConsumed
    });
    this.transitionQueueState(task, 'failed');
    task.updatedAt = now.toISOString();
    this.addTrace(
      task,
      'background_lease_reclaimed',
      `后台 lease 已过期且 retry budget 已耗尽，任务终止（owner: ${owner}）。`,
      {
        owner,
        retriesConsumed: nextRetriesConsumed,
        retryBudget,
        exhausted: true
      }
    );
    this.markSubgraph(task, 'background-runner');
    this.addProgressDelta(task, '后台执行 lease 已过期，且已耗尽重试预算，任务终止。');
    await this.persistAndEmitTask(task);
    return task;
  }

  async runBackgroundTask(taskId: string): Promise<RuntimeTaskRecord | undefined> {
    const task = this.tasks.get(taskId);
    if (!task?.queueState?.backgroundRun || task.queueState.status !== 'queued') {
      return undefined;
    }

    await this.getRunBootstrapGraph()(
      task,
      { goal: task.goal, context: task.context, constraints: [] },
      { mode: 'initial' }
    );
    if (task.status !== TaskStatus.WAITING_APPROVAL && task.status !== TaskStatus.BLOCKED) {
      await this.getRunTaskPipeline()(
        task,
        { goal: task.goal, context: task.context, constraints: [] },
        { mode: 'initial' }
      );
    }
    return task;
  }

  async markBackgroundTaskRunnerFailure(taskId: string, reason: string): Promise<RuntimeTaskRecord | undefined> {
    const task = this.tasks.get(taskId);
    if (!task?.queueState?.backgroundRun) {
      return undefined;
    }

    task.status = TaskStatus.FAILED;
    task.currentNode = 'background_runner_failed';
    task.currentStep = 'background_runner_failed';
    task.result = reason;
    this.transitionQueueState(task, 'failed');
    task.updatedAt = new Date().toISOString();
    this.addTrace(task, 'background_runner_failed', reason);
    this.markSubgraph(task, 'background-runner');
    this.addProgressDelta(task, reason);
    await this.persistAndEmitTask(task);
    return task;
  }

  async retryTask(taskId: string): Promise<RuntimeTaskRecord | undefined> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return undefined;
    }

    this.pendingExecutions.delete(taskId);
    task.status = TaskStatus.QUEUED;
    task.review = undefined;
    task.result = undefined;
    task.currentStep = 'queued';
    task.queueState = {
      mode: task.queueState?.mode ?? (task.sessionId ? 'foreground' : 'background'),
      backgroundRun: task.queueState?.backgroundRun ?? !task.sessionId,
      status: 'queued',
      enqueuedAt: new Date().toISOString(),
      startedAt: undefined,
      finishedAt: undefined,
      lastTransitionAt: new Date().toISOString(),
      attempt: (task.queueState?.attempt ?? 1) + 1
    };
    task.retryCount = 0;
    task.maxRetries = 1;
    task.updatedAt = new Date().toISOString();
    this.addTrace(task, 'manager_replan', 'Manual retry requested for multi-agent pipeline');

    await this.persistAndEmitTask(task);
    await this.getRunTaskPipeline()(task, { goal: task.goal, constraints: [] }, { mode: 'retry' });
    return task;
  }

  async cancelTask(taskId: string, reason?: string): Promise<RuntimeTaskRecord | undefined> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return undefined;
    }

    this.cancelledTasks.add(taskId);
    this.pendingExecutions.delete(taskId);
    task.status = TaskStatus.CANCELLED;
    task.currentNode = 'run_cancelled';
    task.currentStep = 'cancelled';
    this.transitionQueueState(task, 'cancelled');
    task.result = reason ? `已终止当前执行：${reason}` : '已手动终止当前执行。';
    task.updatedAt = new Date().toISOString();
    task.pendingAction = undefined;
    task.pendingApproval = undefined;
    this.addTrace(task, 'run_cancelled', task.result, { reason });
    await this.persistAndEmitTask(task);
    return task;
  }

  async deleteSessionState(sessionId: string): Promise<void> {
    const taskIds = [...this.tasks.values()].filter(task => task.sessionId === sessionId).map(task => task.id);
    for (const taskId of taskIds) {
      this.tasks.delete(taskId);
      this.pendingExecutions.delete(taskId);
      this.cancelledTasks.delete(taskId);
    }
    await this.persistRuntimeState();
  }
}

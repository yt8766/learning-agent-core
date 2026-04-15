import { ExecutionTrace, TaskRecord } from '@agent/shared';
import { WorkerRegistry } from '../../../governance/worker-registry';
import { MainGraphBackgroundRuntime } from '../background/main-graph-background';

type BackgroundLifecycleDeps = {
  workerRegistry: WorkerRegistry;
  backgroundRuntime: MainGraphBackgroundRuntime;
  listTasks: () => TaskRecord[];
  initialize: () => Promise<void>;
};

export function listLifecycleWorkers(workerRegistry: WorkerRegistry) {
  return workerRegistry.list();
}

export function registerLifecycleWorker(
  workerRegistry: WorkerRegistry,
  worker: Parameters<WorkerRegistry['register']>[0]
) {
  workerRegistry.register(worker);
}

export function setLifecycleWorkerEnabled(workerRegistry: WorkerRegistry, workerId: string, enabled: boolean) {
  workerRegistry.setEnabled(workerId, enabled);
}

export function isLifecycleWorkerEnabled(workerRegistry: WorkerRegistry, workerId: string) {
  return workerRegistry.isEnabled(workerId);
}

export function listQueuedLifecycleBackgroundTasks(
  backgroundRuntime: MainGraphBackgroundRuntime,
  listTasks: () => TaskRecord[]
) {
  return backgroundRuntime.listQueuedBackgroundTasks(listTasks);
}

export async function acquireLifecycleBackgroundLease(
  deps: BackgroundLifecycleDeps,
  taskId: string,
  owner: string,
  ttlMs: number
) {
  await deps.initialize();
  return deps.backgroundRuntime.acquireBackgroundLease(taskId, owner, ttlMs);
}

export async function heartbeatLifecycleBackgroundLease(
  deps: BackgroundLifecycleDeps,
  taskId: string,
  owner: string,
  ttlMs: number
) {
  await deps.initialize();
  return deps.backgroundRuntime.heartbeatBackgroundLease(taskId, owner, ttlMs);
}

export async function releaseLifecycleBackgroundLease(deps: BackgroundLifecycleDeps, taskId: string, owner: string) {
  await deps.initialize();
  return deps.backgroundRuntime.releaseBackgroundLease(taskId, owner);
}

export function listExpiredLifecycleBackgroundLeases(
  backgroundRuntime: MainGraphBackgroundRuntime,
  listTasks: () => TaskRecord[]
) {
  return backgroundRuntime.listExpiredBackgroundLeases(listTasks);
}

export async function reclaimExpiredLifecycleBackgroundLease(
  deps: BackgroundLifecycleDeps,
  taskId: string,
  owner: string
) {
  await deps.initialize();
  return deps.backgroundRuntime.reclaimExpiredBackgroundLease(taskId, owner);
}

export async function runLifecycleBackgroundTask(deps: BackgroundLifecycleDeps, taskId: string) {
  await deps.initialize();
  return deps.backgroundRuntime.runBackgroundTask(taskId);
}

export async function markLifecycleBackgroundTaskRunnerFailure(
  deps: BackgroundLifecycleDeps,
  taskId: string,
  reason: string
) {
  await deps.initialize();
  return deps.backgroundRuntime.markBackgroundTaskRunnerFailure(taskId, reason);
}

export async function retryLifecycleTask(deps: BackgroundLifecycleDeps, taskId: string) {
  await deps.initialize();
  return deps.backgroundRuntime.retryTask(taskId);
}

export async function cancelLifecycleTask(deps: BackgroundLifecycleDeps, taskId: string, reason?: string) {
  await deps.initialize();
  return deps.backgroundRuntime.cancelTask(taskId, reason);
}

export async function deleteLifecycleSessionState(deps: BackgroundLifecycleDeps, sessionId: string) {
  await deps.initialize();
  await deps.backgroundRuntime.deleteSessionState(sessionId);
}

export function listLifecycleTaskTraces(tasks: Map<string, TaskRecord>, taskId: string): ExecutionTrace[] {
  return tasks.get(taskId)?.trace ?? [];
}

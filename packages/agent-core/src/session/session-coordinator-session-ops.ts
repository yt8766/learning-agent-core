import {
  ApprovalDecision,
  ChatSessionRecord,
  RecoverToCheckpointDto,
  SessionCancelDto,
  TaskRecord,
  TaskStatus
} from '@agent/shared';

import { AgentOrchestrator } from '../graphs/main.graph';
import { SessionCoordinatorStore } from './session-coordinator-store';
import { syncCoordinatorTask } from './session-coordinator-sync';
import { SessionCoordinatorThinking } from './session-coordinator-thinking';
import { autoConfirmLearningIfNeeded, runLearningConfirmation } from './session-coordinator-learning';

type SessionSyncDeps = {
  orchestrator: AgentOrchestrator;
  store: SessionCoordinatorStore;
  thinking: SessionCoordinatorThinking;
};

export function syncSessionTask(
  { orchestrator, store, thinking }: SessionSyncDeps,
  sessionId: string,
  task: TaskRecord
): void {
  syncCoordinatorTask(
    store,
    thinking,
    sessionId,
    task,
    currentTask => {
      orchestrator.ensureLearningCandidates(currentTask);
    },
    (nextSessionId, nextTask) => {
      void autoConfirmLearningIfNeeded(orchestrator, store, nextSessionId, nextTask);
    }
  );
}

export async function recoverSession(deps: SessionSyncDeps, sessionId: string): Promise<ChatSessionRecord> {
  const session = deps.store.requireSession(sessionId);
  const taskId = deps.store.requireTaskId(session);
  const task = deps.orchestrator.getTask(taskId);
  if (task) {
    syncSessionTask(deps, sessionId, task);
  }
  deps.store.addEvent(sessionId, 'session_started', { recovered: true, taskId });
  await deps.store.persistRuntimeState();
  return session;
}

export async function recoverSessionToCheckpoint(
  deps: Pick<SessionSyncDeps, 'store'>,
  sessionId: string,
  dto: RecoverToCheckpointDto
): Promise<ChatSessionRecord> {
  const session = deps.store.requireSession(sessionId);
  const checkpoint = deps.store.checkpoints.get(sessionId);
  if (!checkpoint) {
    throw new Error(`Checkpoint for session ${sessionId} not found`);
  }
  if (dto.checkpointId && dto.checkpointId !== checkpoint.checkpointId) {
    throw new Error(`Checkpoint ${dto.checkpointId} is not available for session ${sessionId}`);
  }

  const nextCursor = Math.max(0, Math.min(dto.checkpointCursor ?? checkpoint.traceCursor, checkpoint.traceCursor));
  checkpoint.traceCursor = nextCursor;
  checkpoint.messageCursor = Math.min(checkpoint.messageCursor, nextCursor);
  checkpoint.approvalCursor = Math.min(checkpoint.approvalCursor, nextCursor);
  checkpoint.learningCursor = Math.min(checkpoint.learningCursor, nextCursor);
  checkpoint.recoverability = checkpoint.pendingApproval ? 'partial' : 'safe';
  checkpoint.updatedAt = new Date().toISOString();

  session.status = checkpoint.graphState.status === TaskStatus.WAITING_APPROVAL ? 'waiting_approval' : 'idle';
  session.updatedAt = checkpoint.updatedAt;
  deps.store.addEvent(sessionId, 'session_started', {
    recovered: true,
    checkpointId: checkpoint.checkpointId,
    checkpointCursor: nextCursor,
    reason: dto.reason
  });
  await deps.store.persistRuntimeState();
  return session;
}

export async function cancelSessionRun(
  deps: SessionSyncDeps,
  sessionId: string,
  dto?: SessionCancelDto
): Promise<ChatSessionRecord> {
  const session = deps.store.requireSession(sessionId);
  const taskId = session.currentTaskId ?? deps.store.getCheckpoint(sessionId)?.taskId;
  const reason = dto?.reason?.trim();
  if (!taskId) {
    return finishSessionCancellation(deps.store, sessionId, session, reason);
  }

  const task = await deps.orchestrator.cancelTask(taskId, dto?.reason);
  if (!task) {
    session.currentTaskId = undefined;
    const checkpoint = deps.store.getCheckpoint(sessionId);
    if (checkpoint?.taskId === taskId) {
      checkpoint.graphState = {
        ...checkpoint.graphState,
        status: TaskStatus.CANCELLED,
        currentStep: 'cancelled'
      };
      checkpoint.pendingApproval = undefined;
      checkpoint.pendingApprovals = [];
      checkpoint.updatedAt = new Date().toISOString();
    }
    return finishSessionCancellation(deps.store, sessionId, session, reason);
  }
  syncSessionTask(deps, sessionId, task);
  deps.store.addMessage(sessionId, 'system', reason ? `已终止当前执行：${reason}` : '已手动终止当前执行。', undefined);
  await deps.store.persistRuntimeState();
  return deps.store.requireSession(sessionId);
}

export async function finishSessionCancellation(
  store: SessionCoordinatorStore,
  sessionId: string,
  session: ChatSessionRecord,
  reason?: string
) {
  if (session.status !== 'completed' && session.status !== 'failed' && session.status !== 'cancelled') {
    session.status = 'cancelled';
    session.updatedAt = new Date().toISOString();
    store.addEvent(sessionId, 'run_cancelled', {
      summary: reason ? `执行已终止：${reason}` : '执行已手动终止。'
    });
    store.addMessage(sessionId, 'system', reason ? `已终止当前执行：${reason}` : '已手动终止当前执行。', undefined);
    await store.persistRuntimeState();
  }
  return session;
}

export async function deleteSessionState(
  deps: Pick<SessionSyncDeps, 'orchestrator' | 'store'>,
  sessionId: string
): Promise<void> {
  deps.store.requireSession(sessionId);
  await deps.orchestrator.deleteSessionState(sessionId);
  deps.store.sessions.delete(sessionId);
  deps.store.messages.delete(sessionId);
  deps.store.events.delete(sessionId);
  deps.store.checkpoints.delete(sessionId);
  deps.store.subscribers.delete(sessionId);
  await deps.store.persistRuntimeState();
}

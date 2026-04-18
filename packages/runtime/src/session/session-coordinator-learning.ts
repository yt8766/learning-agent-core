import { TaskStatus } from '@agent/core';

import { createLearningGraph } from '../graphs/learning/learning.graph';
import type { AgentOrchestrator } from '../orchestration/agent-orchestrator';
import type { SessionCoordinatorStore } from './session-coordinator-store';
import type { SessionTaskLike } from './session-task.types';

export async function autoConfirmLearningIfNeeded(
  orchestrator: AgentOrchestrator,
  store: SessionCoordinatorStore,
  sessionId: string,
  task: SessionTaskLike
): Promise<void> {
  const preferredCandidateIds = task.learningEvaluation?.autoConfirmCandidateIds;
  const pendingCandidateIds =
    task.learningCandidates
      ?.filter(candidate => candidate.status === 'pending_confirmation')
      .map(candidate => candidate.id) ?? [];

  const selectedCandidateIds =
    preferredCandidateIds?.filter(candidateId => pendingCandidateIds.includes(candidateId)) ?? pendingCandidateIds;

  if (!selectedCandidateIds.length) {
    return;
  }

  await runLearningConfirmation(orchestrator, store, sessionId, task, selectedCandidateIds, true);
}

export async function runLearningConfirmation(
  orchestrator: AgentOrchestrator,
  store: SessionCoordinatorStore,
  sessionId: string,
  task: SessionTaskLike,
  candidateIds?: string[],
  autoConfirmed = false
): Promise<void> {
  const selectedIds = candidateIds ?? task.learningCandidates?.map(candidate => candidate.id);
  if (!selectedIds?.length) {
    return;
  }

  const graph = createLearningGraph({
    confirm: async state => {
      const confirmedTask = await orchestrator.confirmLearning(task.id, state.candidateIds);
      if (confirmedTask) {
        task.learningCandidates = confirmedTask.learningCandidates;
        task.updatedAt = confirmedTask.updatedAt;
      }
      return {
        ...state,
        confirmedCandidates:
          task.learningCandidates?.filter(
            candidate => state.candidateIds.includes(candidate.id) && candidate.status === 'confirmed'
          ) ?? []
      };
    }
  }).compile();

  await graph.invoke({
    taskId: task.id,
    candidateIds: selectedIds,
    autoConfirmed,
    confirmedCandidates: []
  });

  const session = store.requireSession(sessionId);
  session.status = task.status === TaskStatus.FAILED ? 'failed' : 'completed';
  session.updatedAt = new Date().toISOString();
  store.addEvent(sessionId, 'learning_confirmed', {
    taskId: task.id,
    candidateIds: selectedIds,
    autoConfirmed
  });
  await store.persistRuntimeState();
}

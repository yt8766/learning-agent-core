import type { TaskRecord } from '@agent/shared';
import { TaskStatus } from '@agent/shared';

import { createLearningGraph } from '../graphs/learning.graph';
import type { AgentOrchestrator } from '../graphs/main/main.graph';
import type { SessionCoordinatorStore } from './session-coordinator-store';

export async function autoConfirmLearningIfNeeded(
  orchestrator: AgentOrchestrator,
  store: SessionCoordinatorStore,
  sessionId: string,
  task: TaskRecord
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
  task: TaskRecord,
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

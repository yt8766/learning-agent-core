import { SessionCoordinator } from '@agent/runtime';
import type { ChatCheckpointRecord } from '@agent/core';

export function buildCheckpointRef(
  sessionCoordinator: Pick<SessionCoordinator, 'getCheckpoint'>,
  sessionId?: string
):
  | {
      sessionId: string;
      taskId?: string;
      checkpointId?: string;
      checkpointCursor?: number;
      recoverability: ChatCheckpointRecord['recoverability'];
    }
  | undefined {
  if (!sessionId) {
    return undefined;
  }
  const checkpoint = sessionCoordinator.getCheckpoint(sessionId);
  if (!checkpoint) {
    return undefined;
  }
  return {
    sessionId,
    taskId: checkpoint.taskId,
    checkpointId: checkpoint.checkpointId,
    checkpointCursor: checkpoint.traceCursor,
    recoverability: checkpoint.recoverability ?? 'partial'
  };
}

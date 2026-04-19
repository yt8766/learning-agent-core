import type { ChatCheckpointRecord, RunCheckpointSummaryRecord } from '@agent/core';

import { resolveRunStage } from './run-stage-semantics';

export function buildRunCheckpointSummaries(
  checkpoint: Partial<ChatCheckpointRecord> | undefined
): RunCheckpointSummaryRecord[] {
  if (!checkpoint?.checkpointId) {
    return [];
  }

  const graphState = checkpoint.graphState;

  return [
    {
      checkpointId: checkpoint.checkpointId,
      sessionId: checkpoint.sessionId,
      cursor: checkpoint.traceCursor,
      stage: resolveRunStage({
        currentNode: checkpoint.currentNode,
        currentStep: graphState?.currentStep,
        currentMinistry: checkpoint.currentMinistry
      }),
      currentStep: graphState?.currentStep,
      nodeLabel: checkpoint.streamStatus?.nodeLabel,
      status: graphState?.status === 'blocked' ? 'blocked' : graphState?.status,
      summary:
        checkpoint.streamStatus?.detail ??
        graphState?.currentStep ??
        checkpoint.currentNode ??
        'checkpoint available for replay',
      createdAt: checkpoint.createdAt ?? checkpoint.updatedAt ?? new Date().toISOString(),
      recoverable: checkpoint.recoverability === 'safe' || checkpoint.recoverability === 'partial',
      recoverability:
        checkpoint.recoverability === 'unsafe' ? 'none' : checkpoint.recoverability === 'safe' ? 'safe' : 'partial',
      agentStateCount: checkpoint.agentStates?.length,
      pendingApprovalCount: checkpoint.pendingApprovals?.length,
      evidenceCount: checkpoint.externalSources?.length,
      thoughtChainCount: checkpoint.thoughtChain?.length
    }
  ];
}

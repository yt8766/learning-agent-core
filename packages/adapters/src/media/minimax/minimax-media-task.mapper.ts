import type { MediaGenerationTask, MediaKind, MediaProviderError, MediaTaskStatus } from '@agent/core';

export type MiniMaxTaskStatus = 'Preparing' | 'Queueing' | 'Processing' | 'Unknown' | 'Success' | 'Fail';

export interface MiniMaxTaskMapperInput {
  readonly taskId: string;
  readonly kind: MediaKind;
  readonly providerTaskId?: string;
  readonly status: MiniMaxTaskStatus;
  readonly assetRefs?: readonly string[];
  readonly evidenceRefs?: readonly string[];
  readonly error?: MediaProviderError;
  readonly now: string;
}

export function mapMiniMaxTask(input: MiniMaxTaskMapperInput): MediaGenerationTask {
  const status = mapMiniMaxTaskStatus(input.status);

  return {
    taskId: input.taskId,
    kind: input.kind,
    provider: 'minimax',
    status,
    providerTaskId: input.providerTaskId,
    assetRefs: [...(input.assetRefs ?? [])],
    evidenceRefs: [...(input.evidenceRefs ?? [])],
    error: input.error,
    createdAt: input.now,
    updatedAt: input.now,
    completedAt: status === 'succeeded' || status === 'failed' ? input.now : undefined
  };
}

export function mapMiniMaxTaskStatus(status: MiniMaxTaskStatus): MediaTaskStatus {
  switch (status) {
    case 'Preparing':
    case 'Queueing':
      return 'queued';
    case 'Processing':
    case 'Unknown':
      return 'running';
    case 'Success':
      return 'succeeded';
    case 'Fail':
      return 'failed';
  }
}

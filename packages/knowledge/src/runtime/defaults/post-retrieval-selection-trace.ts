import type { RetrievalHit } from '../../index';
import type { PostRetrievalSelectionTraceEntry } from '../types/retrieval-runtime.types';

export type PostRetrievalTraceStage = 'filtering' | 'ranking' | 'diversification' | 'post-processor';

export type PostRetrievalTraceDropReason = PostRetrievalSelectionTraceEntry['reason'];

export interface PostRetrievalTraceStageSnapshot {
  stage: PostRetrievalTraceStage;
  inputHits: RetrievalHit[];
  outputHits: RetrievalHit[];
  droppedReason?: Exclude<PostRetrievalTraceDropReason, 'selected'>;
  droppedReasonByChunkId?: Record<string, Exclude<PostRetrievalTraceDropReason, 'selected'>>;
}

export function buildPostRetrievalSelectionTrace(
  stages: PostRetrievalTraceStageSnapshot[]
): PostRetrievalSelectionTraceEntry[] {
  const dropped = new Map<string, PostRetrievalSelectionTraceEntry>();
  let latestOutput: RetrievalHit[] = [];

  for (const stage of stages) {
    latestOutput = stage.outputHits;
    const outputIds = new Set(stage.outputHits.map(hit => hit.chunkId));

    for (const hit of stage.inputHits) {
      if (outputIds.has(hit.chunkId) || dropped.has(hit.chunkId)) {
        continue;
      }

      dropped.set(hit.chunkId, {
        chunkId: hit.chunkId,
        sourceId: hit.sourceId,
        selected: false,
        stage: stage.stage,
        reason: stage.droppedReasonByChunkId?.[hit.chunkId] ?? stage.droppedReason ?? 'post-processor-min-score',
        score: hit.score
      });
    }
  }

  const selected = latestOutput.map((hit, order) => ({
    chunkId: hit.chunkId,
    sourceId: hit.sourceId,
    selected: true,
    stage: 'post-processor' as const,
    reason: 'selected' as const,
    score: hit.score,
    order
  }));

  return [...dropped.values(), ...selected];
}

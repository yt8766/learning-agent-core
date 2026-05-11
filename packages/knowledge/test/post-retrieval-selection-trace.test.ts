import { describe, expect, it } from 'vitest';

import type { RetrievalHit } from '@agent/knowledge';
import {
  buildPostRetrievalSelectionTrace,
  type PostRetrievalTraceStageSnapshot
} from '../src/runtime/defaults/post-retrieval-selection-trace';

function makeHit(overrides: Partial<RetrievalHit> = {}): RetrievalHit {
  return {
    chunkId: 'chunk-1',
    documentId: 'doc-1',
    sourceId: 'source-1',
    title: 'Guide',
    uri: '/guide.md',
    sourceType: 'repo-docs',
    trustClass: 'internal',
    content: 'useful content',
    score: 0.8,
    citation: {
      sourceId: 'source-1',
      chunkId: 'chunk-1',
      title: 'Guide',
      uri: '/guide.md',
      sourceType: 'repo-docs',
      trustClass: 'internal'
    },
    ...overrides
  };
}

describe('buildPostRetrievalSelectionTrace', () => {
  it('marks filter drops using diagnostics reasons', () => {
    const kept = makeHit({ chunkId: 'kept', score: 0.9 });
    const lowScore = makeHit({ chunkId: 'low', score: 0.01 });
    const stages: PostRetrievalTraceStageSnapshot[] = [
      {
        stage: 'filtering',
        inputHits: [kept, lowScore],
        outputHits: [kept],
        droppedReason: 'low-score'
      },
      {
        stage: 'post-processor',
        inputHits: [kept],
        outputHits: [kept]
      }
    ];

    const trace = buildPostRetrievalSelectionTrace(stages);

    expect(trace).toEqual([
      {
        chunkId: 'low',
        sourceId: 'source-1',
        selected: false,
        stage: 'filtering',
        reason: 'low-score',
        score: 0.01
      },
      {
        chunkId: 'kept',
        sourceId: 'source-1',
        selected: true,
        stage: 'post-processor',
        reason: 'selected',
        score: 0.9,
        order: 0
      }
    ]);
  });

  it('marks diversification drops as source-limit or parent-limit', () => {
    const selected = makeHit({ chunkId: 'selected', sourceId: 'source-a', score: 0.9 });
    const sourceLimited = makeHit({ chunkId: 'source-limited', sourceId: 'source-a', score: 0.8 });
    const parentLimited = makeHit({
      chunkId: 'parent-limited',
      sourceId: 'source-b',
      score: 0.7,
      metadata: { parentId: 'parent-1' }
    });

    const trace = buildPostRetrievalSelectionTrace([
      {
        stage: 'diversification',
        inputHits: [selected, sourceLimited, parentLimited],
        outputHits: [selected],
        droppedReasonByChunkId: {
          'source-limited': 'source-limit',
          'parent-limited': 'parent-limit'
        }
      },
      {
        stage: 'post-processor',
        inputHits: [selected],
        outputHits: [selected]
      }
    ]);

    expect(trace.map(entry => [entry.chunkId, entry.reason])).toEqual([
      ['source-limited', 'source-limit'],
      ['parent-limited', 'parent-limit'],
      ['selected', 'selected']
    ]);
  });
});

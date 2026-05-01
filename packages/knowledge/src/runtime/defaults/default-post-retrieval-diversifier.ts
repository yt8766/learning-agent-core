import type {
  PostRetrievalDiversificationContext,
  PostRetrievalDiversificationPolicy,
  PostRetrievalDiversifier,
  PostRetrievalDiversifyResult
} from '../stages/post-retrieval-diversifier';
import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';
import type { RetrievalHit } from '@agent/knowledge';

function resolvePolicy(
  policy: PostRetrievalDiversificationPolicy | undefined,
  fallbackLimit: number
): Required<PostRetrievalDiversificationPolicy> {
  return {
    maxPerSource: policy?.maxPerSource ?? fallbackLimit,
    maxPerParent: policy?.maxPerParent ?? fallbackLimit
  };
}

export class DefaultPostRetrievalDiversifier implements PostRetrievalDiversifier {
  constructor(private readonly defaultPolicy: PostRetrievalDiversificationPolicy = {}) {}

  async diversify(
    hits: RetrievalHit[],
    request: NormalizedRetrievalRequest,
    context?: PostRetrievalDiversificationContext
  ): Promise<PostRetrievalDiversifyResult> {
    const policy = resolvePolicy(context?.policy ?? this.defaultPolicy, hits.length);
    const sourceCounts = new Map<string, number>();
    const parentCounts = new Map<string, number>();
    const selected: RetrievalHit[] = [];
    const deferredBySourceLimit: RetrievalHit[] = [];

    for (const hit of hits) {
      if (selected.length >= request.topK) {
        break;
      }

      const sourceCount = sourceCounts.get(hit.sourceId) ?? 0;
      if (sourceCount >= policy.maxPerSource) {
        deferredBySourceLimit.push(hit);
        continue;
      }

      const parentId = typeof hit.metadata?.parentId === 'string' ? hit.metadata.parentId : undefined;
      if (parentId) {
        const parentCount = parentCounts.get(parentId) ?? 0;
        if (parentCount >= policy.maxPerParent) {
          continue;
        }
        parentCounts.set(parentId, parentCount + 1);
      }

      sourceCounts.set(hit.sourceId, sourceCount + 1);
      selected.push(hit);
    }

    for (const hit of deferredBySourceLimit) {
      if (selected.length >= request.topK) {
        break;
      }

      selected.push(hit);
    }

    return {
      hits: selected,
      diagnostics: {
        enabled: true,
        strategy: 'source-parent-section-coverage',
        beforeCount: hits.length,
        afterCount: selected.length,
        maxPerSource: policy.maxPerSource,
        maxPerParent: policy.maxPerParent
      }
    };
  }
}

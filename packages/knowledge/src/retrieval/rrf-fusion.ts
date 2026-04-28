import type { RetrievalHit } from '@agent/knowledge';

/**
 * Reciprocal Rank Fusion。
 * 输入多路按 score 降序排列的 RetrievalHit[][] 数组。
 * 公式：rrfScore(chunk) = Σ(路) 1 / (k + rank)，rank 从 1 开始。
 * 同一 chunkId 在多路出现时自动去重，保留第一次出现的元数据。
 * 默认 k=60（文献标准值）。
 */
export function rrfFusion(rankLists: RetrievalHit[][], k = 60): RetrievalHit[] {
  const scoreMap = new Map<string, number>();
  const hitMap = new Map<string, RetrievalHit>();

  for (const list of rankLists) {
    list.forEach((hit, index) => {
      const rank = index + 1;
      const prev = scoreMap.get(hit.chunkId) ?? 0;
      scoreMap.set(hit.chunkId, prev + 1 / (k + rank));
      if (!hitMap.has(hit.chunkId)) {
        hitMap.set(hit.chunkId, hit);
      }
    });
  }

  return [...scoreMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([chunkId, score]) => ({
      ...hitMap.get(chunkId)!,
      score
    }));
}

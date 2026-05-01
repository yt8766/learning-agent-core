import type { VectorSearchHit, VectorSearchOptions, VectorSearchProvider } from './vector-search-provider';

/**
 * 基于 bigram（字符二元组）频率向量 + 余弦相似度的内存 VectorSearchProvider。
 * 不依赖任何 LLM 或外部服务，用于测试和 demo。
 * 生产环境换成真实 embedding provider 无需改动上游代码。
 */
export class InMemoryVectorSearchProvider implements VectorSearchProvider {
  private readonly store = new Map<string, string>();
  private vocabulary: string[] = [];

  register(chunkId: string, content: string): void {
    const bigrams = toBigrams(content);
    // Update vocabulary with new bigrams
    for (const bigram of bigrams) {
      if (!this.vocabulary.includes(bigram)) {
        this.vocabulary.push(bigram);
      }
    }
    // Store original content for re-vectorization
    this.store.set(chunkId, content);
  }

  async searchSimilar(query: string, topK: number, _options?: VectorSearchOptions): Promise<VectorSearchHit[]> {
    if (this.store.size === 0) {
      return [];
    }

    const queryVec = this.toVector(query);
    const results: VectorSearchHit[] = [];

    for (const [chunkId, content] of this.store) {
      const chunkVec = this.toVector(content);
      const score = cosineSimilarity(queryVec, chunkVec);
      if (score > 0) {
        results.push({ chunkId, score });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  private toVector(text: string): number[] {
    const bigrams = toBigrams(text);
    return this.vocabulary.map(bigram => bigrams.filter(b => b === bigram).length);
  }
}

function toBigrams(text: string): string[] {
  const normalized = text.toLowerCase();
  const bigrams: string[] = [];
  for (let i = 0; i < normalized.length - 1; i++) {
    bigrams.push(normalized.slice(i, i + 2));
  }
  return bigrams;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const aVal = a[i];
    const bVal = b[i];
    if (aVal !== undefined && bVal !== undefined) {
      dot += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

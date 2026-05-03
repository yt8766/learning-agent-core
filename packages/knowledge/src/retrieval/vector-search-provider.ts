import type { ResolvedKnowledgeRetrievalFilters } from './knowledge-retrieval-filters';

/** 单个向量搜索命中结果 */
export interface VectorSearchHit {
  chunkId: string;
  /** Optional provider-side knowledge base projection, when the vector backend returns scoped metadata. */
  knowledgeBaseId?: string;
  /** 余弦相似度，范围 [0, 1] */
  score: number;
}

export interface VectorSearchOptions {
  filters?: ResolvedKnowledgeRetrievalFilters;
}

export interface VectorSearchProviderHealthCheckResult {
  status: 'healthy' | 'degraded';
  message?: string;
}

/**
 * 向量检索注入点。
 * 实现此接口：embed query + 计算相似度 + 返回 topK 结果。
 * 失败时 throw，由 HybridRetrievalEngine 这类上层编排负责降级与 diagnostics。
 */
export interface VectorSearchProvider {
  searchSimilar(query: string, topK: number, options?: VectorSearchOptions): Promise<VectorSearchHit[]>;
  healthCheck?(): Promise<VectorSearchProviderHealthCheckResult>;
}

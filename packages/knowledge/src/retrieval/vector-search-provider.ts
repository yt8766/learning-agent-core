/** 单个向量搜索命中结果 */
export interface VectorSearchHit {
  chunkId: string;
  /** 余弦相似度，范围 [0, 1] */
  score: number;
}

/**
 * 向量检索注入点。
 * 实现此接口：embed query + 计算相似度 + 返回 topK 结果。
 * 失败时 throw，由 VectorKnowledgeSearchService 捕获处理降级。
 */
export interface VectorSearchProvider {
  searchSimilar(query: string, topK: number): Promise<VectorSearchHit[]>;
}

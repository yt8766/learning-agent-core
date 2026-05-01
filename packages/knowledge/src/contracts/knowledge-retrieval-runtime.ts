import type { RetrievalRequest } from '@agent/knowledge';

import type { ContextAssembler } from '../runtime/stages/context-assembler';
import type { ContextExpander, ContextExpansionPolicy } from '../runtime/stages/context-expander';
import type { PostRetrievalDiversifier } from '../runtime/stages/post-retrieval-diversifier';
import type { PostRetrievalFilter, RetrievalSafetyScanner } from '../runtime/stages/post-retrieval-filter';
import type { PostRetrievalRanker, RetrievalRerankProvider } from '../runtime/stages/post-retrieval-ranker';
import type { QueryNormalizer } from '../runtime/stages/query-normalizer';
import type { RetrievalPostProcessor } from '../runtime/stages/post-processor';
import type { KnowledgeRetrievalResult } from '../runtime/types/retrieval-runtime.types';
import type { KnowledgeFacade } from './knowledge-facade';

export interface RetrievalPipelineConfig {
  /**
   * 检索前 query 归一化处理器。
   * - 传入单个 QueryNormalizer：直接使用
   * - 传入数组：按顺序串联执行，每步输出作为下步输入
   * - 传入空数组或不传：使用默认规则式 DefaultQueryNormalizer
   * 调用方可传入 SDK 内置实现（DefaultQueryNormalizer、LlmQueryNormalizer）、
   * 自定义实现，或两者的任意组合。
   */
  queryNormalizer?: QueryNormalizer | QueryNormalizer[];
  postRetrievalFilter?: PostRetrievalFilter;
  safetyScanner?: RetrievalSafetyScanner;
  postRetrievalRanker?: PostRetrievalRanker;
  rerankProvider?: RetrievalRerankProvider;
  postRetrievalDiversifier?: PostRetrievalDiversifier;
  postProcessor?: RetrievalPostProcessor;
  contextExpander?: ContextExpander;
  contextExpansionPolicy?: ContextExpansionPolicy;
  contextAssembler?: ContextAssembler;
}

export interface KnowledgeRetrievalRuntime extends KnowledgeFacade {
  retrieve(request: RetrievalRequest, pipeline?: RetrievalPipelineConfig): Promise<KnowledgeRetrievalResult>;
}

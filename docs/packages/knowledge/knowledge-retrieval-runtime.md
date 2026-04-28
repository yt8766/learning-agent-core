# packages/knowledge 知识检索运行时设计文档

状态：current
文档类型：architecture
适用范围：`packages/knowledge/src/runtime/`
最后核对：2026-04-28（2026-04-28 LLM 改写更新）

## 背景与定位

`packages/knowledge/src/runtime/` 是知识检索的**在线链路编排层**，负责把查询请求通过三段式 pipeline 转化为可供 agent runtime 消费的检索结果与上下文材料。

> **重要边界**：`packages/runtime` 是多 Agent Runtime Kernel，负责 graph、session、approval、orchestration。知识检索 runtime 属于 `packages/knowledge`，不属于 `packages/runtime`。

## 三阶段 Pipeline

```text
RetrievalRequest
  ─→ query normalization   （规范化/改写/生成 query variants/决定 topK）
  ─→ retrieval             （按 query variants 召回候选 hits）
  ─→ merge                 （按 chunkId 去重并保留最高分命中）
  ─→ post-process          （score 过滤 + limit trim）
  ─→ KnowledgeRetrievalResult（hits + contextBundle? + diagnostics?）
```

**不含 generation 阶段**。生成回答由 `packages/runtime` 主链 + `agents/*` 负责。

## 核心文件结构

```
packages/knowledge/src/
  contracts/
    knowledge-retrieval-runtime.ts    ← KnowledgeRetrievalRuntime 接口，RetrievalPipelineConfig
  runtime/
    pipeline/
      run-knowledge-retrieval.ts      ← 函数式主入口 runKnowledgeRetrieval()
    stages/
      query-normalizer.ts             ← QueryNormalizer 接口 + QueryRewriteProvider 接口
      post-processor.ts               ← RetrievalPostProcessor 接口
      context-assembler.ts            ← ContextAssembler 接口
    defaults/
      default-query-normalizer.ts     ← deterministic rewrite + query variant generation
      default-query-normalizer.helpers.ts
      default-post-processor.ts       ← score > 0 过滤 + topK trim
      default-context-assembler.ts    ← 拼接 [N] title\ncontent
      retrieval-runtime-defaults.ts   ← DEFAULT_RETRIEVAL_LIMIT = 5 等常量
    normalizers/
      llm-query-normalizer.ts         ← LlmQueryNormalizer：LLM 改写 + 失败降级
    types/
      retrieval-runtime.types.ts      ← KnowledgeRetrievalResult / Diagnostics / NormalizedRetrievalRequest
    local-knowledge-facade.ts         ← 实现 KnowledgeRetrievalRuntime，默认内存存储
```

## 关键接口

### KnowledgeRetrievalRuntime

```ts
interface KnowledgeRetrievalRuntime extends KnowledgeFacade {
  retrieve(request: RetrievalRequest, pipeline?: RetrievalPipelineConfig): Promise<KnowledgeRetrievalResult>;
}
```

`KnowledgeFacade` 的所有属性（sourceRepository / chunkRepository / searchService）仍然可用，`retrieve()` 是新增的 pipeline 入口。

### 函数式入口 runKnowledgeRetrieval

```ts
interface KnowledgeRetrievalRunOptions {
  request: RetrievalRequest;
  searchService: KnowledgeSearchService;
  pipeline?: RetrievalPipelineConfig;
  assembleContext?: boolean; // 是否组装 contextBundle，默认 false
  includeDiagnostics?: boolean; // 是否返回诊断信息，默认 false
}

function runKnowledgeRetrieval(options: KnowledgeRetrievalRunOptions): Promise<KnowledgeRetrievalResult>;
```

### QueryRewriteProvider（LLM 改写注入点）

```ts
/** 调用方注入的 LLM 改写能力。失败时 normalizer 会静默降级，不中断检索。 */
interface QueryRewriteProvider {
  rewrite(query: string): Promise<string>;
}
```

`QueryRewriteProvider` 是轻量 adapter 接口，目的是让调用方注入任意 LLM（OpenAI / Anthropic / 内部 model router 均可），而不把具体 SDK 绑定进 `packages/knowledge`。

### LlmQueryNormalizer

```ts
class LlmQueryNormalizer implements QueryNormalizer {
  constructor(provider: QueryRewriteProvider, fallbackNormalizer?: QueryNormalizer);
  normalize(request: RetrievalRequest): Promise<NormalizedRetrievalRequest>;
}
```

- 先调用 `provider.rewrite(query)` 进行语义改写
- 失败时（任何错误/reject）静默降级到 `fallbackNormalizer`（默认 `DefaultQueryNormalizer`）
- 降级路径不会 throw，不影响主检索流程
- 可通过 `pipeline.queryNormalizer` 单个注入，也可组合进串联数组

```ts
interface KnowledgeRetrievalResult {
  hits: RetrievalHit[];
  total: number;
  contextBundle?: string; // 仅当 assembleContext: true 时返回
  diagnostics?: RetrievalDiagnostics;
}
```

当前 diagnostics 至少包含：

- `originalQuery`
- `normalizedQuery`
- `rewriteApplied`
- `rewriteReason`
- `queryVariants`
- `executedQueries`
- `preHitCount`
- `postHitCount`

## Schema 复用策略

所有知识检索稳定 contract（`RetrievalRequest` / `RetrievalResult` / `RetrievalHit` / `Citation`）全部来自 `@agent/knowledge` 的本包 `contracts/`，不再从 `@agent/core` 消费。运行时专属类型（`KnowledgeRetrievalResult` / `RetrievalDiagnostics` / `NormalizedRetrievalRequest`）放在 `runtime/types/`，不放进 core。

## 命名约定

| 用途       | 命名                                                              | 说明                                                |
| ---------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| 函数式入口 | `runKnowledgeRetrieval()`                                         | 不用 `createRuntime()` 避免与 `@agent/runtime` 混淆 |
| 对象接口   | `KnowledgeRetrievalRuntime`                                       | 区分 `AgentRuntime`                                 |
| 阶段接口   | `QueryNormalizer` / `RetrievalPostProcessor` / `ContextAssembler` | 不使用 `Generator`（属于 agent runtime 职责）       |

## 使用示例

```ts
import { LocalKnowledgeFacade, LlmQueryNormalizer, runKnowledgeRetrieval } from '@agent/knowledge';

// 方式一：facade.retrieve（走默认 pipeline，不含 LLM 改写）
const facade = new LocalKnowledgeFacade();
const result = await facade.retrieve({ query: 'retrieval pipeline' });

// 方式二：注入 LLM 改写（实现 QueryRewriteProvider 接口）
class MyLlmProvider {
  async rewrite(query: string): Promise<string> {
    // 调用自己的 LLM router / OpenAI / Anthropic，返回改写后 query
    return callMyLlm(query);
  }
}

const llmNormalizer = new LlmQueryNormalizer(new MyLlmProvider());

const llmResult = await runKnowledgeRetrieval({
  request: { query: 'How do I improve retrieval quality?' },
  searchService: facade.searchService,
  assembleContext: true,
  includeDiagnostics: true,
  pipeline: {
    queryNormalizer: llmNormalizer
  }
});

// 方式三：串联多个 normalizer（数组顺序执行，前一个输出作为后一个输入）
const chainedResult = await runKnowledgeRetrieval({
  request: { query: 'search quality' },
  searchService: facade.searchService,
  pipeline: {
    queryNormalizer: [llmNormalizer, anotherNormalizer]
  }
});
// chainedResult.contextBundle → prompt-ready 字符串
// chainedResult.diagnostics  → 运行时诊断信息（含 rewriteApplied / rewriteReason）
```

## 当前已实现

默认 runtime 现在已经包含：

- deterministic query cleanup
- 轻量 query rewrite
- bounded multi-query retrieval
- 按 `chunkId` 的命中合并
- richer retrieval diagnostics
- **LLM-based query rewrite**：通过 `LlmQueryNormalizer` + `QueryRewriteProvider` 接口，失败时自动降级
- `VectorSearchProvider` 接口（`src/retrieval/vector-search-provider.ts`）
- `InMemoryVectorSearchProvider`（bigram 余弦相似度，`src/retrieval/in-memory-vector-search-provider.ts`）
- `VectorKnowledgeSearchService`（Provider + Repo 映射，`src/retrieval/vector-knowledge-search-service.ts`）
- `rrfFusion`（RRF 纯函数，`src/retrieval/rrf-fusion.ts`）
- **`HybridKnowledgeSearchService`**（双路并行 + RRF 融合 + 降级，`src/retrieval/hybrid-knowledge-search-service.ts`）

## 仍未实现

当前默认 runtime 还没有实现这些更重的检索前增强：

- query decomposition（把一个复合问题拆成多个子查询）
- HyDE（Hypothetical Document Embeddings：先让 LLM 生成假想文档，再检索最近邻）
- semantic rerank beyond the current post-process hook（交叉编码器重排）

这些能力仍然建议通过 `QueryNormalizer` / `RetrievalPostProcessor` 的扩展点按需注入。

## 扩展点

| 场景                     | 注入方式                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| 接入向量检索             | 替换 `KnowledgeSearchService`                                                            |
| 接入 LLM query rewrite   | 实现 `QueryRewriteProvider` 并构造 `LlmQueryNormalizer`，注入 `pipeline.queryNormalizer` |
| 串联多个 normalizer      | `pipeline.queryNormalizer` 支持数组，顺序执行                                            |
| 接入语义 reranker        | 实现 `RetrievalPostProcessor` 注入 `pipeline.postProcessor`                              |
| 接入 query decomposition | 在 `QueryNormalizer` 中生成结构化 `queryVariants`                                        |
| 自定义 context 格式      | 实现 `ContextAssembler` 注入 `pipeline.contextAssembler`                                 |

## 测试

- `packages/knowledge/test/default-query-normalizer.test.ts` — 默认 rewrite / query variants 单元测试
- `packages/knowledge/test/run-knowledge-retrieval.test.ts` — pipeline runner 单元测试（含 multi-query merge 与 diagnostics）
- `packages/knowledge/test/local-knowledge-facade-retrieve.test.ts` — facade retrieve 集成测试
- `packages/knowledge/test/llm-query-normalizer.test.ts` — LLM 改写 + 降级路径单元测试
- `packages/knowledge/test/query-normalizer-chain.test.ts` — resolveNormalizerChain 串联行为测试
- `packages/knowledge/demo/retrieval-runtime.ts` — 最小可运行 demo

## 不属于此包的能力

| 能力            | 正确位置                             |
| --------------- | ------------------------------------ |
| 生成 answer     | `packages/runtime` 主链 + `agents/*` |
| 向量检索实现    | `packages/adapters`                  |
| 离线索引构建    | `packages/knowledge/src/indexing/`   |
| 知识 store 管理 | `apps/backend`                       |

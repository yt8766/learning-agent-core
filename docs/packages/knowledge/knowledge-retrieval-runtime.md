# packages/knowledge 知识检索运行时设计文档

状态：current
文档类型：architecture
适用范围：`packages/knowledge/src/runtime/`
最后核对：2026-04-24

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
      query-normalizer.ts             ← QueryNormalizer 接口
      post-processor.ts               ← RetrievalPostProcessor 接口
      context-assembler.ts            ← ContextAssembler 接口
    defaults/
      default-query-normalizer.ts     ← deterministic rewrite + query variant generation
      default-query-normalizer.helpers.ts
      default-post-processor.ts       ← score > 0 过滤 + topK trim
      default-context-assembler.ts    ← 拼接 [N] title\ncontent
      retrieval-runtime-defaults.ts   ← DEFAULT_RETRIEVAL_LIMIT = 5 等常量
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

### 结果类型

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

所有稳定 contract（`RetrievalRequest` / `RetrievalResult` / `RetrievalHit` / `Citation`）全部来自 `@agent/core`，不重新定义。运行时专属类型（`KnowledgeRetrievalResult` / `RetrievalDiagnostics` / `NormalizedRetrievalRequest`）放在 `runtime/types/`，不放进 core。

## 命名约定

| 用途       | 命名                                                              | 说明                                                |
| ---------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| 函数式入口 | `runKnowledgeRetrieval()`                                         | 不用 `createRuntime()` 避免与 `@agent/runtime` 混淆 |
| 对象接口   | `KnowledgeRetrievalRuntime`                                       | 区分 `AgentRuntime`                                 |
| 阶段接口   | `QueryNormalizer` / `RetrievalPostProcessor` / `ContextAssembler` | 不使用 `Generator`（属于 agent runtime 职责）       |

## 使用示例

```ts
import { LocalKnowledgeFacade, runKnowledgeRetrieval } from '@agent/knowledge';

// 方式一：facade.retrieve（走默认 pipeline）
const facade = new LocalKnowledgeFacade();
const result = await facade.retrieve({ query: 'retrieval pipeline' });

// 方式二：runKnowledgeRetrieval 自定义 pipeline + context assembly
const fullResult = await runKnowledgeRetrieval({
  request: { query: 'How do I improve retrieval quality?' },
  searchService: facade.searchService,
  assembleContext: true,
  includeDiagnostics: true,
  pipeline: {
    postProcessor: customReranker // 注入自定义 reranker
  }
});
// fullResult.contextBundle → prompt-ready 字符串
// fullResult.diagnostics  → 运行时诊断信息
```

## 当前已实现

默认 runtime 现在已经包含：

- deterministic query cleanup
- 轻量 query rewrite
- bounded multi-query retrieval
- 按 `chunkId` 的命中合并
- richer retrieval diagnostics

## 仍未实现

当前默认 runtime 还没有实现这些更重的检索前增强：

- query decomposition
- HyDE
- LLM-based rewrite
- semantic rerank beyond the current post-process hook

这些能力仍然建议通过 `QueryNormalizer` / `RetrievalPostProcessor` 的扩展点按需注入。

## 扩展点

| 场景                     | 注入方式                                                    |
| ------------------------ | ----------------------------------------------------------- |
| 接入向量检索             | 替换 `KnowledgeSearchService`                               |
| 接入 LLM query rewrite   | 实现 `QueryNormalizer` 注入 `pipeline.queryNormalizer`      |
| 接入语义 reranker        | 实现 `RetrievalPostProcessor` 注入 `pipeline.postProcessor` |
| 接入 query decomposition | 在 `QueryNormalizer` 中生成结构化 `queryVariants`           |
| 自定义 context 格式      | 实现 `ContextAssembler` 注入 `pipeline.contextAssembler`    |

## 测试

- `packages/knowledge/test/default-query-normalizer.test.ts` — 默认 rewrite / query variants 单元测试
- `packages/knowledge/test/run-knowledge-retrieval.test.ts` — pipeline runner 单元测试（含 multi-query merge 与 diagnostics）
- `packages/knowledge/test/local-knowledge-facade-retrieve.test.ts` — facade retrieve 集成测试
- `packages/knowledge/demo/retrieval-runtime.ts` — 最小可运行 demo

## 不属于此包的能力

| 能力            | 正确位置                             |
| --------------- | ------------------------------------ |
| 生成 answer     | `packages/runtime` 主链 + `agents/*` |
| 向量检索实现    | `packages/adapters`                  |
| 离线索引构建    | `packages/knowledge/src/indexing/`   |
| 知识 store 管理 | `apps/backend`                       |

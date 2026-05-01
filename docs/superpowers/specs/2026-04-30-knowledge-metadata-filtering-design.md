# Knowledge Metadata Filtering 主链设计

状态：snapshot
文档类型：plan
适用范围：`packages/knowledge`
最后核对：2026-04-30

## 1. 背景

当前 `packages/knowledge` 已有基础过滤能力，但只覆盖 `allowedSourceTypes` 级别：

- `DefaultKnowledgeSearchService` 在关键词打分前按 `allowedSourceTypes` 过滤。
- `VectorKnowledgeSearchService` 在向量 provider 召回后按 `allowedSourceTypes` 防御过滤。
- `HybridKnowledgeSearchService` 只透传 request，不直接解释过滤语义。

这还不是完整的 metadata filtering。按检索设计语义，metadata filtering 不是 query rewrite，也不是相似度算法，而是对“去哪里搜”施加结构化约束。它应该作为检索前范围约束进入主链，并在检索中和召回后保留防御过滤。

## 2. 目标

第一阶段目标是把当前局部过滤升级为统一过滤契约：

```text
Query Normalize
  -> Resolve Metadata Filters
  -> Keyword Search within filtered scope
  -> Vector Search with filter pushdown when available
  -> Defensive Filter
  -> Hybrid / RRF
  -> Post-process
  -> Context Assembly
  -> Diagnostics
```

本阶段完成后应具备：

- 统一 `filters` request contract。
- 旧字段 `allowedSourceTypes` / `minTrustClass` 继续兼容。
- keyword 路先过滤再打分。
- vector 路预留 filter pushdown，并保留本地防御过滤。
- hybrid 路在 fusion 前防御过滤。
- diagnostics 能解释过滤前后数量。

## 3. 非目标

第一阶段不实现：

- HyDE / Hypothetical Retrieval。
- Query Strategy Router。
- 完整 LangChain Adapter。
- cross-encoder rerank。
- eval dashboard。

这些能力后续必须复用本设计中的 resolved filters，不能绕过 metadata filtering。

> 2026-04-30 后续更新：Small-to-Big Expansion 第一阶段已完成，入口为 `SmallToBigContextExpander`。它复用本设计中的 resolved filters，只扩展 context assembly 输入，不改变 `result.hits`。执行记录见 `docs/superpowers/plans/2026-04-30-knowledge-small-to-big-expansion.md`。

## 4. Contract 设计

在 `packages/knowledge/src/contracts/schemas/knowledge-retrieval.schema.ts` 中新增 `KnowledgeRetrievalFiltersSchema`，并让 `RetrievalRequestSchema` 新增 `filters` 字段。

第一批进入正式契约的字段：

```ts
type KnowledgeRetrievalFilters = {
  sourceTypes?: KnowledgeSourceType[];
  sourceIds?: string[];
  documentIds?: string[];
  minTrustClass?: KnowledgeTrustClass;
  trustClasses?: KnowledgeTrustClass[];
  searchableOnly?: boolean;
  docTypes?: string[];
  statuses?: string[];
  allowedRoles?: string[];
};
```

`RetrievalRequest` 保持兼容：

```ts
type RetrievalRequest = {
  query: string;
  limit?: number;
  filters?: KnowledgeRetrievalFilters;

  // legacy compat
  allowedSourceTypes?: KnowledgeSourceType[];
  minTrustClass?: KnowledgeTrustClass;

  includeContextWindow?: boolean;
};
```

兼容映射规则：

```text
allowedSourceTypes -> filters.sourceTypes
minTrustClass -> filters.minTrustClass
```

暂不进入第一批实现的字段：

```text
departments
productLines
knowledgeBases
tags
timeRange
```

这些字段依赖 indexing 阶段能稳定产出对应 metadata，后续再按 schema-first 方式扩展。

## 5. Metadata 承载

当前稳定 `KnowledgeChunkSchema` 只有 `sourceId`、`documentId`、`chunkIndex`、`content`、`searchable` 等字段。为了支持 `docTypes`、`statuses`、`allowedRoles`，需要为 chunk 增加 JSON-safe metadata 承载字段，或把这些字段提升为稳定字段。

第一阶段推荐新增：

```ts
metadata?: {
  docType?: string;
  status?: string;
  allowedRoles?: string[];
};
```

如果实现时选择更通用的 `metadata: JsonObject`，必须保持 schema-first，并避免第三方 metadata 结构穿透 runtime 主链。

## 6. Filter Resolver

新增过滤解析 helper：

```text
packages/knowledge/src/retrieval/knowledge-retrieval-filters.ts
```

提供：

```ts
resolveKnowledgeRetrievalFilters(request: RetrievalRequest): ResolvedKnowledgeRetrievalFilters;
```

职责：

- 合并 `request.filters`。
- 兼容 `allowedSourceTypes`。
- 兼容 `minTrustClass`。
- 默认 `searchableOnly = true`。
- 输出供 search service、hybrid service、future expander 共用的 resolved filters。

## 7. Filter Matcher

同一 helper 文件提供：

```ts
matchesKnowledgeSourceFilters(source, filters): boolean;
matchesKnowledgeChunkFilters(chunk, filters): boolean;
matchesKnowledgeHitFilters(hit, filters): boolean;
```

匹配边界：

- `sourceTypes`、`sourceIds`、`trustClasses`、`minTrustClass` 匹配 source / hit。
- `documentIds`、`searchableOnly`、`docTypes`、`statuses`、`allowedRoles` 匹配 chunk metadata / hit metadata。
- `minTrustClass` 需要定义稳定顺序，不能按字符串字典序比较。

`KnowledgeTrustClass` 推荐顺序：

```text
unverified < community < curated < official < internal
```

## 8. Keyword Search 行为

`DefaultKnowledgeSearchService` 的目标流程：

```text
读取 chunks / sources
  -> resolve filters
  -> apply filters
  -> scoreKnowledgeChunk()
  -> sort
  -> limit
```

这使 keyword 路真正符合“先根据 metadata 限定范围，再做关键词检索”的语义。

## 9. Vector Search 行为

`VectorSearchProvider` 扩展为：

```ts
searchSimilar(
  query: string,
  topK: number,
  options?: { filters?: ResolvedKnowledgeRetrievalFilters }
): Promise<VectorSearchHit[]>;
```

执行策略：

- provider 支持过滤时，尽量下推 filters。
- provider 暂不支持过滤时，可扩大召回窗口，例如 `topK * 3`，再本地防御过滤并 slice 回 `topK`。
- 无论 provider 是否支持过滤，本地都必须再跑一次 defensive filter。

## 10. Hybrid Search 行为

`HybridKnowledgeSearchService` 不重新解释过滤语义：

```text
keyword.search(request)
vector.search(request)
  -> pre-fusion defensive filter
  -> rrfFusion
  -> limit
```

pre-fusion defensive filter 是安全网，用于兜住第三方 retriever、adapter 或 provider 没有严格执行 filters 的情况。

## 11. Diagnostics

`RetrievalDiagnostics` 新增 filtering 字段：

```ts
type RetrievalFilteringDiagnostics = {
  enabled: boolean;
  stages: Array<{
    stage: 'pre-merge-defensive' | 'context-expansion-defensive';
    beforeCount: number;
    afterCount: number;
    droppedCount: number;
  }>;
};
```

第一阶段当前真实实现记录：

- `pre-merge-defensive`：`runKnowledgeRetrieval()` 在多 query variants 合并前统一兜底过滤。
- `context-expansion-defensive`：保留给 context expansion / Small-to-Big 对候选 chunk 的兜底过滤语义；当前扩展细节主要落在 `diagnostics.contextExpansion`。

这样可以区分“没有召回”和“被 metadata filter 过滤掉”。

更细粒度的 `pre-keyword`、`post-vector-defensive`、`pre-fusion-defensive` stage 仍有诊断价值，但当前尚未作为稳定 runtime diagnostics contract 暴露；后续若要让调用方按这些 stage 消费，必须先更新 `RetrievalFilteringDiagnostics` 类型、测试和文档。

## 12. 测试要求

必须覆盖：

- legacy `allowedSourceTypes` 映射为 `filters.sourceTypes`。
- legacy `minTrustClass` 映射为 `filters.minTrustClass`。
- keyword search 先过滤再打分。
- vector search 对 provider 返回结果做防御过滤。
- hybrid search 在 RRF 前不会混入不符合 filters 的 hit。
- `docTypes`、`statuses`、`allowedRoles` 能过滤 chunk metadata。
- diagnostics 记录 `beforeCount`、`afterCount`、`droppedCount`。

建议使用“报销流程”测试数据：

```text
doc1: sales / policy / active / role sales
doc2: procurement / policy / active / role procurement
doc3: sales / policy / inactive / role sales
doc4: sales / workflow / active / role sales
```

请求：

```ts
{
  query: "报销流程怎么走",
  filters: {
    docTypes: ["policy"],
    statuses: ["active"],
    allowedRoles: ["sales"]
  }
}
```

期望只返回符合 filters 的候选，并在 diagnostics 中记录过滤数量。

## 13. 文档更新

实现时必须同步更新：

- `docs/packages/knowledge/knowledge-retrieval-runtime.md`
- `docs/packages/knowledge/indexing-contract-guidelines.md`

需要写清：

- Metadata Filtering 是检索前范围约束。
- `filters` 是新入口。
- `allowedSourceTypes` / `minTrustClass` 是兼容入口。
- vector provider 应支持 filter pushdown。
- defensive filter 是安全网，不是主过滤语义。
- 后续 Small-to-Big Expansion 回补 parent / neighbor 时必须复用 resolved filters。

## 14. 后续演进

第二阶段可以继续加入：

- `departments`
- `productLines`
- `knowledgeBases`
- `tags`
- `timeRange`
- Small-to-Big Expansion 阶段过滤
- filter-aware eval cases

这些扩展必须先确认 indexing metadata 已稳定产出，再进入正式 contract。

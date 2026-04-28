# knowledge 文档目录

状态：current
文档类型：index
适用范围：`docs/packages/knowledge/`
最后核对：2026-04-28（2026-04-28 LLM 改写更新）

本目录用于沉淀 `packages/knowledge` 相关文档。

包边界：

- 职责：
  - RAG 知识源接入、文档标准化、chunking、索引写入、检索、重排、citation/context 组装
  - 本地知识 ingestion / overview / artifact snapshot facade
- 允许：
  - knowledge source / chunk repository
  - retrieval contract
  - citation contract
  - indexing / retrieval runtime
  - 本地 docs/package manifest ingestion、chunk/embedding receipt 持久化
- 禁止：
  - chat / workflow 主链编排
  - 最终回答生成
  - app view model
  - provider SDK 具体实现
- 依赖方向：
  - 允许依赖 `@agent/config`、`@agent/adapters`、`@agent/memory`
  - 被 `runtime`、`agents/*` 与 backend 消费
- 公开入口：
  - 根入口：`@agent/knowledge`

约定：

- `packages/knowledge` 是知识检索宿主，不是 memory 的别名
- 稳定知识契约沉淀到 `packages/knowledge/src/contracts/*`，不要恢复 `packages/core/src/knowledge/*`
- 具体 provider / vector-store / loader 适配器仍放在 `packages/adapters`

当前文档：

- [indexing-package-guidelines.md](/docs/packages/knowledge/indexing-package-guidelines.md)
- [knowledge-retrieval-runtime.md](/docs/packages/knowledge/knowledge-retrieval-runtime.md)

当前实现补充：

- `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`
  - 当前已支持 deterministic query cleanup、轻量 rewrite 与 bounded query variants
  - 会按 query variants 执行多次检索，再按 `chunkId` 合并命中并保留最高分结果
  - diagnostics 会暴露 `originalQuery`、`normalizedQuery`、`rewriteApplied`、`rewriteReason`、`queryVariants`、`executedQueries`
  - `pipeline.queryNormalizer` 支持单个或数组（`resolveNormalizerChain` 串联执行）

- `packages/knowledge/src/runtime/normalizers/llm-query-normalizer.ts`
  - 接受 `QueryRewriteProvider` 注入，调用 LLM 进行语义改写
  - 失败时静默降级，不中断检索流程
  - 调用方实现 `QueryRewriteProvider.rewrite(query)` 即可接入任意 LLM

- `packages/knowledge/src/runtime/local-knowledge-store.ts`
  - 是当前本地知识摄取与概览读取的真实宿主
  - 负责 `ingestLocalKnowledge`、`readKnowledgeOverview`、`listKnowledgeArtifacts`、`buildKnowledgeDescriptor`
  - backend 的 `apps/backend/agent-server/src/runtime/knowledge/runtime-knowledge-store.ts` 仅保留 thin compat re-export
- `packages/knowledge/src/runtime/local-knowledge-store.helpers.ts`
  - 承载本地 docs/package manifest 枚举、chunk 切分、embedding 写盘与 snapshot 读写
  - 如果继续增长，应优先拆到 `packages/knowledge/src/runtime/` 下的更细 helper，而不是把逻辑再放回 backend

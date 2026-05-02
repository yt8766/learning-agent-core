# Knowledge Indexing 规范

状态：current
文档类型：convention
适用范围：`packages/knowledge/src/indexing/*`
最后核对：2026-04-30（writer fanout 闭环核对）

## 1. 定位

`packages/knowledge/src/indexing` 是当前仓库中 RAG 离线索引链路的宿主。

它负责把原始知识内容加工成运行时可检索的数据资产，核心流程固定为：

```text
load -> filter(optional) -> chunk -> metadata build -> writer fanout -> result collect
```

这里的 `indexing` 是 pipeline orchestration 层，不是 provider SDK 封装层，也不是 runtime 检索层。

当前 `runKnowledgeIndexing()` 不直接持有 embedder，也不直接绑定真实 vector store。它把 chunk 转为 `KnowledgeVectorDocumentRecord` 后写入注入的 `KnowledgeVectorIndexWriter`；embedding 与向量索引持久化由 `@agent/memory` 的 vector boundary 负责。若调用方同时提供 `KnowledgeSourceIndexWriter` 和 `KnowledgeFulltextIndexWriter`，同一批文档会额外写入 `KnowledgeSource` 与 `KnowledgeChunk` 边界，用于关键词检索、Small-to-Big 上下文回补和 Runtime Center source 观测。

Runtime metadata filtering 与 Small-to-Big Expansion 已依赖 chunk metadata 的稳定语义。新增或调整索引 metadata 时，必须同步核对 `docs/packages/knowledge/indexing-contract-guidelines.md`：`docType`、`status`、`allowedRoles`、`parentId`、`prevChunkId`、`nextChunkId`、`sectionId`、`sectionTitle` 都必须保持 JSON-safe，不能把第三方对象、权限 SDK 类型或 vendor response 直接写入 metadata。

## 2. 边界

### 2.1 indexing 负责什么

- 定义知识索引流水线阶段
- 提供统一入口 `runKnowledgeIndexing`
- 提供默认 chunker
- 组织 loader、chunker、vector writer、fulltext writer 的调用关系
- 组织可选 source writer，确保 user upload、catalog sync、web curated 等生产来源不仅有 chunk，也有稳定 `KnowledgeSource`
- 统一批次、上下文、warning 汇总与结果统计

### 2.2 indexing 不负责什么

- 不负责定义跨包共享知识契约主定义
- 不负责绑定真实 embedding 模型或真实向量库
- 不负责 runtime 检索、rerank 或回答生成
- 不负责 app / backend controller 编排
- 不负责把 provider SDK 直接塞进 indexing 目录

## 3. 与其他包的关系

### 3.1 `packages/knowledge/src/contracts`

稳定公共知识契约放在 `packages/knowledge/src/contracts/*`。

当前 indexing 应复用这些类型：

- `KnowledgeSource`
- `KnowledgeChunk`
- `KnowledgeSourceType`
- `KnowledgeTrustClass`

禁止在 `packages/knowledge/src/indexing` 再重复定义这些公共模型，也不要把 indexing contract 恢复到 `packages/core/src/knowledge/*`。

### 3.2 `packages/adapters`

真实 loader / embedding / vector-store / reranker 适配器应放在 `packages/adapters`。

`indexing` 只能依赖抽象接口和注入进来的实现，不能自己变成 provider 聚合层。

### 3.3 `packages/runtime`

`runtime` 只消费 indexing 结果或 facade，不反向持有 indexing 的内部阶段逻辑。

运行时检索和离线索引必须分开，不能把 `retrieve` 回塞进 `indexing/`.

## 4. 目录规范

当前 canonical host：

```text
packages/knowledge/src/indexing/
  chunkers/
  defaults/
  loaders/
  pipeline/
  transformers/
  types/
  writers/
  index.ts
```

各目录职责：

- `loaders/`
  - 将外部来源组织成 `KnowledgeIndexingDocument[]`
- `transformers/`
  - 做清洗、规范化、裁剪、结构转换
- `chunkers/`
  - 把文档切分成 `KnowledgeChunk[]`
- `writers/`
  - 可放 indexing 本地 writer 适配；当前稳定 writer 契约在 `types/` 中声明，并由调用方注入实现
- `pipeline/`
  - 放 `runKnowledgeIndexing` 这类编排入口
- `defaults/`
  - 放默认 chunk size、batch size、default shouldIndex 等默认策略
- `types/`
  - 放 indexing 内部运行时类型，不重复定义 core stable contract

## 5. 扩展规则

后续 AI 扩展时默认遵守：

1. 新增真实文件系统 loader、飞书 loader 等来源 adapter 时，优先新增实现到 `packages/adapters`，这里只保留协议和 orchestration 接口。当前知识库暂不建设真实网页抓取 loader；`web-curated` 仅表示外部或人工已整理内容进入统一 ingestion 边界。
2. 新增真实 embedding provider 时，优先新增 `@agent/memory` vector boundary 或 adapter 内部实现，不要让 embedding provider 类型穿透到 `runKnowledgeIndexing`。
3. 新增 metadata builder、filter、retry、incremental strategy 时，优先新增独立实现点，不要持续堆叠 `if/else`。
4. 如果 indexing 子域文件继续增长，优先补 `shared/` 或 `policies/`，不要把复杂逻辑堆回 `pipeline/run-knowledge-indexing.ts`。
5. 如果未来出现稳定对外 DTO，再补 `schemas/`，并保持 schema-first。

## 6. 当前入口

当前最重要的入口文件：

- [packages/knowledge/src/indexing/index.ts](/packages/knowledge/src/indexing/index.ts)
- [packages/knowledge/src/indexing/pipeline/run-knowledge-indexing.ts](/packages/knowledge/src/indexing/pipeline/run-knowledge-indexing.ts)
- 所有规范文档统一放在 `docs/packages/knowledge/*`，不要在 `packages/knowledge/*` 下继续新增 handoff README 或重复说明

当前默认实现只有 `FixedWindowChunker`。loader、vector writer、fulltext writer 都必须由调用方显式注入。

当前提供的 loader：

- `createKnowledgeSourceIngestionLoader(payloads)`：把调用方传入的生产来源产物规范化为 indexing `Document[]`。payload 必须显式包含 `sourceId`、`sourceType`、`uri`、`title`、`trustClass`、`content`；可选 `documentId`、`version`、JSON-safe `metadata`。它适合 user upload、catalog sync、web curated、connector content 这类“调用方已经拿到内容”的接线场景。

Writer fanout 的当前边界：

- `vectorIndex: KnowledgeVectorIndexWriter` 是必填项；每个 indexed chunk 都会写入 `upsertKnowledge(record)`。
- `sourceIndex?: KnowledgeSourceIndexWriter` 是可选项；提供后每个 indexed source 都会写入 `upsertKnowledgeSource(source)`，skipped document 不会写入 source。
- `fulltextIndex?: KnowledgeFulltextIndexWriter` 是可选项；提供后每个 indexed chunk 都会写入 `upsertKnowledgeChunk(chunk)`。
- `KnowledgeIndexingResult.sourceCount` 统计成功进入 source writer fanout 的去重 source 数；未提供 source writer 时仍会基于 indexed documents 计算该值。
- `KnowledgeIndexingResult.embeddedChunkCount` 统计交给 vector boundary 的 chunk 数。
- `KnowledgeIndexingResult.fulltextChunkCount` 统计成功交给 fulltext writer 的 chunk 数；未提供 fulltext writer 时为 `0`。
- fulltext chunk 使用 `sourceId`、`documentId`、`title`、`uri` 等已构建 metadata，且保持 JSON-safe metadata，不允许写入 provider SDK 对象。

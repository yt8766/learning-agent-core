# Knowledge Indexing 规范

状态：current
文档类型：convention
适用范围：`packages/knowledge/src/indexing/*`
最后核对：2026-04-18

## 1. 定位

`packages/knowledge/src/indexing` 是当前仓库中 RAG 离线索引链路的宿主。

它负责把原始知识内容加工成运行时可检索的数据资产，核心流程固定为：

```text
load -> transform(optional) -> filter(optional) -> chunk -> metadata build(optional) -> embed -> write -> result collect
```

这里的 `indexing` 是 pipeline orchestration 层，不是 provider SDK 封装层，也不是 runtime 检索层。

## 2. 边界

### 2.1 indexing 负责什么

- 定义知识索引流水线阶段
- 提供统一入口 `runKnowledgeIndexing`
- 提供默认 loader / chunker / mock embedder / in-memory writer
- 组织 loader、transformer、chunker、embedder、writer 的调用关系
- 统一批次、上下文、warning 汇总与结果统计

### 2.2 indexing 不负责什么

- 不负责定义跨包共享知识契约主定义
- 不负责绑定真实 embedding 模型或真实向量库
- 不负责 runtime 检索、rerank 或回答生成
- 不负责 app / backend controller 编排
- 不负责把 provider SDK 直接塞进 indexing 目录

## 3. 与其他包的关系

### 3.1 `packages/core`

稳定公共知识契约优先放在 `packages/core/src/knowledge/*`。

当前 indexing 应复用这些类型：

- `KnowledgeSource`
- `KnowledgeChunk`
- `KnowledgeSourceType`
- `KnowledgeTrustClass`

禁止在 `packages/knowledge/src/indexing` 再重复定义这些公共模型。

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
  embedders/
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
- `embedders/`
  - 定义 embedding 抽象，允许 mock 或 adapter 注入
- `writers/`
  - 将 source / chunk / vector 写入下游索引宿主
- `pipeline/`
  - 放 `runKnowledgeIndexing` 这类编排入口
- `defaults/`
  - 放默认 chunk size、batch size、default shouldIndex 等默认策略
- `types/`
  - 放 indexing 内部运行时类型，不重复定义 core stable contract

## 5. 扩展规则

后续 AI 扩展时默认遵守：

1. 新增真实文件系统 loader、飞书 loader、网页 loader 时，优先新增实现到 `packages/adapters`，这里只保留协议和 orchestration 接口。
2. 新增真实 embedding provider 时，优先新增 adapter，再由调用方把实现注入 `runKnowledgeIndexing`。
3. 新增 metadata builder、filter、retry、incremental strategy 时，优先新增独立实现点，不要持续堆叠 `if/else`。
4. 如果 indexing 子域文件继续增长，优先补 `shared/` 或 `policies/`，不要把复杂逻辑堆回 `pipeline/run-knowledge-indexing.ts`。
5. 如果未来出现稳定对外 DTO，再补 `schemas/`，并保持 schema-first。

## 6. 当前入口

当前最重要的入口文件：

- [packages/knowledge/src/indexing/index.ts](/packages/knowledge/src/indexing/index.ts)
- [packages/knowledge/src/indexing/pipeline/run-knowledge-indexing.ts](/packages/knowledge/src/indexing/pipeline/run-knowledge-indexing.ts)
- 所有规范文档统一放在 `docs/knowledge/*`，不要在 `packages/knowledge/*` 下继续新增 handoff README 或重复说明

当前默认实现：

- `StaticKnowledgeDocumentLoader`
- `FixedWindowKnowledgeChunker`
- `MockKnowledgeEmbedder`
- `InMemoryKnowledgeIndexWriter`

这些实现只用于最小闭环、测试和后续接口演进，不应被误认为生产级基础设施。

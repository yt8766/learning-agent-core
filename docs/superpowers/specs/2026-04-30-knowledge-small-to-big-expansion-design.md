# Knowledge Small-to-Big Expansion 第一阶段设计快照

状态：snapshot
文档类型：plan
适用范围：`packages/knowledge`
最后核对：2026-04-30

## 1. 背景

Small-to-Big 的目标是在检索命中 small chunk 后，为 prompt context 回补更大的上下文窗口，例如父级 chunk 或相邻 chunk。第一阶段已经接入 retrieval runtime，但只作为 context assembly 前的可选扩展 stage，不改变基础检索结果。

## 2. 当前真实实现

Pipeline 顺序为：

```text
query normalization
-> filter resolution
-> retrieval
-> defensive filtering
-> merge
-> post-process
-> context expansion
-> context assembly
```

当前实现入口：

- `packages/knowledge/src/runtime/stages/context-expander.ts`
  - 定义 `ContextExpander`、`ContextExpansionPolicy`、`ContextExpansionDiagnostics`。
- `packages/knowledge/src/retrieval/small-to-big-context-expander.ts`
  - 第一阶段 `SmallToBigContextExpander`。
- `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`
  - 在 post-processor 后、context assembler 前执行 `pipeline.contextExpander`。
- `packages/knowledge/src/repositories/knowledge-chunk.repository.ts`
  - 提供 `getByIds(ids)`，供 expander 批量读取候选 chunk。

`SmallToBigContextExpander` 从 seed hit 的 metadata 读取：

- `parentId`
- `prevChunkId`
- `nextChunkId`

读取到的候选 id 会通过 `chunkRepository.getByIds()` 回补为 chunk，再转换为 expanded hits。

## 3. Contract 与过滤语义

`KnowledgeChunkMetadataSchema` 已显式包含：

- `docType`
- `status`
- `allowedRoles`
- `parentId`
- `prevChunkId`
- `nextChunkId`
- `sectionId`
- `sectionTitle`

metadata 必须是 JSON-safe 数据，不能穿透第三方 SDK 对象、vendor response、权限 SDK 对象或 runtime 内部实例。

Context expansion 必须复用当前 request 已解析出的 resolved filters。expanded candidate 即使由 repository 返回，也需要按同一份 filters 做防御过滤；被过滤掉的数量进入 diagnostics，不允许借 parent / neighbor 回补扩大用户原始检索范围。

## 4. Result 语义

expanded hits 只用于 `contextAssembler` 输入：

- `contextBundle` 可以包含 seed hits 与 expanded hits。
- `KnowledgeRetrievalResult.hits` 保持 post-process 后的原始命中。
- `KnowledgeRetrievalResult.total` 不因为 expanded hits 增加而改变。

这保证 Small-to-Big 只增强 prompt context，不污染调用方对检索命中、排序和数量的解释。

## 5. Diagnostics

`diagnostics.contextExpansion` 记录：

- `enabled`
- `seedCount`
- `candidateCount`
- `addedCount`
- `dedupedCount`
- `missingCount`
- `droppedByFilterCount`
- `maxExpandedHits`

其中 `missingCount` 表示 metadata 指向但 repository 未返回的候选数量，`droppedByFilterCount` 表示候选 chunk 被 resolved filters 拦截的数量。

## 6. 非目标

第一阶段不实现：

- indexing / local store 自动生成 `parentId`、`prevChunkId`、`nextChunkId`、`sectionId`、`sectionTitle`。
- 章节树、标题层级解析或跨文档 parent 关系推断。
- 自动扩大 vector / keyword retrieval 召回窗口。
- 改变 `result.hits` 排序、score 或 total。
- 把 expanded hits 持久化回索引。
- 引入第三方 chunker、LangChain document 或 Chroma record 作为公共 metadata contract。

后续如果要自动生成 neighbor metadata，必须先更新 indexing contract，再补 schema、实现和回归测试。

## 7. 验证入口

- `packages/knowledge/test/small-to-big-context-expander.test.ts`
- `packages/knowledge/test/run-knowledge-retrieval.test.ts`
- `packages/knowledge/test/knowledge-chunk.repository.test.ts`
- `packages/knowledge/test/contracts-boundary.test.ts`
- `packages/knowledge/test/root-exports.test.ts`

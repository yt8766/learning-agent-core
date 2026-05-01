# Knowledge Small-to-Big Expansion 第一阶段执行记录

状态：snapshot
文档类型：plan
适用范围：`packages/knowledge`
最后核对：2026-04-30

## Goal

记录 Small-to-Big 第一阶段已经完成的最小闭环：在 retrieval runtime 中增加 context expansion stage，通过 `SmallToBigContextExpander` 基于 parent / neighbor metadata 回补 context assembly 输入，并保持 `result.hits` 不变。

## 已执行任务

- [x] 在 `KnowledgeChunkMetadataSchema` 显式增加 `parentId`、`prevChunkId`、`nextChunkId`、`sectionId`、`sectionTitle`。
- [x] 为 chunk repository 增加 `getByIds(ids)`，支持按候选 id 批量读取 parent / neighbor chunk。
- [x] 增加 `ContextExpander` runtime stage contract 与 `ContextExpansionDiagnostics`。
- [x] 实现 `SmallToBigContextExpander`，从 hit metadata 读取 parent / neighbor candidate ids。
- [x] 在 `runKnowledgeRetrieval()` 中按 `post-process -> context expansion -> context assembly` 接线。
- [x] 确保 expanded hits 只进入 `contextAssembler`，不污染 `KnowledgeRetrievalResult.hits`。
- [x] 确保 expanded candidates 复用 resolved filters，并记录 dropped / missing / deduped diagnostics。

## 当前非目标

- 不在 indexing / local store 中自动生成 neighbor metadata。
- 不改变 retrieval hit 排序、score、total 或 post-process 结果。
- 不把 expanded hits 写回索引或稳定结果列表。
- 不引入新的第三方 chunking SDK contract。

## 验证入口

代码验证入口：

- `packages/knowledge/test/small-to-big-context-expander.test.ts`
- `packages/knowledge/test/run-knowledge-retrieval.test.ts`
- `packages/knowledge/test/knowledge-chunk.repository.test.ts`
- `packages/knowledge/test/contracts-boundary.test.ts`
- `packages/knowledge/test/root-exports.test.ts`

文档验证入口：

```bash
pnpm check:docs
```

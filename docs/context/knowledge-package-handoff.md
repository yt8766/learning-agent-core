# knowledge 包交接文档

状态：current
文档类型：guide
适用范围：`packages/knowledge`
最后核对：2026-04-19

## 包定位

`packages/knowledge` 是 RAG knowledge ingestion、retrieval、citation 与 context assembly 的真实宿主。

## 当前主要目录

- `src/indexing/`
- `src/retrieval/`
- `src/repositories/`
- `src/runtime/`
- `src/contracts/`

## 修改前先读

- [docs/knowledge/README.md](/docs/knowledge/README.md)
- [docs/knowledge/indexing-package-guidelines.md](/docs/knowledge/indexing-package-guidelines.md)
- [docs/packages-overview.md](/docs/packages-overview.md)

## 改动边界

- 这里负责知识接入、检索和 citation/context 组装，不负责最终回答生成或 graph orchestration。
- 如果新增 source/chunk/index/retrieval contract，优先明确 repository 与 runtime 边界。
- 不要把 knowledge 检索逻辑重新混回 `packages/memory`。

## 验证

- `pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit`
- `pnpm --dir packages/knowledge test`
- `pnpm --dir packages/knowledge test:integration`

## 交接提醒

- 任何 citation / context assembly 调整，都可能影响上游 evidence 展示与下游回答生成，要带着联调意识改。

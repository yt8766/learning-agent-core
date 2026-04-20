# memory 包交接文档

状态：current
文档类型：guide
适用范围：`packages/memory`
最后核对：2026-04-19

## 包定位

`packages/memory` 负责 memory、rules、runtime-state repository、semantic cache 与 memory search。

## 当前主要目录

- `src/repositories/`
- `src/search/`
- `src/vector/`
- `src/embeddings/`
- `src/governance/`
- `src/normalization/`

## 修改前先读

- [docs/memory/README.md](/docs/memory/README.md)
- [docs/memory/agent-memory-architecture.md](/docs/memory/agent-memory-architecture.md)
- [docs/memory/storage-and-search.md](/docs/memory/storage-and-search.md)

## 改动边界

- 这里负责 memory 和 runtime-state，不负责 knowledge retrieval 与 chat prompt。
- 如果新增 repository 或 normalization 规则，要保证可测试、可替换、边界清晰。
- 与 knowledge 的边界要继续守住：memory 是记忆与状态，不是文档知识库。

## 验证

- `pnpm exec tsc -p packages/memory/tsconfig.json --noEmit`
- `pnpm --dir packages/memory test`
- `pnpm --dir packages/memory test:integration`

## 交接提醒

- 搜索、缓存、向量索引和治理规则改动都容易产生隐性回归，最好补最小回归用例。

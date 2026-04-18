# knowledge 文档目录

状态：current
文档类型：index
适用范围：`docs/knowledge/`
最后核对：2026-04-18

本目录用于沉淀 `packages/knowledge` 相关文档。

包边界：

- 职责：
  - RAG 知识源接入、文档标准化、chunking、索引写入、检索、重排、citation/context 组装
- 允许：
  - knowledge source / chunk repository
  - retrieval contract
  - citation contract
  - indexing / retrieval runtime
- 禁止：
  - chat / workflow 主链编排
  - 最终回答生成
  - app view model
  - provider SDK 具体实现
- 依赖方向：
  - 只依赖 `@agent/core`
  - 被 `runtime`、`agents/*` 与 backend 消费
- 公开入口：
  - 根入口：`@agent/knowledge`

约定：

- `packages/knowledge` 是知识检索宿主，不是 memory 的别名
- 稳定知识契约优先沉淀到 `packages/core/src/knowledge/*`
- 具体 provider / vector-store / loader 适配器仍放在 `packages/adapters`

当前文档：

- [indexing-package-guidelines.md](/docs/knowledge/indexing-package-guidelines.md)

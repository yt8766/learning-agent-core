# adapters 文档目录

状态：current
文档类型：index
适用范围：`docs/adapters/`
最后核对：2026-04-18

本目录用于沉淀 `packages/adapters` 相关文档。

包边界：

- 职责：
  - LLM provider adapter
  - embedding adapter
  - chat / structured generation facade
  - fallback / retry / normalize
  - 通用 prompt 基础设施
- 允许：
  - provider adapter
  - runtime provider factory
  - structured prompt helper
  - retry / fallback policy
- 禁止：
  - agent orchestration
  - graph / ministry 主逻辑
  - 业务 prompt
  - memory repository
- 依赖方向：
  - 只依赖 `@agent/config`、`@agent/core` 与必要第三方库
  - 被 `@agent/runtime`、`agents/*` 与 app 装配层消费
- 公开入口：
  - 根入口：`@agent/adapters`
- 当前真实宿主：
  - `src/runtime/chat-model-factory.ts`
  - `src/runtime/runtime-provider-factory.ts`
  - `src/embeddings/runtime-embedding-provider.ts`
  - `src/llm/llm-provider.ts`
- 边界约定：
  - `contracts/llm-provider.ts` 当前仅保留稳定 facade re-export
  - `chat/chat-model-factory.ts` 与 `llm/runtime-provider-factory.ts` 已删除
  - `chat/index.ts` 当前直接聚合到 `runtime/chat-model-factory.ts`

约定：

- `packages/adapters` 的专项文档统一放在 `docs/adapters/`
- 新增 provider、runtime factory、structured output contract 或 retry 策略后，需同步更新本目录文档

当前文档：

- [package-structure-guidelines.md](/docs/adapters/package-structure-guidelines.md)

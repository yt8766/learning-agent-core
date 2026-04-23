# adapters 文档目录

状态：current
文档类型：index
适用范围：`docs/adapters/`
最后核对：2026-05-09

本目录用于沉淀 `packages/adapters` 相关文档。

包边界：

- 职责：
  - LLM provider adapter
  - embedding adapter
  - chat / structured generation facade
  - fallback / retry / normalize
  - 通用 prompt 基础设施
  - **LangChain loader / chunker / embedder 默认 adapter**
  - **Chroma VectorStore 默认 adapter**
  - metadata / id / URL / error / retry / fallback 等边界转化
- 允许：
  - provider adapter
  - runtime provider factory
  - structured prompt helper
  - retry / fallback policy
  - 第三方生态适配（LangChain / Chroma / 未来 Pinecone / pgvector）
- 禁止：
  - agent orchestration
  - graph / ministry 主逻辑
  - 业务 prompt
  - memory repository
  - indexing pipeline 编排（由 `@agent/knowledge` 负责）
- 依赖方向：
  - 只依赖 `@agent/config`、`@agent/core` 与必要第三方库
  - 被 `@agent/runtime`、`@agent/knowledge`、`agents/*` 与 app 装配层消费

## 文档列表

- [package-structure-guidelines.md](./package-structure-guidelines.md) — 目录结构与模块规范
- [provider-extension-sdk-guidelines.md](./provider-extension-sdk-guidelines.md) — 自定义 provider 扩展指南
- [custom-provider-example.md](./custom-provider-example.md) — 自定义 provider 示例
- [indexing-adapter-guidelines.md](./indexing-adapter-guidelines.md) — LangChain / Chroma indexing adapter 规范
- [langchain-adapter.md](./langchain-adapter.md) — LangChain adapter 使用文档
- [chroma-adapter.md](./chroma-adapter.md) — Chroma VectorStore adapter 使用文档

- 公开入口：
  - 根入口：`@agent/adapters`
- 当前真实宿主：
  - `src/chat/*`
  - `src/embeddings/*`
  - `src/factories/runtime/default-runtime-llm-provider.factory.ts`
  - `src/providers/llm/*`
  - `src/contracts/llm/index.ts`
- 边界约定：
  - `contracts/llm-provider.ts` 作为稳定 compat facade 保留
  - `chat/index.ts` 与 `embeddings/index.ts` 同时承担稳定入口与对应 factory 聚合
  - `prompts/`、`retry/`、`structured-output/`、`support/` 分别承载共享提示、安全重试、结构化输出和底层支撑 helper

约定：

- `packages/adapters` 的专项文档统一放在 `docs/adapters/`
- 新增 provider、runtime factory、structured output contract 或 retry 策略后，需同步更新本目录文档

当前文档：

- [custom-provider-example.md](/docs/adapters/custom-provider-example.md)
- [package-structure-guidelines.md](/docs/adapters/package-structure-guidelines.md)
- [provider-extension-sdk-guidelines.md](/docs/adapters/provider-extension-sdk-guidelines.md)

当前最小示例：

- [packages/adapters/demo/README.md](/packages/adapters/demo/README.md)

# adapters 文档目录

状态：current
文档类型：index
适用范围：`docs/packages/adapters/`
最后核对：2026-05-02

本目录用于沉淀 `packages/adapters` 相关文档。

包边界：

- 职责：
  - LLM provider adapter
  - embedding adapter
  - chat / structured generation facade
  - fallback / retry / normalize
  - 通用 prompt 基础设施
  - metadata / id / URL / error / retry / fallback 等边界转化
- 允许：
  - provider adapter
  - runtime provider factory
  - structured prompt helper
  - retry / fallback policy
  - LLM / MCP / media 相关第三方生态适配
  - MCP provider / MCP skills 适配（MiniMax、智谱等具体供应商能力映射）
- 禁止：
  - agent orchestration
  - graph / ministry 主逻辑
  - 业务 prompt
  - memory repository
  - indexing pipeline 编排（由 `@agent/knowledge` 负责）
  - knowledge 专属 LangChain loader/chunker/embedder、Chroma、OpenSearch、Supabase pgvector 主实现
- 依赖方向：
  - 依赖 `@agent/config`、`@agent/core` 与必要第三方库
  - `src/{chroma,langchain,opensearch,supabase}` 已删除，真实实现与公开入口均迁至 `packages/knowledge/src/adapters/*`
  - 被 `@agent/runtime`、`@agent/knowledge`、`agents/*` 与 app 装配层消费

## 文档列表

- [package-structure-guidelines.md](./package-structure-guidelines.md) — 目录结构与模块规范
- [provider-extension-sdk-guidelines.md](./provider-extension-sdk-guidelines.md) — 自定义 provider 扩展指南
- [custom-provider-example.md](./custom-provider-example.md) — 自定义 provider 示例
- [indexing-adapter-guidelines.md](./indexing-adapter-guidelines.md) — 已迁移到 knowledge 的历史规范入口
- [langchain-adapter.md](./langchain-adapter.md) — 历史入口；新代码使用 `@agent/knowledge/adapters/langchain`
- [chroma-adapter.md](./chroma-adapter.md) — 历史入口；新代码使用 `@agent/knowledge/adapters/chroma`
- [opensearch-adapter.md](./opensearch-adapter.md) — 历史入口；新代码使用 `@agent/knowledge/adapters/opensearch`
- [mcp-skill-providers.md](./mcp-skill-providers.md) — MCP skills / provider adapter 规范

- 公开入口：
  - 根入口：`@agent/adapters`
- 当前真实宿主：
  - `src/openai-compatible/chat/*`、`src/minimax/chat/*`、`src/zhipu/chat/*`
  - `src/openai-compatible/embeddings/*`
  - `src/factories/runtime/default-runtime-llm-provider.factory.ts`
  - `src/openai-compatible/provider/*`、`src/anthropic/provider/*`、`src/minimax/provider/*`、`src/zhipu/provider/*`
  - `src/contracts/llm/index.ts`
- 边界约定：
  - `contracts/llm-provider.ts` 作为稳定 compat facade 保留
  - 历史 `src/chat`、`src/providers`、`src/retry`、`src/support`、`src/utils` 兼容入口已删除；新代码必须使用 provider-first 目录或根入口
  - `prompts/`、`resilience/`、`structured-output/`、`shared/` 分别承载共享提示、安全重试、结构化输出和底层支撑 helper
  - `mcp/` 后续作为 MiniMax、智谱等 MCP provider / MCP skills adapter 的真实宿主；`@agent/tools` 只保留 MCP contract、registry 与 transport runtime
  - MiniMax text provider 使用 OpenAI-compatible endpoint，但必须做 MiniMax 参数白名单：不要把 LangChain `stream_options.include_usage`、runtime `thinking` setting、OpenAI `max_tokens` 或采样 `temperature` 透传到 `/v1/chat/completions`，否则可能触发 MiniMax 400 `invalid chat setting (2013)`。MiniMax M2.7 当前使用 `max_completion_tokens`，最大值 2048；adapter 层负责把内部 `maxTokens` 映射并裁剪到该上限。即使上层传入 `temperature`，`createMiniMaxChatModel` 也会剥离该字段，保持请求体只包含当前已验证的最小 chat setting。
  - Zhipu GLM 4.6 / 4.7 / 5 默认可能先输出 reasoning tokens；direct chat 要传 `thinking: false`，由 Zhipu OpenAI-compatible adapter 映射成 `thinking: { type: "disabled" }`，避免最终 `content` 为空导致 `finalOutput.text` 校验失败。
  - 语义缓存只允许命中和写入非空文本；空字符串视为上游失败或 reasoning-only 异常结果，不能作为可复用回答返回给 chat。

约定：

- `packages/adapters` 的专项文档统一放在 `docs/packages/adapters/`
- 新增 provider、runtime factory、structured output contract 或 retry 策略后，需同步更新本目录文档
- 新增 MCP provider / MCP skills 适配时，默认落在 `packages/adapters/src/mcp/<provider>/`；不要把供应商实现长期放进 `packages/tools`

当前文档：

- [custom-provider-example.md](/docs/packages/adapters/custom-provider-example.md)
- [mcp-skill-providers.md](/docs/packages/adapters/mcp-skill-providers.md)
- [package-structure-guidelines.md](/docs/packages/adapters/package-structure-guidelines.md)
- [provider-extension-sdk-guidelines.md](/docs/packages/adapters/provider-extension-sdk-guidelines.md)

当前最小示例：

- [packages/adapters/demo/README.md](/packages/adapters/demo/README.md)

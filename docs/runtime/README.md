# runtime 文档目录

状态：current
文档类型：index
适用范围：`docs/runtime/`
最后核对：2026-04-18

本目录用于沉淀 `packages/runtime` 相关文档。

包边界：

- 职责：
  - graph wiring
  - runtime orchestration
  - session lifecycle
  - checkpoint / cancel / recover
  - governance runtime
  - runtime-facing facade
- 允许：
  - graphs
  - flows
  - session
  - governance
  - runtime facade
  - capabilities
- 禁止：
  - provider SDK 细节
  - repository 底层实现
  - tool executor 底层实现
  - app controller / view model
  - 垂直 agent 私有 prompt 与实现
- 依赖方向：
  - 依赖 `@agent/config`、`@agent/core`、`@agent/adapters`、`@agent/memory`、`@agent/tools`、`@agent/skill-runtime`
  - 当前仍存在对 `agents/*` 的编排依赖，后续应继续向 contract / registry 方向收敛
- 公开入口：
  - 根入口：`@agent/runtime`

约定：

- `packages/runtime` 的专项文档统一放在 `docs/runtime/`
- 新增 runtime facade、session 语义、governance 边界或 graph 主链宿主变化后，需同步更新本目录文档
- `runtime/llm-facade.ts` 当前作为 LLM retry / structured generation facade 的真实宿主
- `contracts/llm-facade.ts` 已删除；这类 helper 不再额外包一层 runtime contract 壳

当前文档：

- [package-structure-guidelines.md](/docs/runtime/package-structure-guidelines.md)

# agent-core 迁移历史目录

状态：current
适用范围：`docs/agent-core/`
最后核对：2026-04-15

本目录用于保留 `packages/agent-core` 已删除前后的迁移说明、历史结构、专题结论与后续 AI 接手所需上下文。

当前迁移状态：

- `packages/agent-core` 包已删除
- `runtime / session / governance` 的真实实现位于 `packages/runtime/src/*`
- `adapters/llm` 的真实实现位于 `packages/adapters/src/llm/*`
- `bootstrap / graphs/main-route / graphs/subgraph-registry / workflows / flows/supervisor` 的真实实现位于 `agents/supervisor/src/*`
- `chat / recovery / learning / main graph / approval / session / stage orchestration` 的真实实现位于 `packages/runtime/src/*`
- `data-report` 真实实现位于 `agents/data-report/src/*`
- `coder / reviewer / supervisor ministries` 真实实现位于 `agents/*/src/*`

约定：

- `agent-core` 相关历史与迁移文档统一保留在 `docs/agent-core/`
- 不再把新的 `packages/agent-core` 实现文档继续扩写到这里；当前真实实现请改写到对应宿主目录文档
- 文档优先记录：
  - 当前真实生效的链路
  - 已踩过的坑和回归约束
  - 与前端 / backend 的对接边界
  - 继续演进时不能破坏的行为

当前文档：

- [runtime-current-state.md](/Users/dev/Desktop/learning-agent-core/docs/agent-core/runtime-current-state.md)
- [data-report-json-generation-guide.md](/Users/dev/Desktop/learning-agent-core/docs/agent-core/data-report-json-generation-guide.md)
- [package-migration-status.md](/Users/dev/Desktop/learning-agent-core/docs/agent-core/package-migration-status.md)

当前用途：

- 记录迁移历史
- 保存仍有参考价值的专题实现文档
- 给后续 AI 提供“为什么当时要删包”的背景

历史归档文档：

- [agent-core-structure-report.md](/Users/dev/Desktop/learning-agent-core/docs/agent-core/archive/agent-core-structure-report.md)
- [flow-prompt-schema-optimization-report.md](/Users/dev/Desktop/learning-agent-core/docs/agent-core/archive/flow-prompt-schema-optimization-report.md)

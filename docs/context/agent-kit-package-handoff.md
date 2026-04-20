# agent-kit 包交接文档

状态：current
文档类型：guide
适用范围：`packages/agent-kit`
最后核对：2026-04-19

## 包定位

`packages/agent-kit` 是编写 Agent 的轻量 SDK，承载 AgentDescriptor、AgentRegistry、基础执行 helper 与能力声明。

## 当前主要目录

- `src/`

当前物理目录仍较扁平，后续若继续扩张，应优先按 contract / runtime helper / registry helper 等语义拆分。

## 修改前先读

- [docs/packages-overview.md](/docs/packages-overview.md)
- [docs/package-architecture-guidelines.md](/docs/package-architecture-guidelines.md)

## 改动边界

- 这里负责 Agent SDK，不负责 session、checkpoint、platform center projection。
- 这里可以定义稳定 Agent contract，但不应回收 runtime kernel 或 app 侧视图模型。
- 如果某个能力已经明显是官方装配逻辑，应优先落回 `packages/platform-runtime`。

## 验证

- `pnpm exec tsc -p packages/agent-kit/tsconfig.json --noEmit`
- `pnpm --dir packages/agent-kit test`
- `pnpm --dir packages/agent-kit test:integration`

## 交接提醒

- 新增 Agent contract 时，先考虑是否会被多个 agent / runtime / platform 共同消费。
- 只要是长期公共接口，就尽量保证命名稳定、输入输出清晰、错误语义明确。

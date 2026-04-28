# platform-runtime demo

本目录承载 `@agent/platform-runtime` 的真实最小闭环验证。

- 入口：`pnpm --filter @agent/platform-runtime demo`
- 目标：验证 default platform runtime 可注入自定义 `agentRegistry`、`agentDependencies` 与 `metadata`，未注入时保持空 registry / metadata fallback；官方 agent 装配由 backend 组合根负责。

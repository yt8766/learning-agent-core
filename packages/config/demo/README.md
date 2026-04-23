# config demo

本目录承载 `@agent/config` 的真实最小闭环验证。

- 入口：`pnpm --filter @agent/config demo`
- 目标：验证 `loadSettings(...)` 能合并 overrides、解析 profile，并生成关键 runtime 配置

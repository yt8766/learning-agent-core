# knowledge demo

本目录承载 `@agent/knowledge` 的真实最小闭环验证。

- 入口：`pnpm --filter @agent/knowledge demo`
- 目标：验证 source -> chunk -> retrieval -> citation 这一条最小知识检索路径
- 当前 demo 会额外展示默认的 query rewrite / multi-query diagnostics

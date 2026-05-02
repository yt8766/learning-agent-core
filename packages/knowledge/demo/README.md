# knowledge demo

本目录承载 `@agent/knowledge` 的真实最小闭环验证。

- 入口：`pnpm --filter @agent/knowledge demo`
- 目标：验证 source -> chunk -> retrieval -> citation 这一条最小知识检索路径
- 当前 demo 会额外展示默认的 query rewrite / multi-query diagnostics
- Knowledge adapter demo：
  - `pnpm --dir packages/knowledge exec tsx demo/langchain-default-chain.ts`
  - `pnpm --dir packages/knowledge exec tsx demo/chroma-upsert.ts`
- 近生产 fake 骨架：`pnpm --dir packages/knowledge exec tsx demo/production-ingestion-runtime-center.ts`
  - 验证 fake OpenSearch / fake Chroma -> unified retrieval -> Runtime Center -> agent-admin payload
  - 仅作为 contract rehearsal，不接真实 backend RuntimeHost、SDK client 或凭据

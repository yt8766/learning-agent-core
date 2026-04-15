# agent-server 概览

状态：current
适用范围：`apps/backend/agent-server`
最后核对：2026-04-15

`agent-server` 是平台主 API 服务，负责：

- chat 会话与 `/api/chat/stream` SSE 推流
- `/api/chat` 直连大模型 SSE 推流
- runtime / approvals / learning / evidence / connectors 治理接口
- 任务创建、审批、恢复、学习确认
- 可选的内建 background runner

## Chat 模块拆分约束

`apps/backend/agent-server/src/chat/chat.service.ts` 现在只保留会话委托、直连模式判断和 facade 级入口。

- 直连文本 / Sandpack 预览 / Sandpack 代码流转 helper 在 `apps/backend/agent-server/src/chat/chat-direct-response.helpers.ts`
- report-schema 直连链路和 artifact cache key helper 在 `apps/backend/agent-server/src/chat/chat-report-schema.helpers.ts`
- `chat.service` 相关测试按主题拆到 `apps/backend/agent-server/test/chat/chat.service.*.spec.ts`
- `apps/backend/agent-server/test/chat/chat.service.spec.ts` 只保留结构检查需要的标准入口，不再承载完整测试正文

后续如果继续扩展 chat 直连能力，优先往 helper 或同域新文件里拆，不要把大段流式生成和 schema 编排逻辑塞回 `chat.service.ts`。

## 启动

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server start:dev
```

生产构建：

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
pnpm --dir apps/backend/agent-server start:prod
```

构建约束：

- `apps/backend/agent-server/tsconfig.build.json` 必须覆盖开发态 `paths` 为 `{}`，让生产构建走 workspace 包解析，而不是继续命中 `packages/*/src`、`agents/*/src`
- `apps/backend/agent-server/tsconfig.build.json` 的生产构建应关闭 `incremental`，避免 `tsconfig.build.tsbuildinfo` 仍在但 `dist/` 已被清理时出现“`tsc` 成功、却没有任何发射产物”的假成功
- 上游 workspace 包与专项 agent 的声明产物必须固定到各自 `build/types`，运行时代码产物固定到 `build/cjs` 与 `build/esm`；`package.json` 中 `types` / `exports.types` 也必须同步指向这些真实存在的构建产物，不要把 `.d.ts/.js/.js.map` 回写到 `packages/*/src`、`agents/*/src`
- 生产构建输出应只落在 `apps/backend/agent-server/dist`
- workspace 共享包与专项 agent 通过各自已构建的包产物消费，不应由 `agent-server` 的 `tsc` 二次编译源码

## 关键环境变量

- `PORT`
- `ZHIPU_API_KEY`
- `MCP_RESEARCH_HTTP_ENDPOINT`
- `MCP_RESEARCH_HTTP_API_KEY`
- 其他 provider 变量按实际接入启用

## Runtime Background

服务默认会启动内建 background runner，用于：

- 消费 queued background tasks
- reclaim 过期 lease
- sweep interrupt timeouts
- process learning queue / scan learning conflicts

可通过以下变量切换：

- `RUNTIME_BACKGROUND_ENABLED`
- `RUNTIME_BACKGROUND_WORKER_POOL_SIZE`
- `RUNTIME_BACKGROUND_LEASE_TTL_MS`
- `RUNTIME_BACKGROUND_HEARTBEAT_MS`
- `RUNTIME_BACKGROUND_POLL_MS`
- `RUNTIME_BACKGROUND_RUNNER_ID_PREFIX`

如果使用独立 worker 模式，建议：

- backend 设置 `RUNTIME_BACKGROUND_ENABLED=false`
- `apps/worker` 保持默认启用

## 本地验证

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/backend/agent-server test:runtime
```
